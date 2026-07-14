#!/usr/bin/env node
// diag-progress-routes.cjs — Find the route that maps to /users/progress/courses/.../versions/.../modules

const fs = require('fs');
const path = require('path');

const BACKEND = 'C:/Users/openclaw-user/Projects/vibe/backend/src';
function walk(dir) {
  let results = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) results = results.concat(walk(p));
    else if (f.endsWith('.ts')) results.push(p);
  }
  return results;
}

const files = walk(BACKEND);
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  if (txt.includes('progress/courses') || txt.includes('progress/.*courses')) {
    console.log(f);
    // print lines around the match
    const lines = txt.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('progress')) {
        for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 4); j++) {
          console.log(`  ${j}: ${lines[j]}`);
        }
        console.log('---');
      }
    }
  }
}