import 'reflect-metadata';
import {describe, expect, it} from 'vitest';
import {resolveContentLock} from '#root/shared/interfaces/models.js';

describe('resolveContentLock', () => {
  it('is open when nothing is set', () => {
    expect(resolveContentLock(undefined, undefined, undefined)).toEqual({
      locked: false,
      source: 'default',
    });
    expect(
      resolveContentLock({isLocked: null}, {isLocked: null}, {isLocked: null}),
    ).toEqual({locked: false, source: 'default'});
  });

  it('inherits a locked module', () => {
    expect(resolveContentLock({}, {}, {isLocked: true})).toEqual({
      locked: true,
      source: 'module',
    });
  });

  it('lets one lesson stay open inside a locked module', () => {
    expect(resolveContentLock({isLocked: false}, {}, {isLocked: true})).toEqual(
      {locked: false, source: 'item'},
    );
  });

  it('lets a section override its module', () => {
    expect(resolveContentLock({}, {isLocked: true}, {isLocked: false})).toEqual(
      {locked: true, source: 'section'},
    );
    expect(resolveContentLock({}, {isLocked: false}, {isLocked: true})).toEqual(
      {locked: false, source: 'section'},
    );
  });

  it('lets a lesson lock itself inside open content', () => {
    expect(resolveContentLock({isLocked: true}, {}, {})).toEqual({
      locked: true,
      source: 'item',
    });
  });
});
