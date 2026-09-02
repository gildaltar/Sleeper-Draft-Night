import { describe, expect, it } from "vitest";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { liveKitGrant } from "./livekit-token";

describe("LiveKit token grants", () => {
  it("serializes owner camera and microphone permissions", async () => {
    const grant = liveKitGrant("owner","draft-test");
    expect(grant.canPublishSources).toEqual([TrackSource.CAMERA,TrackSource.MICROPHONE]);
    const token = new AccessToken("test-key","01234567890123456789012345678901",{identity:"team-1-test"});
    token.addGrant(grant);
    const jwt = await token.toJwt();
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1],"base64url").toString("utf8"));
    expect(payload.video.canPublishSources).toEqual(["camera","microphone"]);
  });

  it("does not give viewers publish permissions", () => {
    const grant = liveKitGrant("viewer","draft-test");
    expect(grant.canPublish).toBe(false);
    expect(grant.canPublishSources).toBeUndefined();
    expect(grant.canSubscribe).toBe(true);
  });
});
