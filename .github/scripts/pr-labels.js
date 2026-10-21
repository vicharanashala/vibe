// Type and size labels for pull requests, applied by .github/workflows/labeler.yml
// after actions/labeler has set the area labels. Never reads PR code: only
// the title and the per-file line counts from the GitHub API.

/** Conventional title prefix -> type label. */
const TYPE_LABELS = {
  feat: 'feature',
  fix: 'bug',
  docs: 'documentation',
  refactor: 'refactor',
  chore: 'chore',
  ci: 'ci',
  test: 'tests',
  tests: 'tests',
};
// `ci` and `tests` are also area labels that actions/labeler sets from the
// changed files, so this script only ever adds them, never removes them.
const SHARED_WITH_AREAS = new Set(['ci', 'tests']);
const ALL_TYPE_LABELS = [...new Set(Object.values(TYPE_LABELS))];

const SIZES = [
  [10, 'size/XS'],
  [100, 'size/S'],
  [500, 'size/M'],
  [1000, 'size/L'],
  [Infinity, 'size/XL'],
];
const ALL_SIZE_LABELS = SIZES.map(([, label]) => label);

/** Files whose churn says nothing about the size of the change. */
const IGNORED_FOR_SIZE = [
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/,
  /^\.claude\/commands\/opsx\//,
  /^\.claude\/skills\/openspec-[^/]+\//,
];

/** `feat(v3)!: …` -> 'feature'; null when the title has no recognised prefix. */
function typeLabel(title) {
  const m = /^\s*([a-z]+)(?:\([^)]*\))?!?:\s/i.exec(title ?? '');
  return (m && TYPE_LABELS[m[1].toLowerCase()]) || null;
}

/** Size label from the PR's files ({ filename, additions, deletions }). */
function sizeLabel(files) {
  const lines = files
    .filter((f) => !IGNORED_FOR_SIZE.some((re) => re.test(f.filename)))
    .reduce((sum, f) => sum + (f.additions ?? 0) + (f.deletions ?? 0), 0);
  return SIZES.find(([max]) => lines < max)[1];
}

/** Labels to add and remove so the PR has exactly the wanted type and size labels. */
function plan(current, wantedType, wantedSize) {
  const add = [wantedSize, wantedType].filter((l) => l && !current.includes(l));
  const remove = current.filter(
    (l) =>
      (ALL_SIZE_LABELS.includes(l) && l !== wantedSize) ||
      (ALL_TYPE_LABELS.includes(l) && l !== wantedType && !SHARED_WITH_AREAS.has(l)),
  );
  return { add, remove };
}

/** Entry point for actions/github-script. */
async function run({ github, context, core }) {
  const pr = context.payload.pull_request;
  const { owner, repo } = context.repo;
  const files = await github.paginate(github.rest.pulls.listFiles, { owner, repo, pull_number: pr.number, per_page: 100 });
  // Labels as they are now, after actions/labeler's changes in this job.
  const { data: issue } = await github.rest.issues.get({ owner, repo, issue_number: pr.number });
  const current = issue.labels.map((l) => (typeof l === 'string' ? l : l.name));
  const { add, remove } = plan(current, typeLabel(pr.title), sizeLabel(files));
  core.info(`type: ${typeLabel(pr.title) ?? 'none'}, size: ${sizeLabel(files)}; add [${add}] remove [${remove}]`);
  if (add.length) await github.rest.issues.addLabels({ owner, repo, issue_number: pr.number, labels: add });
  for (const name of remove) {
    await github.rest.issues.removeLabel({ owner, repo, issue_number: pr.number, name }).catch((e) => {
      if (e.status !== 404) throw e;
    });
  }
}

module.exports = { typeLabel, sizeLabel, plan, run };
