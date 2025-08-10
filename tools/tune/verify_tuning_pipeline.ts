
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

interface PipelineStep {
  name: string;
  command: string[];
  outputFiles: string[];
  required: boolean;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    name: 'Coarse Grid Search',
    command: ['npm', 'exec', 'tsx', 'tools/tune/stevie_optuna.ts'],
    outputFiles: ['artifacts/tuning/coarse_results.csv'],
    required: true
  },
  {
    name: 'Optuna Refinement',
    command: ['python', 'tools/tune/stevie_optuna.py'],
    outputFiles: ['artifacts/tuning/optuna_top10.csv'],
    required: false
  },
  {
    name: 'Pareto Selection',
    command: ['npm', 'exec', 'tsx', 'tools/tune/select_and_emit.ts'],
    outputFiles: ['artifacts/tuning/stevie.config.candidate.json'],
    required: true
  },
  {
    name: 'Walk-Forward Validation',
    command: ['npm', 'exec', 'tsx', 'tools/tune/walkforward_and_stress.ts'],
    outputFiles: ['artifacts/tuning/walkforward_stress.csv'],
    required: true
  }
];

function checkFileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function validateConfig(configPath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!checkFileExists(configPath)) {
    return { valid: false, errors: ['Config file does not exist'] };
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Validate structure
    if (!config.version) errors.push('Missing version field');
    if (!config.params) errors.push('Missing params field');
    if (!config.provenance) errors.push('Missing provenance field');
    
    // Validate parameter ranges
    const params = config.params;
    if (params.baseRiskPct && (params.baseRiskPct < 0.1 || params.baseRiskPct > 1.0)) {
      errors.push('baseRiskPct out of safe range [0.1, 1.0]');
    }
    if (params.volPctBreakout && (params.volPctBreakout < 50 || params.volPctBreakout > 90)) {
      errors.push('volPctBreakout out of expected range [50, 90]');
    }
    
    return { valid: errors.length === 0, errors };
  } catch (e) {
    return { valid: false, errors: [`Invalid JSON: ${e.message}`] };
  }
}

async function runPipelineStep(step: PipelineStep): Promise<{ success: boolean; output: string }> {
  console.log(`🔄 Running: ${step.name}...`);
  
  const result = spawnSync(step.command[0], step.command.slice(1), {
    encoding: 'utf8',
    env: {
      ...process.env,
      TRIALS: '20', // Reduced for verification
      COARSE_N: '30',
      TUNE_FROM: '2024-07-01',
      TUNE_TO: '2024-07-15'
    }
  });
  
  const output = (result.stdout || '') + (result.stderr || '');
  const success = result.status === 0;
  
  // Check output files
  for (const file of step.outputFiles) {
    if (!checkFileExists(file)) {
      return { success: false, output: output + `\nMissing output file: ${file}` };
    }
  }
  
  return { success, output };
}

async function main() {
  console.log('🔍 Verifying Optuna tuning pipeline...\n');
  
  // Ensure artifacts directory exists
  fs.mkdirSync('artifacts/tuning', { recursive: true });
  
  const results: { step: string; success: boolean; output: string }[] = [];
  let overallSuccess = true;
  
  // Run each pipeline step
  for (const step of PIPELINE_STEPS) {
    const result = await runPipelineStep(step);
    results.push({
      step: step.name,
      success: result.success,
      output: result.output
    });
    
    if (!result.success) {
      console.log(`❌ ${step.name} failed`);
      if (step.required) {
        overallSuccess = false;
        break;
      } else {
        console.log(`⚠️ ${step.name} failed but is optional, continuing...`);
      }
    } else {
      console.log(`✅ ${step.name} completed`);
    }
  }
  
  // Validate final configuration
  if (overallSuccess && checkFileExists('artifacts/tuning/stevie.config.candidate.json')) {
    const configValidation = validateConfig('artifacts/tuning/stevie.config.candidate.json');
    if (!configValidation.valid) {
      console.log('❌ Configuration validation failed:');
      configValidation.errors.forEach(err => console.log(`  - ${err}`));
      overallSuccess = false;
    } else {
      console.log('✅ Configuration validation passed');
    }
  }
  
  // Generate verification report
  const report = {
    timestamp: new Date().toISOString(),
    overallSuccess,
    steps: results,
    outputFiles: {
      coarse_results: checkFileExists('artifacts/tuning/coarse_results.csv'),
      optuna_top10: checkFileExists('artifacts/tuning/optuna_top10.csv'),
      candidate_config: checkFileExists('artifacts/tuning/stevie.config.candidate.json'),
      walkforward_stress: checkFileExists('artifacts/tuning/walkforward_stress.csv')
    }
  };
  
  fs.writeFileSync('artifacts/tuning/verification_report.json', JSON.stringify(report, null, 2));
  
  console.log('\n📊 Pipeline Verification Summary:');
  console.log(`Overall Status: ${overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Report: artifacts/tuning/verification_report.json`);
  
  if (!overallSuccess) {
    process.exit(1);
  }
}

main().catch(console.error);
// Verification pipeline for tuning results
import fs from "fs";
import { spawnSync } from "node:child_process";

function run(cmd: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  return { ok: r.status === 0, out };
}

function checkFile(path: string): boolean {
  return fs.existsSync(path);
}

function loadCandidate(): any {
  const path = "artifacts/tuning/stevie.config.candidate.json";
  if (!checkFile(path)) throw new Error("Candidate config not found");
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

async function main() {
  console.log("🔍 Running tuning verification pipeline...");
  
  const checks = [
    { name: "Mock scan", cmd: "npm", args: ["run", "audit:mock"] },
    { name: "Entropy test", cmd: "npm", args: ["run", "test", "tools/metrics_entropy.spec.ts"] },
    { name: "Cross-source audit", cmd: "npm", args: ["exec", "tsx", "tools/audit_cross_source.ts"] },
    { name: "Feature drift", cmd: "npm", args: ["exec", "tsx", "tools/feature_drift.ts"] }
  ];
  
  for (const check of checks) {
    console.log(`  Running ${check.name}...`);
    const result = run(check.cmd, check.args);
    if (!result.ok) {
      console.error(`❌ ${check.name} failed:`);
      console.error(result.out);
      process.exit(1);
    }
    console.log(`  ✅ ${check.name} passed`);
  }
  
  // Check required files
  const requiredFiles = [
    "artifacts/tuning/coarse_results.csv",
    "artifacts/tuning/optuna_top10.csv", 
    "artifacts/tuning/stevie.config.candidate.json",
    "artifacts/tuning/walkforward_stress.csv"
  ];
  
  for (const file of requiredFiles) {
    if (!checkFile(file)) {
      console.error(`❌ Required file missing: ${file}`);
      process.exit(1);
    }
    console.log(`  ✅ Found ${file}`);
  }
  
  // Validate candidate constraints
  const candidate = loadCandidate();
  const metrics = candidate.provenance?.metrics;
  
  if (!metrics) {
    console.error("❌ Candidate missing metrics");
    process.exit(1);
  }
  
  const constraints = [
    { name: "Profit Factor ≥ 1.2", value: metrics.profitFactor, min: 1.2 },
    { name: "Max Drawdown ≤ 10%", value: metrics.maxDrawdown, max: 10 },
    { name: "Trades/day ≥ 3", value: metrics.tradesPerDay, min: 3 },
    { name: "Trades/day ≤ 30", value: metrics.tradesPerDay, max: 30 }
  ];
  
  for (const constraint of constraints) {
    const { name, value, min, max } = constraint;
    let passed = true;
    
    if (min !== undefined && value < min) passed = false;
    if (max !== undefined && value > max) passed = false;
    
    if (!passed) {
      console.error(`❌ Constraint violation: ${name} (value: ${value})`);
      process.exit(1);
    }
    console.log(`  ✅ ${name}: ${value}`);
  }
  
  console.log("🎉 All verification checks passed!");
  console.log("📊 Candidate Summary:");
  console.log(`  Score: ${metrics.score?.toFixed(2)}`);
  console.log(`  Sharpe: ${metrics.sharpe?.toFixed(3)}`);
  console.log(`  Profit Factor: ${metrics.profitFactor?.toFixed(2)}`);
  console.log(`  Max Drawdown: ${metrics.maxDrawdown?.toFixed(2)}%`);
  console.log(`  Trades/Day: ${metrics.tradesPerDay?.toFixed(1)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(e); process.exit(1); });
}
