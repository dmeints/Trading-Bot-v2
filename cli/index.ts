#!/usr/bin/env node
/**
 * Skippy Trading Platform CLI
 * 
 * Main CLI entry point with all commands
 */

import { Command } from 'commander';
import { tradeCommand } from './commands/trade';
import { deployCommand } from './commands/deploy';
import { trainingCommand } from './commands/training';
import { transcendenceCommand } from './commands/transcendence';
import { advancedCommand } from './commands/advancedFeatures';
import { temporalCommand } from './commands/temporal';
import { universalCommand } from './commands/universal';
import { aiChat } from './commands/aiChat';
import { optuna } from './commands/optuna';
import { scenarioCommand } from './commands/scenarioTest';
import { registerConformalTuningCommands } from './commands/conformalTuning';

const program = new Command();

program
  .name('skippy')
  .description('Skippy Trading Platform CLI')
  .version('2.0.0');

// Add all command groups
program.addCommand(tradeCommand);
program.addCommand(deployCommand);
program.addCommand(trainingCommand);
program.addCommand(transcendenceCommand);
program.addCommand(advancedCommand);
program.addCommand(temporalCommand);
program.addCommand(universalCommand);
program.addCommand(aiChat);
program.addCommand(optuna);
program.addCommand(scenarioCommand);

// Register conformal tuning commands in CLI program
program.addCommand(registerConformalTuningCommands(program));


// Parse command line arguments
program.parse();