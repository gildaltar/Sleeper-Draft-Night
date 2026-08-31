import { describe, expect, it, vi } from "vitest";
import { afterAuthLock, checkCommissioner } from "./controlAuth";

describe("control authentication", () => {
  it("does not query the database without a session", async () => {
    const client = { from: vi.fn() };
    await expect(checkCommissioner(client, null)).resolves.toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("checks the signed-in user against commissioners", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { user_id: "commissioner-1" }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    await expect(checkCommissioner(client, { user: { id: "commissioner-1" } })).resolves.toBe(true);
    expect(client.from).toHaveBeenCalledWith("commissioners");
    expect(eq).toHaveBeenCalledWith("user_id", "commissioner-1");
  });

  it("defers database work until after the auth callback returns", () => {
    const task = vi.fn();
    const scheduler = vi.fn();
    afterAuthLock(task, scheduler);
    expect(task).not.toHaveBeenCalled();
    expect(scheduler).toHaveBeenCalledWith(task, 0);
  });
});
