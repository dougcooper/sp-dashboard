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

  // capture dashboard view first
  const dashPath = path.join(outDir, 'dashboard.png');
  await page.screenshot({ path: dashPath, fullPage: true });
  console.log('Dashboard screenshot saved to', dashPath);

  // switch to detailed list and capture second screenshot
  await page.evaluate(() => window.switchTab && window.switchTab('details'));
  // give DOM a moment to render the new view
  await new Promise(resolve => setTimeout(resolve, 500));
  const listPath = path.join(outDir, 'detailed_list.png');
  await page.screenshot({ path: listPath, fullPage: true });
  console.log('Detailed list screenshot saved to', listPath);

  await browser.close();
})();
