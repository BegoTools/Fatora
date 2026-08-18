const fs = require('fs');

const filePath = 'src/services/auth.ts';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

// Keep lines 1-379, 418-529
const newLines = [
  ...lines.slice(0, 379),
  ...lines.slice(418, 529)
];

fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
console.log('auth.ts cleaned');
