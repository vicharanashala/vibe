// diag-utils.cjs — read the courses/utils directory
const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\openclaw-user\\Projects\\vibe\\backend\\src\\modules\\courses\\utils';
try {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isFile() && (p.endsWith('.ts') || p.endsWith('.js'))) {
      const content = fs.readFileSync(p, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('sortItemsByOrder') || lines[i].includes('items is not iterable') || (lines[i].includes('items') && (lines[i].includes('...') || lines[i].includes('for (')))) {
          console.log(`${p}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }
  }
} catch (e) {
  console.error('Error:', e.message);
}