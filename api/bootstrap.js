import { normalizeDraft, normalizePlayer, send, sleeper, validLeague } from "./_sleeper.js";

const NFL_TEAMS = {
  ARI:"Arizona Cardinals", ATL:"Atlanta Falcons", BAL:"Baltimore Ravens", BUF:"Buffalo Bills",
  CAR:"Carolina Panthers", CHI:"Chicago Bears", CIN:"Cincinnati Bengals", CLE:"Cleveland Browns",
  DAL:"Dallas Cowboys", DEN:"Denver Broncos", DET:"Detroit Lions", GB:"Green Bay Packers",
  HOU:"Houston Texans", IND:"Indianapolis Colts", JAX:"Jacksonville Jaguars", KC:"Kansas City Chiefs",
  LAC:"Los Angeles Chargers", LAR:"Los Angeles Rams", LV:"Las Vegas Raiders", MIA:"Miami Dolphins",
  MIN:"Minnesota Vikings", NE:"New England Patriots", NO:"New Orleans Saints", NYG:"New York Giants",
  NYJ:"New York Jets", PHI:"Philadelphia Eagles", PIT:"Pittsburgh Steelers", SEA:"Seattle Seahawks",
  SF:"San Francisco 49ers", TB:"Tampa Bay Buccaneers", TEN:"Tennessee Titans", WAS:"Washington Commanders",
};

export default async function handler(req, res) {
  const leagueId = String(req.query.leagueId || process.env.SLEEPER_LEAGUE_ID || "");
  if (!validLeague(leagueId)) return send(res, 400, { error: "A valid Sleeper league ID is required" }, "no-store");
  try {
    const [leagueRaw, usersRaw, rostersRaw, draftsRaw, playersRaw] = await Promise.all([
      sleeper(`/league/${leagueId}`),
      sleeper(`/league/${leagueId}/users`),
      sleeper(`/league/${leagueId}/rosters`),
      sleeper(`/league/${leagueId}/drafts`),
      sleeper("/players/nfl"),
    ]);
    const draftRaw = [...draftsRaw].sort((a, b) => Number(b.created || 0) - Number(a.created || 0))[0];
    if (!draftRaw) throw new Error("No Sleeper draft exists for this league");
    const rosterByOwner = new Map(rostersRaw.map((roster) => [roster.owner_id, roster.roster_id]));
    const members = usersRaw.map((user) => ({
      userId: user.user_id,
      displayName: user.display_name || "Owner",
      teamName: user.metadata?.team_name || user.display_name || "Team",
      avatar: user.avatar || "",
      rosterId: Number(rosterByOwner.get(user.user_id) || 0),
    })).filter((member) => member.rosterId).sort((a, b) => a.rosterId - b.rosterId);
    const eligible = Object.entries(playersRaw)
      .filter(([, player]) => ["QB", "RB", "WR", "TE", "K", "DEF"].includes(player.position) && player.search_rank != null)
      .sort(([, a], [, b]) => Number(a.search_rank) - Number(b.search_rank));
    const skill = eligible.filter(([, player]) => player.position !== "DEF").slice(0, 468);
    const players = skill.map(([id, player], index) => normalizePlayer(id, player, index + 1));
    for (const [team, name] of Object.entries(NFL_TEAMS)) {
      players.push(normalizePlayer(team, { full_name: `${name} D/ST`, position: "DEF", team, search_rank: 700 + players.length, status: "Active", fantasy_positions: ["DEF"] }, players.length + 1));
    }
    return send(res, 200, {
      league: {
        leagueId: leagueRaw.league_id,
        name: leagueRaw.name,
        status: leagueRaw.status,
        season: leagueRaw.season,
        rosterPositions: leagueRaw.roster_positions || [],
        totalRosters: Number(leagueRaw.total_rosters || members.length),
      },
      draft: normalizeDraft(draftRaw),
      members,
      players,
      fetchedAt: Date.now(),
    }, "public, s-maxage=300, stale-while-revalidate=3600");
  } catch (error) {
    return send(res, 502, { error: error instanceof Error ? error.message : "Sleeper bootstrap failed" }, "no-store");
  }
}
