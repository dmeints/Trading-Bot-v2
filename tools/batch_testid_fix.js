/* Batch fix for missing data-testids - addresses critical audit issues */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define critical components that need data-testid fixes
const fixes = [
  {
    file: 'client/src/components/CollaborativeIntelligence.tsx',
    replacements: [
      { search: 'onClick={() => handleAction("buy")}', replace: 'onClick={() => handleAction("buy")} data-testid="button-buy"' },
      { search: 'onClick={() => handleAction("sell")}', replace: 'onClick={() => handleAction("sell")} data-testid="button-sell"' },
    ]
  },
  {
    file: 'client/src/components/dashboard/RecentTrades.tsx',
    replacements: [
      { search: '>Buy<', replace: ' data-testid="button-buy">Buy<' },
      { search: '>Sell<', replace: ' data-testid="button-sell">Sell<' },
      { search: '>Execute<', replace: ' data-testid="button-execute">Execute<' },
    ]
  },
  {
    file: 'client/src/components/social/SocialTradingFeed.tsx',
    replacements: [
      { search: 'className=".*buy.*">', replace: '$& data-testid="button-buy"' },
      { search: 'className=".*sell.*">', replace: '$& data-testid="button-sell"' },
    ]
  },
  {
    file: 'client/src/components/trading/ExecutionRouter.tsx',
    replacements: [
      { search: 'onClick={.*buy.*}', replace: '$& data-testid="button-buy"' },
      { search: 'onClick={.*sell.*}', replace: '$& data-testid="button-sell"' },
    ]
  },
  {
    file: 'client/src/pages/LiveTrading.tsx',
    replacements: [
      { search: '>Buy<', replace: ' data-testid="button-buy">Buy<' },
      { search: '>Sell<', replace: ' data-testid="button-sell">Sell<' },
      { search: '>Cancel<', replace: ' data-testid="button-cancel">Cancel<' },
    ]
  },
];

function applyFixesToFile(filePath, replacements) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    replacements.forEach(({ search, replace }) => {
      const regex = new RegExp(search, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, replace);
        modified = true;
        console.log(`✅ Applied fix to ${filePath}: ${search}`);
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

// Apply fixes
console.log('🔧 Applying batch data-testid fixes...\n');

let totalFixed = 0;
fixes.forEach(({ file, replacements }) => {
  const fullPath = path.join(__dirname, '..', file);
  if (applyFixesToFile(fullPath, replacements)) {
    totalFixed++;
  }
});

console.log(`\n✅ Batch fix complete. Updated ${totalFixed} files.`);
console.log('🔍 Re-running audit to verify fixes...\n');

// Re-run audit
import('./ui_wiring_check.js');