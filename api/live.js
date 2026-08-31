import { normalizeDraft, normalizePick, send, sleeper, validLeague } from "./_sleeper.js";

export default async function handler(req, res) {
  const leagueId = String(req.query.leagueId || process.env.SLEEPER_LEAGUE_ID || "");
  if (!validLeague(leagueId)) return send(res, 400, { error: "A valid Sleeper league ID is required" }, "no-store");
  try {
    const drafts = await sleeper(`/league/${leagueId}/drafts`);
    const raw = [...drafts].sort((a, b) => Number(b.created || 0) - Number(a.created || 0))[0];
    if (!raw) throw new Error("No Sleeper draft exists for this league");
    const picks = await sleeper(`/draft/${raw.draft_id}/picks`);
    return send(res, 200, { draft: normalizeDraft(raw), picks: picks.map((pick) => normalizePick(pick)), fetchedAt: Date.now() });
  } catch (error) {
    return send(res, 502, { error: error instanceof Error ? error.message : "Sleeper live feed failed" }, "no-store");
  }
}
