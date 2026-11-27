import {describe, expect, it} from 'vitest';
import {phoneLessonMode, resolveStudyMode, studyModeLevel, studyModeRefusal, studyModeState} from './studyMode';

describe('resolveStudyMode', () => {
  it('follows item > section > module, allowing study mode when nothing is set', () => {
    expect(resolveStudyMode({}, {}, {})).toEqual({allowed: true, source: 'default'});
    expect(resolveStudyMode({studyModeEnabled: null}, {studyModeEnabled: null}, {studyModeEnabled: false})).toEqual({
      allowed: false,
      source: 'module',
    });
    expect(resolveStudyMode({}, {studyModeEnabled: false}, {studyModeEnabled: true})).toEqual({allowed: false, source: 'section'});
    expect(resolveStudyMode({studyModeEnabled: true}, {}, {studyModeEnabled: false})).toEqual({allowed: true, source: 'item'});
  });
});

describe('studyModeState', () => {
  it('shows a module with study mode off as set here', () => {
    expect(studyModeState({studyModeEnabled: false}, [])).toEqual({
      own: false,
      inherited: true,
      effective: false,
      isInherited: false,
    });
  });

  it('shows a section in a disabled module as inheriting off', () => {
    expect(studyModeState({}, [{studyModeEnabled: false}])).toEqual({
      own: null,
      inherited: false,
      effective: false,
      isInherited: true,
    });
  });

  it('lets an item override a disabled module', () => {
    expect(studyModeState({studyModeEnabled: true}, [{}, {studyModeEnabled: false}])).toEqual({
      own: true,
      inherited: false,
      effective: true,
      isInherited: false,
    });
  });

  it('returns to the inherited value when the item is reset to inherit', () => {
    expect(studyModeState({studyModeEnabled: null}, [{studyModeEnabled: true}, {studyModeEnabled: false}])).toEqual({
      own: null,
      inherited: true,
      effective: true,
      isInherited: true,
    });
  });
});

describe('studyModeLevel', () => {
  it('names the level that disabled study mode', () => {
    expect(studyModeLevel('module')).toBe('this module');
    expect(studyModeLevel('section')).toBe('this section');
    expect(studyModeLevel('item')).toBe('this lesson');
  });
});

describe('phoneLessonMode', () => {
  const video = (allowed: boolean) => ({type: 'VIDEO', studyMode: {allowed, source: 'default' as const}});

  it('keeps today’s behaviour on a computer whatever the setting', () => {
    expect(phoneLessonMode(video(true), false, false)).toBe('normal');
    expect(phoneLessonMode(video(false), false, false)).toBe('normal');
  });

  it('plays a study-allowed video in study mode on a phone', () => {
    expect(phoneLessonMode(video(true), true, false)).toBe('study');
  });

  it('shows the fallback for an instructor-disabled video, a quiz, or other items on a phone', () => {
    expect(phoneLessonMode(video(false), true, false)).toBe('fallback');
    expect(phoneLessonMode({type: 'QUIZ', studyMode: {allowed: true, source: 'default'}}, true, false)).toBe('fallback');
    expect(phoneLessonMode({type: 'BLOG', studyMode: {allowed: true, source: 'default'}}, true, false)).toBe('fallback');
  });

  it('falls back when the backend did not report study mode (older backend)', () => {
    expect(phoneLessonMode({type: 'VIDEO'}, true, false)).toBe('fallback');
  });

  it('keeps the existing unproctored-on-a-phone path unchanged', () => {
    expect(phoneLessonMode(video(false), true, true)).toBe('normal');
    expect(phoneLessonMode({type: 'QUIZ'}, true, true)).toBe('normal');
  });
});

describe('studyModeRefusal', () => {
  it('recognises the backend’s study-mode refusals and nothing else', () => {
    expect(studyModeRefusal({name: 'STUDY_MODE_DISABLED', details: {source: 'section'}})).toEqual({
      kind: 'disabled',
      source: 'section',
    });
    expect(studyModeRefusal({name: 'STUDY_MODE_QUIZ'})).toEqual({kind: 'quiz'});
    expect(studyModeRefusal({name: 'ForbiddenError', message: "You don't have permission"})).toBeUndefined();
    expect(studyModeRefusal(undefined)).toBeUndefined();
  });
});
