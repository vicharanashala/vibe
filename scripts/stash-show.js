// Dump full stash content to a file we can read
const { execSync } = require('child_process');
require('fs').writeFileSync('scripts/stash-content.txt', execSync('git stash show -p "stash@{0}"', { encoding: 'utf8' }));
console.log('Dumped stash to scripts/stash-content.txt');