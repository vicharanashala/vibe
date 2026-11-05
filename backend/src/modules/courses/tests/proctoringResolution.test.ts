// models.ts pulls in class-transformer decorators, which need the metadata
// polyfill loaded first — same first line as every other suite here.
import 'reflect-metadata';
import {describe, expect, it} from 'vitest';
import {
  isProctoringActive,
  isDetectorEnabled,
  resolveProctoringDetectors,
} from '#root/shared/interfaces/models.js';
import {ProctoringComponent} from '#root/shared/database/interfaces/ISettingRepository.js';

function detectors(enabledNames: ProctoringComponent[]) {
  return Object.values(ProctoringComponent).map(detectorName => ({
    detectorName,
    settings: {enabled: enabledNames.includes(detectorName)},
  }));
}

/**
 * Guards the item > module > universal precedence that lets selective
 * proctoring ship without migrating existing content: every item/module
 * written before this feature existed has no override field at all, so the
 * "absent falls through to the next tier" behavior below is what keeps
 * their proctoring status unchanged after deploy.
 */
describe('resolveProctoringDetectors', () => {
  const universalOn = {
    settings: {proctors: {detectors: detectors([ProctoringComponent.CAMERAMICRO])}},
  };
  const universalOff = {
    settings: {proctors: {detectors: detectors([])}},
  };
  const onlyBlur = detectors([ProctoringComponent.BLURDETECTION]);
  const onlyFaceRecognition = detectors([ProctoringComponent.FACERECOGNITION]);

  it('universal on, no overrides -> resolves the course list, proctored', () => {
    const resolved = resolveProctoringDetectors(undefined, undefined, universalOn);
    expect(isProctoringActive(resolved)).toBe(true);
    expect(isDetectorEnabled(resolved, ProctoringComponent.CAMERAMICRO)).toBe(true);
  });

  it('universal off, no overrides -> not proctored', () => {
    const resolved = resolveProctoringDetectors(undefined, undefined, universalOff);
    expect(isProctoringActive(resolved)).toBe(false);
  });

  it('universal off, item override enables a specific detector -> resolves exactly that subset', () => {
    const resolved = resolveProctoringDetectors(
      {proctoringDetectors: onlyBlur},
      undefined,
      universalOff,
    );
    expect(resolved).toEqual(onlyBlur);
    expect(isDetectorEnabled(resolved, ProctoringComponent.BLURDETECTION)).toBe(true);
    expect(isDetectorEnabled(resolved, ProctoringComponent.CAMERAMICRO)).toBe(false);
  });

  it('universal on, item override to an empty-of-enabled list -> not proctored (selective exception)', () => {
    const allOff = detectors([]);
    const resolved = resolveProctoringDetectors(
      {proctoringDetectors: allOff},
      undefined,
      universalOn,
    );
    expect(isProctoringActive(resolved)).toBe(false);
  });

  it('module override present, item unset -> module tier applies', () => {
    const resolved = resolveProctoringDetectors(
      undefined,
      {proctoringDetectors: onlyFaceRecognition},
      universalOff,
    );
    expect(resolved).toEqual(onlyFaceRecognition);
  });

  it('item override wins over a conflicting module override, which wins over universal', () => {
    const resolved = resolveProctoringDetectors(
      {proctoringDetectors: onlyBlur},
      {proctoringDetectors: onlyFaceRecognition},
      universalOn,
    );
    expect(resolved).toEqual(onlyBlur);
  });

  it('a legacy item/module with no field at all resolves exactly like absent', () => {
    expect(isProctoringActive(resolveProctoringDetectors({}, {}, universalOn))).toBe(true);
    expect(isProctoringActive(resolveProctoringDetectors({}, {}, universalOff))).toBe(false);
  });

  it('a stored `null` (how Mongo serializes a never-set optional field on insert) is treated as unset, not as an explicit empty override', () => {
    const resolvedOn = resolveProctoringDetectors(
      {proctoringDetectors: null},
      {proctoringDetectors: null},
      universalOn,
    );
    expect(isProctoringActive(resolvedOn)).toBe(true);

    const resolvedOff = resolveProctoringDetectors(
      {proctoringDetectors: null},
      {proctoringDetectors: null},
      universalOff,
    );
    expect(isProctoringActive(resolvedOff)).toBe(false);

    // Module still applies when only the item is null.
    const resolvedModule = resolveProctoringDetectors(
      {proctoringDetectors: null},
      {proctoringDetectors: onlyFaceRecognition},
      universalOff,
    );
    expect(resolvedModule).toEqual(onlyFaceRecognition);
  });

  it('missing course settings entirely resolves to an empty list, not proctored', () => {
    const resolved = resolveProctoringDetectors(undefined, undefined, undefined);
    expect(resolved).toEqual([]);
    expect(isProctoringActive(resolved)).toBe(false);
  });
});

describe('isProctoringActive', () => {
  it('is false when every detector is disabled (the default for every new course)', () => {
    expect(isProctoringActive(detectors([]))).toBe(false);
  });

  it('is true when at least one detector is enabled', () => {
    expect(isProctoringActive(detectors([ProctoringComponent.FACERECOGNITION]))).toBe(true);
  });

  it('is false for an empty list', () => {
    expect(isProctoringActive([])).toBe(false);
  });
});

describe('isDetectorEnabled', () => {
  it('resolves a specific detector independently of the others', () => {
    const list = detectors([ProctoringComponent.FACERECOGNITION, ProctoringComponent.BLURDETECTION]);
    expect(isDetectorEnabled(list, ProctoringComponent.FACERECOGNITION)).toBe(true);
    expect(isDetectorEnabled(list, ProctoringComponent.BLURDETECTION)).toBe(true);
    expect(isDetectorEnabled(list, ProctoringComponent.CAMERAMICRO)).toBe(false);
  });

  it('is false for a detector missing from the list entirely', () => {
    expect(isDetectorEnabled([], ProctoringComponent.FACERECOGNITION)).toBe(false);
  });
});
