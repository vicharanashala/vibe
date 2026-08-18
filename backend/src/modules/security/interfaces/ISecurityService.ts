export interface IHoneypotTriggerData {
  sessionId?: string;
  currentRoute?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  requestId?: string;
}

export interface ISessionRisk {
  sessionId: string;
  userId?: string;
  riskScore: number;
  captchaRequired: boolean;
  reAuthRequired: boolean;
  lastUpdated: Date;
  honeypotTriggerCount: number;
}

export interface ISecurityService {
  recordHoneypotTrigger(data: IHoneypotTriggerData): Promise<void>;
  getSessionRiskScore(sessionId: string): Promise<number>;
  getSessionRiskDetails(sessionId: string): Promise<ISessionRisk | null>;
  isReAuthRequired(sessionId: string): Promise<boolean>;
  isCaptchaRequired(sessionId: string): Promise<boolean>;
}
