/**
 * Client-side throttle for a shared inference slot with both a concurrency
 * cap and a requests/sec cap ("10 RPS per user · 9 cap" on the MiniMax-M3
 * vLLM dashboard). One instance is shared process-wide (see MiniMaxProvider)
 * since every call in this process uses the same MINIMAX_API_KEY, i.e. is
 * the same "user" as far as the shared slot is concerned.
 *
 * Concurrency is a plain counting semaphore. The RPS cap is a sliding
 * 1-second window of call-start timestamps: a new call waits until the
 * oldest timestamp in the window is more than 1s old before it's allowed to
 * start, so at most `maxRps` calls can start in any rolling second.
 */
export class RateLimiter {
    private inFlight = 0;
    private queue: Array<() => void> = [];
    private startTimestamps: number[] = [];

    constructor(private readonly maxConcurrent: number, private readonly maxRps: number) {}

    async acquire(): Promise<() => void> {
        await this.reserveConcurrencySlot();
        await this.reserveRpsSlot();
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.inFlight -= 1;
            this.drainQueue();
        };
    }

    /**
     * Both this and `reserveRpsSlot` check-then-reserve in the *same*
     * synchronous step (the `+= 1`/`.push` happens right alongside the
     * check, with no `await` between them) — that's load-bearing, not
     * style. The previous version awaited a "slot is free" check, then
     * incremented `inFlight` afterwards; every concurrently-pending
     * `acquire()` call observes the same stale `inFlight` before any of
     * them gets to increment it (JS doesn't context-switch mid-expression,
     * but it very much does between two separate `await`ed steps), so
     * `maxConcurrent` (and the analogous `maxRps` window) could be
     * exceeded under real concurrent load — exactly the scenario multiple
     * workers/jobs sharing one process-wide limiter (see this class's
     * top-level doc) produce.
     */
    private reserveConcurrencySlot(): Promise<void> {
        if (this.inFlight < this.maxConcurrent) {
            this.inFlight += 1;
            return Promise.resolve();
        }
        return new Promise(resolve => {
            this.queue.push(() => {
                this.inFlight += 1;
                resolve();
            });
        });
    }

    private drainQueue(): void {
        if (this.inFlight < this.maxConcurrent) {
            const next = this.queue.shift();
            next?.();
        }
    }

    private async reserveRpsSlot(): Promise<void> {
        for (;;) {
            const now = Date.now();
            this.startTimestamps = this.startTimestamps.filter(t => now - t < 1000);
            if (this.startTimestamps.length < this.maxRps) {
                this.startTimestamps.push(now);
                return;
            }
            const oldest = this.startTimestamps[0];
            const waitMs = Math.max(1, 1000 - (now - oldest));
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }
    }
}
