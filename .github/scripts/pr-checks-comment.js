// Builds the PR comment for the v3 Frontend Checks and OpenSpec Checks
// workflows (see .github/workflows/pr-checks-comment.yml).
//
//   node pr-checks-comment.js <collected-dir> <author> <output-file>
//
// <collected-dir> holds one folder per check (`v3`, `openspec`), each with:
//   state  completed run conclusion, or `running` / `missing`
//   url    the run's URL
//   files/ the check's uploaded artifact (only when its checks job ran)
//
// Writes nothing when neither check ran for this commit (the PR touches
// neither v3 nor OpenSpec). Everything read from files/ comes from PR code,
// so it is treated as untrusted: kept to one line, length-capped, and unable
// to mention anyone or break out of inline code.

const fs = require('fs');
const path = require('path');

const MARKER = '<!-- pr-checks-report -->';
const MAX_LISTED = 30;
const MAX_LOG_LINES = 20;

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, '&');

/** One inert line of untrusted text: no ANSI, mentions, backticks or HTML. */
function clean(s, max) {
  const line = decode(String(s ?? '')).replace(/\x1b\[[0-9;]*m/g, '').split('\n').find((l) => l.trim()) ?? '';
  const t = line.trim().replace(/`/g, "'").replace(/@/g, '@​').replace(/</g, '‹').replace(/>/g, '›');
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Test counts and failures from a Vitest JUnit report, or null if there is none. */
function parseJunit(xml) {
  if (!xml) return null;
  const res = { passed: 0, failed: 0, skipped: 0, failures: [] };
  for (const m of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    const body = m[2] ?? '';
    if (/<skipped\b/.test(body)) {
      res.skipped++;
      continue;
    }
    const f = body.match(/<(?:failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:failure|error)>)/);
    if (!f) {
      res.passed++;
      continue;
    }
    res.failed++;
    res.failures.push({
      file: attrs.classname ?? 'unknown',
      name: attrs.name ?? '',
      msg: f[1].match(/message="([^"]*)"/)?.[1] || f[2] || '',
    });
  }
  return res;
}

function listTestFailures(failures) {
  const byFile = new Map();
  for (const f of failures) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  const lines = [];
  let shown = 0;
  for (const [file, list] of byFile) {
    if (shown >= MAX_LISTED) break;
    lines.push(`- \`${clean(file, 120)}\``);
    for (const f of list) {
      if (shown++ >= MAX_LISTED) break;
      lines.push(`  - ${clean(f.name, 140)}: \`${clean(f.msg, 160)}\``);
    }
  }
  if (failures.length > MAX_LISTED) lines.push(`- …and ${failures.length - MAX_LISTED} more, see the run log.`);
  return lines;
}

/** The error lines from a lint or typecheck log. */
function logErrors(log, pattern) {
  const lines = (log ?? '').replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter((l) => pattern.test(l));
  const out = lines.slice(0, MAX_LOG_LINES).map((l) => `- \`${clean(l, 200)}\``);
  if (lines.length > MAX_LOG_LINES) out.push(`- …and ${lines.length - MAX_LOG_LINES} more, see the run log.`);
  return out;
}

/** OpenSpec validation findings (ERROR and WARNING) from `validate --json` output. */
function openspecFindings(json) {
  let report;
  try {
    report = JSON.parse(json);
  } catch {
    return null;
  }
  const findings = [];
  for (const item of report?.items ?? []) {
    for (const issue of item.issues ?? []) {
      if (issue.level === 'INFO') continue;
      findings.push(`- ${clean(issue.level, 10)} \`${clean(`${item.type}/${item.id}`, 100)}\` ${clean(issue.path ?? '', 100)}: ${clean(issue.message, 220)}`);
    }
  }
  return findings;
}

const status = (text) => Object.fromEntries((text ?? '').split('\n').filter(Boolean).map((l) => l.split('=')));
const icon = (outcome) => (outcome === 'success' ? '✅' : outcome === 'failure' ? '❌' : '⚠️');
const link = (url, text) => (url ? `[${text}](${url})` : text);

/**
 * The comment body for this commit, or null when neither check ran.
 * `checks.v3` / `checks.openspec`: { state, url, files: { name: contents } }.
 */
function buildComment({ v3, openspec, author }) {
  const ran = (c) => c && c.files && c.files['status.txt'] !== undefined;
  const running = (c) => c && c.state === 'running';
  if (!ran(v3) && !ran(openspec) && !running(v3) && !running(openspec)) return null;

  const rows = [];
  const details = [];
  const needsFix = [];

  if (running(v3)) rows.push(['v3 frontend', '⏳', `Still running. ${link(v3.url, 'View run')}`]);
  else if (ran(v3)) {
    const st = status(v3.files['status.txt']);
    const junit = parseJunit(v3.files['junit.xml']);
    rows.push(['v3 lint', icon(st.lint), st.lint === 'success' ? 'No errors' : 'Errors found']);
    rows.push(['v3 typecheck', icon(st.typecheck), st.typecheck === 'success' ? 'No errors' : 'Errors found']);
    const counts = junit
      ? `${junit.passed} passed${junit.failed ? `, ${junit.failed} failed` : ''}${junit.skipped ? `, ${junit.skipped} skipped` : ''}`
      : 'No results (the run stopped early; see the log)';
    rows.push(['v3 unit tests', icon(st.test === 'success' && junit ? 'success' : st.test), counts]);
    if (st.lint !== 'success') {
      needsFix.push('lint errors');
      details.push('**v3 lint errors:**', '', ...logErrors(v3.files['lint.log'], /\berror\b/), '');
    }
    if (st.typecheck !== 'success') {
      needsFix.push('type errors');
      details.push('**v3 type errors:**', '', ...logErrors(v3.files['typecheck.log'], /error TS\d+/), '');
    }
    if (st.test !== 'success') {
      needsFix.push('failing tests');
      if (junit?.failures.length) details.push(`**${plural(junit.failures.length, 'failing test')}:**`, '', ...listTestFailures(junit.failures), '');
    }
    details.push(`v3: ${link(v3.url, 'run log')}`, '');
  }

  if (running(openspec)) rows.push(['OpenSpec', '⏳', `Still running. ${link(openspec.url, 'View run')}`]);
  else if (ran(openspec)) {
    const st = status(openspec.files['status.txt']);
    const version = clean(openspec.files['openspec-version'] ?? '', 20);
    rows.push(['OpenSpec specs and changes', icon(st.validate), st.validate === 'success' ? 'Valid' : 'Problems found']);
    rows.push(['OpenSpec archived changes', icon(st.archived), st.archived === 'success' ? 'Valid' : 'Problems found']);
    rows.push(['OpenSpec workflow files', icon(st.drift), st.drift === 'success' ? `Match OpenSpec ${version}` : `Differ from OpenSpec ${version}`]);
    for (const [key, label] of [['validate', 'validate.json'], ['archived', 'archived.json']]) {
      if (st[key] === 'success') continue;
      needsFix.push('OpenSpec validation problems');
      const findings = openspecFindings(openspec.files[label]);
      details.push(`**OpenSpec ${key === 'archived' ? 'archived changes' : 'specs and changes'}:**`, '', ...(findings?.length ? findings : ['- No findings in the report; see the run log.']), '');
    }
    if (st.drift !== 'success') {
      needsFix.push('changed OpenSpec workflow files');
      const files = (openspec.files['drift.txt'] ?? '').split('\n').filter((l) => l.includes('|')).map((l) => `- \`${clean(l.split('|')[0], 120)}\``);
      details.push(
        `**OpenSpec workflow files** under \`.claude/\` don't match what OpenSpec ${version} generates. Run \`openspec update --force\` with that version and commit the result, instead of editing them by hand:`,
        '',
        ...files,
        '',
      );
    }
    details.push(`OpenSpec: ${link(openspec.url, 'run log')}`, '');
  }

  const failing = needsFix.length > 0;
  const pending = running(v3) || running(openspec);
  const headline = failing ? '### ❌ v3 and OpenSpec checks need attention' : pending ? '### ⏳ v3 and OpenSpec checks running' : '### ✅ v3 and OpenSpec checks passed';
  const out = [MARKER, headline, ''];
  if (failing && author) out.push(`@${author}, please fix the ${[...new Set(needsFix)].join(', ')} below and push again.`, '');
  out.push('| Check | Result | |', '|---|:---:|---|', ...rows.map((r) => `| ${r.join(' | ')} |`), '');
  out.push(...details);
  return out.join('\n').trimEnd() + '\n';
}

/** Reads `<dir>/<check>/{state,url,files/*}` into the shape buildComment takes. */
function collect(dir) {
  const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : undefined);
  const one = (name) => {
    const base = path.join(dir, name);
    if (!fs.existsSync(base)) return undefined;
    const filesDir = path.join(base, 'files');
    const files = {};
    if (fs.existsSync(filesDir)) for (const f of fs.readdirSync(filesDir)) files[f] = fs.readFileSync(path.join(filesDir, f), 'utf8');
    return { state: read(path.join(base, 'state')), url: read(path.join(base, 'url')), files };
  };
  return { v3: one('v3'), openspec: one('openspec') };
}

module.exports = { buildComment, clean, parseJunit, openspecFindings, MARKER };

if (require.main === module) {
  const [dir, author, outFile] = process.argv.slice(2);
  const body = buildComment({ ...collect(dir), author });
  if (body) fs.writeFileSync(outFile, body);
  console.log(body ? `Wrote ${outFile}` : 'Neither check ran for this commit; no comment.');
}
