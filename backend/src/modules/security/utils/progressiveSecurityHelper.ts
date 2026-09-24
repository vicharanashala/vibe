/**
 * Progressive Security Helper Logic
 *
 * This module provides utility functions to determine the required security
 * level based on risk scores. It follows the progressive security model:
 *
 * - Risk score < 3: Normal behavior (no additional security)
 * - Risk score >= 3: CAPTCHA required on next sensitive action
 * - Risk score >= 5: Re-authentication required before sensitive actions
 *
 * Risk scores are incremented by honeypot triggers and other suspicious events.
 * The progressive approach allows for gradual security escalation without
 * completely blocking legitimate users.
 */

export const RISK_THRESHOLDS = {
  NORMAL: 0,
  CAPTCHA_THRESHOLD: 3,
  REAUTH_THRESHOLD: 5,
};

export interface SecurityRequirements {
  isCaptchaRequired: boolean;
  isReAuthRequired: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
}

/**
 * Determine security requirements based on risk score
 *
 * @param riskScore The current session risk score
 * @returns Security requirements for the session
 */
export function getSecurityRequirements(
  riskScore: number,
): SecurityRequirements {
  const isCaptchaRequired = riskScore >= RISK_THRESHOLDS.CAPTCHA_THRESHOLD;
  const isReAuthRequired = riskScore >= RISK_THRESHOLDS.REAUTH_THRESHOLD;

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (isReAuthRequired) {
    riskLevel = 'high';
  } else if (isCaptchaRequired) {
    riskLevel = 'medium';
  }

  return {
    isCaptchaRequired,
    isReAuthRequired,
    riskLevel,
    riskScore,
  };
}

/**
 * Determine if CAPTCHA should be shown for a sensitive action
 *
 * @param riskScore The current session risk score
 * @returns true if CAPTCHA should be required
 */
export function shouldShowCaptcha(riskScore: number): boolean {
  return riskScore >= RISK_THRESHOLDS.CAPTCHA_THRESHOLD;
}

/**
 * Determine if re-authentication should be required before sensitive actions
 *
 * @param riskScore The current session risk score
 * @returns true if re-authentication should be required
 */
export function shouldRequireReAuth(riskScore: number): boolean {
  return riskScore >= RISK_THRESHOLDS.REAUTH_THRESHOLD;
}

/**
 * Get a human-readable description of the security level
 *
 * @param riskLevel The risk level
 * @returns Human-readable description
 */
export function getRiskLevelDescription(riskLevel: 'low' | 'medium' | 'high'): string {
  switch (riskLevel) {
    case 'low':
      return 'Normal security level';
    case 'medium':
      return 'Additional verification required (CAPTCHA)';
    case 'high':
      return 'High security level - re-authentication required';
    default:
      return 'Unknown security level';
  }
}
