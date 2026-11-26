const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function optimizeImages() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const assetDirs = [
    path.resolve(__dirname, '../public/assets/logo'),
    path.resolve(__dirname, '../public/assets/mascot'),
  ];

  for (const dir of assetDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);

    for (const file of files) {
      if (!file.endsWith('.png')) continue;
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      // Only optimize large files (> 300KB)
      if (stat.size < 300 * 1024) continue;

      console.log(`Optimizing ${file} (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);

      const imgBuffer = fs.readFileSync(filePath);
      const dataUri = `data:image/png;base64,${imgBuffer.toString('base64')}`;

      try {
        const pngBase64 = await page.evaluate((url) => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              const ctx = canvas.getContext('2d');
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
              const result = canvas.toDataURL('image/png');
              resolve(result.split(',')[1]);
            };
            img.onerror = (e) => reject(new Error('Image load failed'));
            img.src = url;
          });
        }, dataUri);

        const buffer = Buffer.from(pngBase64, 'base64');
        if (buffer.length < stat.size) {
          fs.writeFileSync(filePath, buffer);
          console.log(`  -> Reduced to ${(buffer.length / 1024 / 1024).toFixed(2)} MB (${Math.round((1 - buffer.length / stat.size) * 100)}% saved)`);
        } else {
          console.log(`  -> Kept original size (${stat.size} bytes)`);
        }
      } catch (err) {
        console.error(`  -> Failed to optimize ${file}:`, err.message);
      }
    }
  }

  await browser.close();
  console.log('Image optimization complete!');
}

optimizeImages().catch(console.error);
