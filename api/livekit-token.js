import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";

const json = (res, status, body) => {
  res.setHeader("cache-control", "no-store");
  res.status(status).json(body);
};

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res,405,{error:"POST required"});
  const serverUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!serverUrl || !apiKey || !apiSecret) return json(res,503,{configured:false,error:"Live camera relay is not configured yet"});

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const leagueId = String(body.leagueId || process.env.SLEEPER_LEAGUE_ID || "");
  const expectedLeague = String(process.env.SLEEPER_LEAGUE_ID || "1398145266615345152");
  const role = body.role === "owner" ? "owner" : "viewer";
  if (leagueId !== expectedLeague) return json(res,400,{error:"Invalid league"});
  const room = `draft-${leagueId}`;
  let identity = `viewer-${crypto.randomUUID()}`;
  let metadata = JSON.stringify({role:"viewer"});
  let name = "Draft viewer";

  if (role === "owner") {
    const rosterId = Number(body.rosterId);
    if (!Number.isInteger(rosterId) || rosterId < 1 || rosterId > 32) return json(res,400,{error:"Valid roster ID required"});
    const supabaseUrl = process.env.SUPABASE_URL || "https://iimmjxnjkkzejwgxofsk.supabase.co";
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_UPTYCbZFE3ZN5P6GdS0ZcQ_LCntNs7k";
    const teamToken = String(req.headers["x-team-access-token"] || "");
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i,"") || "";
    let authorized = false;let identitySuffix = crypto.randomUUID().slice(0,8);
    if (teamToken) {
      const accessResponse = await fetch(`${supabaseUrl}/functions/v1/team-access`,{method:"POST",headers:{"content-type":"application/json",apikey:publishableKey,"x-team-access-token":teamToken},body:JSON.stringify({action:"session",leagueId,rosterId})});
      const accessData = await accessResponse.json().catch(() => ({}));
      authorized = accessResponse.ok && accessData.ok;
    }
    if (!authorized && bearer) {
      const db = createClient(supabaseUrl,publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${bearer}`}}});
      const {data:userData,error:userError} = await db.auth.getUser(bearer);
      if (!userError && userData.user) {
        const {data:commissioner} = await db.from("commissioners").select("user_id").eq("user_id",userData.user.id).maybeSingle();
        authorized = Boolean(commissioner);identitySuffix = userData.user.id.slice(0,8);
      }
    }
    if (!authorized) return json(res,401,{error:"Team session expired. Enter the team password again."});
    identity = `team-${rosterId}-${identitySuffix}`;
    metadata = JSON.stringify({role:"owner",rosterId});
    name = `Team ${rosterId}`;
  }

  const token = new AccessToken(apiKey,apiSecret,{identity,name,metadata,ttl:"2h"});
  token.addGrant({
    room, roomJoin:true, canSubscribe:role === "viewer", canPublish:role === "owner",
    canPublishData:false, ...(role === "owner" ? {canPublishSources:["camera","microphone"]} : {}),
  });
  return json(res,200,{configured:true,serverUrl,token:await token.toJwt(),room,role});
}
