#!/usr/bin/env bash
# Checks that the backend lines changed since BASE follow the gts Prettier
# style. Only changed lines are checked: most existing backend files predate
# the style, so a whole-file check would fail on lines nobody touched.
#
# usage: check-backend-format.sh <base-ref> [report-file]   (from the repo root)
# Prints GitHub error annotations and exits 1 if any changed line needs
# formatting. If report-file is given, writes "status" on the first line
# (none | ok | failed), then one "file start end" line per unformatted range.
set -euo pipefail

BASE=$1
REPORT=${2:+$(realpath -m "$2")}
[ -z "$REPORT" ] || mkdir -p "$(dirname "$REPORT")"
cd backend

PRETTIER=$(node -p "require.resolve('prettier/bin/prettier.cjs', {paths: [require('path').dirname(require.resolve('gts/package.json'))]})")

mapfile -t FILES < <(git diff --name-only --diff-filter=AMR "$BASE"...HEAD -- \
  '*.ts' '*.tsx' '*.js' '*.cjs' '*.mjs' | sed -n 's#^backend/##p')

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No backend source files changed."
  [ -z "$REPORT" ] || echo none > "$REPORT"
  exit 0
fi

# "start count" pairs for one side of a `diff -U0`/`git diff -U0` hunk list.
# side=new reads "+a,b", side=old reads "-a,b". A count of 0 marks a pure
# insertion/deletion next to line a, which is still treated as touching a.
ranges() {
  awk -v side="$1" '/^@@/ {
    split($0, p, " ")
    r = (side == "new") ? p[3] : p[2]
    sub(/^[-+]/, "", r)
    n = split(r, a, ",")
    start = a[1]; count = (n > 1) ? a[2] : 1
    if (count == 0) count = 1
    print start, count
  }'
}

failed=0
[ -z "$REPORT" ] || : > "$REPORT.ranges"
tmp=$(mktemp)
for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  node "$PRETTIER" "$f" > "$tmp"
  cmp -s "$f" "$tmp" && continue

  changed=$(git diff -U0 "$BASE"...HEAD -- "$f" | ranges new)
  needs=$(diff -U0 "$f" "$tmp" | ranges old || true)

  # Report each Prettier hunk that overlaps a line this change touched.
  bad=$(awk -v changed="$changed" '
    BEGIN {
      n = split(changed, c, "\n")
      for (i = 1; i <= n; i++) { split(c[i], x, " "); cs[i] = x[1]; ce[i] = x[1] + x[2] - 1 }
    }
    {
      s = $1; e = $1 + $2 - 1
      for (i = 1; i <= n; i++) if (s <= ce[i] && cs[i] <= e) { print s, e; break }
    }' <<< "$needs")

  while read -r s e; do
    [ -n "$s" ] || continue
    failed=1
    [ -z "$REPORT" ] || echo "backend/$f $s $e" >> "$REPORT.ranges"
    echo "::error file=backend/$f,line=$s,endLine=$e,title=Formatting::Lines $s-$e are not formatted (gts Prettier style)."
  done <<< "$bad"
done
rm -f "$tmp"
if [ -n "$REPORT" ]; then
  { [ "$failed" -eq 1 ] && echo failed || echo ok; cat "$REPORT.ranges"; } > "$REPORT"
  rm -f "$REPORT.ranges"
fi

if [ "$failed" -eq 1 ]; then
  echo
  echo "Some changed lines don't follow the backend Prettier style (gts)."
  echo "Only lines changed in this PR are checked. Either format those lines by"
  echo "hand, or reformat the whole file (a bigger diff on older files):"
  echo "  cd backend && npx prettier@3.3.3 --write <file>"
  exit 1
fi
echo "All changed backend lines are formatted."
