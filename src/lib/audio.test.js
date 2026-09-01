import { describe, expect, it } from "vitest";
import { announcementCue, isDraftComplete, isDraftLive } from "./audio";

describe("draft audio helpers", () => {
  it("selects explicit and inferred announcement cues", () => {
    expect(announcementCue({ type:"announcement" })).toBe("announcement");
    expect(announcementCue({ type:"round" })).toBe("round-break");
    expect(announcementCue({ type:"trade", sound:"alert" })).toBe("alert");
    expect(announcementCue({ type:"trade" })).toBe("trade");
    expect(announcementCue({ type:"celebration", sound:"fanfare" })).toBe("celebration");
    expect(announcementCue({ type:"trade", sound:"none" })).toBeNull();
  });

  it("recognizes Sleeper completion variants", () => {
    expect(isDraftComplete("complete")).toBe(true);
    expect(isDraftComplete("draft_complete")).toBe(true);
    expect(isDraftComplete("in_progress")).toBe(false);
  });

  it("recognizes Sleeper and internal active-draft statuses", () => {
    expect(isDraftLive("drafting")).toBe(true);
    expect(isDraftLive("in_progress")).toBe(true);
    expect(isDraftLive("pre_draft")).toBe(false);
  });
});
