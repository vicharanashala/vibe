import 'reflect-metadata';
import {describe, expect, it} from 'vitest';

import {resolveStudyMode} from '../models.js';

describe('resolveStudyMode', () => {
  it('allows study mode when nothing is set', () => {
    expect(resolveStudyMode({}, {}, {})).toEqual({
      allowed: true,
      source: 'default',
    });
    expect(resolveStudyMode(undefined, undefined, undefined)).toEqual({
      allowed: true,
      source: 'default',
    });
  });

  it('treats null (an unset field read back from MongoDB) as inherit', () => {
    expect(
      resolveStudyMode(
        {studyModeEnabled: null},
        {studyModeEnabled: null},
        {studyModeEnabled: null},
      ),
    ).toEqual({allowed: true, source: 'default'});
    expect(
      resolveStudyMode(
        {studyModeEnabled: null},
        {studyModeEnabled: null},
        {studyModeEnabled: false},
      ),
    ).toEqual({allowed: false, source: 'module'});
  });

  it('inherits a module that disallows study mode', () => {
    expect(resolveStudyMode({}, {}, {studyModeEnabled: false})).toEqual({
      allowed: false,
      source: 'module',
    });
  });

  it('lets an item override its module', () => {
    expect(
      resolveStudyMode({studyModeEnabled: true}, {}, {studyModeEnabled: false}),
    ).toEqual({
      allowed: true,
      source: 'item',
    });
    expect(resolveStudyMode({studyModeEnabled: false}, {}, {})).toEqual({
      allowed: false,
      source: 'item',
    });
  });

  it('lets a section override its module', () => {
    expect(
      resolveStudyMode({}, {studyModeEnabled: false}, {studyModeEnabled: true}),
    ).toEqual({
      allowed: false,
      source: 'section',
    });
    expect(
      resolveStudyMode({}, {studyModeEnabled: true}, {studyModeEnabled: false}),
    ).toEqual({
      allowed: true,
      source: 'section',
    });
  });

  it('prefers the item over its section', () => {
    expect(
      resolveStudyMode(
        {studyModeEnabled: true},
        {studyModeEnabled: false},
        {studyModeEnabled: false},
      ),
    ).toEqual({allowed: true, source: 'item'});
  });
});
