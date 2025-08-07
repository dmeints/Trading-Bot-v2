import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../server/utils/logger';

interface StrategyNode {
  id: string;
  type: 'signal_source' | 'filter' | 'position_sizer' | 'exit_rule';
  label: string;
  parameters: Record<string, any>;
}

interface StrategyConfig {
  name: string;
  description: string;
  nodes: StrategyNode[];
  connections: Array<{ id: string; source: string; target: string }>;
  metadata: {
    created: string;
    version: string;
    author: string;
  };
}

export function addBuilderCommands(program: Command): void {
  const builder = program
    .command('builder')
    .description('Strategy builder commands');

  // Export strategy to TypeScript file
  builder
    .command('export')
    .description('Export strategy from JSON config to TypeScript file')
    .requiredOption('-f, --file <path>', 'Path to strategy JSON config file')
    .option('-o, --output <path>', 'Output TypeScript file path')
    .option('--validate', 'Validate strategy config before export')
    .action(async (options) => {
      try {
        const configPath = path.resolve(options.file);
        const configData = await fs.readFile(configPath, 'utf-8');
        const strategy: StrategyConfig = JSON.parse(configData);

        if (options.validate) {
          validateStrategy(strategy);
        }

        const outputPath = options.output || 
          path.join(path.dirname(configPath), `${strategy.name.toLowerCase().replace(/\s+/g, '-')}.ts`);

        const strategyCode = generateStrategyCode(strategy);
        await fs.writeFile(outputPath, strategyCode, 'utf-8');

        logger.info(`Strategy exported successfully to ${outputPath}`);
        console.log(`✓ Strategy "${strategy.name}" exported to ${outputPath}`);
      } catch (error) {
        logger.error('Failed to export strategy', { error });
        console.error(`✗ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  // Validate strategy configuration
  builder
    .command('validate')
    .description('Validate strategy configuration file')
    .requiredOption('-f, --file <path>', 'Path to strategy JSON config file')
    .action(async (options) => {
      try {
        const configPath = path.resolve(options.file);
        const configData = await fs.readFile(configPath, 'utf-8');
        const strategy: StrategyConfig = JSON.parse(configData);

        validateStrategy(strategy);
        
        console.log(`✓ Strategy "${strategy.name}" is valid`);
        console.log(`  - ${strategy.nodes.length} nodes`);
        console.log(`  - ${strategy.connections.length} connections`);
        console.log(`  - Created: ${strategy.metadata.created}`);
      } catch (error) {
        logger.error('Strategy validation failed', { error });
        console.error(`✗ Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  // List saved strategies
  builder
    .command('list')
    .description('List all saved strategy configurations')
    .option('-d, --dir <path>', 'Strategy directory path', './strategies')
    .action(async (options) => {
      try {
        const strategiesDir = path.resolve(options.dir);
        
        try {
          await fs.access(strategiesDir);
        } catch {
          console.log('No strategies directory found');
          return;
        }

        const files = await fs.readdir(strategiesDir);
        const strategyFiles = files.filter(file => file.endsWith('.json'));

        if (strategyFiles.length === 0) {
          console.log('No strategy configurations found');
          return;
        }

        console.log(`Found ${strategyFiles.length} strategy configurations:\n`);

        for (const file of strategyFiles) {
          try {
            const configPath = path.join(strategiesDir, file);
            const configData = await fs.readFile(configPath, 'utf-8');
            const strategy: StrategyConfig = JSON.parse(configData);

            console.log(`📊 ${strategy.name}`);
            console.log(`   File: ${file}`);
            console.log(`   Description: ${strategy.description}`);
            console.log(`   Nodes: ${strategy.nodes.length}`);
            console.log(`   Created: ${new Date(strategy.metadata.created).toLocaleDateString()}`);
            console.log('');
          } catch (error) {
            console.log(`⚠️  ${file} - Invalid configuration`);
          }
        }
      } catch (error) {
        logger.error('Failed to list strategies', { error });
        console.error(`✗ List failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  // Create template strategy
  builder
    .command('template')
    .description('Create a template strategy configuration')
    .requiredOption('-n, --name <name>', 'Strategy name')
    .option('-o, --output <path>', 'Output directory', './strategies')
    .option('-t, --type <type>', 'Template type (basic|ema|rsi)', 'basic')
    .action(async (options) => {
      try {
        const outputDir = path.resolve(options.output);
        await fs.mkdir(outputDir, { recursive: true });

        const template = createStrategyTemplate(options.name, options.type);
        const filename = `${options.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        const outputPath = path.join(outputDir, filename);

        await fs.writeFile(outputPath, JSON.stringify(template, null, 2), 'utf-8');

        console.log(`✓ Template strategy "${options.name}" created at ${outputPath}`);
        console.log(`  Type: ${options.type}`);
        console.log(`  Nodes: ${template.nodes.length}`);
      } catch (error) {
        logger.error('Failed to create template', { error });
        console.error(`✗ Template creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });
}

function validateStrategy(strategy: StrategyConfig): void {
  if (!strategy.name || typeof strategy.name !== 'string') {
    throw new Error('Strategy must have a valid name');
  }

  if (!strategy.nodes || !Array.isArray(strategy.nodes)) {
    throw new Error('Strategy must have a nodes array');
  }

  if (strategy.nodes.length === 0) {
    throw new Error('Strategy must have at least one node');
  }

  // Validate nodes
  for (const node of strategy.nodes) {
    if (!node.id || !node.type || !node.label) {
      throw new Error(`Node ${node.id || 'unknown'} is missing required fields`);
    }

    if (!['signal_source', 'filter', 'position_sizer', 'exit_rule'].includes(node.type)) {
      throw new Error(`Node ${node.id} has invalid type: ${node.type}`);
    }
  }

  // Check for at least one signal source
  const signalSources = strategy.nodes.filter(node => node.type === 'signal_source');
  if (signalSources.length === 0) {
    throw new Error('Strategy must have at least one signal source');
  }
}

function generateStrategyCode(strategy: StrategyConfig): string {
  const className = strategy.name.replace(/\s+/g, '');
  
  return `// Generated Strategy: ${strategy.name}
// Description: ${strategy.description}
// Generated on: ${new Date().toISOString()}
// Nodes: ${strategy.nodes.length}

import { Strategy, StrategyContext, StrategyResult } from '../types/strategy';

export class ${className}Strategy implements Strategy {
  name = '${strategy.name}';
  description = '${strategy.description}';
  
  parameters = {
    ${strategy.nodes.map(node => 
      `${node.id}: ${JSON.stringify(node.parameters, null, 4)}`
    ).join(',\n    ')}
  };

  async execute(context: StrategyContext): Promise<StrategyResult> {
    const { marketData, indicators, portfolio, timestamp } = context;
    const signals = [];
    
    try {
      // Validate input data
      if (!marketData || marketData.length === 0) {
        return { signals: [] };
      }

${strategy.nodes.map(node => generateNodeCode(node, '      ')).join('\n\n')}

      return {
        signals,
        metadata: {
          strategy: '${strategy.name}',
          timestamp: timestamp.toISOString(),
          nodeCount: ${strategy.nodes.length},
          executedNodes: ${strategy.nodes.length}
        }
      };
    } catch (error) {
      console.error('Strategy execution error:', error);
      return { 
        signals: [],
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: timestamp.toISOString()
        }
      };
    }
  }

${generateHelperMethods(strategy.nodes)}
}

export default ${className}Strategy;`;
}

function generateNodeCode(node: StrategyNode, indent: string): string {
  switch (node.type) {
    case 'signal_source':
      return `${indent}// ${node.label} Signal Source
${indent}const ${node.id}Signal = await this.generate${node.parameters.subtype || 'Price'}Signal(
${indent}  marketData,
${indent}  this.parameters.${node.id}
${indent});
${indent}if (${node.id}Signal) {
${indent}  signals.push(${node.id}Signal);
${indent}}`;

    case 'filter':
      return `${indent}// ${node.label} Filter
${indent}const filteredSignals = signals.filter(signal => 
${indent}  this.apply${node.parameters.subtype || 'Threshold'}Filter(signal, this.parameters.${node.id})
${indent});
${indent}signals.length = 0;
${indent}signals.push(...filteredSignals);`;

    case 'position_sizer':
      return `${indent}// ${node.label} Position Sizer
${indent}signals.forEach(signal => {
${indent}  signal.size = this.calculate${node.parameters.subtype || 'Fixed'}Size(
${indent}    portfolio,
${indent}    this.parameters.${node.id}
${indent}  );
${indent}});`;

    case 'exit_rule':
      return `${indent}// ${node.label} Exit Rule
${indent}this.apply${node.parameters.subtype || 'ProfitTarget'}Exit(
${indent}  signals,
${indent}  this.parameters.${node.id}
${indent});`;

    default:
      return `${indent}// Unknown node type: ${node.type}`;
  }
}

function generateHelperMethods(nodes: StrategyNode[]): string {
  const methods = new Set<string>();
  
  nodes.forEach(node => {
    switch (node.type) {
      case 'signal_source':
        methods.add(`generate${node.parameters.subtype || 'Price'}Signal`);
        break;
      case 'filter':
        methods.add(`apply${node.parameters.subtype || 'Threshold'}Filter`);
        break;
      case 'position_sizer':
        methods.add(`calculate${node.parameters.subtype || 'Fixed'}Size`);
        break;
      case 'exit_rule':
        methods.add(`apply${node.parameters.subtype || 'ProfitTarget'}Exit`);
        break;
    }
  });

  return Array.from(methods).map(method => `
  private ${method}(data: any, params: any): any {
    // TODO: Implement ${method}
    console.warn('${method} not implemented');
    return null;
  }`).join('\n');
}

function createStrategyTemplate(name: string, type: string): StrategyConfig {
  const baseTemplate: StrategyConfig = {
    name,
    description: `${type.toUpperCase()} template strategy created by CLI`,
    nodes: [],
    connections: [],
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      author: 'CLI Generator'
    }
  };

  switch (type) {
    case 'ema':
      baseTemplate.nodes = [
        {
          id: 'ema_signal_1',
          type: 'signal_source',
          label: 'EMA Crossover',
          parameters: { subtype: 'ema', fast: 12, slow: 26 }
        },
        {
          id: 'position_sizer_1',
          type: 'position_sizer',
          label: 'Fixed Size',
          parameters: { subtype: 'fixed', size: 100 }
        }
      ];
      break;

    case 'rsi':
      baseTemplate.nodes = [
        {
          id: 'rsi_signal_1',
          type: 'signal_source',
          label: 'RSI',
          parameters: { subtype: 'rsi', period: 14, overbought: 70, oversold: 30 }
        },
        {
          id: 'filter_1',
          type: 'filter',
          label: 'Threshold Filter',
          parameters: { subtype: 'threshold', operator: '>', value: 0.5 }
        },
        {
          id: 'position_sizer_1',
          type: 'position_sizer',
          label: 'Percent Size',
          parameters: { subtype: 'percent', percent: 5 }
        }
      ];
      break;

    default: // basic
      baseTemplate.nodes = [
        {
          id: 'price_signal_1',
          type: 'signal_source',
          label: 'Price Action',
          parameters: { subtype: 'price', symbol: 'BTC', timeframe: '1h' }
        },
        {
          id: 'position_sizer_1',
          type: 'position_sizer',
          label: 'Fixed Size',
          parameters: { subtype: 'fixed', size: 100 }
        }
      ];
  }

  return baseTemplate;
}