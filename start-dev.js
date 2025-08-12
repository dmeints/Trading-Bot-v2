
#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Skippy AI Trading Platform...\n');

// Start server
const server = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: '5000',
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/skippy_dev',
    SESSION_SECRET: process.env.SESSION_SECRET || 'dev-session-secret-change-in-production',
    REPLIT_DOMAINS: process.env.REPLIT_DOMAINS || 'replit.dev,replit.com'
  }
});

// Start client
const client = spawn('npm', ['run', 'client'], {
  stdio: ['inherit', 'pipe', 'pipe']
});

// Handle server output
server.stdout.on('data', (data) => {
  process.stdout.write(`[SERVER] ${data}`);
});

server.stderr.on('data', (data) => {
  process.stderr.write(`[SERVER] ${data}`);
});

// Handle client output  
client.stdout.on('data', (data) => {
  process.stdout.write(`[CLIENT] ${data}`);
});

client.stderr.on('data', (data) => {
  process.stderr.write(`[CLIENT] ${data}`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Skippy...');
  server.kill('SIGTERM');
  client.kill('SIGTERM');
  process.exit(0);
});

server.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Server exited with code ${code}`);
  }
});

client.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Client exited with code ${code}`);
  }
});

console.log('✅ Both server and client starting...');
