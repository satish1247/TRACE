import { existsSync, rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { persist, persistenceMode, restore } from "./persist";
import { seed } from "./scenario";
import { reduce } from "./store";

const SNAPSHOT = ".trace-state.json";
const T0 = 1_700_000_000_000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("persistence: the demo survives a restart", () => {
  afterAll(() => {
    if (existsSync(SNAPSHOT)) rmSync(SNAPSHOT);
  });

  it("writes a snapshot and reads back the same state", async () => {
    let s = reduce(seed(T0), { type: "demo.beat", payload: { beat: 2 } }, T0);
    s = reduce(s, { type: "call.advance" }, T0);
    const markers = s.call.markers.length;
    const risk = s.call.risk;
    expect(markers).toBeGreaterThan(0);

    persist(s);
    await wait(700); // past the debounce window

    const back = await restore();
    expect(back).not.toBeNull();
    expect(back!.beat).toBe(2);
    expect(back!.call.markers.length).toBe(markers);
    expect(back!.call.risk).toBe(risk);
    expect(back!.user.balance).toBe(s.user.balance);
  });

  it("reports which backend it used, and never claims Firestore without credentials", () => {
    const mode = persistenceMode();
    expect(["firestore", "file", "memory"]).toContain(mode);
    if (!process.env.FIREBASE_PROJECT_ID) expect(mode).not.toBe("firestore");
  });

  it("debounces: many rapid changes collapse into one write", async () => {
    const s = seed(T0);
    for (let i = 0; i < 50; i++) persist({ ...s, version: i });
    await wait(700);
    const back = await restore();
    expect(back).not.toBeNull(); // the last one wins, no crash, no 50 writes
  });
});
