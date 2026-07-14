// diag-find-func.cjs — locate sortItemsByOrder across the source tree
const fs = require('fs');
const path = require('path');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile() && (p.endsWith('.ts') || p.endsWith('.js'))) out.push(p);
  }
  return out;
}

const root = 'C:\\Users\\openclaw-user\\Projects\\vibe\\backend\\src';
const files = walk(root);
let hits = 0;
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('sortItemsByOrder')) {
      console.log(`${f}:${i + 1}: ${lines[i].trim()}`);
      hits++;
    }
  }
}
console.log(`\nTotal hits: ${hits}`);