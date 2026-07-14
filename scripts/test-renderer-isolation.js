// Verify: are the `let animal`, `let mood`, etc. inside createCompanionRenderer scope?
// Approach: count braces from the function start.
const fs = require('fs');
const txt = fs.readFileSync('frontend/src/components/Companion/companionRenderer.js', 'utf8');
const lines = txt.split('\n');

// Find where createCompanionRenderer starts and ends, and check whether
// the `let animal` declaration is inside that span.
let factoryStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export function createCompanionRenderer')) { factoryStart = i; break; }
}
const animalLine = lines.findIndex(l => l.includes("let animal='panda'"));

// Find the matching closing brace by counting depth from the line *after* the function's opening `{`.
// We need to strip out default-object `{}` like `opts = {}` which would confuse the count.
let depth = 0;
let foundOpen = false;
let factoryEnd = -1;
for (let i = factoryStart; i < lines.length; i++) {
  let stripped = lines[i];
  // Remove default-object `{}` (heuristic: pairs not at the end-of-line)
  stripped = stripped.replace(/\{\s*\}/g, '');
  // Remove object-literal `{` `}` inside string literals (rough)
  stripped = stripped.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '').replace(/`[^`]*`/g, '');
  for (const c of stripped) {
    if (c === '{') { depth++; foundOpen = true; }
    else if (c === '}') {
      depth--;
      if (foundOpen && depth === 0) { factoryEnd = i; break; }
    }
  }
  if (factoryEnd !== -1) break;
}

console.log('Factory opens: line ' + (factoryStart + 1));
console.log('Factory closes: line ' + (factoryEnd + 1));
console.log('`let animal=...` line: ' + (animalLine + 1));
const inside = animalLine >= factoryStart && animalLine <= factoryEnd;
console.log('Is `let animal` INSIDE the factory closure? ' + (inside ? 'YES (per-instance)' : 'NO (module-level collides)'));