#!/usr/bin/env node

/**
 * Proactive Error Prevention Scanner
 * Scans codebase for potential JavaScript/TypeScript errors that could cause runtime crashes
 */

import fs from 'fs';
import path from 'path';

// Critical error patterns to detect
const errorPatterns = [
  {
    name: "Unsafe .toFixed() calls",
    pattern: /(\w+)\.toFixed\(/g,
    severity: "critical",
    description: "Calling .toFixed() on potentially undefined/null values",
    fix: "Add null check: (value || 0).toFixed()"
  },
  {
    name: "Unsafe parseFloat() with .toFixed()",
    pattern: /parseFloat\([^)]+\)\.toFixed\(/g,
    severity: "critical", 
    description: "parseFloat() can return NaN, causing .toFixed() to fail",
    fix: "Use: (parseFloat(value) || 0).toFixed()"
  },
  {
    name: "Array operations without safety checks",
    pattern: /(\w+)\.map\(/g,
    severity: "medium",
    description: "Calling .map() on potentially undefined arrays",
    fix: "Add check: (array || []).map()"
  },
  {
    name: "Object property access without optional chaining",
    pattern: /(\w+)\.(\w+)\.(\w+)/g,
    severity: "medium",
    description: "Deep property access without null checks",
    fix: "Use optional chaining: obj?.prop?.subprop"
  },
  {
    name: "Math operations without null checks",
    pattern: /Math\.\w+\([^)]*\w+[^)]*\)\.toFixed\(/g,
    severity: "high",
    description: "Math operations with potentially undefined values followed by .toFixed()",
    fix: "Ensure inputs are numbers: Math.abs(value || 0).toFixed()"
  }
];

// Component file patterns to scan
const componentPatterns = [
  'client/src/components/**/*.tsx',
  'client/src/pages/**/*.tsx',
  'client/src/routes/**/*.tsx'
];

function scanDirectory(dir, pattern) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files.push(...scanDirectory(fullPath, pattern));
    } else if (stat.isFile() && pattern.test(item)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];
  
  for (const errorPattern of errorPatterns) {
    let match;
    errorPattern.pattern.lastIndex = 0; // Reset regex
    
    while ((match = errorPattern.pattern.exec(content)) !== null) {
      // Find line number
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const line = lines[lineNumber - 1];
      
      // Skip if already has null check
      if (line.includes('|| 0') || line.includes('?.') || line.includes('??')) {
        continue;
      }
      
      issues.push({
        file: filePath,
        line: lineNumber,
        column: match.index - beforeMatch.lastIndexOf('\n'),
        severity: errorPattern.severity,
        pattern: errorPattern.name,
        description: errorPattern.description,
        fix: errorPattern.fix,
        code: line.trim(),
        match: match[0]
      });
    }
  }
  
  return issues;
}

function main() {
  console.log('🔍 Running Proactive Error Prevention Scan...\n');
  
  const allIssues = [];
  const filePattern = /\.(tsx?)$/;
  
  // Scan component directories
  const basePaths = ['client/src/components', 'client/src/pages', 'client/src/routes'];
  
  for (const basePath of basePaths) {
    if (fs.existsSync(basePath)) {
      const files = scanDirectory(basePath, filePattern);
      
      for (const file of files) {
        const issues = scanFile(file);
        allIssues.push(...issues);
      }
    }
  }
  
  // Group by severity
  const critical = allIssues.filter(i => i.severity === 'critical');
  const high = allIssues.filter(i => i.severity === 'high');
  const medium = allIssues.filter(i => i.severity === 'medium');
  
  console.log(`📊 Found ${allIssues.length} potential issues:\n`);
  
  if (critical.length > 0) {
    console.log(`❌ ${critical.length} CRITICAL issues (likely to cause crashes):`);
    critical.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line} - ${issue.pattern}`);
      console.log(`    Code: ${issue.code}`);
      console.log(`    Fix: ${issue.fix}`);
      console.log('');
    });
  }
  
  if (high.length > 0) {
    console.log(`⚠️  ${high.length} HIGH priority issues:`);
    high.slice(0, 5).forEach(issue => {
      console.log(`  ${issue.file}:${issue.line} - ${issue.pattern}`);
      console.log(`    Code: ${issue.code}`);
    });
    if (high.length > 5) console.log(`  ... and ${high.length - 5} more`);
    console.log('');
  }
  
  if (medium.length > 0) {
    console.log(`📋 ${medium.length} MEDIUM priority issues (showing first 3):`);
    medium.slice(0, 3).forEach(issue => {
      console.log(`  ${issue.file}:${issue.line} - ${issue.pattern}`);
    });
    if (medium.length > 3) console.log(`  ... and ${medium.length - 3} more`);
  }
  
  // Summary recommendations
  if (critical.length > 0) {
    console.log('\n🚨 IMMEDIATE ACTION REQUIRED:');
    console.log('Critical issues found that are likely to cause runtime crashes.');
    console.log('Priority: Fix .toFixed() calls and parseFloat() operations first.');
  } else {
    console.log('\n✅ No critical issues found!');
  }
  
  return allIssues.length;
}

// Check if running as main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const issueCount = main();
  process.exit(issueCount > 0 ? 1 : 0);
}

export { main };