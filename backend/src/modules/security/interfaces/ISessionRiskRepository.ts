import { ISessionRisk } from './ISecurityService.js';
import { ClientSession } from 'mongodb';

export interface ISessionRiskRepository {
  create(sessionRisk: Omit<ISessionRisk, '_id'>): Promise<void>;
  findBySessionId(sessionId: string): Promise<ISessionRisk | null>;
  updateRiskScore(
    sessionId: string,
    increment: number,
    session?: ClientSession,
  ): Promise<void>;
  updateCaptchaRequired(
    sessionId: string,
    required: boolean,
    session?: ClientSession,
  ): Promise<void>;
  updateReAuthRequired(
    sessionId: string,
    required: boolean,
    session?: ClientSession,
  ): Promise<void>;
  incrementHoneypotTriggerCount(
    sessionId: string,
    session?: ClientSession,
  ): Promise<void>;
}
