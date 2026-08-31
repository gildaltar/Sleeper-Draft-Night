import { describe, expect, it } from "vitest";
import { memberForPick, nextMockPick, rosterNeeds, roundAndPick } from "./draft";

const members = Array.from({ length: 6 }, (_, index) => ({ userId: `u${index + 1}`, rosterId: index + 1, teamName: `Team ${index + 1}` }));
const draft = { settings: { teams: 6, rounds: 22 }, draftOrder: Object.fromEntries(members.map((member) => [member.userId, member.rosterId])) };

describe("snake draft order", () => {
  it("reverses cleanly in round two", () => {
    expect(memberForPick(1, draft, members).rosterId).toBe(1);
    expect(memberForPick(6, draft, members).rosterId).toBe(6);
    expect(memberForPick(7, draft, members).rosterId).toBe(6);
    expect(memberForPick(12, draft, members).rosterId).toBe(1);
    expect(memberForPick(13, draft, members).rosterId).toBe(1);
  });

  it("creates synchronized, unique mock picks", () => {
    const players = Array.from({ length: 132 }, (_, index) => ({ playerId: String(index), name: `Player ${index}`, position: "WR" }));
    const picks = [];
    for (let index = 0; index < 20; index += 1) picks.push(nextMockPick({ draft, members, players, picks }));
    expect(picks.map((pick) => pick.player.playerId)).toEqual(Array.from({ length: 20 }, (_, index) => String(index)));
    expect(picks[6].rosterId).toBe(6);
    expect(picks[11].rosterId).toBe(1);
  });
});

describe("draft helpers", () => {
  it("reports the correct round and slot", () => expect(roundAndPick(14, 6)).toEqual({ round: 3, slot: 2 }));
  it("consumes direct and flex roster needs", () => {
    const league = { rosterPositions: ["QB", "RB", "WR", "FLEX", "SUPER_FLEX", "BN"] };
    const picks = [
      { rosterId: 1, player: { position: "RB" } },
      { rosterId: 1, player: { position: "WR" } },
      { rosterId: 1, player: { position: "TE" } },
    ];
    expect(rosterNeeds(league, picks, 1)).toEqual([["QB", 1], ["Q/W/R/T", 1]]);
  });
});
