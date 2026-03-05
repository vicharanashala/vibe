

import { InterceptorInterface, Action} from 'routing-controllers';
import {injectable, inject} from 'inversify';
import {AUDIT_TRAILS_TYPES} from '#root/modules/auditTrails/types.js';
import {IAuditTrailsRepository} from '#root/modules/auditTrails/interfaces/IAuditTrailsRepository.js';

@injectable()
export class AuditTrailsHandler implements InterceptorInterface {
  constructor(
    @inject(AUDIT_TRAILS_TYPES.AuditTrailsRepository)
    private readonly auditTrailsRepo: IAuditTrailsRepository,
  ) {
  }

  async intercept(action: Action, content: any) {
    const method = action.request.method;
    if (method === 'GET' || method === 'OPTIONS') {
      console.log('Skipping audit trail for method:', action.request.method);
      return content;
    }

    try {
      const auditData = action.request.auditTrail;
      if (!auditData) {
        console.warn(
          'No audit trail data found on request. Skipping audit logging.',
        );
        return content;
      }

      //To-be implemented -> implement the background queue job.
      await this.auditTrailsRepo.createAuditTrail({
        ...auditData,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error('Error in AuditTrailsHandler interceptor:', err);
    }

    return content; // VERY IMPORTANT
  }
}
