const { execSync } = require('child_process');

try {
  execSync('adb -s 127.0.0.1:5555 shell uiautomator dump /data/local/tmp/current_ui.xml', { stdio: 'ignore' });
  const xml = execSync('adb -s 127.0.0.1:5555 shell cat /data/local/tmp/current_ui.xml').toString('utf8');
  const regex = /text="([^"]+)"[^>]*bounds="([^"]+)"/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    console.log(`${match[1]} -> ${match[2]}`);
  }
} catch (e) {
  console.error(e.message);
}
