import {describe, expect, it} from 'vitest';
import {ObjectId} from 'mongodb';
import {
  buildCrowdValidationPatch,
  mapStatusToCrowdValidationState,
} from '../StudentQuestionMigration.js';

describe('StudentQuestionMigration', () => {
  it('maps legacy statuses to expected crowd states', () => {
    expect(mapStatusToCrowdValidationState('UNVERIFIED')).toBe('PENDING_CROWD_DATA');
    expect(mapStatusToCrowdValidationState('TO_BE_VALIDATED')).toBe('READY_FOR_CROWD');
    expect(mapStatusToCrowdValidationState('VALIDATED')).toBe('KEPT');
    expect(mapStatusToCrowdValidationState('REJECTED')).toBe('DISCARDED');
  });

  it('builds patch for legacy V1 document with no crowd fields', () => {
    const patch = buildCrowdValidationPatch({
      _id: new ObjectId(),
      status: 'TO_BE_VALIDATED',
    });

    expect(patch).not.toBeNull();
    expect(patch?.$set.crowdValidationState).toBe('READY_FOR_CROWD');
    expect(patch?.$set.crowdValidationMetrics).toEqual({
      totalAttempts: 0,
      correctAttempts: 0,
    });
  });

  it('returns null when document already has normalized V2 fields', () => {
    const patch = buildCrowdValidationPatch({
      _id: new ObjectId(),
      status: 'VALIDATED',
      crowdValidationState: 'KEPT',
      crowdValidationMetrics: {
        totalAttempts: 10,
        correctAttempts: 6,
        correctRate: 0.6,
      },
    });

    expect(patch).toBeNull();
  });

  it('normalizes invalid metrics and recomputes rate', () => {
    const patch = buildCrowdValidationPatch({
      _id: new ObjectId(),
      status: 'UNVERIFIED',
      crowdValidationState: 'PENDING_CROWD_DATA',
      crowdValidationMetrics: {
        totalAttempts: 5,
        correctAttempts: 7,
      },
    });

    expect(patch).not.toBeNull();
    expect(patch?.$set.crowdValidationMetrics).toEqual({
      totalAttempts: 0,
      correctAttempts: 0,
    });
  });
});
