import 'reflect-metadata';
import request from 'supertest';
import  Express  from 'express';
import { useExpressServer } from 'routing-controllers';
import { faker } from '@faker-js/faker';
import { SignUpBody } from '#root/modules/auth/classes/index.js';
import { setupNotificationsContainer } from '../index.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {HttpErrorHandler} from '#shared/index.js';
import { InviteController } from '../controllers/InviteController.js';

function generateDummyEmails(count: number): string[] {
  const domains = ['gmail.com'];
  return Array.from({ length: count }, (_, i) => {
    const user = `user${i}_${Math.random().toString(36).substring(2, 5)}`;
    const domain = domains[i % domains.length];
    return `${user}@${domain}`;
  });
}




describe('Invite Controller Integration Tests', () => {
  const appInstance = Express();
  let app;

  beforeAll(async () => {
    await setupNotificationsContainer();
    app = useExpressServer(appInstance, {
      controllers: [InviteController],
      validation: true,
      defaultErrorHandler: false,
      middlewares: [HttpErrorHandler],
    });
  }, 30000);

  describe('Invite Multiple Users Test', () => {
    const courseId = '6844113ce1f2a9f17bedc542'; // Sample course ID
    // Replace with a valid course version ID for your tests
    const courseVersionId = '6844113ce1f2a9f17bedc542'; // Sample course version ID

    it('should invite multiple users successfully', async () => {
      const inviteBody = {
        emails: generateDummyEmails(5), // Generate 5 dummy emails
      };
      console.log(inviteBody)
      const response = await request(app)
        .post(`/notifications/invite/courses/${courseId}/versions/${courseVersionId}`)
        .send(inviteBody);
        console.log('Response:', response.status, response.body); 
      expect(response.status).toBe(200);
    }, 90000);

    it('should return 400 for invalid email', async () => {
      const inviteBody = {
        email: ['invalid-email'],
      };
      const response = await request(app)
        .post(`/notifications/invite/courses/${courseId}/versions/${courseVersionId}`)
        .send(inviteBody);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors[0].constraints.isEmail).toBeDefined();
      expect(response.body.errors[0].constraints.isEmail).toBe(
        'Each item must be a valid email address',
      );
    }, 30000);

    it('should return 400 for missing required fields', async () => {
      const inviteBody = {
        email: [],
      };
      const response = await request(app)
        .post(`/notifications/invite/courses/${courseId}/versions/${courseVersionId}`)
        .send(inviteBody);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    }, 30000);
  });

  describe('Process Invite Test', () => {
    it('should process invite successfully', async () => {
      const validToken = '1b6714320d9b0409f74c15420c6266c4c57fb79250c8307d7564813c2c22f7f6'; // Replace with actual testable token
      const response = await request(app)
        .post(`/notifications/invite/${validToken}`)
        .send();

      console.log('Process Response:', response.status, response.body);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    }, 90000);
  });
});







