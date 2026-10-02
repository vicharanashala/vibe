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
        this.safeWrite(res, ': connected\n\n');

        const heartbeat = setInterval(() => {
            this.safeWrite(res, ': ping\n\n');
        }, SSE_HEARTBEAT_MS);

        this.clients.push({ jobId, res, heartbeat });

        req.once('close', () => this.cleanup(res));
        // A broken connection (client vanished mid-write, e.g. ECONNRESET)
        // more often surfaces as an async 'error' event on the stream than a
        // synchronous throw from `write()` — an EventEmitter 'error' with no
        // listener is itself an uncaught exception, so this is just as
        // load-bearing as `safeWrite`'s try/catch above.
        res.once('error', () => this.cleanup(res));
        req.once('error', () => this.cleanup(res));
    }

    send(jobId: string, event: string, payload: unknown) {
        const clients = this.clients.filter(c => c.jobId === jobId);
        const data = JSON.stringify(payload);
        for (const c of clients) {
            this.safeWrite(c.res, `event: ${event}\ndata: ${data}\n\n`);
        }
    }

    /**
     * `res.write` on a connection that closed between our last check and
     * this call (a real race — the client can disconnect at any point, and
     * `req`'s `close` event/`cleanup` aren't guaranteed to have run yet, e.g.
     * from the heartbeat's own `setInterval` callback) throws
     * synchronously (ERR_STREAM_WRITE_AFTER_END) or emits an `error` on the
     * stream. Either one, unhandled, previously crashed the whole backend
     * process — not just this SSE connection. Any failure here just means
     * this one client is gone; treat it the same as an explicit disconnect.
     */
    private safeWrite(res: Response, chunk: string): void {
        if (res.writableEnded || res.destroyed) {
            this.cleanup(res);
            return;
        }
        try {
            res.write(chunk);
        } catch {
            this.cleanup(res);
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
