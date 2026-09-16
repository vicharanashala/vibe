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
        await this.waitForConcurrencySlot();
        await this.waitForRpsSlot();
        this.inFlight += 1;
        this.startTimestamps.push(Date.now());
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.inFlight -= 1;
            this.drainQueue();
        };
    }

    private waitForConcurrencySlot(): Promise<void> {
        if (this.inFlight < this.maxConcurrent) return Promise.resolve();
        return new Promise(resolve => this.queue.push(resolve));
    }

    private drainQueue(): void {
        if (this.inFlight < this.maxConcurrent) {
            const next = this.queue.shift();
            next?.();
        }
    }

    private async waitForRpsSlot(): Promise<void> {
        for (;;) {
            const now = Date.now();
            this.startTimestamps = this.startTimestamps.filter(t => now - t < 1000);
            if (this.startTimestamps.length < this.maxRps) return;
            const oldest = this.startTimestamps[0];
            const waitMs = Math.max(1, 1000 - (now - oldest));
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }
    }
}
