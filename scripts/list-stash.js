// List files in the stash
const { execSync } = require('child_process');
const out = execSync('git stash show -p "stash@{0}" --name-only', { encoding: 'utf8' });
console.log(out);