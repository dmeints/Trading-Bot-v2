
import { describe, it, expect } from "vitest";
import { QuantileRegressor, cvarLower } from "./quantile";

describe("QuantileRegressor", () => {
  it("learns simple linear quantiles", () => {
    const qr = new QuantileRegressor({ dim: 1, lr: 0.01, taus: [0.05, 0.5, 0.95] });
    const X = Array.from({ length: 500 }, (_, i) => [i / 100]);
    const y = X.map(([x]) => 2 * x + 0.5);
    
    for (let k = 0; k < 20; k++) qr.partialFit(X, y);
    
    const { 0.05: q05, 0.5: q50, 0.95: q95 } = qr.predict([1]);
    expect(q05).toBeLessThan(q50); 
    expect(q50).toBeLessThan(q95);
    expect(cvarLower({ 0.05: q05, 0.5: q50, 0.95: q95 }, 0.05)).toBeCloseTo(q05, 6);
  });
});
