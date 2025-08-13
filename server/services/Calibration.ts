
export interface CalibrationMetrics {
  brierScore: number;
  reliability: number;
  resolution: number;
  sharpness: number;
}

export class Calibration {
  getMetrics(): CalibrationMetrics {
    return {
      brierScore: 0.2,
      reliability: 0.1,
      resolution: 0.05,
      sharpness: 0.3
    };
  }
}

export const calibration = new Calibration();
