const { execSync } = require('child_process');
try {
  const out = execSync('docker ps -a --format "{{.Names}} | {{.Status}} | {{.Ports}}"', { encoding: 'utf8' });
  console.log(out);
} catch (e) {
  console.log('ERR:', e.message);
}