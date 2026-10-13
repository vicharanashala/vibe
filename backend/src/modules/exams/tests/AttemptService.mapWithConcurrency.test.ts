import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '../services/AttemptService.js';

/**
 * Pure-function unit test -- no Mongo/DI setup needed, unlike this module's
 * other test files. Exists because the concurrency-batching fix in
 * AttemptService.submitAttempt (replacing an unbounded Promise.all with this
 * worker pool) is not observable through the public HTTP API: the output
 * array is identical either way, only in-flight concurrency differs. This is
 * the one place that actually needs a synthetic assertion rather than a
 * black-box request/response check.
 */
describe('mapWithConcurrency', () => {
    it('never exceeds the configured concurrency', async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        const items = Array.from({ length: 20 }, (_, i) => i);

        const results = await mapWithConcurrency(items, 5, async (item) => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 5));
            inFlight--;
            return item * 2;
        });

        expect(maxInFlight).toBeLessThanOrEqual(5);
        expect(results).toEqual(items.map((i) => i * 2));
    });

    it('preserves result order regardless of completion order', async () => {
        // Earlier items sleep longer than later ones, so if the pool ever
        // wrote results out of order this would catch it.
        const items = [30, 10, 20, 5, 25];
        const results = await mapWithConcurrency(items, 3, async (ms) => {
            await new Promise((resolve) => setTimeout(resolve, ms));
            return ms;
        });
        expect(results).toEqual(items);
    });

    it('handles an empty array', async () => {
        const results = await mapWithConcurrency<number, number>([], 5, async (i) => i);
        expect(results).toEqual([]);
    });
});
