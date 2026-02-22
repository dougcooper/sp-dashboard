import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const fileUrl = 'file://' + path.resolve('sp-dashboard/index.html');
  console.log('Opening', fileUrl);

  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 1200, height: 800 });

  // wait a moment for any mock data to load
  await new Promise(resolve => setTimeout(resolve, 1000));

  // ensure assets directory exists
  const outDir = path.resolve('assets');
  try { await fs.promises.mkdir(outDir, { recursive: true }); } catch {};

  const outPath = path.join(outDir, 'screenshot.png');
  await page.screenshot({ path: outPath, fullPage: true });
  console.log('Screenshot saved to', outPath);

  await browser.close();
})();
