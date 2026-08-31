export const avatarUrl = (avatar) => {
  if (!avatar) return "";
  if (avatar.startsWith("http")) return avatar;
  return `https://sleepercdn.com/avatars/thumbs/${avatar}`;
};

export const playerImage = (playerId) =>
  `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;

export function orderedMembers(draft, members) {
  return [...members].sort(
    (a, b) =>
      Number(draft?.draftOrder?.[a.userId] ?? a.rosterId) -
      Number(draft?.draftOrder?.[b.userId] ?? b.rosterId),
  );
}

export function memberForPick(pickNo, draft, members) {
  const order = orderedMembers(draft, members);
  if (!order.length) return null;
  const round = Math.ceil(pickNo / order.length);
  const index = (pickNo - 1) % order.length;
  return round % 2 === 0 ? order[order.length - 1 - index] : order[index];
}

export function nextMockPick({ draft, members, players, picks }) {
  const pickNo = picks.length + 1;
  const total = Number(draft?.settings?.teams || members.length) * Number(draft?.settings?.rounds || 1);
  if (pickNo > total) return null;
  const picked = new Set(picks.map((pick) => pick.player?.playerId));
  const player = players.find((candidate) => !picked.has(candidate.playerId));
  const member = memberForPick(pickNo, draft, members);
  if (!player || !member) return null;
  return {
    pickNo,
    round: Math.ceil(pickNo / members.length),
    draftSlot: Number(draft.draftOrder?.[member.userId] ?? member.rosterId),
    rosterId: member.rosterId,
    pickedBy: member.userId,
    pickedAt: Date.now(),
    player,
  };
}

const slotLabel = (slot) =>
  slot === "FLEX" ? "W/R/T" : slot === "SUPER_FLEX" ? "Q/W/R/T" : slot;

export function rosterNeeds(league, picks, rosterId) {
  const drafted = picks.filter((pick) => Number(pick.rosterId) === Number(rosterId));
  const remaining = (league?.rosterPositions || []).filter((slot) => slot !== "BN");
  for (const pick of drafted) {
    const position = pick.player?.position;
    let index = remaining.findIndex((slot) => slot === position);
    if (index < 0 && ["RB", "WR", "TE"].includes(position)) index = remaining.indexOf("FLEX");
    if (index < 0 && ["QB", "RB", "WR", "TE"].includes(position)) index = remaining.indexOf("SUPER_FLEX");
    if (index >= 0) remaining.splice(index, 1);
  }
  const counts = remaining.reduce((result, slot) => {
    const label = slotLabel(slot);
    result[label] = (result[label] || 0) + 1;
    return result;
  }, {});
  return Object.entries(counts);
}

export const roundAndPick = (pickNo, teams) => ({
  round: Math.ceil(pickNo / teams),
  slot: ((pickNo - 1) % teams) + 1,
});
