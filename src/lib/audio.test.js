import { describe, expect, it } from "vitest";
import { announcementCue, appleMusicSongId, isDraftComplete, normalizeAppleMusicTrackUrl, normalizeSpotifyTrackUrl } from "./audio";

describe("draft audio helpers", () => {
  it("normalizes Spotify track links and strips tracking parameters", () => {
    expect(normalizeSpotifyTrackUrl("https://open.spotify.com/track/2nLtzopw4rPReszdYBJU6h?si=abc")).toBe("https://open.spotify.com/track/2nLtzopw4rPReszdYBJU6h");
    expect(normalizeSpotifyTrackUrl("https://open.spotify.com/intl-de/embed/track/2nLtzopw4rPReszdYBJU6h")).toBe("https://open.spotify.com/track/2nLtzopw4rPReszdYBJU6h");
  });

  it("normalizes Apple Music song and album-track links", () => {
    expect(appleMusicSongId("https://music.apple.com/us/song/numb/116255495?uo=4")).toBe("116255495");
    expect(appleMusicSongId("https://music.apple.com/us/album/meteora/116255348?i=116255495&ls=1")).toBe("116255495");
    expect(normalizeAppleMusicTrackUrl("https://music.apple.com/us/song/numb/116255495?uo=4")).toBe("https://music.apple.com/us/song/numb/116255495");
    expect(normalizeAppleMusicTrackUrl("https://music.apple.com/us/playlist/example/pl.abc")).toBeNull();
  });

  it("rejects links that cannot participate in the automatic queue", () => {
    expect(normalizeSpotifyTrackUrl("https://music.apple.com/us/song/numb/528437514")).toBeNull();
    expect(normalizeSpotifyTrackUrl("https://open.spotify.com/playlist/abc")).toBeNull();
    expect(normalizeSpotifyTrackUrl("javascript:alert(1)")).toBeNull();
  });

  it("selects explicit and inferred announcement cues", () => {
    expect(announcementCue({ type:"announcement" })).toBe("announcement");
    expect(announcementCue({ type:"round" })).toBe("fanfare");
    expect(announcementCue({ type:"trade", sound:"alert" })).toBe("alert");
    expect(announcementCue({ type:"trade", sound:"none" })).toBeNull();
  });

  it("recognizes Sleeper completion variants", () => {
    expect(isDraftComplete("complete")).toBe(true);
    expect(isDraftComplete("draft_complete")).toBe(true);
    expect(isDraftComplete("in_progress")).toBe(false);
  });
});
