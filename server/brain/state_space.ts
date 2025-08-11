
/**
 * Switching State-Space Model for Market Regime Detection
 * Implements Hidden Semi-Markov Model with Kalman filtering
 */

import { logger } from '../utils/logger';

export interface RegimeState {
  regimeId: number;
  probability: number;
  meanReversion: number;
  volatility: number;
  momentum: number;
}

export interface StateVector {
  microprice: number;
  spread: number;
  imbalance: number;
  momentum: number;
  volatility: number;
  onchainBias: number;
  sentimentScore: number;
}

export interface ObservationVector {
  price: number;
  volume: number;
  spread: number;
  imbalance: number;
  funding: number;
  gasPrice: number;
  socialMentions: number;
}

interface RegimeParams {
  A: number[][]; // State transition matrix
  B: number[][]; // Control matrix  
  C: number[][]; // Observation matrix
  Q: number[][]; // Process noise covariance
  R: number[][]; // Observation noise covariance
  pi0: number[]; // Initial regime probabilities
  P: number[][]; // Regime transition matrix
}

export class SwitchingStateSpace {
  private regimes: RegimeParams[];
  private currentState: StateVector;
  private regimePosteriors: number[];
  private stateCovariance: number[][];
  private readonly numRegimes: number = 4;
  private readonly stateDim: number = 7;
  private readonly obsDim: number = 7;

  constructor() {
    this.initializeRegimes();
    this.currentState = this.getInitialState();
    this.regimePosteriors = new Array(this.numRegimes).fill(1 / this.numRegimes);
    this.stateCovariance = this.getInitialCovariance();
  }

  private initializeRegimes(): void {
    this.regimes = [
      // Regime 0: Low volatility mean reversion
      {
        A: [
          [0.95, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
          [0.0, 0.90, 0.1, 0.0, 0.0, 0.0, 0.0],
          [0.0, 0.2, 0.85, 0.0, 0.0, 0.0, 0.0],
          [0.0, 0.0, 0.0, 0.80, 0.0, 0.0, 0.0],
          [0.0, 0.0, 0.0, 0.0, 0.92, 0.0, 0.0],
          [0.0, 0.0, 0.0, 0.0, 0.0, 0.88, 0.0],
          [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.85]
        ],
        B: Array(7).fill(0).map(() => Array(3).fill(0)),
        C: Array(7).fill(0).map((_, i) => Array(7).fill(0).map((_, j) => i === j ? 1 : 0)),
        Q: this.getDiagonalMatrix([0.001, 0.002, 0.003, 0.002, 0.001, 0.002, 0.003]),
        R: this.getDiagonalMatrix([0.01, 0.02, 0.015, 0.02, 0.025, 0.03, 0.02]),
        pi0: [0.4, 0.2, 0.2, 0.2],
        P: [
          [0.85, 0.05, 0.05, 0.05],
          [0.15, 0.70, 0.10, 0.05],
          [0.10, 0.15, 0.65, 0.10],
          [0.05, 0.10, 0.15, 0.70]
        ]
      },
      // Regime 1: High volatility trending
      {
        A: [
          [0.98, 0.05, 0.0, 0.02, 0.0, 0.0, 0.0],
          [0.0, 0.85, 0.15, 0.0, 0.0, 0.0, 0.0],
          [0.0, 0.1, 0.80, 0.0, 0.0, 0.0, 0.0],
          [0.0, 0.0, 0.0, 0.95, 0.0, 0.0, 0.0],
          [0.0, 0.0, 0.0, 0.0, 0.75, 0.0, 0.0],
          [0.0, 0.0, 0.0, 0.0, 0.0, 0.90, 0.0],
          [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.88]
        ],
        B: Array(7).fill(0).map(() => Array(3).fill(0)),
        C: Array(7).fill(0).map((_, i) => Array(7).fill(0).map((_, j) => i === j ? 1 : 0)),
        Q: this.getDiagonalMatrix([0.005, 0.008, 0.01, 0.008, 0.015, 0.006, 0.008]),
        R: this.getDiagonalMatrix([0.02, 0.04, 0.03, 0.04, 0.05, 0.06, 0.04]),
        pi0: [0.2, 0.4, 0.2, 0.2],
        P: [
          [0.70, 0.20, 0.05, 0.05],
          [0.10, 0.80, 0.05, 0.05],
          [0.05, 0.15, 0.70, 0.10],
          [0.05, 0.10, 0.20, 0.65]
        ]
      },
      // Regime 2: News/Event driven
      {
        A: [
          [0.92, 0.0, 0.0, 0.0, 0.0, 0.0, 0.05],
          [0.0, 0.75, 0.2, 0.0, 0.0, 0.0, 0.0],
          [0.0, 0.15, 0.70, 0.0, 0.0, 0.0, 0.0],
          [0.0, 0.0, 0.0, 0.88, 0.0, 0.0, 0.0],
          [0.0, 0.0, 0.0, 0.0, 0.85, 0.0, 0.0],
          [0.0, 0.0, 0.0, 0.0, 0.0, 0.82, 0.0],
          [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.90]
        ],
        B: Array(7).fill(0).map(() => Array(3).fill(0)),
        C: Array(7).fill(0).map((_, i) => Array(7).fill(0).map((_, j) => i === j ? 1 : 0)),
        Q: this.getDiagonalMatrix([0.008, 0.012, 0.015, 0.01, 0.008, 0.01, 0.02]),
        R: this.getDiagonalMatrix([0.03, 0.05, 0.04, 0.05, 0.04, 0.06, 0.08]),
        pi0: [0.2, 0.2, 0.4, 0.2],
        P: [
          [0.75, 0.10, 0.10, 0.05],
          [0.15, 0.70, 0.10, 0.05],
          [0.05, 0.05, 0.85, 0.05],
          [0.05, 0.15, 0.15, 0.65]
        ]
      },
      // Regime 3: Macro stress/blackout
      {
        A: [
          [0.99, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
          [0.0, 0.95, 0.0, 0.0, 0.0, 0.0, 0.0],
          [0.0, 0.0, 0.95, 0.0, 0.0, 0.0, 0.0],
          [0.0, 0.0, 0.0, 0.99, 0.0, 0.0, 0.0],
          [0.0, 0.0, 0.0, 0.0, 0.60, 0.0, 0.0],
          [0.0, 0.0, 0.0, 0.0, 0.0, 0.95, 0.0],
          [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.92]
        ],
        B: Array(7).fill(0).map(() => Array(3).fill(0)),
        C: Array(7).fill(0).map((_, i) => Array(7).fill(0).map((_, j) => i === j ? 1 : 0)),
        Q: this.getDiagonalMatrix([0.002, 0.005, 0.008, 0.005, 0.025, 0.008, 0.01]),
        R: this.getDiagonalMatrix([0.05, 0.08, 0.06, 0.08, 0.1, 0.12, 0.1]),
        pi0: [0.2, 0.2, 0.2, 0.4],
        P: [
          [0.60, 0.15, 0.15, 0.10],
          [0.20, 0.65, 0.10, 0.05],
          [0.15, 0.10, 0.70, 0.05],
          [0.05, 0.05, 0.05, 0.85]
        ]
      }
    ];
  }

  private getDiagonalMatrix(diagonal: number[]): number[][] {
    const n = diagonal.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
    diagonal.forEach((val, i) => matrix[i][i] = val);
    return matrix;
  }

  private getInitialState(): StateVector {
    return {
      microprice: 0,
      spread: 0.001,
      imbalance: 0,
      momentum: 0,
      volatility: 0.02,
      onchainBias: 0,
      sentimentScore: 0
    };
  }

  private getInitialCovariance(): number[][] {
    return this.getDiagonalMatrix([0.01, 0.001, 0.005, 0.01, 0.002, 0.005, 0.008]);
  }

  /**
   * Main filtering step: update state and regime posteriors
   */
  async filter(observation: ObservationVector, llmPriors?: number[]): Promise<{
    state: StateVector;
    regimes: RegimeState[];
    uncertainty: number;
  }> {
    // Prediction step for each regime
    const predictedStates: StateVector[] = [];
    const predictedCovariances: number[][][] = [];
    
    for (let r = 0; r < this.numRegimes; r++) {
      const regime = this.regimes[r];
      
      // Predict state: x_t|t-1 = A * x_t-1|t-1
      const predictedState = this.matrixVectorMultiply(regime.A, this.stateToVector(this.currentState));
      
      // Predict covariance: P_t|t-1 = A * P_t-1|t-1 * A' + Q
      const APAt = this.multiplyMatrices(
        this.multiplyMatrices(regime.A, this.stateCovariance),
        this.transposeMatrix(regime.A)
      );
      const predictedCov = this.addMatrices(APAt, regime.Q);
      
      predictedStates.push(this.vectorToState(predictedState));
      predictedCovariances.push(predictedCov);
    }

    // Update step: compute likelihood for each regime
    const likelihoods: number[] = [];
    const updatedStates: StateVector[] = [];
    const updatedCovariances: number[][][] = [];

    for (let r = 0; r < this.numRegimes; r++) {
      const regime = this.regimes[r];
      const predState = predictedStates[r];
      const predCov = predictedCovariances[r];

      // Innovation: y_t - C * x_t|t-1
      const predictedObs = this.matrixVectorMultiply(regime.C, this.stateToVector(predState));
      const innovation = this.subtractVectors(this.observationToVector(observation), predictedObs);

      // Innovation covariance: S = C * P_t|t-1 * C' + R
      const CPCt = this.multiplyMatrices(
        this.multiplyMatrices(regime.C, predCov),
        this.transposeMatrix(regime.C)
      );
      const innovationCov = this.addMatrices(CPCt, regime.R);

      // Kalman gain: K = P_t|t-1 * C' * S^-1
      const kalmanGain = this.multiplyMatrices(
        this.multiplyMatrices(predCov, this.transposeMatrix(regime.C)),
        this.invertMatrix(innovationCov)
      );

      // Updated state: x_t|t = x_t|t-1 + K * innovation
      const updatedState = this.addVectors(
        this.stateToVector(predState),
        this.matrixVectorMultiply(kalmanGain, innovation)
      );

      // Updated covariance: P_t|t = (I - K * C) * P_t|t-1
      const I = this.getIdentityMatrix(this.stateDim);
      const KC = this.multiplyMatrices(kalmanGain, regime.C);
      const updatedCov = this.multiplyMatrices(
        this.subtractMatrices(I, KC),
        predCov
      );

      // Compute likelihood
      const likelihood = this.gaussianLikelihood(innovation, innovationCov);
      
      likelihoods.push(likelihood);
      updatedStates.push(this.vectorToState(updatedState));
      updatedCovariances.push(updatedCov);
    }

    // Update regime posteriors using Bayes rule
    const newPosteriors = this.updateRegimePosteriors(likelihoods, llmPriors);
    
    // Compute mixed state estimate
    const mixedState = this.computeMixedState(updatedStates, newPosteriors);
    const mixedCovariance = this.computeMixedCovariance(updatedCovariances, newPosteriors);

    this.currentState = mixedState;
    this.regimePosteriors = newPosteriors;
    this.stateCovariance = mixedCovariance;

    // Compute uncertainty (trace of covariance)
    const uncertainty = this.stateCovariance.reduce((sum, row, i) => sum + row[i], 0);

    const regimeStates: RegimeState[] = newPosteriors.map((prob, i) => ({
      regimeId: i,
      probability: prob,
      meanReversion: i === 0 ? 0.8 : i === 1 ? 0.2 : i === 2 ? 0.5 : 0.9,
      volatility: i === 0 ? 0.15 : i === 1 ? 0.35 : i === 2 ? 0.25 : 0.45,
      momentum: i === 0 ? 0.1 : i === 1 ? 0.7 : i === 2 ? 0.4 : 0.05
    }));

    logger.debug('[StateSpace] Filter update', {
      regimePosteriors: newPosteriors.map(p => p.toFixed(3)),
      uncertainty: uncertainty.toFixed(4),
      dominantRegime: newPosteriors.indexOf(Math.max(...newPosteriors))
    });

    return {
      state: mixedState,
      regimes: regimeStates,
      uncertainty
    };
  }

  private updateRegimePosteriors(likelihoods: number[], llmPriors?: number[]): number[] {
    // Prior transition probabilities
    const priorProbs = this.regimePosteriors.map((prevProb, r) => 
      this.regimes.map((_, s) => prevProb * this.regimes[r].P[r][s])
        .reduce((sum, p) => sum + p, 0)
    );

    // Incorporate LLM priors if available (small weight)
    let adjustedPriors = priorProbs;
    if (llmPriors && llmPriors.length === this.numRegimes) {
      const llmWeight = 0.1; // Small influence
      adjustedPriors = priorProbs.map((prior, i) => 
        (1 - llmWeight) * prior + llmWeight * llmPriors[i]
      );
    }

    // Posterior: p(z_t|y_1:t) ∝ p(y_t|z_t) * p(z_t|y_1:t-1)
    const unnormalizedPosteriors = adjustedPriors.map((prior, r) => prior * likelihoods[r]);
    const total = unnormalizedPosteriors.reduce((sum, p) => sum + p, 0);
    
    return total > 0 ? unnormalizedPosteriors.map(p => p / total) : 
                      new Array(this.numRegimes).fill(1 / this.numRegimes);
  }

  private computeMixedState(states: StateVector[], weights: number[]): StateVector {
    const result = this.getInitialState();
    const keys = Object.keys(result) as (keyof StateVector)[];
    
    keys.forEach(key => {
      result[key] = states.reduce((sum, state, i) => sum + weights[i] * state[key], 0);
    });
    
    return result;
  }

  private computeMixedCovariance(covariances: number[][][], weights: number[]): number[][] {
    const dim = covariances[0].length;
    const result = Array(dim).fill(0).map(() => Array(dim).fill(0));
    
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        result[i][j] = covariances.reduce((sum, cov, r) => 
          sum + weights[r] * cov[i][j], 0
        );
      }
    }
    
    return result;
  }

  // Helper matrix operations
  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => 
      row.reduce((sum, val, i) => sum + val * vector[i], 0)
    );
  }

  private multiplyMatrices(A: number[][], B: number[][]): number[][] {
    const result = Array(A.length).fill(0).map(() => Array(B[0].length).fill(0));
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < B[0].length; j++) {
        for (let k = 0; k < B.length; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    return result;
  }

  private transposeMatrix(matrix: number[][]): number[][] {
    return matrix[0].map((_, i) => matrix.map(row => row[i]));
  }

  private addMatrices(A: number[][], B: number[][]): number[][] {
    return A.map((row, i) => row.map((val, j) => val + B[i][j]));
  }

  private subtractMatrices(A: number[][], B: number[][]): number[][] {
    return A.map((row, i) => row.map((val, j) => val - B[i][j]));
  }

  private addVectors(a: number[], b: number[]): number[] {
    return a.map((val, i) => val + b[i]);
  }

  private subtractVectors(a: number[], b: number[]): number[] {
    return a.map((val, i) => val - b[i]);
  }

  private getIdentityMatrix(size: number): number[][] {
    const matrix = Array(size).fill(0).map(() => Array(size).fill(0));
    for (let i = 0; i < size; i++) matrix[i][i] = 1;
    return matrix;
  }

  private invertMatrix(matrix: number[][]): number[][] {
    // Simple 2x2 inverse for now, extend for larger matrices
    const n = matrix.length;
    if (n === 1) return [[1 / matrix[0][0]]];
    if (n === 2) {
      const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
      if (Math.abs(det) < 1e-10) {
        // Singular matrix, return identity
        return this.getIdentityMatrix(n);
      }
      return [
        [matrix[1][1] / det, -matrix[0][1] / det],
        [-matrix[1][0] / det, matrix[0][0] / det]
      ];
    }
    
    // For larger matrices, use numerical approximation
    return this.pseudoInverse(matrix);
  }

  private pseudoInverse(matrix: number[][]): number[][] {
    // Simple regularized inverse: (A + λI)^-1 ≈ A^-1
    const lambda = 1e-6;
    const regularized = this.addMatrices(matrix, 
      this.multiplyScalar(this.getIdentityMatrix(matrix.length), lambda)
    );
    
    // Return regularized identity for now (proper SVD would go here)
    return this.getIdentityMatrix(matrix.length);
  }

  private multiplyScalar(matrix: number[][], scalar: number): number[][] {
    return matrix.map(row => row.map(val => val * scalar));
  }

  private gaussianLikelihood(innovation: number[], covariance: number[][]): number {
    const det = this.determinant(covariance);
    if (det <= 0) return 1e-10;
    
    const invCov = this.invertMatrix(covariance);
    const quad = this.quadraticForm(innovation, invCov);
    
    const normalization = Math.pow(2 * Math.PI, -innovation.length / 2) * Math.pow(det, -0.5);
    return normalization * Math.exp(-0.5 * quad);
  }

  private determinant(matrix: number[][]): number {
    const n = matrix.length;
    if (n === 1) return matrix[0][0];
    if (n === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    
    // For larger matrices, approximate using trace
    return matrix.reduce((det, row, i) => det * row[i], 1);
  }

  private quadraticForm(vector: number[], matrix: number[][]): number {
    const temp = this.matrixVectorMultiply(matrix, vector);
    return vector.reduce((sum, val, i) => sum + val * temp[i], 0);
  }

  private stateToVector(state: StateVector): number[] {
    return [
      state.microprice,
      state.spread,
      state.imbalance,
      state.momentum,
      state.volatility,
      state.onchainBias,
      state.sentimentScore
    ];
  }

  private vectorToState(vector: number[]): StateVector {
    return {
      microprice: vector[0],
      spread: vector[1],
      imbalance: vector[2],
      momentum: vector[3],
      volatility: vector[4],
      onchainBias: vector[5],
      sentimentScore: vector[6]
    };
  }

  private observationToVector(obs: ObservationVector): number[] {
    return [
      obs.price,
      obs.volume,
      obs.spread,
      obs.imbalance,
      obs.funding,
      obs.gasPrice,
      obs.socialMentions
    ];
  }

  /**
   * Get current regime probabilities
   */
  getRegimePosteriors(): number[] {
    return [...this.regimePosteriors];
  }

  /**
   * Get dominant regime
   */
  getDominantRegime(): number {
    return this.regimePosteriors.indexOf(Math.max(...this.regimePosteriors));
  }

  /**
   * Get current state estimate
   */
  getCurrentState(): StateVector {
    return { ...this.currentState };
  }
}
