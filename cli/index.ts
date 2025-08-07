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

const program = new Command();

program
  .name('skippy')
  .description('Skippy Trading Platform CLI')
  .version('2.0.0');

// Add all command groups
program.addCommand(tradeCommand);
program.addCommand(deployCommand);
program.addCommand(trainingCommand);

// Parse command line arguments
program.parse();