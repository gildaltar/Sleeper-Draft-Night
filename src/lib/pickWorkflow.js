export function reconcilePickRequest(request,picks = []) {
  if (!request) return null;
  const official = picks.find((pick) => Number(pick.pickNo) === Number(request.pick_no));
  if (!official) return null;
  const matches = String(official.player?.playerId) === String(request.player_id);
  return {
    status:matches ? "confirmed" : "rejected",
    official_pick_no:official.pickNo,
    operator_note:matches ? "Verified against the official Sleeper feed." : `Sleeper recorded ${official.player?.name || "a different player"} at this pick.`,
  };
}
