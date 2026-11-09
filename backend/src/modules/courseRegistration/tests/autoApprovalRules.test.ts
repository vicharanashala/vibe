import {describe, expect, it} from 'vitest';
import {
  normalizeEntries,
  parseEntry,
  resolveMode,
  shouldAutoApprove,
} from '../utils/autoApproval.js';

const list = (...autoapproval_emails: string[]) => ({
  registrationsAutoApproved: true,
  autoApprovalMode: 'LIST' as const,
  autoapproval_emails,
});

describe('parseEntry', () => {
  it.each([
    ['bob@gmail.com', 'address', 'bob@gmail.com'],
    [' Bob@Gmail.com ', 'address', 'bob@gmail.com'],
    ['iitm.ac.in', 'domain', 'iitm.ac.in'],
    ['@IITM.ac.in', 'domain', 'iitm.ac.in'],
  ])('reads %s as a %s', (entry, kind, value) => {
    expect(parseEntry(entry)).toEqual({kind, value});
  });

  it.each(['', 'iitm', '.ac.in', 'a b.com', 'a@b@c.com', '@', 'bob@', 'bob@x'])(
    'rejects %j',
    entry => {
      expect(parseEntry(entry)).toBeNull();
    },
  );
});

describe('whitelist entries match exactly', () => {
  it.each([
    ['bob@gmail.com', 'Bob@Gmail.com', true],
    ['bob@gmail.com', 'jimbob@gmail.com', false],
    ['iitm.ac.in', 'a@iitm.ac.in', true],
    ['@iitm.ac.in', 'a@iitm.ac.in', true],
    [' IITM.ac.in ', 'A@iitm.AC.in', true],
    ['iitm.ac.in', 'x@iitm.ac.in.evil.com', false],
    ['iitm.ac.in', 'a@cs.iitm.ac.in', false],
    ['iitm.ac.in', 'a@notiitm.ac.in', false],
    ['iitm', 'a@iitm.ac.in', false],
    ['.ac.in', 'a@iitm.ac.in', false],
  ])('entry %j, email %j: %s', (entry, email, expected) => {
    expect(shouldAutoApprove(list(entry), email)).toBe(expected);
  });

  it('never approves a missing or malformed email', () => {
    expect(shouldAutoApprove(list('iitm.ac.in'), undefined)).toBe(false);
    expect(shouldAutoApprove(list('iitm.ac.in'), 'iitm.ac.in')).toBe(false);
  });
});

describe('modes', () => {
  it('EVERYONE approves anyone, without needing an email', () => {
    expect(
      shouldAutoApprove({
        registrationsAutoApproved: true,
        autoApprovalMode: 'EVERYONE',
        autoapproval_emails: ['a@b.com'],
      }),
    ).toBe(true);
  });

  it('an empty LIST approves nobody', () => {
    expect(shouldAutoApprove(list(), 'a@b.com')).toBe(false);
  });

  it.each([false, null, undefined])(
    'auto-approval %j approves nobody, whatever the mode',
    registrationsAutoApproved => {
      expect(
        shouldAutoApprove(
          {registrationsAutoApproved, autoApprovalMode: 'EVERYONE'},
          'a@b.com',
        ),
      ).toBe(false);
    },
  );

  it('missing settings approve nobody', () => {
    expect(shouldAutoApprove(undefined, 'a@b.com')).toBe(false);
  });

  it.each([
    [undefined, undefined, 'EVERYONE'],
    [null, [], 'EVERYONE'],
    [undefined, ['a@b.com'], 'LIST'],
    ['LIST', [], 'LIST'],
    ['EVERYONE', ['a@b.com'], 'EVERYONE'],
  ] as const)(
    'mode %j with list %j resolves to %s',
    (autoApprovalMode, emails, expected) => {
      expect(
        resolveMode({
          autoApprovalMode,
          autoapproval_emails: emails as string[] | undefined,
        }),
      ).toBe(expected);
    },
  );

  it('a setting saved before modes existed keeps its meaning', () => {
    const noList = {registrationsAutoApproved: true, autoapproval_emails: []};
    const withList = {
      registrationsAutoApproved: true,
      autoapproval_emails: ['a@b.com'],
    };
    expect(shouldAutoApprove(noList, 'x@y.com')).toBe(true);
    expect(shouldAutoApprove(withList, 'x@y.com')).toBe(false);
    expect(shouldAutoApprove(withList, 'a@b.com')).toBe(true);
  });
});

describe('normalizeEntries', () => {
  it('trims, lower-cases and de-duplicates', () => {
    expect(normalizeEntries([' Bob@Gmail.com ', 'bob@gmail.com'])).toEqual({
      entries: ['bob@gmail.com'],
      invalid: [],
    });
  });

  it('treats a domain with and without @ as one entry', () => {
    expect(normalizeEntries(['@x.com', 'x.com']).entries).toEqual(['@x.com']);
  });

  it('skips blanks and reports invalid entries', () => {
    expect(normalizeEntries(['', 'IITM', 'a@b.com', 'iitm'])).toEqual({
      entries: ['a@b.com'],
      invalid: ['iitm'],
    });
  });
});
