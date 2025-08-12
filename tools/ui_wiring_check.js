/* UI Wiring Audit Tool - Flags critical wiring issues */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientSrc = path.join(__dirname, '../client/src');
const errors = [];
const warnings = [];

// Critical elements that must have data-testid
const criticalElements = [
  'submit', 'save', 'place-order', 'buy', 'sell', 'cancel', 'delete',
  'confirm', 'apply', 'execute', 'close-position'
];

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Check for buttons without onClick or type="submit"
    const buttonPattern = /<Button[^>]*>/g;
    const buttonMatches = content.matchAll(buttonPattern);
    
    for (const match of buttonMatches) {
      const buttonTag = match[0];
      const hasOnClick = buttonTag.includes('onClick');
      const hasTypeSubmit = buttonTag.includes('type="submit"');
      const hasDisabled = buttonTag.includes('disabled');
      
      if (!hasOnClick && !hasTypeSubmit) {
        warnings.push(`${relativePath}:${getLineNumber(content, match.index)} - Button without onClick or type="submit"`);
      }
    }
    
    // Check for links with href="#" or missing href
    const linkPattern = /<a[^>]*>/g;
    const linkMatches = content.matchAll(linkPattern);
    
    for (const match of linkMatches) {
      const linkTag = match[0];
      const hasEmptyHref = linkTag.includes('href="#"');
      const hasHref = linkTag.includes('href=');
      
      if (hasEmptyHref) {
        warnings.push(`${relativePath}:${getLineNumber(content, match.index)} - Link with href="#"`);
      } else if (!hasHref) {
        warnings.push(`${relativePath}:${getLineNumber(content, match.index)} - Link missing href attribute`);
      }
    }
    
    // Check for forms without onSubmit
    const formPattern = /<form[^>]*>/g;
    const formMatches = content.matchAll(formPattern);
    
    for (const match of formMatches) {
      const formTag = match[0];
      const hasOnSubmit = formTag.includes('onSubmit');
      
      if (!hasOnSubmit) {
        warnings.push(`${relativePath}:${getLineNumber(content, match.index)} - Form without onSubmit handler`);
      }
    }
    
    // Check for missing data-testid on critical controls
    criticalElements.forEach(element => {
      const testIdPattern = new RegExp(`data-testid="[^"]*${element}[^"]*"`, 'g');
      const hasTestId = testIdPattern.test(content);
      
      // Look for buttons or elements that might need this testid
      const elementPattern = new RegExp(`(button|Button)[^>]*(?:${element}|${element.replace('-', '\\s+')})`,'gi');
      const hasElement = elementPattern.test(content);
      
      if (hasElement && !hasTestId) {
        errors.push(`${relativePath} - Missing data-testid for critical element: ${element}`);
      }
    });
    
    // Check mutations without disabled={isPending} and success/error toasts
    const mutationPattern = /useMutation|\.mutate\(/g;
    const hasMutation = mutationPattern.test(content);
    
    if (hasMutation) {
      const hasDisabledPending = /disabled.*isPending|disabled.*isLoading/.test(content);
      const hasToast = /toast\(|useToast/.test(content);
      
      if (!hasDisabledPending) {
        warnings.push(`${relativePath} - Mutation without disabled={isPending} state`);
      }
      if (!hasToast) {
        warnings.push(`${relativePath} - Mutation without toast feedback`);
      }
    }
    
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error.message);
  }
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      scanFile(fullPath);
    }
  }
}

// Run the audit
console.log('🔍 Running UI Wiring Audit...\n');

scanDirectory(clientSrc);

// Report results
if (errors.length > 0) {
  console.log('❌ CRITICAL ISSUES:');
  errors.forEach(error => console.log(`  ${error}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS:');
  warnings.forEach(warning => console.log(`  ${warning}`));
  console.log('');
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ No wiring issues found!');
} else {
  console.log(`📊 Summary: ${errors.length} critical issues, ${warnings.length} warnings`);
}

// Exit with error code if critical issues found
process.exit(errors.length > 0 ? 1 : 0);