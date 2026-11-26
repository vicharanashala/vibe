import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../services/llm/RateLimiter.js';

/**
 * Regression coverage for the concurrency/RPS race described in the module
 * review: the previous implementation checked "is a slot free?" and only
 * incremented `inFlight`/pushed a timestamp on a LATER tick (after an
 * `await`), so every `acquire()` call fired back-to-back could observe the
 * same stale state and all get admitted together, exceeding both caps.
 */
describe('examGenAI — RateLimiter concurrency race', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('never admits more than maxConcurrent callers at once under a burst of simultaneous acquires', async () => {
        const limiter = new RateLimiter(3, 1000); // high RPS cap so only concurrency is exercised
        let inFlight = 0;
        let maxObservedInFlight = 0;

        const worker = async () => {
            const release = await limiter.acquire();
            inFlight += 1;
            maxObservedInFlight = Math.max(maxObservedInFlight, inFlight);
            // Simulate an in-flight call so overlapping acquires actually contend.
            await new Promise(resolve => setTimeout(resolve, 50));
            inFlight -= 1;
            release();
        };

        const runs = Promise.all(Array.from({ length: 10 }, () => worker()));
        await vi.runAllTimersAsync();
        await runs;

        expect(maxObservedInFlight).toBeLessThanOrEqual(3);
    });

    it('never starts more than maxRps callers within any rolling second, even fired simultaneously', async () => {
        const limiter = new RateLimiter(100, 2); // high concurrency cap so only RPS is exercised
        const startTimes: number[] = [];

        const worker = async () => {
            const release = await limiter.acquire();
            startTimes.push(Date.now());
            release();
        };

        const runs = Promise.all(Array.from({ length: 6 }, () => worker()));
        await vi.runAllTimersAsync();
        await runs;

        // Slide a 1000ms window across every start time; none should contain
        // more than maxRps(=2) starts.
        for (const t of startTimes) {
            const inWindow = startTimes.filter(x => x >= t && x < t + 1000).length;
            expect(inWindow).toBeLessThanOrEqual(2);
        }
    });
});
