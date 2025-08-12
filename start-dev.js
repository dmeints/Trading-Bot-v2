
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Skippy Trading Platform...');

// Start both server and client concurrently
const server = spawn('npm', ['run', 'server'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

const client = spawn('npm', ['run', 'client'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Skippy...');
  server.kill('SIGTERM');
  client.kill('SIGTERM');
  process.exit(0);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

client.on('error', (err) => {
  console.error('❌ Client error:', err);
});

console.log('✅ Skippy is starting up...');
