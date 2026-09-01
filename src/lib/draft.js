export const avatarUrl = (avatar) => {
  if (!avatar) return "";
  if (avatar.startsWith("http")) return avatar;
  return `https://sleepercdn.com/avatars/thumbs/${avatar}`;
};

const DEFENSE_LOGO_KEYS = {
  ARI:"ari", ATL:"atl", BAL:"bal", BUF:"buf", CAR:"car", CHI:"chi", CIN:"cin", CLE:"cle",
  DAL:"dal", DEN:"den", DET:"det", GB:"gb", HOU:"hou", IND:"ind", JAX:"jax", KC:"kc",
  LAC:"lac", LAR:"lar", LV:"lv", MIA:"mia", MIN:"min", NE:"ne", NO:"no", NYG:"nyg",
  NYJ:"nyj", PHI:"phi", PIT:"pit", SEA:"sea", SF:"sf", TB:"tb", TEN:"ten", WAS:"wsh",
};

export const playerImage = (playerId, position) => {
  const key = String(playerId || "").toUpperCase();
  if (position === "DEF" || DEFENSE_LOGO_KEYS[key]) {
    return `https://a.espncdn.com/i/teamlogos/nfl/500/${DEFENSE_LOGO_KEYS[key] || key.toLowerCase()}.png`;
  }
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
};

export function parsePanelProfile(value = "broadcast") {
  const [style = "broadcast", intensity = "72", favorite = "custom", nameplate = "classic", encodedLogo = "", borderWidth = "2", backgroundMode = "studio", encodedBackground = ""] = String(value).split("|");
  return {
    style,
    intensity,
    favorite,
    nameplate,
    logo: encodedLogo ? decodeURIComponent(encodedLogo) : "",
    borderWidth,
    backgroundMode,
    background: encodedBackground ? decodeURIComponent(encodedBackground) : "",
  };
}

export const profileLogo = (profile) => {
  const parsed = parsePanelProfile(profile?.panel_style);
  return parsed.logo || (parsed.favorite !== "custom" ? `https://a.espncdn.com/i/teamlogos/nfl/500/${parsed.favorite}.png` : "");
};

export function orderedMembers(draft, members) {
  return [...members].sort(
    (a, b) =>
      draftSlotForMember(draft, a) - draftSlotForMember(draft, b),
  );
}

export function draftSlotForMember(draft, member) {
  return Number(draft?.draftOrder?.[member?.userId] ?? member?.rosterId ?? 0);
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
