// scripts/list-routes.js — print every @Controller base path so we know
// where to hit endpoints from smoke tests.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'backend', 'src');
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}
for (const f of walk(ROOT)) {
  const c = fs.readFileSync(f, 'utf8');
  const base = c.match(/@Controller\(['"]([^'"]+)['"]\)/);
  if (!base) continue;
  const routes = [...c.matchAll(/@(Get|Post|Put|Patch|Delete)\(['"]([^'"]*)['"]?\)/g)]
    .map(m => `${m[1].toUpperCase().padEnd(6)} ${base[1]}${m[2] || ''}`);
  if (routes.length) {
    console.log(`\n${path.relative(process.cwd(), f)}  @Controller('${base[1]}')`);
    routes.forEach(r => console.log('   ', r));
  }
}