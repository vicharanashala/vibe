// import { Request, Response, NextFunction } from "express";
// import { Middleware } from "routing-controllers/types/decorator/Middleware.js";

// export function AuditTrailsHandler(req: Request, res: Response, next: NextFunction) {
//     console.log(`[Audit Trail] ${req}`);
//     next();
// }

// import { ExpressMiddlewareInterface, Middleware } from "routing-controllers";
// import { Request, Response, NextFunction } from "express";
// import { inject, injectable } from "inversify";

// import { GLOBAL_TYPES } from "#root/types.js";
// import { MongoDatabase } from "../database/index.js";

// @Middleware({ type: "before" }) // runs after controller
// @injectable()
// export class AuditTrailsHandler implements ExpressMiddlewareInterface {
//   constructor(
//      @inject(AUDIT_TRAILS_TYPES.AuditTrailsRepository)
//      private readonly auditTrailsRepo: IAuditTrailsRepository,

//      @inject(GLOBAL_TYPES.Database)
//      private readonly mongoDatabase: MongoDatabase

//      )
//   {}
//   use(req: Request, res: Response, next: NextFunction) {
//     console.log("Inside AuditTrailsHandler middleware");

//     console.log("res.send exists:", typeof res.send);
// console.log("res.json exists:", typeof res.json);
// console.log("res.end exists:", typeof res.end);

//     const repo = this.auditTrailsRepo;
//     const oldsent = res.send.bind(res);
//     res.send = (body: any) => {
//       console.log("Captured Response:", body);

//       return oldsent(body);
//     };

//     next();
//   }
// }

import { InterceptorInterface, Action} from 'routing-controllers';
import {injectable, inject} from 'inversify';
import {AUDIT_TRAILS_TYPES} from '#root/modules/auditTrails/types.js';
import {IAuditTrailsRepository} from '#root/modules/auditTrails/interfaces/IAuditTrailsRepository.js';
import { ObjectId } from 'mongodb';

@injectable()
export class AuditTrailsHandler implements InterceptorInterface {
  constructor(
    @inject(AUDIT_TRAILS_TYPES.AuditTrailsRepository)
    private readonly auditTrailsRepo: IAuditTrailsRepository,
  ) {
    console.log('AuditTrailsHandler interceptor initialized');
  }

  async intercept(action: Action, content: any) {
    const method = action.request.method;
    if (method === 'GET' || method === 'OPTIONS') {
      console.log('Skipping audit trail for method:', action.request.method);
      return content;
    }

    try {
      const auditData = action.request.auditTrail;
      console.log("🔥 INTERCEPTOR RUNNING:", action.request.url);
      console.log('AuditTrailsHandler interceptor executed for method:');
      if (!auditData) {
        console.warn(
          'No audit trail data found on request. Skipping audit logging.',
        );
        return content;
      }
      console.log('Logging audit trail with data:', auditData);

      //To-be implemented -> implement the background queue job.
      await this.auditTrailsRepo.createAuditTrail({
        ...auditData,
        actor: new ObjectId(String(auditData.actor)),
        createdAt: new Date(),
      });
    } catch (err) {
      console.error('Error in AuditTrailsHandler interceptor:', err);
    }

    return content; // VERY IMPORTANT
  }
}
