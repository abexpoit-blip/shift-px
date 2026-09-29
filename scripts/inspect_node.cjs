const fs = require('fs');

const filePath = process.argv[2] || 'C:\\Users\\Shovon\\.gemini\\antigravity\\brain\\a96195a4-ec9e-4905-b886-a72436cce1e1\\chooser_dump.xml';
const search = process.argv[3] || 'Copy Link';
const xml = fs.readFileSync(filePath, 'utf8');

const idx = xml.indexOf(`text="${search}"`);
if (idx !== -1) {
  console.log("Found snippet around:", search);
  console.log(xml.substring(Math.max(0, idx - 400), Math.min(xml.length, idx + 300)));
} else {
  console.log("Not found:", search);
}
