
import { Command } from 'commander';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function addOptunaCommands(program: Command) {
  const optuna = program
    .command('optuna')
    .description('Stevie hyperparameter optimization with Optuna');

  // Coarse grid search
  optuna
    .command('coarse')
    .description('Run coarse grid search')
    .option('--trials <n>', 'Number of random trials', '120')
    .option('--from <date>', 'Start date', '2024-06-01') 
    .option('--to <date>', 'End date', '2024-06-30')
    .action(async (options) => {
      console.log('🔍 Starting coarse grid search...');
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
    });

  // Optuna refinement
  optuna
    .command('refine')
    .description('Run Optuna TPE refinement')
    .option('--trials <n>', 'Number of Optuna trials', '80')
    .option('--study <name>', 'Study name', 'stevie_v2_1')
    .action(async (options) => {
      console.log('🎯 Starting Optuna refinement...');
      const env = {
        ...process.env,
        TRIALS: options.trials,
        OPTUNA_STUDY: options.study,
        OPTUNA_RDB: `sqlite:///artifacts/tuning/${options.study}.db`
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
    });

  // Pareto selection
  optuna
    .command('select')
    .description('Select Pareto-optimal configuration')
    .action(async () => {
      console.log('🏆 Selecting optimal configuration...');
      const result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/select_and_emit.ts'], {
        stdio: 'inherit'
      });
      
      if (result.status !== 0) {
        console.error('❌ Configuration selection failed');
        process.exit(1);
      }
      
      console.log('✅ Configuration selected');
    });

  // Walk-forward validation
  optuna
    .command('validate')
    .description('Run walk-forward validation')
    .action(async () => {
      console.log('🧪 Running walk-forward validation...');
      const result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/walkforward_and_stress.ts'], {
        stdio: 'inherit'
      });
      
      if (result.status !== 0) {
        console.error('❌ Validation failed');
        process.exit(1);
      }
      
      console.log('✅ Validation completed');
    });

  // Extreme mode (T5)
  optuna
    .command('extreme')
    .description('High-frequency optimization with aggressive search')
    .option('--coarse-trials <n>', 'Coarse trials', '200')
    .option('--optuna-trials <n>', 'Optuna trials', '150')
    .option('--parallel <n>', 'Parallel workers', '3')
    .action(async (options) => {
      console.log('⚡ Running EXTREME optimization mode...');
      
      const promises = [];
      
      // Run multiple parallel coarse searches
      for (let i = 0; i < parseInt(options.parallel); i++) {
        const env = {
          ...process.env,
          COARSE_N: Math.floor(parseInt(options.coarseTrials) / parseInt(options.parallel)),
          OPTUNA_RDB: `sqlite:///artifacts/tuning/extreme_${i}.db`
        };
        
        promises.push(
          spawnSync('npm', ['exec', 'tsx', 'tools/tune/stevie_optuna.ts'], {
            stdio: 'inherit',
            env
          })
        );
      }
      
      console.log('🔥 Extreme mode optimization complete');
    });

  // Shadow deployment (T6)
  optuna
    .command('shadow')
    .description('Shadow trading with optimized parameters')
    .option('--config <path>', 'Configuration file', 'artifacts/tuning/stevie.config.candidate.json')
    .option('--duration <hours>', 'Shadow duration in hours', '24')
    .action(async (options) => {
      console.log('👤 Starting shadow deployment...');
      
      if (!fs.existsSync(options.config)) {
        console.error('❌ Configuration file not found. Run optimization first.');
        process.exit(1);
      }
      
      const config = JSON.parse(fs.readFileSync(options.config, 'utf8'));
      
      const env = {
        ...process.env,
        SHADOW_MODE: '1',
        SHADOW_DURATION_HOURS: options.duration,
        ...Object.fromEntries(
          Object.entries(config.parameters || {}).map(([k, v]) => [`STEVIETUNE_${k}`, String(v)])
        )
      };
      
      console.log('🔄 Running shadow trading with optimized parameters...');
      const result = spawnSync('npm', ['run', 'dev'], {
        stdio: 'inherit',
        env
      });
      
      if (result.status === 0) {
        console.log('✅ Shadow deployment completed successfully');
      }
    });

  // Full pipeline
  optuna
    .command('full')
    .description('Run complete optimization pipeline (T1-T6)')
    .option('--coarse-trials <n>', 'Coarse trials', '120')
    .option('--optuna-trials <n>', 'Optuna trials', '80')
    .option('--extreme', 'Enable extreme mode', false)
    .action(async (options) => {
      console.log('🚀 Running FULL optimization pipeline...');
      
      const steps = [
        { name: 'Coarse Search', cmd: 'npm', args: ['exec', 'tsx', 'tools/tune/stevie_optuna.ts'] },
        { name: 'Optuna Refinement', cmd: 'python', args: ['tools/tune/stevie_optuna.py'] },
        { name: 'Pareto Selection', cmd: 'npm', args: ['exec', 'tsx', 'tools/tune/select_and_emit.ts'] },
        { name: 'Walk-Forward Validation', cmd: 'npm', args: ['exec', 'tsx', 'tools/tune/walkforward_and_stress.ts'] }
      ];
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`\nStep ${i + 1}/${steps.length}: ${step.name}...`);
        
        const env = {
          ...process.env,
          COARSE_N: options.coarseTrials,
          TRIALS: options.optunaTrials
        };
        
        const result = spawnSync(step.cmd, step.args, { stdio: 'inherit', env });
        
        if (result.status !== 0) {
          console.error(`❌ ${step.name} failed`);
          process.exit(1);
        }
      }
      
      console.log('🎉 Complete optimization pipeline finished successfully!');
      
      // Show results
      if (fs.existsSync('artifacts/tuning/stevie.config.candidate.json')) {
        const candidate = JSON.parse(fs.readFileSync('artifacts/tuning/stevie.config.candidate.json', 'utf8'));
        console.log('\n📊 Final Candidate Summary:');
        console.log(JSON.stringify(candidate.provenance?.metrics || {}, null, 2));
      }
    });

  // Verification
  optuna
    .command('verify')
    .description('Verify complete tuning pipeline')
    .action(async () => {
      console.log('🔍 Verifying tuning pipeline...');
      const result = spawnSync('npm', ['exec', 'tsx', 'tools/tune/verify_tuning_pipeline.ts'], {
        stdio: 'inherit'
      });
      
      if (result.status === 0) {
        console.log('✅ Pipeline verification passed');
      } else {
        console.error('❌ Pipeline verification failed');
        process.exit(1);
      }
    });

  return optuna;
}
