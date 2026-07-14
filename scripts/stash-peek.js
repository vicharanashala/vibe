// Look at what's in the leftover stash and any backup stash
const { execSync } = require('child_process');
try {
  const out = execSync('git stash list', { encoding: 'utf8' });
  console.log('STASH LIST:', out);
} catch (e) { console.log('ERR:', e.message); }

try {
  const out = execSync('git log --oneline -5', { encoding: 'utf8' });
  console.log('LOG:', out);
} catch (e) { console.log('ERR:', e.message); }

// Check working tree state
try {
  const out = execSync('git status --short', { encoding: 'utf8' });
  console.log('STATUS:', out);
} catch (e) { console.log('ERR:', e.message); }