import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTeamSession, getTeamSessionToken, hasTeamSession } from "./teamAccess";

const values = new Map();

describe("team password session storage", () => {
  beforeEach(() => {
    values.clear();
    vi.stubGlobal("window",{localStorage:{getItem:(key) => values.get(key) || null,setItem:(key,value) => values.set(key,value),removeItem:(key) => values.delete(key)}});
  });

  it("isolates saved sessions by team", () => {
    window.localStorage.setItem("sdn-team-password-session-v1-1398145266615345152-2","team-two-token");
    expect(hasTeamSession(2)).toBe(true);
    expect(getTeamSessionToken(2)).toBe("team-two-token");
    expect(hasTeamSession(3)).toBe(false);
  });

  it("fully signs a team out on this browser", () => {
    window.localStorage.setItem("sdn-team-password-session-v1-1398145266615345152-2","team-two-token");
    clearTeamSession(2);
    expect(hasTeamSession(2)).toBe(false);
    expect(getTeamSessionToken(2)).toBe("");
  });
});
