import { describe, expect, it } from "vitest";
import { reconcilePickRequest } from "./pickWorkflow";

const request = {pick_no:23,player_id:"4046"};

describe("official pick reconciliation", () => {
  it("waits until Sleeper publishes the requested pick number", () => {
    expect(reconcilePickRequest(request,[{pickNo:22,player:{playerId:"4046"}}])).toBeNull();
  });
  it("confirms only an exact official player and pick-number match", () => {
    expect(reconcilePickRequest(request,[{pickNo:23,player:{playerId:"4046",name:"Requested Player"}}])).toMatchObject({status:"confirmed",official_pick_no:23});
  });
  it("rejects a request when Sleeper records a different player", () => {
    expect(reconcilePickRequest(request,[{pickNo:23,player:{playerId:"9999",name:"Different Player"}}])).toMatchObject({status:"rejected",official_pick_no:23});
  });
});
