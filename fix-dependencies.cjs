#!/usr/bin/env node

const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function fixDependencies() {
  console.log('🔧 Fixing dependency issues...');
  
  try {
    // Read the current package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Fix the problematic vitest version
    if (packageJson.devDependencies && packageJson.devDependencies.vitest) {
      console.log('📦 Fixing vitest version from ^1.7.0 to ^1.6.1');
      packageJson.devDependencies.vitest = '^1.6.1';
    }
    
    // Create a backup
    fs.writeFileSync('package.json.original', JSON.stringify(JSON.parse(fs.readFileSync('package.json', 'utf8')), null, 2));
    
    // Write the fixed package.json
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    
    console.log('✅ Fixed package.json - installing dependencies...');
    
    // Clean up any existing node_modules and package-lock
    try {
      await execAsync('rm -rf node_modules package-lock.json');
    } catch (e) {
      // Ignore if files don't exist
    }
    
    // Install dependencies
    await execAsync('npm install');
    
    console.log('🎉 Dependencies installed successfully!');
    console.log('🚀 Application should now be able to start');
    
  } catch (error) {
    console.error('❌ Error fixing dependencies:', error.message);
    
    // Restore original package.json if it exists
    if (fs.existsSync('package.json.original')) {
      fs.renameSync('package.json.original', 'package.json');
      console.log('📋 Restored original package.json');
    }
    
    process.exit(1);
  }
}

fixDependencies();