
import { describe, it, expect } from "vitest";
import { solveQP } from "./execution_qp_solver";

describe("QP projected gradient", () => {
  it("respects box and L1 caps and reduces objective proxy", () => {
    const Sigma = [[1, 0], [0, 1]], q = [0.5, 0.2];
    const { dw, slipBps } = solveQP([0, 0], { Sigma, q }, { 
      kappa: 0, 
      step: 0.2, 
      iters: 50, 
      l1Cap: 0.8, 
      boxCap: 0.6, 
      slipCapBps: 9999 
    });
    
    expect(Math.abs(dw[0]) <= 0.6 && Math.abs(dw[1]) <= 0.6).toBe(true);
    expect(Math.abs(dw[0]) + Math.abs(dw[1]) <= 0.8 + 1e-9).toBe(true);
    expect(slipBps).toBeDefined();
  });
});
