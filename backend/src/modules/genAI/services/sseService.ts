import { injectable } from 'inversify';
import { Request, Response } from 'express';

interface Client {
  jobId: string;
  res: Response;
  heartbeat: NodeJS.Timeout;
}

const SSE_HEARTBEAT_MS = 15000;

@injectable()
export class SseService {
  private clients: Client[] = [];

  init(req: Request, res: Response, jobId: string) {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.flushHeaders?.();
    res.write(': connected\n\n'); // optional initial comment

    const heartbeat = setInterval(() => {
      // Keep the SSE stream active so EventSource clients do not timeout.
      res.write(': ping\n\n');
    }, SSE_HEARTBEAT_MS);

    this.clients.push({ jobId, res, heartbeat });

    req.once('close', () => this.cleanup(res));
  }

  send(jobId: string, event: string, payload: any) {
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
    res.end();
  }
}

