import {describe, expect, it} from 'vitest';
import {contentLockRefusal, contentLockState, lockedMessage, resolveContentLock} from './contentLock';

describe('resolveContentLock', () => {
  it('follows item > section > module, open when nothing is set', () => {
    expect(resolveContentLock({}, {}, {})).toEqual({locked: false, source: 'default'});
    expect(resolveContentLock({isLocked: null}, {isLocked: null}, {isLocked: true})).toEqual({
      locked: true,
      source: 'module',
    });
    expect(resolveContentLock({}, {isLocked: true}, {isLocked: false})).toEqual({locked: true, source: 'section'});
    expect(resolveContentLock({isLocked: false}, {}, {isLocked: true})).toEqual({locked: false, source: 'item'});
  });
});

describe('contentLockState', () => {
  it('reports an inherited lock on a lesson with no setting', () => {
    expect(contentLockState({}, [{}, {isLocked: true}])).toEqual({
      own: null,
      inherited: true,
      effective: true,
      isInherited: true,
    });
  });

  it('lets a lesson stay open inside a locked module', () => {
    expect(contentLockState({isLocked: false}, [{}, {isLocked: true}])).toEqual({
      own: false,
      inherited: true,
      effective: false,
      isInherited: false,
    });
  });

  it('is open for a module with nothing set', () => {
    expect(contentLockState({}, []).effective).toBe(false);
  });
});

describe('contentLockRefusal', () => {
  it('recognises the backend’s lock refusal and nothing else', () => {
    expect(contentLockRefusal({name: 'CONTENT_LOCKED', details: {source: 'section'}})).toEqual({source: 'section'});
    expect(contentLockRefusal({name: 'ForbiddenError'})).toBeUndefined();
    expect(contentLockRefusal(undefined)).toBeUndefined();
  });
});

describe('lockedMessage', () => {
  it('names the level', () => {
    expect(lockedMessage('module')).toContain('locked this module');
    expect(lockedMessage('item')).toContain('locked this lesson');
  });
});
