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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const body = await req.json();
    const action = String(body.action ?? "verify");
    const leagueId = String(body.leagueId ?? "");
    const rosterId = Number(body.rosterId);
    const password = String(body.password ?? "");
    if (!leagueId || !Number.isInteger(rosterId) || rosterId < 1 || rosterId > 32 || password.length < 6 || password.length > 72) return json({ error: "Invalid credentials" }, 400);

    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rawBucket = `${forwarded}:${leagueId}:${rosterId}`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBucket));
    const bucket = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const now = Date.now();
    const { data: attempt } = await db.from("team_access_attempts").select("attempts,window_started_at").eq("bucket", bucket).maybeSingle();
    const started = attempt?.window_started_at ? new Date(attempt.window_started_at).getTime() : 0;
    if (attempt && now - started < 60_000 && attempt.attempts >= 12) return json({ error: "Too many attempts. Try again in a minute." }, 429);

    const { data: valid, error: verifyError } = await db.rpc("verify_team_password", { p_league_id: leagueId, p_roster_id: rosterId, p_password: password });
    if (verifyError) throw verifyError;
    if (!valid) {
      if (!attempt || now - started >= 60_000) await db.from("team_access_attempts").upsert({ bucket, attempts: 1, window_started_at: new Date().toISOString() });
      else await db.from("team_access_attempts").update({ attempts: attempt.attempts + 1 }).eq("bucket", bucket);
      return json({ ok: false, error: "Invalid team password" }, 401);
    }
    await db.from("team_access_attempts").delete().eq("bucket", bucket);

    if (action === "verify") return json({ ok: true });
    if (action === "pick-status") {
      const draftId = String(body.draftId ?? "");
      const { data, error } = await db.from("pick_requests").select("*").eq("league_id",leagueId).eq("draft_id",draftId).eq("roster_id",rosterId).order("requested_at",{ascending:false}).limit(1).maybeSingle();
      if (error) throw error;
      return json({ ok:true, request:publicRequest(data) });
    }
    if (action === "cancel-pick") {
      const requestId = Number(body.requestId);
      const { data, error } = await db.from("pick_requests").update({status:"cancelled",updated_at:new Date().toISOString(),completed_at:new Date().toISOString()}).eq("id",requestId).eq("league_id",leagueId).eq("roster_id",rosterId).eq("status","pending").select("id").maybeSingle();
      if (error) throw error;
      if (!data) return json({ ok:false,error:"The operator already started this request" },409);
      return json({ ok:true });
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
      if (turn.status !== "in_progress") return json({ok:false,error:"Sleeper has not started the draft"},409);
      if (turn.pickNo !== pickNo || turn.rosterId !== rosterId) return json({ok:false,error:"This team is not currently on the clock"},409);
      if (turn.drafted.has(playerId)) return json({ok:false,error:"That player is already drafted"},409);
      const { data: existing, error: existingError } = await db.from("pick_requests").select("*").eq("league_id",leagueId).eq("draft_id",draftId).eq("pick_no",pickNo).in("status",activeStatuses).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return json({ok:true,request:publicRequest(existing)});
      const { data, error } = await db.from("pick_requests").insert({league_id:leagueId,draft_id:draftId,pick_no:pickNo,roster_id:rosterId,player_id:playerId,player_name:playerName,position,nfl_team:nflTeam}).select().single();
      if (error) throw error;
      return json({ok:true,request:publicRequest(data)});
    }
    if (action !== "update") return json({ error: "Unsupported action" }, 400);

    const { data, error } = await db.rpc("update_team_profile", {
      p_league_id: leagueId,p_roster_id: rosterId,p_password: password,
      p_team_name: String(body.teamName ?? ""),p_accent: String(body.accent ?? ""),
      p_accent_2: String(body.accent2 ?? ""),p_panel_style: String(body.panelStyle ?? "broadcast"),
      p_motto: String(body.motto ?? ""),p_badge: String(body.badge ?? ""),
    });
    if (error) throw error;
    return json({ ok: true, profile: data });
  } catch (error) {
    console.error(error);
    return json({ error: "Team access service failed" }, 500);
  }
});
