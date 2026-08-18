const fs = require('fs');
const filePath = 'src/services/auth.ts';
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
// keep only up to line 288 (index 287)
fs.writeFileSync(filePath, lines.slice(0, 288).join('\n'), 'utf8');
console.log('auth.ts trimmed to 288 lines');
