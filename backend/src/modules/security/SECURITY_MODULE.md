# Security Module - Honeypot Interaction Detection

This module implements a security-focused "Honeypot Interaction Detection" feature that detects suspicious automated interactions without blocking legitimate users.

## Features

### Honeypot Button Detection
- Hidden honeypot button in the frontend that mimics legitimate action buttons
- Automatically records triggers when bots/automated tools interact with it
- Never interferes with legitimate user experience

### Risk Scoring System
- Per-session risk scoring based on honeypot triggers
- Progressive security escalation based on risk thresholds
- Tracks multiple honeypot trigger events

### Progressive Security Model
- **Risk Score < 3**: Normal behavior (no action)
- **Risk Score >= 3**: CAPTCHA required on next sensitive action
- **Risk Score >= 5**: Re-authentication required before sensitive actions

### Non-Blocking Approach
- Sessions are never automatically banned or invalidated
- Users are not logged out automatically
- Security requirements are progressively enforced
- All data is logged for audit purposes

## Architecture

### Backend

#### Endpoints
- `POST /api/security/honeypot-triggered` - Records honeypot interactions

#### Key Components
- **SecurityService**: Manages risk scoring and security policy logic
- **SessionRiskRepository**: Persists session risk data to MongoDB
- **SecurityController**: Handles HTTP requests

#### Risk Thresholds
```typescript
HONEYPOT_INCREMENT = 1        // Each trigger adds 1 risk point
CAPTCHA_THRESHOLD = 3         // CAPTCHA required at this level
REAUTH_THRESHOLD = 5          // Re-auth required at this level
```

### Frontend

#### Components
- **HoneypotButton**: Hidden button that triggers honeypot detection

#### Hiding Techniques
- `opacity: 0` - Fully transparent
- `position: absolute; left: -9999px` - Off-screen positioning
- `width: 1px; height: 1px` - Minimal dimensions
- `z-index: -1` - Behind all other content
- `aria-hidden="true"` - Hidden from screen readers
- `tabIndex={-1}` - Removed from tab order

#### Helpers
- `progressiveSecurityHelper.ts` - Utilities for determining security requirements

## Usage

### Backend Integration

The security module is automatically loaded when the application starts with `module: 'all'` configuration.

To use the SecurityService:

```typescript
@injectable()
export class MyService {
  constructor(
    @inject(SECURITY_TYPES.SecurityService)
    private readonly securityService: ISecurityService,
  ) {}

  async checkSecurityRequirements(sessionId: string) {
    const isReAuthRequired = await this.securityService.isReAuthRequired(sessionId);
    const isCaptchaRequired = await this.securityService.isCaptchaRequired(sessionId);
    
    if (isReAuthRequired) {
      // Require re-authentication
    } else if (isCaptchaRequired) {
      // Show CAPTCHA
    }
  }
}
```

### Frontend Integration

The HoneypotButton is automatically included in the main App component and works out of the box.

To query risk requirements:

```typescript
import { getSecurityRequirements, shouldShowCaptcha } from '@/utils/progressiveSecurityHelper';

const requirements = getSecurityRequirements(riskScore);
if (requirements.isCaptchaRequired) {
  // Show CAPTCHA modal
}
```

## Database Schema

### sessionRisks Collection

```typescript
{
  _id: ObjectId,
  sessionId: string,           // Session identifier
  userId?: string,             // Authenticated user ID (if available)
  riskScore: number,           // Accumulated risk points
  captchaRequired: boolean,    // CAPTCHA required flag
  reAuthRequired: boolean,     // Re-authentication required flag
  lastUpdated: Date,           // Last risk update timestamp
  honeypotTriggerCount: number // Total honeypot triggers for this session
}
```

## API Responses

### POST /api/security/honeypot-triggered

**Request:**
```json
{
  "sessionId": "session-123",
  "currentRoute": "/student/course",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Thank you for your submission"
}
```

**Always returns success (200)** - This prevents automated tools from detecting the honeypot.

## Monitoring & Logging

All honeypot triggers are logged with:
- Timestamp
- Session ID
- User ID (if authenticated)
- IP address
- User agent
- Current route
- Request ID

Logs are sent to Sentry for monitoring and security alerts.

## Security Considerations

1. **No Auto-Blocking**: Users are never automatically blocked or banned
2. **Progressive Escalation**: Security requirements increase gradually
3. **Always Return Success**: Honeypot endpoint never reveals detection
4. **Transparent Logging**: All events are logged for audit purposes
5. **No False Positives**: Legitimate users will not trigger honeypot
6. **Graceful Degradation**: Failures don't break user experience

## Testing

### Backend Tests
- `SecurityController.test.ts` - Tests honeypot endpoint behavior
- `progressiveSecurityHelper.test.ts` - Tests risk scoring logic

### Frontend Tests
- `HoneypotButton.test.tsx` - Tests component rendering and interaction
- `honeypot.spec.ts` - E2E tests for honeypot visibility and API calls

## Future Enhancements

Possible improvements:
- CAPTCHA integration with reCAPTCHA v3
- Rate limiting based on risk score
- IP-based reputation system
- Geographic anomaly detection
- Machine learning for automated behavior detection
- Admin dashboard for risk monitoring
- CAPTCHA recovery mechanisms
- Risk score decay over time
