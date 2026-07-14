// Peek at the leftover stash to see if it contains the original 4 bug fixes
// the user pre-stashed yesterday.
const { execSync } = require('child_process');
try {
  const out = execSync('git stash show -p stash@{0} 2>&1', { encoding: 'utf8' });
  console.log('STASH CONTENT (first 3000 chars):');
  console.log(out.slice(0, 3000));
  console.log('---');
  console.log('TOTAL LINES:', out.split('\n').length);
} catch (e) {
  console.log('ERR:', e.message);
}