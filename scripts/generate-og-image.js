const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function generateOgImage() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 }
  });

  const logoPath = 'file://' + path.resolve(__dirname, '../public/assets/logo/ChatGPT Image Aug 11, 2026, 03_55_47 AM.png').replace(/\\/g, '/');
  const mascotPath = 'file://' + path.resolve(__dirname, '../public/assets/mascot/ChatGPT_Image_Aug_10__2026__03_55_30_AM-removebg-preview.png').replace(/\\/g, '/');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          width: 1200px;
          height: 630px;
          background: #0D282C;
          color: #ffffff;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          display: flex;
          position: relative;
          overflow: hidden;
        }
        .bg-pattern {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(20, 184, 166, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(20, 184, 166, 0.2) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(13, 40, 44, 1) 0%, rgba(5, 20, 22, 1) 100%);
          z-index: 1;
        }
        .grid-overlay {
          position: absolute;
          inset: 0;
          background-size: 40px 40px;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          z-index: 2;
        }
        .content {
          position: relative;
          z-index: 10;
          display: flex;
          width: 100%;
          height: 100%;
          padding: 60px 80px;
          align-items: center;
          justify-content: space-between;
        }
        .left {
          max-width: 650px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 9999px;
          background: rgba(20, 184, 166, 0.15);
          border: 1px solid rgba(20, 184, 166, 0.4);
          color: #2DD4BF;
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 24px;
        }
        .logo-img {
          height: 60px;
          object-fit: contain;
          margin-bottom: 24px;
        }
        h1 {
          font-size: 54px;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin-bottom: 20px;
          color: #ffffff;
        }
        .gradient-text {
          background: linear-gradient(135deg, #2DD4BF 0%, #99F6E4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        p {
          font-size: 22px;
          line-height: 1.5;
          color: #94A3B8;
          font-weight: 400;
        }
        .right {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .mascot-glow {
          position: absolute;
          width: 340px;
          height: 340px;
          background: rgba(20, 184, 166, 0.25);
          filter: blur(60px);
          border-radius: 50%;
        }
        .mascot-img {
          width: 320px;
          height: 320px;
          object-fit: contain;
          position: relative;
          z-index: 2;
          filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5));
        }
      </style>
    </head>
    <body>
      <div class="bg-pattern"></div>
      <div class="grid-overlay"></div>
      <div class="content">
        <div class="left">
          <img src="${logoPath}" class="logo-img" alt="Examly Logo" />
          <div class="badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
            AI-Powered Oral Assessment Platform
          </div>
          <h1>Transform Oral Exams with <span class="gradient-text">Intelligent AI</span></h1>
          <p>Automate speaking evaluation, prevent tab switching, and save hours of grading for educators and universities.</p>
        </div>
        <div class="right">
          <div class="mascot-glow"></div>
          <img src="${mascotPath}" class="mascot-img" alt="Examly Mascot" />
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(htmlContent);
  const outputPath = path.resolve(__dirname, '../public/og-image.png');
  await page.screenshot({ path: outputPath, type: 'png' });
  console.log('Successfully generated og-image.png at:', outputPath);
  await browser.close();
}

generateOgImage().catch(console.error);
