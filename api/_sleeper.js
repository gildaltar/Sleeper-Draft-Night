const API = "https://api.sleeper.app/v1";

export async function sleeper(path) {
  const response = await fetch(`${API}${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Sleeper ${path} returned ${response.status}`);
  return response.json();
}

export function send(res, status, body, cache = "public, s-maxage=1, stale-while-revalidate=20") {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", cache);
  res.status(status).json(body);
}

export function validLeague(value) {
  return /^\d{10,24}$/.test(String(value || ""));
}

export function normalizeDraft(raw) {
  return {
    draftId: raw.draft_id,
    status: raw.status === "drafting" ? "in_progress" : raw.status,
    type: raw.type,
    startTime: raw.start_time,
    lastPicked: raw.last_picked,
    settings: {
      teams: Number(raw.settings?.teams || 0),
      rounds: Number(raw.settings?.rounds || 0),
      pickTimer: Number(raw.settings?.pick_timer || 0),
    },
    slotToRosterId: raw.slot_to_roster_id || {},
    draftOrder: raw.draft_order || {},
    metadata: { scoringType: raw.metadata?.scoring_type, name: raw.metadata?.name },
  };
}

export function normalizePlayer(playerId, raw, rank) {
  const position = raw.position === "DEF" ? "DEF" : raw.position;
  return {
    playerId: String(playerId),
    name: raw.full_name || (position === "DEF" ? `${raw.first_name || raw.team} D/ST` : [raw.first_name, raw.last_name].filter(Boolean).join(" ")),
    position,
    team: raw.team || (position === "DEF" ? playerId : "FA"),
    searchRank: Number(raw.search_rank ?? 9999),
    status: raw.status || "Active",
    age: raw.age ?? null,
    college: raw.college ?? null,
    yearsExp: raw.years_exp ?? null,
    injuryStatus: raw.injury_status ?? null,
    height: raw.height ?? null,
    weight: raw.weight ?? null,
    fantasyPositions: raw.fantasy_positions || (position ? [position] : []),
    rank,
  };
}

export function normalizePick(raw, players = {}) {
  const meta = raw.metadata || {};
  const playerId = String(raw.player_id || "");
  const source = players[playerId] || {};
  return {
    pickNo: Number(raw.pick_no),
    round: Number(raw.round),
    draftSlot: Number(raw.draft_slot),
    rosterId: Number(raw.roster_id),
    pickedBy: raw.picked_by,
    player: normalizePlayer(playerId, {
      ...source,
      full_name: meta.first_name || meta.last_name ? [meta.first_name, meta.last_name].filter(Boolean).join(" ") : source.full_name,
      position: meta.position || source.position,
      team: meta.team || source.team,
    }, Number(raw.pick_no)),
  };
}
