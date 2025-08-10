#!/usr/bin/env node

/**
 * Anti-Mock Audit Scanner
 * Scans the codebase for potential mock data infiltration
 */

const fs = require('fs');
const path = require('path');

// Mock patterns to detect
const MOCK_PATTERNS = [
  /mock|fake|test|placeholder|example/i,
  /lorem ipsum/i,
  /foo.*bar|bar.*foo/i,
  /123.*456.*789/,
  /pattern_\d+/,
  /sample.*data|demo.*data/i,
  /\$?0+(\.0+)?$/,  // All zeros
  /9{4,}/,          // Many 9s
  /1{4,}/,          // Many 1s
  /999+/,
  /temp|tmp/i,
  /fixture/i
];

// File patterns to scan
const SCAN_PATTERNS = [
  '**/*.ts',
  '**/*.js',
  '**/*.json',
  '**/*.md'
];

// Directories to ignore
const IGNORE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'tmp'
];

class MockDataScanner {
  constructor() {
    this.findings = [];
    this.scannedFiles = 0;
    this.startTime = Date.now();
  }

  /**
   * Main scan function
   */
  async scan(rootDir = '.') {
    console.log('[MockScan] Starting anti-mock audit...');
    console.log(`[MockScan] Scanning directory: ${path.resolve(rootDir)}`);
    
    await this.scanDirectory(rootDir);
    
    const duration = Date.now() - this.startTime;
    console.log(`[MockScan] Scan completed in ${duration}ms`);
    console.log(`[MockScan] Files scanned: ${this.scannedFiles}`);
    console.log(`[MockScan] Issues found: ${this.findings.length}`);
    
    if (this.findings.length > 0) {
      console.log('\n[MockScan] ISSUES DETECTED:');
      this.findings.forEach((finding, index) => {
        console.log(`${index + 1}. ${finding.file}:${finding.line}`);
        console.log(`   Issue: ${finding.issue}`);
        console.log(`   Context: ${finding.context.trim()}`);
        console.log('');
      });
      
      // Write report
      const reportPath = 'mock-scan-report.json';
      fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        scannedFiles: this.scannedFiles,
        duration,
        findings: this.findings
      }, null, 2));
      
      console.log(`[MockScan] Report written to: ${reportPath}`);
      return false; // Issues found
    } else {
      console.log('[MockScan] ✅ No mock data issues detected');
      return true; // Clean
    }
  }

  /**
   * Recursively scan directory
   */
  async scanDirectory(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
            await this.scanDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          if (this.shouldScanFile(entry.name)) {
            await this.scanFile(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`[MockScan] Cannot read directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Check if file should be scanned
   */
  shouldScanFile(filename) {
    const ext = path.extname(filename);
    return ['.ts', '.js', '.json', '.md', '.txt'].includes(ext);
  }

  /**
   * Scan individual file
   */
  async scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.scannedFiles++;
      
      // Skip binary files
      if (this.isBinaryFile(content)) {
        return;
      }
      
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const issues = this.checkLine(line, lineNumber, filePath);
        this.findings.push(...issues);
      });
      
    } catch (error) {
      console.warn(`[MockScan] Cannot read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Check if content appears to be binary
   */
  isBinaryFile(content) {
    // Check for null bytes or high ratio of non-printable characters
    const nullBytes = (content.match(/\x00/g) || []).length;
    if (nullBytes > 0) return true;
    
    const nonPrintable = content.split('').filter(char => {
      const code = char.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13;
    }).length;
    
    return nonPrintable / content.length > 0.1;
  }

  /**
   * Check individual line for mock patterns
   */
  checkLine(line, lineNumber, filePath) {
    const findings = [];
    
    // Skip comments (basic detection)
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
      return findings;
    }
    
    // Check each pattern
    MOCK_PATTERNS.forEach(pattern => {
      const matches = line.match(pattern);
      if (matches) {
        findings.push({
          file: path.relative(process.cwd(), filePath),
          line: lineNumber,
          issue: `Mock pattern detected: ${pattern.toString()}`,
          context: line.substring(0, 100),
          match: matches[0]
        });
      }
    });
    
    // Special checks for numeric patterns
    const numbers = line.match(/\d+/g);
    if (numbers) {
      numbers.forEach(num => {
        if (this.isSuspiciousNumber(num)) {
          findings.push({
            file: path.relative(process.cwd(), filePath),
            line: lineNumber,
            issue: `Suspicious mock number: ${num}`,
            context: line.substring(0, 100),
            match: num
          });
        }
      });
    }
    
    return findings;
  }

  /**
   * Check if number looks like mock data
   */
  isSuspiciousNumber(numStr) {
    const num = parseInt(numStr);
    
    // Common mock numbers
    const mockNumbers = [123, 456, 789, 999, 111, 222, 333, 555, 777, 888];
    if (mockNumbers.includes(num)) return true;
    
    // Sequential patterns
    if (numStr.length >= 3) {
      const digits = numStr.split('').map(Number);
      const isSequential = digits.every((digit, i) => 
        i === 0 || digit === digits[i-1] + 1 || digit === digits[i-1]
      );
      if (isSequential && numStr !== '0') return true;
    }
    
    return false;
  }
}

// Run scanner if called directly
if (require.main === module) {
  const scanner = new MockDataScanner();
  const targetDir = process.argv[2] || '.';
  
  scanner.scan(targetDir).then(isClean => {
    process.exit(isClean ? 0 : 1);
  }).catch(error => {
    console.error('[MockScan] Fatal error:', error);
    process.exit(2);
  });
}

module.exports = { MockDataScanner };