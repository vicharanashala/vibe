import { describe, it, expect } from 'vitest';
import {
  getSecurityRequirements,
  shouldShowCaptcha,
  shouldRequireReAuth,
  getRiskLevelDescription,
  RISK_THRESHOLDS,
} from '../utils/progressiveSecurityHelper.js';

describe('Backend Progressive Security Helper', () => {
  describe('RISK_THRESHOLDS', () => {
    it('should define correct thresholds', () => {
      expect(RISK_THRESHOLDS.NORMAL).toBe(0);
      expect(RISK_THRESHOLDS.CAPTCHA_THRESHOLD).toBe(3);
      expect(RISK_THRESHOLDS.REAUTH_THRESHOLD).toBe(5);
    });
  });

  describe('getSecurityRequirements', () => {
    it('should return low risk for score below CAPTCHA threshold', () => {
      const result = getSecurityRequirements(2);
      expect(result.riskLevel).toBe('low');
      expect(result.isCaptchaRequired).toBe(false);
      expect(result.isReAuthRequired).toBe(false);
    });

    it('should return medium risk at CAPTCHA threshold', () => {
      const result = getSecurityRequirements(3);
      expect(result.riskLevel).toBe('medium');
      expect(result.isCaptchaRequired).toBe(true);
      expect(result.isReAuthRequired).toBe(false);
    });

    it('should return high risk at re-auth threshold', () => {
      const result = getSecurityRequirements(5);
      expect(result.riskLevel).toBe('high');
      expect(result.isCaptchaRequired).toBe(true);
      expect(result.isReAuthRequired).toBe(true);
    });

    it('should return correct risk score', () => {
      const result = getSecurityRequirements(10);
      expect(result.riskScore).toBe(10);
    });
  });

  describe('shouldShowCaptcha', () => {
    it('should return false below threshold', () => {
      expect(shouldShowCaptcha(2)).toBe(false);
    });

    it('should return true at threshold', () => {
      expect(shouldShowCaptcha(3)).toBe(true);
    });

    it('should return true above threshold', () => {
      expect(shouldShowCaptcha(10)).toBe(true);
    });
  });

  describe('shouldRequireReAuth', () => {
    it('should return false below threshold', () => {
      expect(shouldRequireReAuth(4)).toBe(false);
    });

    it('should return true at threshold', () => {
      expect(shouldRequireReAuth(5)).toBe(true);
    });

    it('should return true above threshold', () => {
      expect(shouldRequireReAuth(10)).toBe(true);
    });
  });

  describe('getRiskLevelDescription', () => {
    it('should return correct description for low risk', () => {
      expect(getRiskLevelDescription('low')).toBe('Normal security level');
    });

    it('should return correct description for medium risk', () => {
      expect(getRiskLevelDescription('medium')).toBe(
        'Additional verification required (CAPTCHA)',
      );
    });

    it('should return correct description for high risk', () => {
      expect(getRiskLevelDescription('high')).toBe(
        'High security level - re-authentication required',
      );
    });

    it('should return unknown for invalid risk level', () => {
      expect(getRiskLevelDescription('invalid' as any)).toBe(
        'Unknown security level',
      );
    });
  });
});
