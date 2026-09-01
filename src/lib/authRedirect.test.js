import { describe, expect, it } from "vitest";
import { ownerMagicLinkRedirect, ownerTeamPath } from "./authRedirect";

describe("team owner auth redirects", () => {
  it("always returns email links to the live callback instead of localhost", () => {
    expect(ownerMagicLinkRedirect(7)).toBe("https://sleeper-draft-night-dashboard.vercel.app/auth/callback?team=7");
    expect(ownerMagicLinkRedirect(7)).not.toContain("localhost");
  });

  it("preserves the intended team after authentication", () => {
    expect(ownerTeamPath(7)).toBe("/team?team=7");
  });
});
