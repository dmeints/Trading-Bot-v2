
import { Command } from 'commander';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function addOptunaCommands(program: Command) {
  const optuna = program
    .command('optuna')
    .description('Optuna hyperparameter optimization commands');

  optuna
    .command('study')
    .description('Run Optuna study for Stevie hyperparameter optimization')
    .option('--trials <number>', 'Number of optimization trials', '80')
    .option('--study-name <name>', 'Optuna study name', 'stevie_v2_1')
    .option('--from <date>', 'Start date for tuning', '2024-07-01')
    .option('--to <date>', 'End date for tuning', '2024-07-31')
    .action(async (options) => {
      console.log('🔍 Starting Optuna hyperparameter optimization...');
      
      const env = {
        ...process.env,
        TRIALS: options.trials,
        TUNE_FROM: options.from,
        TUNE_TO: options.to,
        OPTUNA_RDB: `sqlite:///artifacts/tuning/${options.studyName}.db`
      };

      // Run coarse search first
      console.log('📊 Running coarse grid search...');
      const coarseResult = spawnSync('npm', ['exec', 'tsx', 'tools/tune/stevie_optuna.ts'], {
        env,
        stdio: 'inherit'
      });

      if (coarseResult.status !== 0) {
        console.error('❌ Coarse search failed');
        process.exit(1);
      }

      // Run Optuna refinement
      console.log('🎯 Running Optuna refinement...');
      const optunaResult = spawnSync('python', ['tools/tune/stevie_optuna.py'], {
        env,
        stdio: 'inherit'
      });

      if (optunaResult.status !== 0) {
        console.warn('⚠️ Optuna refinement had issues, continuing...');
      }

      // Run Pareto selection
      console.log('🏆 Selecting Pareto-optimal configuration...');
      const selectResult = spawnSync('npm', ['exec', 'tsx', 'tools/tune/select_and_emit.ts'], {
        env,
        stdio: 'inherit'
      });

      if (selectResult.status === 0) {
        console.log('✅ Optuna optimization complete!');
        console.log('📄 Results: artifacts/tuning/stevie.config.candidate.json');
      } else {
        console.error('❌ Pareto selection failed');
        process.exit(1);
      }
    });

  optuna
    .command('walkforward')
    .description('Run walk-forward validation and stress testing')
    .action(async () => {
      console.log('🧪 Running walk-forward validation and stress tests...');
      
      const result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/walkforward_and_stress.ts'], {
        stdio: 'inherit'
      });

      if (result.status === 0) {
        console.log('✅ Walk-forward validation complete!');
        console.log('📄 Results: artifacts/tuning/walkforward_stress.csv');
      } else {
        console.error('❌ Walk-forward validation failed');
        process.exit(1);
      }
    });

  optuna
    .command('verify')
    .description('Verify the complete tuning pipeline')
    .action(async () => {
      console.log('🔍 Verifying tuning pipeline...');
      
      const result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/verify_tuning_pipeline.ts'], {
        stdio: 'inherit'
      });

      if (result.status === 0) {
        console.log('✅ Tuning pipeline verification complete!');
      } else {
        console.error('❌ Pipeline verification failed');
        process.exit(1);
      }
    });

  return optuna;
}
