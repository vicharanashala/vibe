// node --test .github/scripts/
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildComment, MARKER } = require('./pr-checks-comment.js');

const junit = (cases) =>
  `<?xml version="1.0" encoding="UTF-8" ?>\n<testsuites name="vitest tests" tests="${cases.length}">\n<testsuite name="src/a.spec.tsx">\n${cases.join('\n')}\n</testsuite>\n</testsuites>`;
const pass = (name) => `<testcase classname="src/features/admin/a.spec.tsx" name="${name}" time="0.1"></testcase>`;
const fail = (name, msg) =>
  `<testcase classname="src/features/admin/a.spec.tsx" name="${name}" time="0.1"><failure message="${msg}" type="AssertionError">${msg}</failure></testcase>`;

const v3 = (statusTxt, extra = {}) => ({
  state: statusTxt.includes('failure') ? 'failure' : 'success',
  url: 'https://github.com/o/r/actions/runs/1',
  files: { 'status.txt': statusTxt, 'junit.xml': junit([pass('works'), pass('also works')]), ...extra },
});
const allGreen = 'lint=success\ntypecheck=success\ntest=success\n';

// Shape of `openspec validate --all --strict --json` (captured from OpenSpec 1.14.3).
const validateJson = (issues) =>
  JSON.stringify({
    items: [{ id: 'bad-probe', type: 'change', valid: issues.length === 0, issues, durationMs: 2 }],
    summary: { totals: { items: 1, passed: issues.length ? 0 : 1, failed: issues.length ? 1 : 0 } },
    version: '1.0',
  });
const openspec = (statusTxt, extra = {}) => ({
  state: statusTxt.includes('failure') ? 'failure' : 'success',
  url: 'https://github.com/o/r/actions/runs/2',
  files: { 'status.txt': statusTxt, 'validate.json': validateJson([]), 'archived.json': validateJson([]), 'openspec-version': '1.14.3', ...extra },
});

test('writes nothing when neither check ran', () => {
  assert.equal(buildComment({ v3: { state: 'success', files: {} }, openspec: undefined, author: 'ana' }), null);
});

test('all passing: counts shown, author not mentioned', () => {
  const body = buildComment({ v3: v3(allGreen), openspec: openspec('validate=success\narchived=success\ndrift=success\n'), author: 'ana' });
  assert.ok(body.startsWith(MARKER));
  assert.match(body, /✅ v3 and OpenSpec checks passed/);
  assert.match(body, /v3 unit tests \| ✅ \| 2 passed/);
  assert.match(body, /Match OpenSpec 1\.14\.3/);
  assert.doesNotMatch(body, /@ana/);
});

test('a failing test is listed and the author is asked to fix it', () => {
  const run = v3('lint=success\ntypecheck=success\ntest=failure\n', {
    'junit.xml': junit([pass('works'), fail('shows at most 5', 'expected 7 to be 5')]),
  });
  const body = buildComment({ v3: run, author: 'ana' });
  assert.match(body, /❌ v3 and OpenSpec checks need attention/);
  assert.match(body, /@ana, please fix the failing tests below/);
  assert.match(body, /v3 unit tests \| ❌ \| 1 passed, 1 failed/);
  assert.match(body, /- `src\/features\/admin\/a\.spec\.tsx`\n  - shows at most 5: `expected 7 to be 5`/);
});

test('lint errors alone fail the check even with every test passing', () => {
  // A real ESLint error line from v3's lint output.
  const run = v3('lint=failure\ntypecheck=success\ntest=success\n', {
    'lint.log': "/v3/apps/student/public/sw.js\n  26:1   error  Unexpected use of 'self'  no-restricted-globals\n  3:1  warning  Unused import  no-unused-vars\n",
  });
  const body = buildComment({ v3: run, author: 'ana' });
  assert.match(body, /v3 lint \| ❌ \| Errors found/);
  assert.match(body, /v3 unit tests \| ✅/);
  assert.match(body, /@ana, please fix the lint errors below/);
  assert.match(body, /Unexpected use of 'self'/);
  assert.doesNotMatch(body, /Unused import/);
});

test('an OpenSpec finding is shown with its change, file and message', () => {
  const run = openspec('validate=failure\narchived=success\ndrift=success\n', {
    'validate.json': validateJson([{ level: 'ERROR', path: 'probe/spec.md', message: 'ADDED "No scenario here" must include at least one scenario' }]),
  });
  const body = buildComment({ openspec: run, author: 'ana' });
  assert.match(body, /@ana, please fix the OpenSpec validation problems below/);
  assert.match(body, /ERROR `change\/bad-probe` probe\/spec\.md: ADDED "No scenario here" must include at least one scenario/);
});

test('changed workflow files point to openspec update', () => {
  const run = openspec('validate=success\narchived=success\ndrift=failure\n', {
    'drift.txt': ' .claude/skills/openspec-explore/SKILL.md | 1 -\n 1 file changed, 1 deletion(-)\n',
  });
  const body = buildComment({ openspec: run, author: 'ana' });
  assert.match(body, /Differ from OpenSpec 1\.14\.3/);
  assert.match(body, /openspec update --force/);
  assert.match(body, /- `\.claude\/skills\/openspec-explore\/SKILL\.md`/);
});

test('hostile text from the PR cannot mention people, break code spans or inject HTML', () => {
  const run = v3('lint=success\ntypecheck=success\ntest=failure\n', {
    'junit.xml': junit([fail('@everyone `pwned` &lt;img src=x onerror=alert(1)&gt;', 'line one&#10;@octocat second line')]),
  });
  const body = buildComment({ v3: run, author: 'ana' });
  const listed = body.split('\n').find((l) => l.includes('pwned'));
  assert.ok(listed);
  assert.doesNotMatch(listed, /@everyone|@octocat|<img|`pwned`/);
  assert.match(listed, /@​everyone/);
  assert.match(listed, /‹img/);
  assert.doesNotMatch(listed, /second line/);
});

test('a check still running is shown as running', () => {
  const body = buildComment({ v3: { state: 'running', url: 'https://x/run/3', files: {} }, openspec: openspec('validate=success\narchived=success\ndrift=success\n'), author: 'ana' });
  assert.match(body, /⏳ v3 and OpenSpec checks running/);
  assert.match(body, /v3 frontend \| ⏳ \| Still running/);
});
