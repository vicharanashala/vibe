// node --test '.github/scripts/*.test.js'
const test = require('node:test');
const assert = require('node:assert/strict');

const { typeLabel, sizeLabel, plan } = require('./pr-labels.js');

const file = (filename, additions, deletions = 0) => ({ filename, additions, deletions });

test('type label from a conventional prefix, with scope and !', () => {
  assert.equal(typeLabel('fix(v3): keep dialogs inside the screen'), 'bug');
  assert.equal(typeLabel('feat: add export'), 'feature');
  assert.equal(typeLabel('feat(backend)!: drop v1 routes'), 'feature');
  assert.equal(typeLabel('docs: README'), 'documentation');
  assert.equal(typeLabel('refactor(api): split service'), 'refactor');
  assert.equal(typeLabel('chore: bump deps'), 'chore');
  assert.equal(typeLabel('ci(v3): typecheck in build mode'), 'ci');
  assert.equal(typeLabel('test: cover paging'), 'tests');
  assert.equal(typeLabel('Fix: capitalised prefix'), 'bug');
});

test('no type label for unprefixed or unknown titles', () => {
  assert.equal(typeLabel('v3: Explore page for public courses'), null);
  assert.equal(typeLabel('openspec: archive studio-sidebar-recent-courses'), null);
  assert.equal(typeLabel('Revert "v3: something"'), null);
  assert.equal(typeLabel('fixes the thing'), null);
  assert.equal(typeLabel(''), null);
});

test('size label thresholds', () => {
  assert.equal(sizeLabel([file('a.ts', 12, 3)]), 'size/S');
  assert.equal(sizeLabel([file('a.ts', 9)]), 'size/XS');
  assert.equal(sizeLabel([file('a.ts', 10)]), 'size/S');
  assert.equal(sizeLabel([file('a.ts', 499)]), 'size/M');
  assert.equal(sizeLabel([file('a.ts', 400, 200)]), 'size/L');
  assert.equal(sizeLabel([file('a.ts', 1000)]), 'size/XL');
});

test('lockfiles and generated OpenSpec files do not count towards size', () => {
  const files = [
    file('v3/apps/student/src/a.ts', 5),
    file('pnpm-lock.yaml', 2000, 1000),
    file('v3/pnpm-lock.yaml', 500),
    file('.claude/skills/openspec-propose/SKILL.md', 300),
    file('.claude/commands/opsx/apply.md', 80),
  ];
  assert.equal(sizeLabel(files), 'size/XS');
  // A hand-written skill that isn't OpenSpec's still counts.
  assert.equal(sizeLabel([file('.claude/skills/my-skill/SKILL.md', 50)]), 'size/S');
});

test('size changes as the PR grows', () => {
  assert.deepEqual(plan(['frontend-v3', 'size/S'], null, 'size/L'), { add: ['size/L'], remove: ['size/S'] });
});

test('title edit swaps the type label and keeps area labels', () => {
  assert.deepEqual(plan(['backend', 'feature', 'size/S'], 'bug', 'size/S'), { add: ['bug'], remove: ['feature'] });
});

test('ci and tests stay when they are area labels, even if the type changes', () => {
  assert.deepEqual(plan(['ci', 'devops', 'tests', 'size/M'], 'bug', 'size/M'), { add: ['bug'], remove: [] });
});

test('nothing to do when labels already match', () => {
  assert.deepEqual(plan(['openspec', 'chore', 'size/XS'], 'chore', 'size/XS'), { add: [], remove: [] });
});

test('removes a stale type label when the title loses its prefix', () => {
  assert.deepEqual(plan(['feature', 'size/S'], null, 'size/S'), { add: [], remove: ['feature'] });
});
