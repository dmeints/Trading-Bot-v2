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

// Parse command line arguments
program.parse();