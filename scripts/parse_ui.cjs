const fs = require('fs');
const xml = fs.readFileSync('C:/Users/Shovon/.gemini/antigravity/brain/a96195a4-ec9e-4905-b886-a72436cce1e1/dump.xml', 'utf8');

const regex = /text="([^"]+)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
let m;
while ((m = regex.exec(xml)) !== null) {
  const [_, text, x1, y1, x2, y2] = m;
  const cx = Math.floor((parseInt(x1) + parseInt(x2)) / 2);
  const cy = Math.floor((parseInt(y1) + parseInt(y2)) / 2);
  console.log(`Text: '${text}' -> Center: (${cx}, ${cy})`);
}
