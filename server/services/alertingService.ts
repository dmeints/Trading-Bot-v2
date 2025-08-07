/**
 * Alerting Service - Slack/Email notifications for critical events
 */

import { logger } from '../utils/logger';

interface AlertingConfig {
  slackWebhookUrl?: string;
  slackChannel?: string;
  emailEnabled?: boolean;
  emailSmtpHost?: string;
  emailFrom?: string;
  emailTo?: string[];
}

interface Alert {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  source: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

class AlertingService {
  private config: AlertingConfig;
  private enabledChannels: Set<string> = new Set();

  constructor() {
    this.config = {
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      slackChannel: process.env.SLACK_CHANNEL_ID,
      emailEnabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
      emailSmtpHost: process.env.EMAIL_SMTP_HOST,
      emailFrom: process.env.EMAIL_FROM,
      emailTo: process.env.EMAIL_TO?.split(',') || []
    };

    this.initializeChannels();
  }

  private initializeChannels() {
    if (this.config.slackWebhookUrl || this.config.slackChannel) {
      this.enabledChannels.add('slack');
      logger.info('Slack alerting initialized');
    }

    if (this.config.emailEnabled && this.config.emailSmtpHost) {
      this.enabledChannels.add('email');
      logger.info('Email alerting initialized');
    }

    if (this.enabledChannels.size === 0) {
      logger.warn('No alerting channels configured - alerts will only be logged');
    }
  }

  async sendAlert(alert: Alert): Promise<void> {
    try {
      // Always log the alert
      logger.warn('ALERT: ' + alert.title, {
        severity: alert.severity,
        message: alert.message,
        source: alert.source,
        metadata: alert.metadata
      });

      // Send to configured channels
      const promises: Promise<void>[] = [];

      if (this.enabledChannels.has('slack')) {
        promises.push(this.sendSlackAlert(alert));
      }

      if (this.enabledChannels.has('email')) {
        promises.push(this.sendEmailAlert(alert));
      }

      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }

    } catch (error) {
      logger.error('Failed to send alert', {
        error: error instanceof Error ? error.message : String(error),
        alert: alert.title
      });
    }
  }

  private async sendSlackAlert(alert: Alert): Promise<void> {
    try {
      const emoji = {
        critical: ':rotating_light:',
        warning: ':warning:',
        info: ':information_source:'
      }[alert.severity];

      const color = {
        critical: 'danger',
        warning: 'warning', 
        info: 'good'
      }[alert.severity];

      const payload = {
        channel: this.config.slackChannel,
        username: 'Skippy Alerts',
        icon_emoji: ':robot_face:',
        attachments: [{
          color,
          title: `${emoji} ${alert.title}`,
          text: alert.message,
          fields: [
            {
              title: 'Source',
              value: alert.source,
              short: true
            },
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Timestamp',
              value: alert.timestamp,
              short: false
            }
          ],
          footer: 'Skippy Trading Platform',
          ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
        }]
      };

      // Use webhook URL if available, otherwise use Bot API
      if (this.config.slackWebhookUrl) {
        const response = await fetch(this.config.slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Slack webhook failed: ${response.status}`);
        }
      } else {
        // TODO: Implement Slack Bot API integration when SLACK_BOT_TOKEN is available
        logger.warn('Slack webhook URL not configured - alert logged only');
      }

    } catch (error) {
      logger.error('Failed to send Slack alert', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async sendEmailAlert(alert: Alert): Promise<void> {
    try {
      // TODO: Implement email sending when SMTP credentials are provided
      logger.info('Email alerting requested but not yet implemented', {
        alert: alert.title,
        recipients: this.config.emailTo
      });
    } catch (error) {
      logger.error('Failed to send email alert', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Convenience methods for common alert types
  async criticalAlert(title: string, message: string, source: string, metadata?: Record<string, any>): Promise<void> {
    await this.sendAlert({
      severity: 'critical',
      title,
      message,
      source,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  async warningAlert(title: string, message: string, source: string, metadata?: Record<string, any>): Promise<void> {
    await this.sendAlert({
      severity: 'warning',
      title,
      message,
      source,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  async infoAlert(title: string, message: string, source: string, metadata?: Record<string, any>): Promise<void> {
    await this.sendAlert({
      severity: 'info',
      title,
      message,
      source,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  // System health alerts
  async systemHealthAlert(status: 'degraded' | 'outage' | 'recovering', details: string): Promise<void> {
    const severity = status === 'outage' ? 'critical' : 'warning';
    await this.sendAlert({
      severity,
      title: `System ${status.toUpperCase()}`,
      message: details,
      source: 'Health Monitor',
      timestamp: new Date().toISOString()
    });
  }

  // Trading alerts
  async tradingAlert(type: 'risk_breach' | 'position_limit' | 'strategy_error', symbol: string, details: string): Promise<void> {
    const severity = type === 'strategy_error' ? 'critical' : 'warning';
    await this.sendAlert({
      severity,
      title: `Trading Alert: ${type.replace('_', ' ').toUpperCase()}`,
      message: `${symbol}: ${details}`,
      source: 'Trading Engine',
      timestamp: new Date().toISOString(),
      metadata: { symbol, alertType: type }
    });
  }
}

export const alertingService = new AlertingService();