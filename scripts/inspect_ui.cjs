const fs = require('fs');

const filePath = process.argv[2] || 'C:\\Users\\Shovon\\.gemini\\antigravity\\brain\\a96195a4-ec9e-4905-b886-a72436cce1e1\\sheet_dump.xml';
const xml = fs.readFileSync(filePath, 'utf8');

const nodeRegex = /<node\s+([^>]+)\/>/g;
let match;
while ((match = nodeRegex.exec(xml)) !== null) {
  const attrs = match[1];
  const getAttr = (name) => {
    const m = attrs.match(new RegExp(name + '="([^"]*)"'));
    return m ? m[1] : '';
  };

  const text = getAttr('text');
  const desc = getAttr('content-desc');
  const bounds = getAttr('bounds');
  const clickable = getAttr('clickable');
  const resId = getAttr('resource-id');

  if (
    text ||
    desc ||
    clickable === 'true'
  ) {
    if (
      text.toLowerCase().includes('share') ||
      desc.toLowerCase().includes('share') ||
      desc.toLowerCase().includes('close') ||
      desc.toLowerCase().includes('navigate') ||
      text.toLowerCase().includes('copy') ||
      desc.toLowerCase().includes('copy') ||
      resId.includes('close') ||
      resId.includes('share')
    ) {
      console.log({ text, desc, resId, clickable, bounds });
    }
  }
}
