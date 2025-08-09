/* UI Wiring Static Analysis Tool - Phase 1 */
import fs from 'fs';
import path from 'path';

const CLIENT_SRC = 'client/src';
const issues = [];
let exitCode = 0;

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for buttons without onClick or type="submit"
    if (line.includes('<button') || line.includes('<Button')) {
      if (!line.includes('onClick') && !line.includes('type="submit"') && !line.includes('type={"submit"}')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'warning',
          message: 'Button without onClick or type="submit"',
          code: line.trim()
        });
      }
    }
    
    // Check for links with href="#" or missing href
    if (line.includes('<a ') || line.includes('<Link')) {
      if (line.includes('href="#"') || (!line.includes('href=') && !line.includes('to='))) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'warning', 
          message: 'Link with href="#" or missing href/to',
          code: line.trim()
        });
      }
    }
    
    // Check for forms without onSubmit
    if (line.includes('<form') && !line.includes('onSubmit')) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'warning',
        message: 'Form without onSubmit handler',
        code: line.trim()
      });
    }
    
    // Check for missing data-testid on critical controls
    const criticalPatterns = [
      /submit-order|place-order|buy|sell|save|cancel|delete/i
    ];
    
    if (line.includes('<button') || line.includes('<Button')) {
      const hasCriticalAction = criticalPatterns.some(pattern => pattern.test(line));
      if (hasCriticalAction && !line.includes('data-testid')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'critical',
          message: 'Critical control missing data-testid',
          code: line.trim()
        });
        exitCode = 1;
      }
    }
    
    // Check for mutations without disabled={isPending} and toasts
    if (line.includes('useMutation') || line.includes('mutationFn')) {
      const functionContent = content.slice(content.indexOf(line));
      if (!functionContent.includes('disabled={') && !functionContent.includes('isPending')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'critical',
          message: 'Mutation without disabled={isPending} state',
          code: line.trim()
        });
        exitCode = 1;
      }
      
      if (!functionContent.includes('toast(') && !functionContent.includes('onSuccess') && !functionContent.includes('onError')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'warning',
          message: 'Mutation without success/error feedback',
          code: line.trim()
        });
      }
    }
  });
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDirectory(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      scanFile(filePath);
    }
  });
}

console.log('🔍 Running UI wiring static analysis...\n');

if (fs.existsSync(CLIENT_SRC)) {
  walkDirectory(CLIENT_SRC);
} else {
  console.error(`❌ Client source directory not found: ${CLIENT_SRC}`);
  process.exit(1);
}

// Report results
console.log(`📊 Found ${issues.length} total issues:\n`);

const criticalIssues = issues.filter(i => i.type === 'critical');
const warningIssues = issues.filter(i => i.type === 'warning');

if (criticalIssues.length > 0) {
  console.log(`❌ ${criticalIssues.length} critical issues:`);
  criticalIssues.forEach(issue => {
    console.log(`  ${issue.file}:${issue.line} - ${issue.message}`);
    console.log(`    ${issue.code}`);
  });
  console.log();
}

if (warningIssues.length > 0) {
  console.log(`⚠️  ${warningIssues.length} warnings:`);
  warningIssues.forEach(issue => {
    console.log(`  ${issue.file}:${issue.line} - ${issue.message}`);
  });
  console.log();
}

if (issues.length === 0) {
  console.log('✅ No UI wiring issues found!');
} else {
  console.log(`Summary: ${criticalIssues.length} critical, ${warningIssues.length} warnings`);
}

process.exit(exitCode);