// Free up port 5173
const { execSync } = require('child_process');
try {
  const out = execSync('netstat -ano | findstr ":5173"', { encoding: 'utf8' });
  console.log('LISTENERS:', out);
  // Extract PIDs and kill them
  const pids = [...new Set(out.split('\n').map(l => l.trim().split(/\s+/).pop()).filter(p => /^\d+$/.test(p)))];
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' });
      console.log('Killed PID', pid);
    } catch (e) {
      console.log('Could not kill', pid, '-', e.message.split('\n')[0]);
    }
  }
} catch (e) {
  console.log('No listeners on 5173:', e.message.split('\n')[0]);
}