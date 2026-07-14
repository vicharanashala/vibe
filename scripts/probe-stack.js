const { execSync } = require('child_process');

// Mongo
try {
  const out = execSync(`mongosh --quiet --eval "db.runCommand({ping:1})" "mongodb://127.0.0.1:27017/vibe"`, { encoding: 'utf8' });
  console.log('MONGO:', out.includes('ok: 1') ? 'UP' : 'WEAK');
  console.log(out.split('\n').slice(0, 3).join(' | '));
} catch (e) {
  console.log('MONGO ERR:', e.message.split('\n')[0]);
}

// Auth emulator
(async () => {
  try {
    const r = await fetch('http://127.0.0.1:9099/', { signal: AbortSignal.timeout(2000) });
    console.log('AUTH:', r.status);
  } catch (e) {
    console.log('AUTH ERR:', e.code);
  }

  // Backend
  try {
    const r = await fetch('http://127.0.0.1:3141/api/companion/me', { signal: AbortSignal.timeout(2000) });
    console.log('BACKEND:', r.status);
  } catch (e) {
    console.log('BACKEND ERR:', e.code);
  }
})();