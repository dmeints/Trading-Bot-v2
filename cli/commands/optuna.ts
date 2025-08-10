
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
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import fs from 'fs';

const optuna = new Command('optuna');

optuna
  .description('Stevie hyperparameter optimization with Optuna')
  .addCommand(
    new Command('coarse')
      .description('Run coarse grid search')
      .option('--trials <n>', 'Number of random trials', '120')
      .option('--from <date>', 'Start date', '2024-06-01') 
      .option('--to <date>', 'End date', '2024-06-30')
      .action(async (options) => {
        console.log('🔄 Starting coarse grid search...');
        const env = {
          ...process.env,
          COARSE_N: options.trials,
          TUNE_FROM: options.from,
          TUNE_TO: options.to
        };
        
        const result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/stevie_optuna.ts'], {
          stdio: 'inherit',
          env
        });
        
        if (result.status !== 0) {
          console.error('❌ Coarse search failed');
          process.exit(1);
        }
        
        console.log('✅ Coarse search completed');
      })
  )
  .addCommand(
    new Command('refine')
      .description('Run Optuna refinement')
      .option('--trials <n>', 'Number of Optuna trials', '80')
      .option('--study <name>', 'Study name', 'stevie_v2_1')
      .action(async (options) => {
        console.log('🔄 Starting Optuna refinement...');
        const env = {
          ...process.env,
          TRIALS: options.trials,
          OPTUNA_STUDY: options.study
        };
        
        const result = spawnSync('python', ['tools/tune/stevie_optuna.py'], {
          stdio: 'inherit',
          env
        });
        
        if (result.status !== 0) {
          console.error('❌ Optuna refinement failed');
          process.exit(1);
        }
        
        console.log('✅ Optuna refinement completed');
      })
  )
  .addCommand(
    new Command('select')
      .description('Select Pareto-optimal configuration')
      .action(async () => {
        console.log('🔄 Selecting optimal configuration...');
        const result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/select_and_emit.ts'], {
          stdio: 'inherit'
        });
        
        if (result.status !== 0) {
          console.error('❌ Configuration selection failed');
          process.exit(1);
        }
        
        console.log('✅ Configuration selected');
      })
  )
  .addCommand(
    new Command('validate')
      .description('Run walk-forward validation')
      .action(async () => {
        console.log('🔄 Running walk-forward validation...');
        const result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/walkforward_and_stress.ts'], {
          stdio: 'inherit'
        });
        
        if (result.status !== 0) {
          console.error('❌ Validation failed');
          process.exit(1);
        }
        
        console.log('✅ Validation completed');
      })
  )
  .addCommand(
    new Command('verify')
      .description('Verify complete tuning pipeline')
      .action(async () => {
        console.log('🔍 Verifying tuning pipeline...');
        const result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/verify_tuning_pipeline.ts'], {
          stdio: 'inherit'
        });
        
        if (result.status !== 0) {
          console.error('❌ Pipeline verification failed');
          process.exit(1);
        }
        
        console.log('✅ Pipeline verification passed');
      })
  )
  .addCommand(
    new Command('full')
      .description('Run complete optimization pipeline')
      .option('--coarse-trials <n>', 'Coarse trials', '120')
      .option('--optuna-trials <n>', 'Optuna trials', '80')
      .action(async (options) => {
        console.log('🚀 Running full optimization pipeline...');
        
        // Run coarse search
        console.log('Step 1/5: Coarse grid search...');
        let result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/stevie_optuna.ts'], {
          stdio: 'inherit',
          env: { ...process.env, COARSE_N: options.coarseTrials }
        });
        if (result.status !== 0) process.exit(1);
        
        // Run Optuna refinement
        console.log('Step 2/5: Optuna refinement...');
        result = spawnSync('python', ['tools/tune/stevie_optuna.py'], {
          stdio: 'inherit',
          env: { ...process.env, TRIALS: options.optunaTrials }
        });
        if (result.status !== 0) process.exit(1);
        
        // Select configuration
        console.log('Step 3/5: Configuration selection...');
        result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/select_and_emit.ts'], {
          stdio: 'inherit'
        });
        if (result.status !== 0) process.exit(1);
        
        // Validate
        console.log('Step 4/5: Walk-forward validation...');
        result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/walkforward_and_stress.ts'], {
          stdio: 'inherit'
        });
        if (result.status !== 0) process.exit(1);
        
        // Verify
        console.log('Step 5/5: Pipeline verification...');
        result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/verify_tuning_pipeline.ts'], {
          stdio: 'inherit'
        });
        if (result.status !== 0) process.exit(1);
        
        console.log('🎉 Complete optimization pipeline finished successfully!');
        
        // Show final summary
        if (fs.existsSync('artifacts/tuning/stevie.config.candidate.json')) {
          const candidate = JSON.parse(fs.readFileSync('artifacts/tuning/stevie.config.candidate.json', 'utf8'));
          console.log('\n📊 Final Candidate Summary:');
          console.log(JSON.stringify(candidate.provenance.metrics, null, 2));
        }
      })
  );

export { optuna };
