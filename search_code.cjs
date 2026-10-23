const fs = require('fs');
const code = fs.readFileSync('C:/Users/Shovon/.gemini/antigravity/scratch/shift-px/src/routes/r.$code.ts', 'utf8');
const lines = code.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('isBot = true') || l.includes('isFbBot = true')) {
    console.log((idx+1) + ': ' + l.trim());
  }
});
