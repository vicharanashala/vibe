import { describe, it, expect } from 'vitest';
import { isProctoringHeartbeatSuspicious, PROCTORING_HEARTBEAT_GRACE_MS } from '../services/AttemptService.js';

/**
 * Pure-function unit test -- no Mongo/DI setup needed, same shape as
 * AttemptService.mapWithConcurrency.test.ts. The actual bypass this guards
 * against (zero proctoring events/tabSwitches accepted at face value) was
 * live-confirmed on the deployed fork by calling start/submit directly with
 * no browser involved at all; this function is the core decision the fix
 * hinges on, so it gets isolated coverage of every branch.
 */
describe('isProctoringHeartbeatSuspicious', () => {
    it('is never suspicious when the exam has no enabled detector', () => {
        expect(isProctoringHeartbeatSuspicious(false, PROCTORING_HEARTBEAT_GRACE_MS + 1, 0)).toBe(false);
        expect(isProctoringHeartbeatSuspicious(false, PROCTORING_HEARTBEAT_GRACE_MS * 10, 0)).toBe(false);
    });

    it('is never suspicious before the grace window has elapsed, regardless of heartbeat count', () => {
        expect(isProctoringHeartbeatSuspicious(true, 0, 0)).toBe(false);
        expect(isProctoringHeartbeatSuspicious(true, PROCTORING_HEARTBEAT_GRACE_MS - 1, 0)).toBe(false);
    });

    it('is not suspicious once at least one heartbeat landed, even far past the grace window', () => {
        expect(isProctoringHeartbeatSuspicious(true, PROCTORING_HEARTBEAT_GRACE_MS, 1)).toBe(false);
        expect(isProctoringHeartbeatSuspicious(true, PROCTORING_HEARTBEAT_GRACE_MS * 100, 1)).toBe(false);
    });

    it('is suspicious only when a detector is enabled, the grace window has passed, and zero heartbeats landed', () => {
        expect(isProctoringHeartbeatSuspicious(true, PROCTORING_HEARTBEAT_GRACE_MS, 0)).toBe(true);
        expect(isProctoringHeartbeatSuspicious(true, PROCTORING_HEARTBEAT_GRACE_MS * 10, 0)).toBe(true);
    });
});
