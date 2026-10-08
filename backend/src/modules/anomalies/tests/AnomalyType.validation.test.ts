import 'reflect-metadata';
import {describe, it, expect} from 'vitest';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {NewAnomalyData} from '../classes/validators/AnomalyValidators.js';
import {
  AnomalyStats,
  AnomalyType,
  normalizeAnomalyType,
} from '../classes/transformers/Anomaly.js';

const ids = {
  courseId: '64c000000000000000000010',
  versionId: '64c000000000000000000011',
  itemId: '64c000000000000000000012',
};

async function errorsFor(type: unknown) {
  const body = plainToInstance(NewAnomalyData, {...ids, type});
  return validate(body);
}

describe('anomaly type validation', () => {
  it('accepts the new gaze and foreign-object types', async () => {
    expect(await errorsFor('GAZE_AWAY')).toHaveLength(0);
    expect(await errorsFor('FOREIGN_OBJECT')).toHaveLength(0);
  });

  it('accepts the camelCase / snake_case values older clients send', async () => {
    // Regression: these used to fail @IsEnum, so no-face / multiple-faces /
    // voice reports from the web client were silently rejected with a 400.
    for (const legacy of [
      'no_face',
      'multiple_faces',
      'voiceDetection',
      'handGestureDetection',
      'focus',
      'faceRecognition',
      'gazeAway',
      'foreignObject',
    ]) {
      expect(await errorsFor(legacy), legacy).toHaveLength(0);
    }
  });

  it('still rejects unknown types', async () => {
    expect((await errorsFor('SOMETHING_ELSE')).length).toBeGreaterThan(0);
    expect((await errorsFor(undefined)).length).toBeGreaterThan(0);
  });

  it('normalizes legacy values to the canonical enum', () => {
    expect(normalizeAnomalyType('no_face')).toBe(AnomalyType.NO_FACE);
    expect(normalizeAnomalyType('gazeAway')).toBe(AnomalyType.GAZE_AWAY);
    expect(normalizeAnomalyType('BLUR_DETECTION')).toBe('BLUR_DETECTION');
  });

  it('starts new stats counters at zero', () => {
    const stats = new AnomalyStats();
    expect(stats.GAZE_AWAY).toBe(0);
    expect(stats.FOREIGN_OBJECT).toBe(0);
  });
});
