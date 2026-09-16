import { injectable } from 'inversify';
import { Request, Response } from 'express';

interface Client {
    jobId: string;
    res: Response;
    heartbeat: NodeJS.Timeout;
}

const SSE_HEARTBEAT_MS = 15000;

/**
 * Same shape as genAI/services/sseService.ts (in-memory, jobId-keyed
 * broadcaster) — kept as a local copy rather than a cross-module import so
 * this module has no dependency on genAI (see index.ts's module boundary
 * note).
 */
@injectable()
export class SseService {
    private clients: Client[] = [];

    init(req: Request, res: Response, jobId: string) {
        res.set({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });
        res.flushHeaders?.();
        res.write(': connected\n\n');

        const heartbeat = setInterval(() => {
            res.write(': ping\n\n');
        }, SSE_HEARTBEAT_MS);

        this.clients.push({ jobId, res, heartbeat });

        req.once('close', () => this.cleanup(res));
    }

    send(jobId: string, event: string, payload: unknown) {
        const clients = this.clients.filter(c => c.jobId === jobId);
        const data = JSON.stringify(payload);
        for (const c of clients) {
            c.res.write(`event: ${event}\n`);
            c.res.write(`data: ${data}\n\n`);
        }
    }

    cleanup(res: Response) {
        const client = this.clients.find(c => c.res === res);
        if (client) {
            clearInterval(client.heartbeat);
        }
        this.clients = this.clients.filter(c => c.res !== res);
        try {
            res.end();
        } catch {
            /* already closed */
        }
    }
}
