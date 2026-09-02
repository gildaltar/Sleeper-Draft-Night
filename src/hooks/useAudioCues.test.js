import { describe, expect, it } from "vitest";
import { audioFileMimeType, eventAudioMaxSeconds } from "./useAudioCues";

describe("event audio upload safeguards", () => {
  it("normalizes common Windows audio files when the browser omits their MIME type", () => {
    expect(audioFileMimeType({name:"pick-in.MP3",type:""})).toBe("audio/mpeg");
    expect(audioFileMimeType({name:"reveal.m4a",type:"video/mp4"})).toBe("audio/mp4");
    expect(audioFileMimeType({name:"not-audio.txt",type:"text/plain"})).toBe("");
  });

  it("keeps timing-sensitive pick cues short", () => {
    expect(eventAudioMaxSeconds("pick-in")).toBe(12);
    expect(eventAudioMaxSeconds("pick-reveal")).toBe(20);
    expect(eventAudioMaxSeconds("opening")).toBeGreaterThan(eventAudioMaxSeconds("pick-in"));
  });
});
