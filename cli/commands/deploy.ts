/**
 * Deploy Command for Skippy Trading Platform
 * 
 * Handles Docker build, push to registry, and deployment to VPS/cloud
 * Usage: skippy deploy --environment production --host my-vps.com
 */

import { Command } from 'commander';
import { execSync, spawn } from 'child_process';
import { logger } from '../../server/utils/logger';
import fs from 'fs/promises';
import path from 'path';

interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  host?: string;
  registry?: string;
  dockerContext?: string;
  skipBuild: boolean;
  skipPush: boolean;
  monitoring: boolean;
  dryRun: boolean;
}

interface DeploymentSecrets {
  POSTGRES_PASSWORD: string;
  SESSION_SECRET: string;
  ADMIN_SECRET: string;
  OPENAI_API_KEY?: string;
  EXCHANGE_API_KEY?: string;
  EXCHANGE_API_SECRET?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_CHANNEL_ID?: string;
}

class SkippyDeployer {
  private config: DeploymentConfig;
  private secrets: DeploymentSecrets;
  private imageName: string;
  private imageTag: string;

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.imageName = 'skippy-trading-platform';
    this.imageTag = this.config.environment === 'production' 
      ? process.env.BUILD_SHA || 'latest'
      : `${this.config.environment}-${Date.now()}`;
  }

  async deploy(): Promise<void> {
    try {
      logger.info('Starting deployment process', {
        environment: this.config.environment,
        host: this.config.host,
        imageTag: this.imageTag
      });

      await this.validatePrerequisites();
      await this.loadSecrets();
      
      if (!this.config.skipBuild) {
        await this.buildDockerImage();
      }

      if (!this.config.skipPush && this.config.registry) {
        await this.pushToRegistry();
      }

      await this.generateDockerComposeOverride();
      await this.deployToTarget();
      await this.performHealthCheck();
      await this.generateDeploymentReport();

      logger.info('Deployment completed successfully', {
        environment: this.config.environment,
        imageTag: this.imageTag
      });

    } catch (error) {
      logger.error('Deployment failed', {
        error: error instanceof Error ? error.message : String(error),
        environment: this.config.environment
      });
      throw error;
    }
  }

  private async validatePrerequisites(): Promise<void> {
    console.log('🔍 Validating deployment prerequisites...');

    // Check Docker
    try {
      execSync('docker --version', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Docker is not installed or not accessible');
    }

    // Check Docker Compose
    try {
      execSync('docker-compose --version', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Docker Compose is not installed or not accessible');
    }

    // Validate environment
    if (!['development', 'staging', 'production'].includes(this.config.environment)) {
      throw new Error('Invalid environment. Must be development, staging, or production');
    }

    // Check for required files
    const requiredFiles = ['Dockerfile', 'docker-compose.yml', 'package.json'];
    for (const file of requiredFiles) {
      try {
        await fs.access(file);
      } catch (error) {
        throw new Error(`Required file ${file} not found`);
      }
    }

    console.log('✅ Prerequisites validated');
  }

  private async loadSecrets(): Promise<void> {
    console.log('🔑 Loading deployment secrets...');

    // Try to load from .env file first
    const envFile = `.env.${this.config.environment}`;
    let envVars: Record<string, string> = {};

    try {
      const envContent = await fs.readFile(envFile, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            envVars[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Environment file ${envFile} not found, using system environment`);
    }

    // Generate or validate required secrets
    this.secrets = {
      POSTGRES_PASSWORD: envVars.POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD || this.generateSecurePassword(),
      SESSION_SECRET: envVars.SESSION_SECRET || process.env.SESSION_SECRET || this.generateSecurePassword(64),
      ADMIN_SECRET: envVars.ADMIN_SECRET || process.env.ADMIN_SECRET || this.generateSecurePassword(32),
      OPENAI_API_KEY: envVars.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      EXCHANGE_API_KEY: envVars.EXCHANGE_API_KEY || process.env.EXCHANGE_API_KEY,
      EXCHANGE_API_SECRET: envVars.EXCHANGE_API_SECRET || process.env.EXCHANGE_API_SECRET,
      SLACK_BOT_TOKEN: envVars.SLACK_BOT_TOKEN || process.env.SLACK_BOT_TOKEN,
      SLACK_CHANNEL_ID: envVars.SLACK_CHANNEL_ID || process.env.SLACK_CHANNEL_ID,
    };

    // Validate production requirements
    if (this.config.environment === 'production') {
      if (!this.secrets.POSTGRES_PASSWORD || this.secrets.POSTGRES_PASSWORD.length < 16) {
        throw new Error('Production deployment requires a strong POSTGRES_PASSWORD (16+ characters)');
      }
      if (!this.secrets.SESSION_SECRET || this.secrets.SESSION_SECRET.length < 32) {
        throw new Error('Production deployment requires a strong SESSION_SECRET (32+ characters)');
      }
    }

    console.log('✅ Secrets loaded and validated');
  }

  private generateSecurePassword(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private async buildDockerImage(): Promise<void> {
    console.log('🏗️ Building Docker image...');

    const buildArgs = [
      'build',
      '-t', `${this.imageName}:${this.imageTag}`,
      '-t', `${this.imageName}:${this.config.environment}-latest`,
      '--build-arg', `BUILD_SHA=${this.imageTag}`,
      '--build-arg', `NODE_ENV=${this.config.environment}`,
    ];

    if (this.config.registry) {
      buildArgs.push('-t', `${this.config.registry}/${this.imageName}:${this.imageTag}`);
    }

    buildArgs.push('.');

    try {
      if (this.config.dryRun) {
        console.log('🔍 Dry run - would execute:', 'docker', buildArgs.join(' '));
        return;
      }

      const buildProcess = spawn('docker', buildArgs, {
        stdio: 'inherit',
        env: { ...process.env }
      });

      await new Promise((resolve, reject) => {
        buildProcess.on('close', (code) => {
          if (code === 0) {
            resolve(void 0);
          } else {
            reject(new Error(`Docker build failed with exit code ${code}`));
          }
        });
      });

      console.log('✅ Docker image built successfully');
    } catch (error) {
      throw new Error(`Docker build failed: ${error}`);
    }
  }

  private async pushToRegistry(): Promise<void> {
    console.log('📤 Pushing image to registry...');

    const imageName = `${this.config.registry}/${this.imageName}:${this.imageTag}`;
    
    try {
      if (this.config.dryRun) {
        console.log('🔍 Dry run - would push:', imageName);
        return;
      }

      execSync(`docker push ${imageName}`, { stdio: 'inherit' });
      console.log('✅ Image pushed to registry');
    } catch (error) {
      throw new Error(`Registry push failed: ${error}`);
    }
  }

  private async generateDockerComposeOverride(): Promise<void> {
    console.log('📝 Generating docker-compose override...');

    const override = {
      version: '3.8',
      services: {
        'skippy-app': {
          image: this.config.registry 
            ? `${this.config.registry}/${this.imageName}:${this.imageTag}`
            : `${this.imageName}:${this.imageTag}`,
          environment: {
            NODE_ENV: this.config.environment,
            BUILD_SHA: this.imageTag,
            POSTGRES_PASSWORD: this.secrets.POSTGRES_PASSWORD,
            SESSION_SECRET: this.secrets.SESSION_SECRET,
            ADMIN_SECRET: this.secrets.ADMIN_SECRET,
            LIVE_TRADING_ENABLED: this.config.environment === 'production' ? 'false' : 'false', // Default to false for safety
            ...this.config.environment === 'production' && {
              AI_SERVICES_ENABLED: 'true',
              PROMETHEUS_ENABLED: 'true',
            }
          }
        },
        postgres: {
          environment: {
            POSTGRES_PASSWORD: this.secrets.POSTGRES_PASSWORD,
          }
        }
      }
    };

    // Add optional environment variables if they exist
    if (this.secrets.OPENAI_API_KEY) {
      override.services['skippy-app'].environment['OPENAI_API_KEY'] = this.secrets.OPENAI_API_KEY;
    }
    if (this.secrets.EXCHANGE_API_KEY) {
      override.services['skippy-app'].environment['EXCHANGE_API_KEY'] = this.secrets.EXCHANGE_API_KEY;
      override.services['skippy-app'].environment['EXCHANGE_API_SECRET'] = this.secrets.EXCHANGE_API_SECRET;
    }
    if (this.secrets.SLACK_BOT_TOKEN) {
      override.services['skippy-app'].environment['SLACK_BOT_TOKEN'] = this.secrets.SLACK_BOT_TOKEN;
      override.services['skippy-app'].environment['SLACK_CHANNEL_ID'] = this.secrets.SLACK_CHANNEL_ID;
    }

    const overrideFile = `docker-compose.${this.config.environment}.yml`;
    await fs.writeFile(overrideFile, `# Generated deployment override for ${this.config.environment}\n` + 
      JSON.stringify(override, null, 2).replace(/"/g, '').replace(/(\w+):/g, '$1:'));

    console.log(`✅ Override file generated: ${overrideFile}`);
  }

  private async deployToTarget(): Promise<void> {
    console.log('🚀 Deploying to target environment...');

    const composeFiles = [
      '-f', 'docker-compose.yml',
      '-f', `docker-compose.${this.config.environment}.yml`
    ];

    if (this.config.monitoring) {
      composeFiles.push('--profile', 'monitoring');
    }

    const deployCommands = [
      // Pull latest images
      ['docker-compose', ...composeFiles, 'pull'],
      // Stop existing containers
      ['docker-compose', ...composeFiles, 'down', '--remove-orphans'],
      // Start new containers
      ['docker-compose', ...composeFiles, 'up', '-d', '--force-recreate'],
    ];

    for (const command of deployCommands) {
      try {
        if (this.config.dryRun) {
          console.log('🔍 Dry run - would execute:', command.join(' '));
          continue;
        }

        console.log(`Executing: ${command.join(' ')}`);
        execSync(command.join(' '), { stdio: 'inherit' });
      } catch (error) {
        throw new Error(`Deployment command failed: ${command.join(' ')}`);
      }
    }

    console.log('✅ Deployment completed');
  }

  private async performHealthCheck(): Promise<void> {
    console.log('🏥 Performing health check...');

    if (this.config.dryRun) {
      console.log('🔍 Dry run - would perform health check');
      return;
    }

    const maxAttempts = 30;
    const delay = 10000; // 10 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const healthCheck = execSync('docker-compose exec -T skippy-app curl -f http://localhost:5000/api/health', {
          stdio: 'pipe',
          timeout: 5000
        });

        const response = JSON.parse(healthCheck.toString());
        if (response.status === 'healthy') {
          console.log('✅ Health check passed');
          return;
        }
      } catch (error) {
        console.log(`Health check attempt ${attempt}/${maxAttempts} failed, retrying in 10s...`);
        
        if (attempt === maxAttempts) {
          throw new Error('Health check failed after maximum attempts');
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async generateDeploymentReport(): Promise<void> {
    const report = {
      deployment: {
        environment: this.config.environment,
        imageTag: this.imageTag,
        deployedAt: new Date().toISOString(),
        host: this.config.host || 'local',
        monitoring: this.config.monitoring
      },
      services: {
        app: `${this.imageName}:${this.imageTag}`,
        database: 'postgres:15-alpine',
        cache: 'redis:7-alpine'
      },
      endpoints: {
        app: this.config.host ? `https://${this.config.host}` : 'http://localhost:5000',
        health: this.config.host ? `https://${this.config.host}/api/health` : 'http://localhost:5000/api/health',
        metrics: this.config.host ? `https://${this.config.host}/api/metrics` : 'http://localhost:5000/api/metrics'
      },
      nextSteps: [
        'Verify application is accessible',
        'Run smoke tests',
        'Monitor logs for errors',
        'Update DNS records if needed',
        'Configure SSL certificates for production'
      ]
    };

    const reportFile = `deployment-report-${this.config.environment}-${Date.now()}.json`;
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

    console.log(`📄 Deployment report saved: ${reportFile}`);
    console.log('\n🎉 DEPLOYMENT SUMMARY');
    console.log('==================');
    console.log(`Environment: ${report.deployment.environment}`);
    console.log(`Image: ${report.services.app}`);
    console.log(`App URL: ${report.endpoints.app}`);
    console.log(`Health Check: ${report.endpoints.health}`);
    
    if (this.config.monitoring) {
      console.log(`Grafana: http://localhost:3001 (admin/admin)`);
      console.log(`Prometheus: http://localhost:9090`);
    }
  }
}

export const deployCommand = new Command('deploy')
  .description('Deploy Skippy Trading Platform to target environment')
  .option('-e, --environment <env>', 'Target environment (development|staging|production)', 'development')
  .option('-h, --host <host>', 'Target host for deployment')
  .option('-r, --registry <registry>', 'Docker registry URL')
  .option('--skip-build', 'Skip Docker image build', false)
  .option('--skip-push', 'Skip registry push', false)
  .option('--monitoring', 'Deploy with monitoring stack', false)
  .option('--dry-run', 'Show what would be executed without running', false)
  .action(async (options) => {
    try {
      const config: DeploymentConfig = {
        environment: options.environment,
        host: options.host,
        registry: options.registry,
        skipBuild: options.skipBuild,
        skipPush: options.skipPush,
        monitoring: options.monitoring,
        dryRun: options.dryRun
      };

      console.log('🚀 Skippy Trading Platform Deployment');
      console.log('=====================================');
      console.log(`Environment: ${config.environment}`);
      console.log(`Host: ${config.host || 'local'}`);
      console.log(`Registry: ${config.registry || 'local'}`);
      console.log(`Monitoring: ${config.monitoring ? 'enabled' : 'disabled'}`);
      
      if (config.dryRun) {
        console.log('⚠️ DRY RUN MODE - No actual changes will be made');
      }
      
      console.log('');

      const deployer = new SkippyDeployer(config);
      await deployer.deploy();

      console.log('\n✅ Deployment completed successfully!');

    } catch (error) {
      console.error('\n❌ Deployment failed:', error);
      process.exit(1);
    }
  });