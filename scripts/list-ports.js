const { execSync } = require('child_process');
try {
  const out = execSync('netstat -ano | findstr :3141', { encoding: 'utf8' });
  console.log(out);
} catch (e) {
  console.log('NO_LISTENERS');
}
try {
  const out = execSync('netstat -ano | findstr :27017', { encoding: 'utf8' });
  console.log('---mongo listeners---\n' + out);
} catch (e) {
  console.log('NO_MONGO_LISTENERS');
}