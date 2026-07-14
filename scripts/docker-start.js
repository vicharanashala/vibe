const { execSync } = require('child_process');
try {
  const out = execSync('docker start vibe-mongo', { encoding: 'utf8' });
  console.log('START:', out.trim());
} catch (e) {
  console.log('ERR:', e.message);
  try {
    const out2 = execSync('docker ps -a --format "{{.Names}} | {{.Status}}"', { encoding: 'utf8' });
    console.log('CONTAINERS:', out2);
  } catch (e2) {
    console.log('ERR2:', e2.message);
  }
}