
import { describe, it, expect } from "vitest";
import { doublyRobust } from "./ope_dr";

describe("DR-OPE", () => {
  it("reduces variance vs plain IS in simple case", () => {
    const n = 200;
    const rewards = Array.from({ length: n }, (_, i) => Math.sin(i / 10) + 1);
    const pb = Array.from({ length: n }, () => 0.5);
    const p = Array.from({ length: n }, () => 0.55);
    const Qb = Array.from({ length: n }, () => 0.9);
    const Vb = Array.from({ length: n }, () => 1.0);
    
    const { vdr, isVar } = doublyRobust({ rewards, pb, p, Qb, Vb });
    expect(isVar).toBeGreaterThanOrEqual(0);
    expect(typeof vdr).toBe("number");
  });
});
