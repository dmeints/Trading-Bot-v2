
#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

console.log('📦 Skippy Release Bundler\n');

// Create bundle zip
function createBundle() {
  console.log('Creating skippy_patched_project.zip...');
  
  try {
    // Create zip excluding heavy directories
    execSync('zip -r skippy_patched_project.zip . -x "node_modules/*" ".git/*" "logs/*" "*.log" "reports/*" "*.zip"', {
      stdio: 'inherit'
    });
    
    console.log('✅ Bundle created: skippy_patched_project.zip');
    
    // Get file size
    const stats = fs.statSync('skippy_patched_project.zip');
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Bundle size: ${fileSizeInMB} MB`);
    
  } catch (error) {
    console.error('❌ Failed to create bundle:', error.message);
    process.exit(1);
  }
}

// Check if GitHub CLI is available
function checkGitHubCLI() {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    console.log('✅ GitHub CLI is available');
    return true;
  } catch (error) {
    console.log('⚠️  GitHub CLI not found - manual upload required');
    return false;
  }
}

// Create GitHub release (if CLI available)
function createGitHubRelease() {
  const hasGH = checkGitHubCLI();
  
  if (hasGH) {
    console.log('\n🚀 GitHub CLI commands (run manually):');
    console.log('# Authenticate (if not already):');
    console.log('gh auth login');
    console.log('\n# Create repository:');
    console.log('gh repo create skippy-patched-bundle --public --source=. --remote=origin --push');
    console.log('\n# Create release with bundle:');
    console.log('gh release create v0.1.0 skippy_patched_project.zip --title "Skippy Patched v0.1.0"');
  } else {
    console.log('\n📝 Manual upload instructions:');
    console.log('1. Go to GitHub and create a new repository');
    console.log('2. Push your code to the repository');
    console.log('3. Go to Releases → Create a new release');
    console.log('4. Upload skippy_patched_project.zip as an asset');
  }
}

// Main bundling flow
function main() {
  createBundle();
  createGitHubRelease();
  
  console.log('\n✅ Release bundle ready!');
  console.log('📁 File: skippy_patched_project.zip');
}

main();
