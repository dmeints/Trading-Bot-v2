
#!/usr/bin/env node

/**
 * Build Validator - Ensures clean TypeScript compilation
 * Runs before deployment to catch and fix syntax errors
 */

import { execSync } from 'child_process';
import fs from 'fs';

console.log('🔍 Running Build Validation...\n');

const CRITICAL_FILES = [
  'server/services/RiskGuards.ts',
  'server/routes.ts',
  'server/index.ts',
  'shared/schema.ts'
];

function validateBuild() {
  console.log('1️⃣ Checking TypeScript compilation...');
  
  try {
    // Clean build
    execSync('npm run build:server', { stdio: 'pipe' });
    console.log('✅ Server builds successfully');
    
    execSync('npm run build', { stdio: 'pipe' });  
    console.log('✅ Client builds successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Build failed:');
    console.error(error.stdout?.toString() || error.stderr?.toString());
    return false;
  }
}

function quickSyntaxFix() {
  console.log('2️⃣ Applying quick syntax fixes...');
  
  for (const file of CRITICAL_FILES) {
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf-8');
      let modified = false;
      
      // Fix common issues
      const fixes = [
        // Template literal fixes  
        [/`([^`]*)\s+breaker\s+([^`]*)`/g, '`$1 limit $2`'],
        // Missing semicolons at end of statements
        [/(\w+)\s*\n/g, '$1;\n'],
        // Unterminated template literals
        [/`([^`]*[^`\\])$/gm, '`$1`;']
      ];
      
      for (const [pattern, replacement] of fixes) {
        const newContent = content.replace(pattern, replacement);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      }
      
      if (modified) {
        fs.writeFileSync(file, content);
        console.log(`  ✅ Fixed syntax issues in ${file}`);
      }
    }
  }
}

function main() {
  // Try initial build
  if (validateBuild()) {
    console.log('\n✅ Build validation passed!');
    process.exit(0);
  }
  
  // Apply fixes and retry
  quickSyntaxFix();
  
  console.log('\n3️⃣ Retrying build after fixes...');
  if (validateBuild()) {
    console.log('\n✅ Build validation passed after auto-fixes!');
    process.exit(0);
  } else {
    console.error('\n❌ Build still failing after auto-fixes');
    console.error('Manual intervention required');
    process.exit(1);
  }
}

main();
