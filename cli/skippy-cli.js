#!/usr/bin/env node

/**
 * Skippy Trading Platform CLI
 * Production-grade command-line interface for system management
 */

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const archiver = require('archiver');

const program = new Command();

program
  .name('skippy')
  .description('Skippy Trading Platform CLI - Production management toolkit')
  .version('1.0.0');

// Disaster Recovery Commands
const recover = program
  .command('recover')
  .description('Disaster recovery operations')
  .option('-f, --file <backup>', 'Backup file to restore from')
  .option('-d, --dir <directory>', 'Backup directory', './backups')
  .option('--test-only', 'Run smoke tests only')
  .option('--skip-deps', 'Skip dependency installation')
  .option('--skip-db', 'Skip database operations')
  .option('--skip-tests', 'Skip smoke tests')
  .action(async (options) => {
    console.log('🚨 Starting disaster recovery process...');
    
    const scriptPath = path.join(__dirname, '..', 'scripts', 'disaster-recovery.sh');
    const args = [];
    
    if (options.file) args.push(options.file);
    if (options.dir) args.push('--backup-dir', options.dir);
    if (options.testOnly) args.push('--test-only');
    if (options.skipDeps) args.push('--skip-deps');
    if (options.skipDb) args.push('--skip-db');
    if (options.skipTests) args.push('--skip-tests');
    
    try {
      await runScript(scriptPath, args);
      console.log('✅ Disaster recovery completed successfully');
    } catch (error) {
      console.error('❌ Disaster recovery failed:', error.message);
      process.exit(1);
    }
  });

// Backup Commands
const backup = program
  .command('backup')
  .description('Create system backup')
  .option('-o, --output <file>', 'Output backup file')
  .option('--include-db', 'Include database dump')
  .option('--compress', 'Compress backup archive')
  .action(async (options) => {
    console.log('📦 Creating system backup...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = options.output || `skippy-backup-${timestamp}.tar.gz`;
    
    try {
      await createBackup(backupFile, options);
      console.log(`✅ Backup created: ${backupFile}`);
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      process.exit(1);
    }
  });

// Load Testing Commands
const loadtest = program
  .command('loadtest')
  .description('Run load and performance tests')
  .option('-t, --type <type>', 'Test type: websocket, chaos, all', 'all')
  .option('-u, --users <number>', 'Number of concurrent users', '500')
  .option('--duration <minutes>', 'Test duration in minutes', '5')
  .option('--base-url <url>', 'Base URL for testing', 'http://localhost:5000')
  .action(async (options) => {
    console.log('🔥 Starting load tests...');
    
    try {
      await runLoadTests(options);
      console.log('✅ Load tests completed');
    } catch (error) {
      console.error('❌ Load tests failed:', error.message);
      process.exit(1);
    }
  });

// Monitoring Commands
const monitor = program
  .command('monitor')
  .description('Monitoring and observability operations')
  .option('--metrics', 'Show current metrics')
  .option('--alerts', 'Check active alerts')
  .option('--health', 'Perform health check')
  .option('--slo', 'Show SLO status')
  .action(async (options) => {
    console.log('📊 Checking system status...');
    
    try {
      await runMonitoring(options);
    } catch (error) {
      console.error('❌ Monitoring check failed:', error.message);
      process.exit(1);
    }
  });

// Database Commands
const db = program
  .command('db')
  .description('Database management operations')
  .option('--migrate', 'Run database migrations')
  .option('--seed', 'Seed database with sample data')
  .option('--reset', 'Reset database (WARNING: destroys data)')
  .option('--backup', 'Create database backup')
  .option('--restore <file>', 'Restore database from backup')
  .action(async (options) => {
    console.log('🗄️ Database operation...');
    
    try {
      await runDatabaseOperations(options);
    } catch (error) {
      console.error('❌ Database operation failed:', error.message);
      process.exit(1);
    }
  });

// Service Management Commands
const service = program
  .command('service')
  .description('Service management operations')
  .option('--start', 'Start services')
  .option('--stop', 'Stop services')
  .option('--restart', 'Restart services')
  .option('--status', 'Check service status')
  .option('--logs', 'Show service logs')
  .action(async (options) => {
    console.log('⚙️ Service management...');
    
    try {
      await runServiceOperations(options);
    } catch (error) {
      console.error('❌ Service operation failed:', error.message);
      process.exit(1);
    }
  });

// Helper Functions
async function runScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });
    
    child.on('error', reject);
  });
}

async function createBackup(outputFile, options) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFile);
    const archive = archiver('tar', {
      gzip: true,
      gzipOptions: { level: 9 }
    });
    
    output.on('close', () => {
      console.log(`Archive created: ${archive.pointer()} total bytes`);
      resolve();
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    
    // Add project files
    archive.glob('**/*', {
      cwd: process.cwd(),
      ignore: [
        'node_modules/**',
        '.git/**',
        'tmp/**',
        'logs/**',
        '*.log',
        '.env',
        'backups/**',
        outputFile
      ]
    });
    
    // Add database dump if requested
    if (options.includeDb) {
      // In production, you would dump the actual database
      archive.append('-- Database dump placeholder\n', { name: 'database-dump.sql' });
    }
    
    archive.finalize();
  });
}

async function runLoadTests(options) {
  const testScripts = [];
  
  if (options.type === 'websocket' || options.type === 'all') {
    testScripts.push('load-tests/k6-websocket-test.js');
  }
  
  if (options.type === 'chaos' || options.type === 'all') {
    testScripts.push('load-tests/chaos-test.js');
  }
  
  for (const script of testScripts) {
    console.log(`Running ${script}...`);
    
    await new Promise((resolve, reject) => {
      const child = spawn('k6', ['run', script], {
        stdio: 'inherit',
        env: {
          ...process.env,
          BASE_URL: options.baseUrl,
          VUS: options.users,
          DURATION: `${options.duration}m`
        }
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Load test failed with code ${code}`));
        }
      });
      
      child.on('error', reject);
    });
  }
}

async function runMonitoring(options) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  
  if (options.health) {
    console.log('Checking system health...');
    await makeRequest(`${baseUrl}/api/health`);
  }
  
  if (options.metrics) {
    console.log('Fetching metrics...');
    await makeRequest(`${baseUrl}/api/monitoring/metrics`);
  }
  
  if (options.alerts) {
    console.log('Checking alerts...');
    await makeRequest(`${baseUrl}/api/monitoring/alerts`);
  }
  
  if (options.slo) {
    console.log('Checking SLO status...');
    await makeRequest(`${baseUrl}/api/monitoring/slo`);
  }
}

async function runDatabaseOperations(options) {
  if (options.migrate) {
    console.log('Running database migrations...');
    await runCommand('npm run db:push');
  }
  
  if (options.seed) {
    console.log('Seeding database...');
    await runCommand('npm run db:seed');
  }
  
  if (options.reset) {
    console.log('⚠️  Resetting database (this will destroy all data)...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
    await runCommand('npm run db:reset');
  }
  
  if (options.backup) {
    console.log('Creating database backup...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    await runCommand(`pg_dump $DATABASE_URL > backups/db-backup-${timestamp}.sql`);
  }
  
  if (options.restore) {
    console.log(`Restoring database from ${options.restore}...`);
    await runCommand(`psql $DATABASE_URL < ${options.restore}`);
  }
}

async function runServiceOperations(options) {
  if (options.start) {
    console.log('Starting services...');
    await runCommand('npm run dev &');
  }
  
  if (options.stop) {
    console.log('Stopping services...');
    await runCommand('pkill -f "npm run dev"');
  }
  
  if (options.restart) {
    console.log('Restarting services...');
    await runCommand('pkill -f "npm run dev" && npm run dev &');
  }
  
  if (options.status) {
    console.log('Checking service status...');
    await runCommand('ps aux | grep "npm run dev"');
  }
  
  if (options.logs) {
    console.log('Showing service logs...');
    await runCommand('tail -f logs/application.log');
  }
}

async function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr);
        reject(error);
      } else {
        console.log(stdout);
        resolve(stdout);
      }
    });
  });
}

async function makeRequest(url) {
  const https = require('https');
  const http = require('http');
  
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(JSON.stringify(parsed, null, 2));
          resolve(parsed);
        } catch (e) {
          console.log(data);
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Parse and execute
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}