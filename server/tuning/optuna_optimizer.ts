
/**
 * Optuna Hyperparameter Optimization for Conformal Prediction
 * Advanced Bayesian optimization using Optuna integration
 */

import { logger } from '../utils/logger';
import { ConformalPredictor } from '../brain/conformal';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface OptunaConfig {
  nTrials: number;
  timeout: number; // seconds
  studyName: string;
  sampler: 'TPESampler' | 'RandomSampler' | 'CmaEsSampler';
  pruner: 'MedianPruner' | 'PatientPruner' | 'NopPruner';
  direction: 'minimize' | 'maximize';
  hyperparameters: {
    alpha: { low: number; high: number; type: 'uniform' | 'loguniform' };
    windowSize: { low: number; high: number; type: 'int' };
    kernelBandwidth: { low: number; high: number; type: 'uniform' | 'loguniform' };
    minSamples: { low: number; high: number; type: 'int' };
  };
}

export interface OptunaResult {
  bestParams: {
    alpha: number;
    windowSize: number;
    kernelBandwidth: number;
    minSamples: number;
  };
  bestValue: number;
  nTrials: number;
  studyStats: {
    completedTrials: number;
    prunedTrials: number;
    failedTrials: number;
  };
  optimizationHistory: Array<{
    trialNumber: number;
    value: number;
    params: any;
    datetime: string;
  }>;
  convergencePlot?: string; // base64 encoded plot
}

export class OptunaOptimizer {
  private config: OptunaConfig;
  private tempDir: string;

  constructor(config: Partial<OptunaConfig> = {}) {
    this.config = {
      nTrials: 100,
      timeout: 3600, // 1 hour
      studyName: `conformal_optimization_${Date.now()}`,
      sampler: 'TPESampler',
      pruner: 'MedianPruner',
      direction: 'maximize',
      hyperparameters: {
        alpha: { low: 0.01, high: 0.3, type: 'uniform' },
        windowSize: { low: 50, high: 2000, type: 'int' },
        kernelBandwidth: { low: 0.001, high: 0.5, type: 'loguniform' },
        minSamples: { low: 20, high: 500, type: 'int' }
      },
      ...config
    };
    
    this.tempDir = path.join(process.cwd(), 'tmp', 'optuna');
  }

  /**
   * Run Optuna optimization
   */
  async optimize(
    trainingData: Array<{
      features: number[];
      actualReturn: number;
      timestamp: Date;
    }>,
    validationData: Array<{
      features: number[];
      actualReturn: number;
      timestamp: Date;
    }>
  ): Promise<OptunaResult> {
    logger.info('[OptunaOptimizer] Starting Optuna optimization', {
      nTrials: this.config.nTrials,
      studyName: this.config.studyName,
      timeout: this.config.timeout
    });

    // Ensure temp directory exists
    await this.ensureTempDirectory();

    // Write data to temporary files
    const trainingFile = await this.writeDataFile(trainingData, 'training');
    const validationFile = await this.writeDataFile(validationData, 'validation');
    const configFile = await this.writeConfigFile();

    try {
      // Run Optuna optimization via Python script
      const result = await this.runOptunaScript(trainingFile, validationFile, configFile);
      
      logger.info('[OptunaOptimizer] Optimization completed', {
        bestValue: result.bestValue,
        nTrials: result.nTrials,
        completedTrials: result.studyStats.completedTrials
      });

      return result;

    } finally {
      // Cleanup temporary files
      await this.cleanup([trainingFile, validationFile, configFile]);
    }
  }

  /**
   * Create temporary directory
   */
  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('[OptunaOptimizer] Failed to create temp directory', error);
      throw error;
    }
  }

  /**
   * Write data to temporary file
   */
  private async writeDataFile(
    data: Array<any>,
    prefix: string
  ): Promise<string> {
    const filename = path.join(this.tempDir, `${prefix}_${Date.now()}.json`);
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    return filename;
  }

  /**
   * Write configuration file for Python script
   */
  private async writeConfigFile(): Promise<string> {
    const configPath = path.join(this.tempDir, `config_${Date.now()}.json`);
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
    return configPath;
  }

  /**
   * Run Optuna optimization Python script
   */
  private async runOptunaScript(
    trainingFile: string,
    validationFile: string,
    configFile: string
  ): Promise<OptunaResult> {
    return new Promise((resolve, reject) => {
      const pythonScript = this.generatePythonScript();
      const scriptPath = path.join(this.tempDir, `optuna_script_${Date.now()}.py`);
      
      // Write Python script
      fs.writeFile(scriptPath, pythonScript).then(() => {
        const pythonProcess = spawn('python3', [
          scriptPath,
          '--training', trainingFile,
          '--validation', validationFile,
          '--config', configFile
        ], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result);
            } catch (error) {
              reject(new Error(`Failed to parse Optuna results: ${error.message}`));
            }
          } else {
            reject(new Error(`Optuna script failed with code ${code}: ${stderr}`));
          }
        });

        pythonProcess.on('error', (error) => {
          reject(new Error(`Failed to spawn Python process: ${error.message}`));
        });
      }).catch(reject);
    });
  }

  /**
   * Generate Python script for Optuna optimization
   */
  private generatePythonScript(): string {
    return `
#!/usr/bin/env python3
"""
Optuna Hyperparameter Optimization for Conformal Prediction
"""

import json
import argparse
import optuna
import numpy as np
from typing import Dict, List, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConformalOptimizer:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.training_data = None
        self.validation_data = None
        
    def load_data(self, training_file: str, validation_file: str):
        with open(training_file, 'r') as f:
            self.training_data = json.load(f)
        with open(validation_file, 'r') as f:
            self.validation_data = json.load(f)
            
    def objective(self, trial):
        # Suggest hyperparameters
        hp = self.config['hyperparameters']
        
        if hp['alpha']['type'] == 'uniform':
            alpha = trial.suggest_uniform('alpha', hp['alpha']['low'], hp['alpha']['high'])
        else:
            alpha = trial.suggest_loguniform('alpha', hp['alpha']['low'], hp['alpha']['high'])
            
        window_size = trial.suggest_int('window_size', hp['windowSize']['low'], hp['windowSize']['high'])
        
        if hp['kernelBandwidth']['type'] == 'uniform':
            kernel_bandwidth = trial.suggest_uniform('kernel_bandwidth', 
                                                   hp['kernelBandwidth']['low'], 
                                                   hp['kernelBandwidth']['high'])
        else:
            kernel_bandwidth = trial.suggest_loguniform('kernel_bandwidth', 
                                                      hp['kernelBandwidth']['low'], 
                                                      hp['kernelBandwidth']['high'])
            
        min_samples = trial.suggest_int('min_samples', hp['minSamples']['low'], hp['minSamples']['high'])
        
        # Simulate conformal prediction evaluation
        try:
            score = self.evaluate_conformal_params(alpha, window_size, kernel_bandwidth, min_samples)
            return score
        except Exception as e:
            logger.error(f"Trial failed: {e}")
            raise optuna.TrialPruned()
    
    def evaluate_conformal_params(self, alpha: float, window_size: int, 
                                kernel_bandwidth: float, min_samples: int) -> float:
        """
        Simplified conformal prediction evaluation
        In production, this would use the actual ConformalPredictor
        """
        # Mock evaluation - replace with actual conformal prediction logic
        np.random.seed(42)
        
        if len(self.training_data) < min_samples:
            return 0.0
            
        # Simulate calibration
        calibration_scores = []
        for sample in self.training_data[:window_size]:
            actual = sample['actualReturn']
            predicted = actual + np.random.normal(0, 0.01)
            calibration_scores.append(abs(actual - predicted))
        
        if not calibration_scores:
            return 0.0
            
        # Simulate prediction intervals
        quantile = np.percentile(calibration_scores, (1 - alpha) * 100)
        
        # Evaluate on validation data
        coverage_count = 0
        total_width = 0
        valid_predictions = 0
        
        for sample in self.validation_data:
            actual = sample['actualReturn']
            predicted = actual + np.random.normal(0, 0.01)
            
            lower_bound = predicted - quantile
            upper_bound = predicted + quantile
            
            # Check coverage
            if lower_bound <= actual <= upper_bound:
                coverage_count += 1
                
            total_width += (upper_bound - lower_bound)
            valid_predictions += 1
        
        if valid_predictions == 0:
            return 0.0
            
        coverage = coverage_count / valid_predictions
        avg_width = total_width / valid_predictions
        sharpness = 1 / avg_width if avg_width > 0 else 0
        
        # Target coverage
        target_coverage = 1 - alpha
        coverage_error = abs(coverage - target_coverage)
        
        # Composite score
        score = coverage * 0.6 + sharpness * 0.3 - coverage_error * 0.1
        return score
    
    def run_optimization(self) -> Dict[str, Any]:
        # Create study
        sampler_class = getattr(optuna.samplers, self.config['sampler'])
        pruner_class = getattr(optuna.pruners, self.config['pruner'])
        
        study = optuna.create_study(
            direction=self.config['direction'],
            sampler=sampler_class(),
            pruner=pruner_class(),
            study_name=self.config['studyName']
        )
        
        # Optimize
        study.optimize(
            self.objective,
            n_trials=self.config['nTrials'],
            timeout=self.config['timeout']
        )
        
        # Collect results
        best_params = study.best_params
        best_value = study.best_value
        
        # Study statistics
        completed_trials = len([t for t in study.trials if t.state == optuna.trial.TrialState.COMPLETE])
        pruned_trials = len([t for t in study.trials if t.state == optuna.trial.TrialState.PRUNED])
        failed_trials = len([t for t in study.trials if t.state == optuna.trial.TrialState.FAIL])
        
        # Optimization history
        history = []
        for trial in study.trials:
            if trial.state == optuna.trial.TrialState.COMPLETE:
                history.append({
                    'trialNumber': trial.number,
                    'value': trial.value,
                    'params': trial.params,
                    'datetime': trial.datetime_complete.isoformat() if trial.datetime_complete else None
                })
        
        return {
            'bestParams': {
                'alpha': best_params.get('alpha', 0.1),
                'windowSize': best_params.get('window_size', 500),
                'kernelBandwidth': best_params.get('kernel_bandwidth', 0.1),
                'minSamples': best_params.get('min_samples', 100)
            },
            'bestValue': best_value,
            'nTrials': len(study.trials),
            'studyStats': {
                'completedTrials': completed_trials,
                'prunedTrials': pruned_trials,
                'failedTrials': failed_trials
            },
            'optimizationHistory': history
        }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--training', required=True)
    parser.add_argument('--validation', required=True)
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    
    # Load config
    with open(args.config, 'r') as f:
        config = json.load(f)
    
    # Run optimization
    optimizer = ConformalOptimizer(config)
    optimizer.load_data(args.training, args.validation)
    result = optimizer.run_optimization()
    
    # Output result as JSON
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
`;
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        await fs.unlink(file);
      } catch (error) {
        logger.warn(`[OptunaOptimizer] Failed to cleanup file: ${file}`, error);
      }
    }
  }

  /**
   * Get optimization recommendations based on historical results
   */
  async getOptimizationRecommendations(
    historicalResults: OptunaResult[]
  ): Promise<{
    recommendedParams: any;
    confidence: number;
    reasoning: string[];
  }> {
    if (historicalResults.length === 0) {
      return {
        recommendedParams: {
          alpha: 0.1,
          windowSize: 500,
          kernelBandwidth: 0.1,
          minSamples: 100
        },
        confidence: 0.5,
        reasoning: ['No historical data available, using defaults']
      };
    }

    // Analyze historical results to recommend parameters
    const bestResults = historicalResults
      .sort((a, b) => b.bestValue - a.bestValue)
      .slice(0, Math.min(5, historicalResults.length));

    const avgParams = {
      alpha: bestResults.reduce((sum, r) => sum + r.bestParams.alpha, 0) / bestResults.length,
      windowSize: Math.round(bestResults.reduce((sum, r) => sum + r.bestParams.windowSize, 0) / bestResults.length),
      kernelBandwidth: bestResults.reduce((sum, r) => sum + r.bestParams.kernelBandwidth, 0) / bestResults.length,
      minSamples: Math.round(bestResults.reduce((sum, r) => sum + r.bestParams.minSamples, 0) / bestResults.length)
    };

    const confidence = Math.min(historicalResults.length / 10, 0.9);
    const reasoning = [
      `Based on ${historicalResults.length} historical optimization runs`,
      `Average best score: ${(bestResults.reduce((sum, r) => sum + r.bestValue, 0) / bestResults.length).toFixed(4)}`,
      `Confidence: ${(confidence * 100).toFixed(1)}%`
    ];

    return {
      recommendedParams: avgParams,
      confidence,
      reasoning
    };
  }
}
