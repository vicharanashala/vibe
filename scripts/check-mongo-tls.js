const { execSync } = require('child_process');
try {
  // Check if mongo container has any cert files
  const out = execSync('docker exec vibe-mongo ls -la /etc/ssl/certs/mongodb* 2>&1 || echo "no ssl certs in container"', { encoding: 'utf8' });
  console.log('CERTS:', out);

  // Check mongo startup command
  const out2 = execSync('docker inspect vibe-mongo --format="{{.Config.Cmd}}"', { encoding: 'utf8' });
  console.log('CMD:', out2);

  // Check mongo log for ssl mode
  const out3 = execSync('docker logs vibe-mongo --tail 5 2>&1', { encoding: 'utf8' });
  console.log('LOGS:', out3);
} catch (e) {
  console.log('ERR:', e.message);
}