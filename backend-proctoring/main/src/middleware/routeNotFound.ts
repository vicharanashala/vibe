import { Request, Response, NextFunction } from "express";

export function routeNotFound(req: Request, res: Response, next: NextFunction) {
    const error = new Error(`Route Not Found - ${req.originalUrl}`);
  
    console.error(`[${new Date().toISOString()}] METHOD: [${req.method}] URL: [${req.url}] - IP: [${req.socket.remoteAddress}] - STATUS: [404]`);
    res.status(404);
    res.json({error: error.message});
    return ;
}