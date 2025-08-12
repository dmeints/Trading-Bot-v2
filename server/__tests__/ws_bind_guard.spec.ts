
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('WebSocket must attach to HTTP server (no direct port bind)', () => {
  it('should not find any WebSocketServer created with { port }', () => {
    const serverDir = path.join(__dirname, '..');
    const files = getAllTsFiles(serverDir);
    
    let foundPortBinding = false;
    const violations: string[] = [];
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Check for WebSocketServer with port option
      const portBindingRegex = /new\s+WebSocketServer\s*\(\s*\{[^}]*port\s*:/g;
      const matches = content.match(portBindingRegex);
      
      if (matches) {
        foundPortBinding = true;
        violations.push(`${file}: Found ${matches.length} WebSocketServer port bindings`);
      }
    }
    
    if (foundPortBinding) {
      console.error('WebSocket port binding violations found:');
      violations.forEach(v => console.error(`  ${v}`));
    }
    
    expect(foundPortBinding).toBe(false);
  });
});

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  
  function traverse(currentDir: string) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}
