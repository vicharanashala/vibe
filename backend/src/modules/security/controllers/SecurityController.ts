import {
  JsonController,
  Post,
  Body,
  Req,
  HttpCode,
  OnUndefined,
} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { Request } from 'express';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { HoneypotTriggerBody, HoneypotTriggerResponse } from '../classes/validators.js';
import { ISecurityService } from '../interfaces/ISecurityService.js';
import { SECURITY_TYPES } from '../types.js';

@OpenAPI({
  tags: ['Security'],
})
@JsonController('/security')
@injectable()
export class SecurityController {
  constructor(
    @inject(SECURITY_TYPES.SecurityService)
    private readonly securityService: ISecurityService,
  ) {}

  @OpenAPI({
    summary: 'Record honeypot trigger',
    description:
      'Records a honeypot button trigger for security monitoring. This endpoint is never called by legitimate users and is used to detect automated interactions.',
  })
  @Post('/honeypot-triggered')
  @HttpCode(200)
  @ResponseSchema(HoneypotTriggerResponse, {
    description: 'Honeypot trigger recorded',
    statusCode: 200,
  })
  @OnUndefined(200)
  async honeypotTriggered(
    @Body() body: HoneypotTriggerBody,
    @Req() req: Request,
  ): Promise<HoneypotTriggerResponse> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';
      const requestId = req.get('x-request-id') || `${Date.now()}-${Math.random()}`;

      // Extract session ID from cookies or request body
      const sessionId = body.sessionId || req.cookies?.sessionId || undefined;

      // Record the honeypot trigger
      await this.securityService.recordHoneypotTrigger({
        sessionId,
        currentRoute: body.currentRoute,
        timestamp: new Date(body.timestamp),
        ipAddress,
        userAgent,
        requestId,
      });

      // Always return success so that automated clients cannot detect the honeypot
      return {
        status: 'success',
        message: 'Thank you for your submission',
      };
    } catch (error) {
      console.error('[SECURITY] Error in honeypot endpoint:', error);
      // Still return success even on error to not reveal the honeypot
      return {
        status: 'success',
        message: 'Thank you for your submission',
      };
    }
  }
}
