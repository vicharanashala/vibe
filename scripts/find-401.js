// Find UnauthorizedError usage in backend
const fs = require('fs');
const path = require('path');

function* walk(dir, skip = ['node_modules', '.git', 'dist', 'build']) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) yield* walk(p, skip);
    else if (f.name.endsWith('.ts')) yield p;
  }
}

const matches = [];
for (const f of walk('backend/src')) {
  const txt = fs.readFileSync(f, 'utf8');
  const lines = txt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/UnauthorizedError/.test(lines[i])) {
      matches.push(f + ':' + (i + 1) + ': ' + lines[i].trim());
    }
  }
}
console.log(matches.join('\n'));