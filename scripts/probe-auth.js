// Quick probe
fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup')
  .then(r => console.log('AUTH STATUS:', r.status, r.statusText))
  .catch(e => console.log('AUTH ERR:', e.code || e.name, e.message?.slice(0, 100)));

fetch('http://127.0.0.1:3141/api/companion/me')
  .then(r => console.log('BACKEND STATUS:', r.status))
  .catch(e => console.log('BACKEND ERR:', e.code || e.name));