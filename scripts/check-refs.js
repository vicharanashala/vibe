// Confirm no remaining references to the old name
const fs = require('fs');
const path = require('path');

function* walk(dir, skip = ['node_modules', '.git', 'dist', 'build', '.firebase']) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) yield* walk(p, skip);
    else if (f.name.endsWith('.ts') || f.name.endsWith('.tsx')) yield p;
  }
}

let found = 0;
for (const f of walk('backend/src')) {
  const txt = fs.readFileSync(f, 'utf8');
  const lines = txt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('_getIdleDays')) {
      console.log(f + ':' + (i + 1) + ': ' + lines[i].trim());
      found++;
    }
  }
}
console.log('\nremaining _getIdleDays refs:', found);