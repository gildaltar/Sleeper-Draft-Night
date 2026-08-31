import { SignJWT } from "jose";

const json = (res, status, body) => {
  res.setHeader("cache-control", "no-store");
  res.status(status).json(body);
};

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "POST required" });
  const key = process.env.ZOOM_VIDEO_SDK_KEY || process.env.ZOOM_SDK_KEY;
  const secret = process.env.ZOOM_VIDEO_SDK_SECRET || process.env.ZOOM_SDK_SECRET;
  const topic = process.env.ZOOM_VIDEO_SDK_TOPIC || process.env.ZOOM_TOPIC || "Stroudy Draft Night";
  if (!key || !secret) return json(res, 503, { configured: false, error: "Team cameras are not configured" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const participantType = ["display", "owner", "spectator"].includes(body.participantType) ? body.participantType : "spectator";
  const rosterId = Number(body.rosterId);
  if (participantType === "owner" && (!Number.isInteger(rosterId) || rosterId < 1 || rosterId > 32)) return json(res, 400, { error: "Valid roster ID required" });
  if (participantType === "owner") {
    const supabaseUrl = process.env.SUPABASE_URL || "https://iimmjxnjkkzejwgxofsk.supabase.co";
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_UPTYCbZFE3ZN5P6GdS0ZcQ_LCntNs7k";
    const access = await fetch(`${supabaseUrl}/functions/v1/team-access`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: publishableKey, authorization: `Bearer ${publishableKey}` },
      body: JSON.stringify({ action: "verify", leagueId: process.env.SLEEPER_LEAGUE_ID || "1398145266615345152", rosterId, password: body.password }),
    });
    const result = await access.json().catch(() => ({}));
    if (!access.ok || !result.ok) return json(res, 401, { error: "Team password verification required" });
  }
  const now = Math.floor(Date.now() / 1000) - 30;
  const userKey = participantType === "owner" ? `team-owner-${rosterId}` : `${participantType}-${String(body.instanceId || crypto.randomUUID()).slice(0, 64)}`;
  const token = await new SignJWT({
    app_key: key,
    tpc: topic,
    role_type: participantType === "display" ? 1 : 0,
    user_identity: userKey,
    user_key: userKey,
    video_webrtc_mode: 1,
    audio_webrtc_mode: 1,
    version: 1,
  }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt(now).setExpirationTime(now + 7200).sign(new TextEncoder().encode(secret));
  return json(res, 200, { configured: true, token, topic, participantType });
}
