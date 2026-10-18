import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import { SseService } from '../services/SseService.js';

/**
 * Regression coverage for the unguarded `res.write()` in the heartbeat
 * `setInterval` callback and in `send()`: a normal client disconnect at the
 * wrong moment (write after the stream ended, or an async 'error' event on
 * a broken connection) previously threw or emitted an unhandled 'error'
 * from inside a plain interval callback / EventEmitter — either one takes
 * down the whole Node process, not just this one SSE connection.
 */
function makeFakeReqRes() {
    const req = new EventEmitter() as any;
    const res = new EventEmitter() as any;
    res.set = vi.fn();
    res.flushHeaders = vi.fn();
    res.writableEnded = false;
    res.destroyed = false;
    res.write = vi.fn();
    res.end = vi.fn();
    return { req, res };
}

describe('examGenAI — SseService crash safety', () => {
    it('does not throw when writing to a response that already ended', () => {
        const sse = new SseService();
        const { req, res } = makeFakeReqRes();
        sse.init(req, res, 'job-1');

        res.writableEnded = true;
        expect(() => sse.send('job-1', 'progress', { ok: true })).not.toThrow();
    });

    it('does not throw (and cleans up the client) when res.write throws synchronously', () => {
        const sse = new SseService();
        const { req, res } = makeFakeReqRes();
        sse.init(req, res, 'job-1');

        res.write = vi.fn(() => {
            throw new Error('ERR_STREAM_WRITE_AFTER_END');
        });

        expect(() => sse.send('job-1', 'progress', { ok: true })).not.toThrow();
        // A second send to the same jobId should be a no-op (client was
        // cleaned up), not attempt another throwing write.
        expect(() => sse.send('job-1', 'progress', { ok: true })).not.toThrow();
    });

    it('does not crash (no unhandled error) when the response stream emits an async error event', async () => {
        const sse = new SseService();
        const { req, res } = makeFakeReqRes();
        sse.init(req, res, 'job-1');

        // An EventEmitter 'error' event with no listener throws — if init()
        // didn't register one, this would crash the test process itself.
        expect(() => res.emit('error', new Error('ECONNRESET'))).not.toThrow();
    });

    it('cleans up the heartbeat interval on cleanup so it cannot fire again', () => {
        vi.useFakeTimers();
        try {
            const sse = new SseService();
            const { req, res } = makeFakeReqRes();
            sse.init(req, res, 'job-1');

            sse.cleanup(res);
            res.write.mockClear();

            vi.advanceTimersByTime(60_000);
            expect(res.write).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });
});
