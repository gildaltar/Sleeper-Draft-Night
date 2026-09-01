import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const activeStatuses = ["pending", "processing", "submitted"];
const publicRequest = (row: Record<string, unknown> | null) => row ? {
  id:row.id,status:row.status,pick_no:row.pick_no,roster_id:row.roster_id,player_id:row.player_id,
  player_name:row.player_name,position:row.position,nfl_team:row.nfl_team,requested_at:row.requested_at,
  operator_note:row.operator_note,official_pick_no:row.official_pick_no,
} : null;

async function currentSleeperTurn(leagueId: string, draftId: string) {
  const [draftResponse, picksResponse, rostersResponse] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/draft/${draftId}`),
    fetch(`https://api.sleeper.app/v1/draft/${draftId}/picks`),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
  ]);
  if (!draftResponse.ok || !picksResponse.ok || !rostersResponse.ok) throw new Error("Sleeper verification unavailable");
  const [draft, picks, rosters] = await Promise.all([draftResponse.json(),picksResponse.json(),rostersResponse.json()]);
  if (String(draft.league_id) !== leagueId || String(draft.draft_id) !== draftId) throw new Error("Draft does not belong to this league");
  const pickNo = picks.length + 1;
  const teams = Number(draft.settings?.teams || 0);
  const round = Math.ceil(pickNo / teams);
  const position = (pickNo - 1) % teams;
  const slot = round % 2 === 0 ? teams - position : position + 1;
  const ownerId = Object.entries(draft.draft_order || {}).find(([,value]) => Number(value) === slot)?.[0];
  const roster = rosters.find((item: Record<string, unknown>) => String(item.owner_id) === String(ownerId));
  return { status:String(draft.status), pickNo, rosterId:Number(roster?.roster_id || 0), drafted:new Set(picks.map((pick: Record<string, unknown>) => String(pick.player_id))) };
}

async function rateLimitedPasswordCheck(db: ReturnType<typeof createClient>, req: Request, leagueId: string, rosterId: number, password: string) {
  if (password.length < 6 || password.length > 72) return false;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rawBucket = `${forwarded}:${leagueId}:${rosterId}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBucket));
  const bucket = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  const { data:attempt } = await db.from("team_access_attempts").select("attempts,window_started_at").eq("bucket",bucket).maybeSingle();
  const started = attempt?.window_started_at ? new Date(attempt.window_started_at).getTime() : 0;
  if (attempt && now - started < 60_000 && attempt.attempts >= 12) throw new Error("Too many attempts. Try again in a minute.");
  const { data:valid, error } = await db.rpc("verify_team_password", { p_league_id:leagueId,p_roster_id:rosterId,p_password:password });
  if (error) throw error;
  if (!valid) {
    if (!attempt || now - started >= 60_000) await db.from("team_access_attempts").upsert({bucket,attempts:1,window_started_at:new Date().toISOString()});
    else await db.from("team_access_attempts").update({attempts:attempt.attempts + 1}).eq("bucket",bucket);
    return false;
  }
  await db.from("team_access_attempts").delete().eq("bucket",bucket);
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:cors});
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const body = await req.json();
    const action = String(body.action ?? "session");
    const leagueId = String(body.leagueId ?? "");
    const rosterId = Number(body.rosterId);
    if (!leagueId || !Number.isInteger(rosterId) || rosterId < 1 || rosterId > 32) return json({error:"Invalid team"},400);

    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i,"") || "";
    const { data:authData } = bearer ? await db.auth.getUser(bearer) : {data:{user:null}};
    const user = authData.user;
    if (!user) return json({ok:false,error:"Sign in with the team owner's email first"},401);

    const [{data:membership},{data:commissioner}] = await Promise.all([
      db.from("team_owner_memberships").select("league_id,roster_id,user_id,owner_email,claimed_at").eq("league_id",leagueId).eq("roster_id",rosterId).maybeSingle(),
      db.from("commissioners").select("user_id").eq("user_id",user.id).maybeSingle(),
    ]);
    const ownerAuthorized = Boolean(commissioner || membership?.user_id === user.id);

    if (action === "set-claim-code" || action === "revoke-owner") {
      if (!commissioner) return json({ok:false,error:"Commissioner access required"},403);
      if (action === "set-claim-code") {
        const password = String(body.password ?? "");
        if (password.length < 6 || password.length > 72) return json({ok:false,error:"Claim code must be 6–72 characters"},400);
        const {error} = await db.rpc("set_team_password",{p_league_id:leagueId,p_roster_id:rosterId,p_password:password});
        if (error) throw error;
        return json({ok:true});
      }
      const {error} = await db.from("team_owner_memberships").delete().eq("league_id",leagueId).eq("roster_id",rosterId);
      if (error) throw error;
      return json({ok:true});
    }

    if (action === "claim") {
      if (membership && membership.user_id !== user.id && !commissioner) return json({ok:false,error:"This team has already been claimed. Ask the commissioner to reset its owner."},409);
      const valid = await rateLimitedPasswordCheck(db,req,leagueId,rosterId,String(body.password ?? ""));
      if (!valid) return json({ok:false,error:"Invalid team claim code"},401);
      const {data:existingClaim} = await db.from("team_owner_memberships").select("roster_id").eq("league_id",leagueId).eq("user_id",user.id).maybeSingle();
      if (existingClaim && Number(existingClaim.roster_id) !== rosterId && !commissioner) return json({ok:false,error:"This account already owns another team in this league"},409);
      const {error} = await db.from("team_owner_memberships").upsert({
        league_id:leagueId,roster_id:rosterId,user_id:user.id,
        owner_email:String(user.email || "owner@invalid.local").toLowerCase(),updated_at:new Date().toISOString(),
      },{onConflict:"league_id,roster_id"});
      if (error) throw error;
      return json({ok:true,membership:{league_id:leagueId,roster_id:rosterId,owner_email:user.email}});
    }

    if (!ownerAuthorized) return json({ok:false,error:"This signed-in account does not own this team"},403);
    if (action === "session" || action === "verify") return json({ok:true,membership,commissioner:Boolean(commissioner)});

    if (action === "pick-status") {
      const draftId = String(body.draftId ?? "");
      const {data,error} = await db.from("pick_requests").select("*").eq("league_id",leagueId).eq("draft_id",draftId).eq("roster_id",rosterId).order("requested_at",{ascending:false}).limit(1).maybeSingle();
      if (error) throw error;
      return json({ok:true,request:publicRequest(data)});
    }
    if (action === "cancel-pick") {
      const requestId = Number(body.requestId);
      const {data,error} = await db.from("pick_requests").update({status:"cancelled",updated_at:new Date().toISOString(),completed_at:new Date().toISOString()}).eq("id",requestId).eq("league_id",leagueId).eq("roster_id",rosterId).eq("status","pending").select("id").maybeSingle();
      if (error) throw error;
      if (!data) return json({ok:false,error:"The operator already started this request"},409);
      return json({ok:true});
    }
    if (action === "submit-pick") {
      const draftId = String(body.draftId ?? "");
      const pickNo = Number(body.pickNo);
      const playerId = String(body.playerId ?? "").slice(0,32);
      const playerName = String(body.playerName ?? "").trim().slice(0,96);
      const position = String(body.position ?? "");
      const nflTeam = String(body.nflTeam || "FA").toUpperCase().slice(0,4);
      if (!/^\d{10,24}$/.test(draftId) || !Number.isInteger(pickNo) || !playerId || !playerName || !["QB","RB","WR","TE","K","DEF"].includes(position)) return json({ok:false,error:"Invalid pick request"},400);
      const turn = await currentSleeperTurn(leagueId,draftId);
      if (!["drafting","in_progress"].includes(turn.status)) return json({ok:false,error:"Sleeper has not started the draft"},409);
      if (turn.pickNo !== pickNo || turn.rosterId !== rosterId) return json({ok:false,error:"This team is not currently on the clock"},409);
      if (turn.drafted.has(playerId)) return json({ok:false,error:"That player is already drafted"},409);
      const {data:existing,error:existingError} = await db.from("pick_requests").select("*").eq("league_id",leagueId).eq("draft_id",draftId).eq("pick_no",pickNo).in("status",activeStatuses).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return json({ok:true,request:publicRequest(existing)});
      const {data,error} = await db.from("pick_requests").insert({league_id:leagueId,draft_id:draftId,pick_no:pickNo,roster_id:rosterId,player_id:playerId,player_name:playerName,position,nfl_team:nflTeam}).select().single();
      if (error) throw error;
      return json({ok:true,request:publicRequest(data)});
    }
    if (action !== "update") return json({error:"Unsupported action"},400);

    const teamName = String(body.teamName ?? "").trim().slice(0,36);
    const accent = String(body.accent ?? "");
    const accent2 = String(body.accent2 ?? "");
    const panelStyle = String(body.panelStyle ?? "broadcast");
    const styleName = panelStyle.split("|")[0];
    if (!/^#[0-9a-f]{6}$/i.test(accent) || !/^#[0-9a-f]{6}$/i.test(accent2)) return json({ok:false,error:"Invalid team color"},400);
    if (!["broadcast","neon","championship","rivalry","carbon","grid","clean"].includes(styleName) || panelStyle.length > 180000) return json({ok:false,error:"Invalid frame style"},400);
    const {data,error} = await db.from("team_profiles").update({
      team_name:teamName,accent,accent_2:accent2,panel_style:panelStyle,
      motto:String(body.motto ?? "").trim().slice(0,64),badge:String(body.badge ?? "").trim().slice(0,18),updated_at:new Date().toISOString(),
    }).eq("league_id",leagueId).eq("roster_id",rosterId).select("league_id,roster_id,display_name,team_name,accent,accent_2,panel_style,motto,badge,updated_at").single();
    if (error) throw error;
    await db.from("broadcast_state").update({updated_at:new Date().toISOString()}).eq("league_id",leagueId);
    return json({ok:true,profile:data});
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Team access service failed";
    if (message.startsWith("Too many attempts")) return json({ok:false,error:message},429);
    return json({error:"Team access service failed"},500);
  }
});
