import { injectable, inject } from 'inversify';
import { ISecurityService, IHoneypotTriggerData, ISessionRisk } from '../interfaces/ISecurityService.js';
import { ISessionRiskRepository } from '../interfaces/ISessionRiskRepository.js';
import { SECURITY_TYPES } from '../types.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import * as Sentry from '@sentry/node';

// Risk scoring thresholds
const RISK_THRESHOLDS = {
  HONEYPOT_INCREMENT: 1,
  CAPTCHA_THRESHOLD: 3,
  REAUTH_THRESHOLD: 5,
};

@injectable()
export class SecurityService extends BaseService implements ISecurityService {
  constructor(
    @inject(SECURITY_TYPES.SessionRiskRepository)
    private readonly sessionRiskRepository: ISessionRiskRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  async recordHoneypotTrigger(data: IHoneypotTriggerData): Promise<void> {
    try {
      // Ensure we have a session ID
      const sessionId = data.sessionId || `anonymous-${Date.now()}`;

      // Check if session risk record exists
      let sessionRisk = await this.sessionRiskRepository.findBySessionId(sessionId);

      // Create new record if doesn't exist
      if (!sessionRisk) {
        const newSessionRisk: Omit<ISessionRisk, '_id'> = {
          sessionId,
          userId: data.userId,
          riskScore: RISK_THRESHOLDS.HONEYPOT_INCREMENT,
          captchaRequired: false,
          reAuthRequired: false,
          lastUpdated: new Date(),
          honeypotTriggerCount: 1,
        };
        await this.sessionRiskRepository.create(newSessionRisk);
      } else {
        // Update existing record
        await this._withTransaction(async (session) => {
          await this.sessionRiskRepository.incrementHoneypotTriggerCount(sessionId, session);
          await this.sessionRiskRepository.updateRiskScore(
            sessionId,
            RISK_THRESHOLDS.HONEYPOT_INCREMENT,
            session,
          );

          // Check if thresholds are reached and update flags
          const updatedRisk = await this.sessionRiskRepository.findBySessionId(sessionId);
          if (updatedRisk) {
            if (updatedRisk.riskScore >= RISK_THRESHOLDS.CAPTCHA_THRESHOLD && !updatedRisk.captchaRequired) {
              await this.sessionRiskRepository.updateCaptchaRequired(sessionId, true, session);
            }
            if (updatedRisk.riskScore >= RISK_THRESHOLDS.REAUTH_THRESHOLD && !updatedRisk.reAuthRequired) {
              await this.sessionRiskRepository.updateReAuthRequired(sessionId, true, session);
            }
          }
        });
      }

      // Log the honeypot trigger for audit purposes
      console.log('[SECURITY] Honeypot triggered:', {
        sessionId,
        userId: data.userId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        route: data.currentRoute,
        timestamp: data.timestamp,
        requestId: data.requestId,
      });

      // Send to Sentry for monitoring
      Sentry.captureMessage('Honeypot triggered', {
        level: 'warning',
        tags: {
          type: 'security_honeypot',
        },
        contexts: {
          security: {
            sessionId,
            userId: data.userId,
            ipAddress: data.ipAddress,
          },
        },
      });
    } catch (error) {
      console.error('[SECURITY] Error recording honeypot trigger:', error);
      // Don't throw - honeypot detection should not break the application
      Sentry.captureException(error, {
        tags: { type: 'security_honeypot_error' },
      });
    }
  }

  async getSessionRiskScore(sessionId: string): Promise<number> {
    try {
      const sessionRisk = await this.sessionRiskRepository.findBySessionId(sessionId);
      return sessionRisk?.riskScore ?? 0;
    } catch (error) {
      console.error('[SECURITY] Error getting session risk score:', error);
      return 0;
    }
  }

  async getSessionRiskDetails(sessionId: string): Promise<ISessionRisk | null> {
    try {
      return await this.sessionRiskRepository.findBySessionId(sessionId);
    } catch (error) {
      console.error('[SECURITY] Error getting session risk details:', error);
      return null;
    }
  }

  async isReAuthRequired(sessionId: string): Promise<boolean> {
    try {
      const sessionRisk = await this.sessionRiskRepository.findBySessionId(sessionId);
      return sessionRisk?.reAuthRequired ?? false;
    } catch (error) {
      console.error('[SECURITY] Error checking re-auth requirement:', error);
      return false;
    }
  }

  async isCaptchaRequired(sessionId: string): Promise<boolean> {
    try {
      const sessionRisk = await this.sessionRiskRepository.findBySessionId(sessionId);
      return sessionRisk?.captchaRequired ?? false;
    } catch (error) {
      console.error('[SECURITY] Error checking CAPTCHA requirement:', error);
      return false;
    }
  }
}
