
#!/usr/bin/env node

/**
 * Phase 5 - Live Deployment CLI
 * Command-line interface for managing live deployment readiness
 */

import { Command } from 'commander';

class LiveDeploymentCLI {
  private baseUrl: string = 'http://localhost:5000';

  async validateReadiness(): Promise<void> {
    try {
      console.log('🔍 Validating Live Deployment Readiness...\n');
      
      const response = await fetch(`${this.baseUrl}/api/live-deployment/validate`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to validate readiness');
      }
      
      const validation = data.data;
      
      console.log('📋 LIVE DEPLOYMENT VALIDATION RESULTS');
      console.log('=====================================\n');
      
      Object.entries(validation.checks).forEach(([key, result]: [string, any]) => {
        const status = result.passed ? '✅' : '❌';
        const label = key.replace(/([A-Z])/g, ' $1').toLowerCase();
        console.log(`${status} ${label}: ${result.details}`);
      });
      
      console.log(`\n🚦 OVERALL STATUS: ${validation.isReady ? '✅ READY FOR LIVE DEPLOYMENT' : '⚠️ NOT READY'}`);
      
      if (!validation.isReady && validation.recommendations.length > 0) {
        console.log('\n📝 RECOMMENDATIONS:');
        console.log('==================');
        validation.recommendations.forEach((rec: string, i: number) => {
          console.log(`${i + 1}. ${rec}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to validate readiness:', error);
    }
  }

  async generateReport(): Promise<void> {
    try {
      console.log('📊 Generating Live Deployment Report...\n');
      
      const response = await fetch(`${this.baseUrl}/api/live-deployment/generate-report`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate report');
      }
      
      console.log(`✅ Live deployment report generated: ${data.data.reportPath}`);
      
    } catch (error) {
      console.error('❌ Failed to generate report:', error);
    }
  }

  async showChecklist(): Promise<void> {
    try {
      console.log('📋 Live Deployment Checklist\n');
      
      const response = await fetch(`${this.baseUrl}/api/live-deployment/checklist`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get checklist');
      }
      
      const checklist = data.data;
      const categories = [...new Set(checklist.map((item: any) => item.category))];
      
      categories.forEach(category => {
        console.log(`\n🏷️ ${category.toUpperCase()}:`);
        console.log('='.repeat(category.length + 4));
        
        checklist
          .filter((item: any) => item.category === category)
          .forEach((item: any) => {
            console.log(`☐ ${item.title}`);
            console.log(`   ${item.description}`);
          });
      });
      
      console.log('\n💡 Use "npm run deploy:validate" to check completion status');
      
    } catch (error) {
      console.error('❌ Failed to show checklist:', error);
    }
  }

  async showStatus(): Promise<void> {
    try {
      console.log('🖥️ System Status for Live Deployment\n');
      
      const response = await fetch(`${this.baseUrl}/api/live-deployment/status`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get status');
      }
      
      const status = data.data;
      
      console.log('📊 SYSTEM INFORMATION:');
      console.log('======================');
      console.log(`Environment: ${status.environment}`);
      console.log(`Version: ${status.version}`);
      console.log(`Uptime: ${Math.floor(status.uptime / 60)} minutes`);
      console.log(`Memory Usage: ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB`);
      
      console.log('\n🚀 DEPLOYMENT CONFIGURATION:');
      console.log('============================');
      console.log(`Stage: ${status.deployment.stage}`);
      console.log(`Live Trading: ${status.deployment.allowLiveTrading ? 'ENABLED' : 'DISABLED'}`);
      console.log(`Emergency Mode: ${status.deployment.emergencyMode ? 'ACTIVE' : 'INACTIVE'}`);
      
    } catch (error) {
      console.error('❌ Failed to show status:', error);
    }
  }
}

const cli = new LiveDeploymentCLI();
const program = new Command();

program
  .name('live-deployment')
  .description('Live Deployment Management CLI')
  .version('1.0.0');

program
  .command('validate')
  .description('Validate system readiness for live deployment')
  .action(() => cli.validateReadiness());

program
  .command('report')
  .description('Generate comprehensive live deployment report')
  .action(() => cli.generateReport());

program
  .command('checklist')
  .description('Show live deployment checklist')
  .action(() => cli.showChecklist());

program
  .command('status')
  .description('Show current system status')
  .action(() => cli.showStatus());

program.parse();
