/**
 * Build CLI executable for Skippy Trading Platform
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const buildCLI = () => {
  console.log('🔨 Building Skippy CLI...');
  
  try {
    // Create dist directory
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist', { recursive: true });
    }
    
    // Build CLI with esbuild
    execSync(`esbuild cli/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist/cli --target=node20`, {
      stdio: 'inherit'
    });
    
    // Make executable
    const cliPath = path.join('dist', 'cli', 'index.js');
    if (fs.existsSync(cliPath)) {
      fs.chmodSync(cliPath, 0o755);
    }
    
    console.log('✅ CLI built successfully');
    console.log('📦 Location: dist/cli/index.js');
    console.log('🚀 Usage: node dist/cli/index.js [command]');
    
  } catch (error) {
    console.error('❌ CLI build failed:', error);
    process.exit(1);
  }
};

buildCLI();