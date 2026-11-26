const fs = require('fs');
const path = require('path');

// Copy icon.png to favicon.ico or write icon bytes
const iconPath = path.resolve(__dirname, '../public/icon.png');
const icoPath = path.resolve(__dirname, '../public/favicon.ico');

if (fs.existsSync(iconPath)) {
  fs.copyFileSync(iconPath, icoPath);
  console.log('Successfully created favicon.ico at:', icoPath);
}
