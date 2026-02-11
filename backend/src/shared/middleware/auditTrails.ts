// import { Request, Response, NextFunction } from "express";
// import { Middleware } from "routing-controllers/types/decorator/Middleware.js";

// export function AuditTrailsHandler(req: Request, res: Response, next: NextFunction) {
//     console.log(`[Audit Trail] ${req}`);
//     next();
// }


import { ExpressMiddlewareInterface, Middleware } from "routing-controllers";
import { Request, Response, NextFunction } from "express";
 
@Middleware({ type: "before" }) // runs before controller
export class AuditTrailsHandler implements ExpressMiddlewareInterface {
 
  use(req: Request, res: Response, next: NextFunction): void {
    console.log(`Audit trails middle ware logged here:`, req)
    console.log(`[${req.method}] ${req.url}`);
    next();
  }
}