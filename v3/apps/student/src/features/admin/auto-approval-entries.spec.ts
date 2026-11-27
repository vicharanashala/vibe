import {
  likelyEmailColumn,
  listFitsInOneSave,
  mergeEntries,
  parseCsv,
  parseEntry,
  splitEntries,
  summarizeColumn,
  toCsvTable,
} from './auto-approval-entries';

describe('parseEntry, matching the backend', () => {
  it.each([
    ['Bob@Gmail.com', { kind: 'address', value: 'bob@gmail.com' }],
    ['iitrpr.ac.in', { kind: 'domain', value: 'iitrpr.ac.in' }],
    ['@iitrpr.ac.in', { kind: 'domain', value: 'iitrpr.ac.in' }],
    ['iitm', null],
    ['a b@x.com', null],
    ['a@b@', null],
    ['@', null],
  ])('%s', (input, expected) => {
    expect(parseEntry(input)).toEqual(expected);
  });
});

describe('splitEntries', () => {
  it('splits on lines, commas, semicolons and spaces', () => {
    expect(splitEntries('a@x.com,b@x.com; c@x.com\nd.com  e.com')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
      'd.com',
      'e.com',
    ]);
  });
});

describe('mergeEntries', () => {
  it('lower-cases, skips repeats and invalid text, keeps existing entries', () => {
    expect(
      mergeEntries(
        ['iitm', 'x.com'],
        ['A@x.com', 'a@x.com', '@x.com', 'nope', 'y.com'],
      ),
    ).toEqual(['iitm', 'x.com', 'a@x.com', 'y.com']);
  });
});

describe('parseCsv', () => {
  it('reads quotes, escaped quotes, commas and line breaks inside quotes', () => {
    expect(parseCsv('a,"b, c","d ""e"""\n"f\ng",h,i')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['f\ng', 'h', 'i'],
    ]);
  });

  it('handles an Excel byte order mark and Windows line endings', () => {
    expect(parseCsv('﻿Email\r\na@x.com\r\n')).toEqual([['Email'], ['a@x.com']]);
  });

  it('reads semicolon and tab separated files', () => {
    expect(parseCsv('Name;Email\nA;a@x.com')[1]).toEqual(['A', 'a@x.com']);
    expect(parseCsv('Name\tEmail\nA\ta@x.com')[1]).toEqual(['A', 'a@x.com']);
  });

  it('skips blank lines, including rows of empty cells', () => {
    expect(parseCsv('a,b\n\n,\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('toCsvTable', () => {
  it('uses the first row as column names', () => {
    expect(
      toCsvTable([
        ['Name', ''],
        ['A', 'a@x.com'],
      ]),
    ).toEqual({
      columns: ['Name', 'Column 2'],
      rows: [['A', 'a@x.com']],
    });
  });

  it('keeps the first row as data when it holds an email', () => {
    expect(toCsvTable([['a@x.com'], ['b@x.com']])).toEqual({
      columns: ['Column 1'],
      rows: [['a@x.com'], ['b@x.com']],
    });
  });
});

describe('likelyEmailColumn', () => {
  it('picks the column with the most addresses, whatever it is called', () => {
    const table = toCsvTable(
      parseCsv('Name,Alt,Contact\nA,a@y.com,a@x.com\nB,,b@x.com\n'),
    );
    expect(likelyEmailColumn(table)).toBe(2);
  });
});

describe('summarizeColumn', () => {
  const table = toCsvTable(
    parseCsv(
      'Email\nA@x.com\na@x.com\nknown@x.com\n\ngmail.com\n1.5\nJohn Smith\nJohn Smith\n',
    ),
  );

  it('takes only full addresses: a domain never comes from a file', () => {
    expect(summarizeColumn(table, 0, ['KNOWN@x.com'])).toEqual({
      toAdd: ['a@x.com'],
      alreadyListed: 1,
      repeated: 1,
      skipped: ['gmail.com', '1.5', 'John Smith'],
    });
  });
});

describe('listFitsInOneSave', () => {
  const list = (n: number) =>
    Array.from(
      { length: n },
      (_, i) => `student${String(i).padStart(5, '0')}@example.com`,
    );

  // 3,785 and 3,795 of these addresses were sent to the real backend: the first
  // saved and the second was refused.
  it('matches the backend limit of 100 KB', () => {
    expect(listFitsInOneSave(list(3785))).toBe(true);
    expect(listFitsInOneSave(list(3795))).toBe(false);
  });
});
