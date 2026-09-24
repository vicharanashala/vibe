import 'reflect-metadata';
import request from 'supertest';
import Express from 'express';
import { useExpressServer } from 'routing-controllers';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { SecurityController } from '../controllers/SecurityController.js';
import { securityContainerModule } from '../container.js';
import { HttpErrorHandler } from '#shared/index.js';
import { Container } from 'inversify';
import { sharedContainerModule } from '#root/container.js';
import { SECURITY_TYPES } from '../types.js';
import { ISecurityService } from '../interfaces/ISecurityService.js';

describe('Security Controller - Honeypot Endpoint', () => {
  let app: Express.Application;
  let securityService: ISecurityService;

  beforeAll(async () => {
    const container = new Container();
    await container.load(securityContainerModule, sharedContainerModule);

    securityService = container.get<ISecurityService>(
      SECURITY_TYPES.SecurityService,
    );

    const appInstance = Express();
    app = useExpressServer(appInstance, {
      controllers: [SecurityController],
      validation: true,
      defaultErrorHandler: false,
      middlewares: [HttpErrorHandler],
      container,
    });
  }, 30000);

  describe('POST /security/honeypot-triggered', () => {
    it('should accept honeypot trigger and return success', async () => {
      const payload = {
        sessionId: 'test-session-123',
        currentRoute: '/student/course',
        timestamp: new Date().toISOString(),
      };

      const response = await request(app)
        .post('/security/honeypot-triggered')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Thank you for your submission');
    }, 10000);

    it('should record honeypot trigger in the database', async () => {
      const sessionId = `test-session-${Date.now()}`;
      const payload = {
        sessionId,
        currentRoute: '/student/quiz',
        timestamp: new Date().toISOString(),
      };

      await request(app).post('/security/honeypot-triggered').send(payload);

      // Wait a moment for async operation
      await new Promise((resolve) => setTimeout(resolve, 100));

      const riskDetails = await securityService.getSessionRiskDetails(sessionId);
      expect(riskDetails).not.toBeNull();
      expect(riskDetails?.riskScore).toBeGreaterThan(0);
    }, 10000);

    it('should increment risk score on multiple triggers', async () => {
      const sessionId = `test-session-multiple-${Date.now()}`;
      const payload = {
        sessionId,
        currentRoute: '/student/course',
        timestamp: new Date().toISOString(),
      };

      // First trigger
      await request(app).post('/security/honeypot-triggered').send(payload);
      await new Promise((resolve) => setTimeout(resolve, 100));

      let riskDetails = await securityService.getSessionRiskDetails(sessionId);
      const firstScore = riskDetails?.riskScore ?? 0;

      // Second trigger
      await request(app).post('/security/honeypot-triggered').send(payload);
      await new Promise((resolve) => setTimeout(resolve, 100));

      riskDetails = await securityService.getSessionRiskDetails(sessionId);
      expect(riskDetails?.riskScore ?? 0).toBeGreaterThan(firstScore);
    }, 10000);

    it('should set captchaRequired when threshold is reached', async () => {
      const sessionId = `test-session-captcha-${Date.now()}`;

      // Trigger honeypot 3+ times to reach CAPTCHA threshold
      for (let i = 0; i < 3; i++) {
        const payload = {
          sessionId,
          currentRoute: '/student/course',
          timestamp: new Date().toISOString(),
        };
        await request(app).post('/security/honeypot-triggered').send(payload);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const riskDetails = await securityService.getSessionRiskDetails(sessionId);
      expect(riskDetails?.captchaRequired).toBe(true);
    }, 15000);

    it('should set reAuthRequired when high threshold is reached', async () => {
      const sessionId = `test-session-reauth-${Date.now()}`;

      // Trigger honeypot 5+ times to reach re-auth threshold
      for (let i = 0; i < 5; i++) {
        const payload = {
          sessionId,
          currentRoute: '/student/course',
          timestamp: new Date().toISOString(),
        };
        await request(app).post('/security/honeypot-triggered').send(payload);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const riskDetails = await securityService.getSessionRiskDetails(sessionId);
      expect(riskDetails?.reAuthRequired).toBe(true);
    }, 15000);

    it('should always return success even with invalid timestamp', async () => {
      const payload = {
        sessionId: 'test-session-invalid',
        currentRoute: '/student/course',
        timestamp: 'invalid-date',
      };

      const response = await request(app)
        .post('/security/honeypot-triggered')
        .send(payload);

      // Validation should reject invalid timestamp
      expect(response.status).toBe(400);
    });

    it('should work with minimal payload (no sessionId)', async () => {
      const payload = {
        currentRoute: '/student/course',
        timestamp: new Date().toISOString(),
      };

      const response = await request(app)
        .post('/security/honeypot-triggered')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    }, 10000);
  });
});
