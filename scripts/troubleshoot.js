
#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔍 Skippy Troubleshooting Tool\n');

// Check if server is running
function checkServerStatus() {
  try {
    const response = execSync('curl -s http://localhost:5000/api/health', { timeout: 5000 });
    console.log('✅ Server is running and responding');
    return true;
  } catch (error) {
    console.log('❌ Server is not responding');
    return false;
  }
}

// Check logs
function checkLogs() {
  if (fs.existsSync('logs/app.log')) {
    console.log('\n📋 Last 200 lines of app.log:');
    try {
      const logs = execSync('tail -n 200 logs/app.log', { encoding: 'utf8' });
      console.log(logs);
    } catch (error) {
      console.log('❌ Could not read logs:', error.message);
    }
  } else {
    console.log('⚠️  No app.log found in logs/ directory');
  }
}

// Check TypeScript types
function checkTypescriptTypes() {
  try {
    execSync('npm list @types/node', { stdio: 'ignore' });
    console.log('✅ @types/node is installed');
  } catch (error) {
    console.log('⚠️  @types/node missing - run: npm i -D @types/node');
  }
}

// Check database drivers
function checkDatabaseDrivers() {
  const drivers = ['pg', 'mysql2', 'better-sqlite3', 'sqlite3'];
  let foundDriver = false;
  
  drivers.forEach(driver => {
    try {
      execSync(`npm list ${driver}`, { stdio: 'ignore' });
      console.log(`✅ ${driver} is installed`);
      foundDriver = true;
    } catch (error) {
      // Driver not found, this is normal
    }
  });
  
  if (!foundDriver) {
    console.log('⚠️  No database drivers found. Install one:');
    console.log('   For Postgres: npm i pg');
    console.log('   For MySQL: npm i mysql2');
    console.log('   For SQLite: npm i better-sqlite3');
  }
}

// Check CORS configuration
function checkCorsConfig() {
  if (fs.existsSync('server/middleware/security.ts')) {
    const content = fs.readFileSync('server/middleware/security.ts', 'utf8');
    if (content.includes('cors(')) {
      console.log('✅ CORS middleware found in security.ts');
    } else {
      console.log('⚠️  CORS configuration may need adjustment in server/middleware/security.ts');
    }
  } else {
    console.log('⚠️  security.ts middleware not found');
  }
}

// Main troubleshooting flow
async function main() {
  const serverRunning = checkServerStatus();
  
  if (!serverRunning) {
    console.log('\n🔧 Server troubleshooting:');
    checkLogs();
  }
  
  console.log('\n🔧 Dependency checks:');
  checkTypescriptTypes();
  checkDatabaseDrivers();
  
  console.log('\n🔧 Configuration checks:');
  checkCorsConfig();
  
  if (!serverRunning) {
    console.log('\n💡 Try these steps:');
    console.log('1. Check logs: tail -n 200 logs/app.log');
    console.log('2. Restart server: npm run start');
    console.log('3. Check database connection: npm run ready:check');
  }
}

main().catch(console.error);
