const { execSync } = require('child_process');

async function probe(name, port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(3000) });
    console.log(`${name} (${port}): UP status=${r.status}`);
  } catch (e) {
    console.log(`${name} (${port}): ${e.code || e.name}`);
  }
}

(async () => {
  await probe('mongo', 27017);
  await probe('auth-emulator', 9099);
  await probe('backend', 3141);
})();