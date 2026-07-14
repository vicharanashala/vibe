// Read full stash content and print it
const fs = require('fs');
const { execSync } = require('child_process');
const out = execSync('git stash show -p "stash@{0}"', { encoding: 'utf8' });
fs.writeFileSync('scripts/stash-full.txt', out);
console.log('Wrote', out.length, 'bytes to scripts/stash-full.txt');
console.log('Files in stash:');
const files = out.split(/^diff --git a\//m).slice(1).map(s => s.split(' ')[0]);
files.forEach(f => console.log('  ' + f));