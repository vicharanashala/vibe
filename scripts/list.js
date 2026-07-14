const fs = require('fs');
console.log(fs.readdirSync('scripts').filter(f => f.endsWith('.js')).join('\n'));