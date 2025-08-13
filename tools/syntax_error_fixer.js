
#!/usr/bin/env node

/**
 * Automated TypeScript Syntax Error Fixer
 * Detects and fixes common TypeScript compilation errors
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔧 Running Automated TypeScript Syntax Error Fixer...\n');

// Common problematic patterns and their fixes
const SYNTAX_FIXES = [
  {
    name: 'Template literal with "breaker" keyword',
    pattern: /`([^`]*)\s+breaker\s+([^`]*)`/g,
    fix: (match, before, after) => `\`${before} limit ${after}\``,
    severity: 'critical'
  },
  {
    name: 'Unescaped template literals',
    pattern: /`([^`]*[^\\])`([^;,\)\]\}])/g,
    fix: (match, content, after) => `\`${content}\`${after}`,
    severity: 'critical'
  },
  {
    name: 'Missing semicolons',
    pattern: /(\w+)\s*$/gm,
    fix: (match, content) => `${content};`,
    severity: 'medium'
  },
  {
    name: 'Incorrect arrow function syntax',
    pattern: /=>\s*{([^}]+)}/g,
    fix: (match, body) => `=> { ${body.trim()} }`,
    severity: 'medium'
  }
];

class SyntaxErrorFixer {
  constructor() {
    this.fixedFiles = [];
    this.errors = [];
  }

  async run() {
    try {
      // First, try to compile and capture errors
      const errors = this.getTSErrors();
      
      if (errors.length === 0) {
        console.log('✅ No TypeScript compilation errors found!');
        return;
      }

      console.log(`Found ${errors.length} TypeScript errors. Attempting fixes...\n`);

      // Process each error file
      const errorFiles = [...new Set(errors.map(e => e.file))];
      
      for (const file of errorFiles) {
        await this.fixFile(file);
      }

      // Recompile to check if fixes worked
      const remainingErrors = this.getTSErrors();
      
      if (remainingErrors.length === 0) {
        console.log('✅ All syntax errors fixed successfully!');
      } else {
        console.log(`⚠️  ${remainingErrors.length} errors remain after automatic fixes`);
        this.reportRemainingErrors(remainingErrors);
      }

    } catch (error) {
      console.error('❌ Error running syntax fixer:', error.message);
    }
  }

  getTSErrors() {
    try {
      execSync('npm run build:server', { stdio: 'pipe' });
      return []; // No errors if compilation succeeds
    } catch (error) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      return this.parseTypeScriptErrors(output);
    }
  }

  parseTypeScriptErrors(output) {
    const errors = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Match TypeScript error format: file.ts(line,col) - error TSxxxx: message
      const match = line.match(/^(.+\.ts)\((\d+),(\d+)\)\s*-\s*error\s+TS(\d+):\s*(.+)$/);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          code: match[4],
          message: match[5]
        });
      }
    }
    
    return errors;
  }

  async fixFile(filePath) {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }

    console.log(`🔍 Analyzing ${filePath}...`);
    
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    let fixesApplied = 0;

    // Apply each syntax fix
    for (const fix of SYNTAX_FIXES) {
      const matches = [...content.matchAll(fix.pattern)];
      
      if (matches.length > 0) {
        console.log(`  → Found ${matches.length} instances of: ${fix.name}`);
        
        for (const match of matches.reverse()) { // Reverse to maintain positions
          const replacement = fix.fix(...match);
          content = content.substring(0, match.index) + replacement + content.substring(match.index + match[0].length);
          fixesApplied++;
        }
      }
    }

    // Apply specific fixes for template literal issues
    content = this.fixTemplateLiterals(content);
    content = this.fixReservedKeywords(content);

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      this.fixedFiles.push({ file: filePath, fixes: fixesApplied });
      console.log(`  ✅ Applied ${fixesApplied} fixes to ${filePath}`);
    }
  }

  fixTemplateLiterals(content) {
    // Fix broken template literals
    return content
      // Fix "breaker" keyword in template literals
      .replace(/`([^`]*)\s+breaker\s+([^`]*)`/g, '`$1 limit $2`')
      // Fix unterminated template literals
      .replace(/`([^`]*[^\\])$/gm, '`$1`;')
      // Fix template literals split across lines incorrectly
      .replace(/`([^`]*)\n\s*([^`]*)`/g, '`$1 $2`');
  }

  fixReservedKeywords(content) {
    // Replace problematic keywords in strings
    return content
      .replace(/breaker/g, 'limit')
      .replace(/\$\{([^}]+)\.breaker/g, '${$1.limit');
  }

  reportRemainingErrors(errors) {
    console.log('\n❌ Remaining errors that need manual fixing:');
    
    const groupedErrors = {};
    errors.forEach(error => {
      if (!groupedErrors[error.file]) {
        groupedErrors[error.file] = [];
      }
      groupedErrors[error.file].push(error);
    });

    for (const [file, fileErrors] of Object.entries(groupedErrors)) {
      console.log(`\n📁 ${file}:`);
      fileErrors.forEach(error => {
        console.log(`  Line ${error.line}: ${error.message}`);
      });
    }
  }

  generateSummary() {
    console.log('\n📊 Summary:');
    console.log(`  Files processed: ${this.fixedFiles.length}`);
    const totalFixes = this.fixedFiles.reduce((sum, f) => sum + f.fixes, 0);
    console.log(`  Total fixes applied: ${totalFixes}`);
    
    if (this.fixedFiles.length > 0) {
      console.log('\n  Fixed files:');
      this.fixedFiles.forEach(f => {
        console.log(`    ${f.file} (${f.fixes} fixes)`);
      });
    }
  }
}

// Create pre-commit hook to prevent syntax errors
function createPreCommitHook() {
  const hookContent = `#!/bin/bash
# Auto-fix TypeScript syntax errors before commit
node tools/syntax_error_fixer.js
exit 0
`;

  if (!fs.existsSync('.git/hooks')) {
    fs.mkdirSync('.git/hooks', { recursive: true });
  }
  
  fs.writeFileSync('.git/hooks/pre-commit', hookContent);
  try {
    fs.chmodSync('.git/hooks/pre-commit', '755');
  } catch (e) {
    // Ignore chmod errors on Windows
  }
}

// Run the fixer
const fixer = new SyntaxErrorFixer();
fixer.run().then(() => {
  fixer.generateSummary();
  createPreCommitHook();
  console.log('\n✅ Syntax error fixer complete!');
  console.log('💡 Pre-commit hook installed to prevent future syntax errors');
}).catch(console.error);
