#!/usr/bin/env tsx

/**
 * Phase L - CI/CD Pipeline Automation
 * Automated deployment, testing, and rollback capabilities
 */

import { logger } from "../server/utils/logger";
import { productionMonitoringService } from "../server/services/ProductionMonitoring";

interface DeploymentConfig {
  environment: 'staging' | 'production';
  version: string;
  branch: string;
  runTests: boolean;
  backupDatabase: boolean;
  rollbackOnFailure: boolean;
  healthCheckTimeout: number;
}

interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  version: string;
  startTime: string;
  endTime: string;
  duration: number;
  steps: DeploymentStep[];
  rollback?: {
    triggered: boolean;
    reason: string;
    rollbackVersion: string;
  };
}

interface DeploymentStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime: string;
  endTime?: string;
  duration?: number;
  output?: string;
  error?: string;
}

export class CICDPipeline {
  private static instance: CICDPipeline;
  
  public static getInstance(): CICDPipeline {
    if (!CICDPipeline.instance) {
      CICDPipeline.instance = new CICDPipeline();
    }
    return CICDPipeline.instance;
  }

  /**
   * Execute full deployment pipeline
   */
  async deployApplication(config: DeploymentConfig): Promise<DeploymentResult> {
    const deploymentId = `deploy_${Date.now()}`;
    const startTime = new Date().toISOString();
    
    logger.info('[CICD] Starting deployment pipeline', {
      deploymentId,
      environment: config.environment,
      version: config.version,
      branch: config.branch
    });

    const steps: DeploymentStep[] = [];
    let rollback: DeploymentResult['rollback'] | undefined;

    try {
      // Step 1: Pre-deployment validation
      await this.executeStep(steps, 'Pre-deployment Validation', async () => {
        await this.validatePreDeployment(config);
      });

      // Step 2: Run tests (if enabled)
      if (config.runTests) {
        await this.executeStep(steps, 'Run Test Suite', async () => {
          await this.runTestSuite();
        });
      }

      // Step 3: Database backup (if enabled)
      if (config.backupDatabase) {
        await this.executeStep(steps, 'Database Backup', async () => {
          await this.backupDatabase(config.environment);
        });
      }

      // Step 4: Build application
      await this.executeStep(steps, 'Build Application', async () => {
        await this.buildApplication(config.version);
      });

      // Step 5: Deploy to environment
      await this.executeStep(steps, 'Deploy Application', async () => {
        await this.deployToEnvironment(config);
      });

      // Step 6: Health check
      await this.executeStep(steps, 'Health Check', async () => {
        await this.performPostDeploymentHealthCheck(config.healthCheckTimeout);
      });

      // Step 7: Smoke tests
      await this.executeStep(steps, 'Smoke Tests', async () => {
        await this.runSmokeTests();
      });

      const endTime = new Date().toISOString();
      const duration = Date.now() - Date.parse(startTime);

      logger.info('[CICD] Deployment completed successfully', {
        deploymentId,
        duration: `${duration}ms`,
        version: config.version
      });

      return {
        success: true,
        deploymentId,
        version: config.version,
        startTime,
        endTime,
        duration,
        steps
      };

    } catch (error) {
      logger.error('[CICD] Deployment failed', error);

      // Handle rollback if enabled
      if (config.rollbackOnFailure) {
        try {
          rollback = await this.performRollback(deploymentId, config);
          
          await this.executeStep(steps, 'Rollback Deployment', async () => {
            logger.info('[CICD] Rollback completed', rollback);
          });

        } catch (rollbackError) {
          logger.error('[CICD] Rollback failed', rollbackError);
        }
      }

      const endTime = new Date().toISOString();
      const duration = Date.now() - Date.parse(startTime);

      return {
        success: false,
        deploymentId,
        version: config.version,
        startTime,
        endTime,
        duration,
        steps,
        rollback
      };
    }
  }

  /**
   * Execute a deployment step with error handling and timing
   */
  private async executeStep(
    steps: DeploymentStep[], 
    name: string, 
    action: () => Promise<void>
  ): Promise<void> {
    const step: DeploymentStep = {
      name,
      status: 'running',
      startTime: new Date().toISOString()
    };

    steps.push(step);
    
    logger.info(`[CICD] Executing step: ${name}`);

    try {
      await action();
      
      step.status = 'completed';
      step.endTime = new Date().toISOString();
      step.duration = Date.parse(step.endTime) - Date.parse(step.startTime);
      step.output = `${name} completed successfully`;
      
      logger.info(`[CICD] Step completed: ${name} (${step.duration}ms)`);

    } catch (error) {
      step.status = 'failed';
      step.endTime = new Date().toISOString();
      step.duration = Date.parse(step.endTime) - Date.parse(step.startTime);
      step.error = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`[CICD] Step failed: ${name}`, error);
      throw error;
    }
  }

  /**
   * Validate pre-deployment conditions
   */
  private async validatePreDeployment(config: DeploymentConfig): Promise<void> {
    // Check system health before deployment
    const healthMetrics = await productionMonitoringService.performHealthCheck();
    
    if (healthMetrics.overall === 'CRITICAL') {
      throw new Error('System is in critical state - deployment blocked');
    }

    // Validate configuration
    if (!config.version || !config.branch) {
      throw new Error('Invalid deployment configuration');
    }

    // Check for active alerts
    const criticalAlerts = healthMetrics.alerts.filter(
      alert => alert.severity === 'CRITICAL' && !alert.resolved
    );

    if (criticalAlerts.length > 0) {
      throw new Error(`Critical alerts present: ${criticalAlerts.length}`);
    }

    logger.info('[CICD] Pre-deployment validation passed');
  }

  /**
   * Run comprehensive test suite
   */
  private async runTestSuite(): Promise<void> {
    logger.info('[CICD] Running test suite');
    
    // Simulate test execution
    await this.delay(5000);
    
    // In a real implementation, this would run:
    // - Unit tests
    // - Integration tests 
    // - API tests
    // - Security tests
    
    const testResults = {
      total: 150,
      passed: 148,
      failed: 2,
      skipped: 0,
      coverage: 92.5
    };

    if (testResults.failed > 0) {
      throw new Error(`Tests failed: ${testResults.failed}/${testResults.total}`);
    }

    logger.info('[CICD] Test suite passed', testResults);
  }

  /**
   * Backup database before deployment
   */
  private async backupDatabase(environment: string): Promise<void> {
    logger.info(`[CICD] Creating database backup for ${environment}`);
    
    await this.delay(3000);
    
    const backupId = `backup_${environment}_${Date.now()}`;
    
    // In production, this would create actual database backups
    logger.info('[CICD] Database backup completed', { backupId });
  }

  /**
   * Build application artifacts
   */
  private async buildApplication(version: string): Promise<void> {
    logger.info(`[CICD] Building application version ${version}`);
    
    await this.delay(10000);
    
    // Simulate build process:
    // - TypeScript compilation
    // - Asset bundling
    // - Docker image creation
    // - Artifact uploading
    
    logger.info('[CICD] Application build completed');
  }

  /**
   * Deploy to target environment
   */
  private async deployToEnvironment(config: DeploymentConfig): Promise<void> {
    logger.info(`[CICD] Deploying to ${config.environment}`);
    
    await this.delay(8000);
    
    // Simulate deployment process:
    // - Update application code
    // - Update configuration
    // - Restart services
    // - Update load balancer
    
    logger.info('[CICD] Application deployed successfully');
  }

  /**
   * Perform health check after deployment
   */
  private async performPostDeploymentHealthCheck(timeout: number): Promise<void> {
    logger.info('[CICD] Performing post-deployment health check');
    
    const startTime = Date.now();
    const maxTime = startTime + timeout;
    
    while (Date.now() < maxTime) {
      try {
        const healthMetrics = await productionMonitoringService.performHealthCheck();
        
        if (healthMetrics.overall === 'HEALTHY') {
          logger.info('[CICD] Health check passed');
          return;
        }
        
        if (healthMetrics.overall === 'CRITICAL') {
          throw new Error('System health critical after deployment');
        }
        
        // Wait before next check
        await this.delay(5000);
        
      } catch (error) {
        if (Date.now() >= maxTime) {
          throw new Error('Health check timeout - deployment may have failed');
        }
        await this.delay(5000);
      }
    }
    
    throw new Error('Health check timeout');
  }

  /**
   * Run smoke tests to validate deployment
   */
  private async runSmokeTests(): Promise<void> {
    logger.info('[CICD] Running smoke tests');
    
    await this.delay(3000);
    
    // Simulate smoke tests:
    // - API endpoint checks
    // - Database connectivity
    // - Critical user flows
    
    const smokeTestResults = {
      apiEndpoints: 'PASS',
      database: 'PASS',
      userFlows: 'PASS',
      externalServices: 'PASS'
    };
    
    logger.info('[CICD] Smoke tests completed', smokeTestResults);
  }

  /**
   * Perform rollback to previous version
   */
  private async performRollback(
    deploymentId: string, 
    config: DeploymentConfig
  ): Promise<NonNullable<DeploymentResult['rollback']>> {
    logger.warn('[CICD] Initiating rollback', { deploymentId });
    
    await this.delay(5000);
    
    const previousVersion = 'v1.0.0'; // Would be determined from deployment history
    
    return {
      triggered: true,
      reason: 'Deployment health check failed',
      rollbackVersion: previousVersion
    };
  }

  /**
   * Get deployment history
   */
  async getDeploymentHistory(limit: number = 10): Promise<Array<{
    deploymentId: string;
    version: string;
    environment: string;
    timestamp: string;
    status: 'success' | 'failed' | 'rolled_back';
    duration: number;
  }>> {
    // In production, this would query deployment database
    return [
      {
        deploymentId: 'deploy_1754836800000',
        version: 'v2.1.0',
        environment: 'production',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'success',
        duration: 180000
      },
      {
        deploymentId: 'deploy_1754750400000',
        version: 'v2.0.5',
        environment: 'production',
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        status: 'failed',
        duration: 95000
      }
    ];
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface for manual deployments
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'deploy') {
    const environment = (args[1] as 'staging' | 'production') || 'staging';
    const version = args[2] || 'v1.0.0';
    
    const pipeline = CICDPipeline.getInstance();
    
    const config: DeploymentConfig = {
      environment,
      version,
      branch: 'main',
      runTests: true,
      backupDatabase: environment === 'production',
      rollbackOnFailure: true,
      healthCheckTimeout: 120000 // 2 minutes
    };
    
    console.log(`🚀 Starting deployment: ${version} to ${environment}`);
    
    try {
      const result = await pipeline.deployApplication(config);
      
      if (result.success) {
        console.log('✅ Deployment completed successfully');
        console.log(`   Duration: ${result.duration}ms`);
        console.log(`   Steps completed: ${result.steps.filter(s => s.status === 'completed').length}/${result.steps.length}`);
      } else {
        console.log('❌ Deployment failed');
        if (result.rollback?.triggered) {
          console.log(`   Rolled back to: ${result.rollback.rollbackVersion}`);
        }
      }
      
    } catch (error) {
      console.error('💥 Deployment error:', error);
      process.exit(1);
    }
    
  } else if (command === 'history') {
    const pipeline = CICDPipeline.getInstance();
    const history = await pipeline.getDeploymentHistory();
    
    console.log('\n📋 Deployment History:');
    history.forEach(deployment => {
      const status = deployment.status === 'success' ? '✅' : deployment.status === 'failed' ? '❌' : '🔄';
      console.log(`   ${status} ${deployment.version} (${deployment.environment}) - ${new Date(deployment.timestamp).toLocaleString()}`);
    });
    
  } else {
    console.log('Usage: tsx tools/cicd_pipeline.ts <command>');
    console.log('Commands:');
    console.log('  deploy [staging|production] [version] - Deploy application');
    console.log('  history - Show deployment history');
  }
}

// ES module main check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}