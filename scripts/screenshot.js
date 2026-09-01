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

  // wait for mock data bootstrap (500ms timeout in the app)
  await new Promise(resolve => setTimeout(resolve, 800));

  // Set custom date range covering the mock data (Feb 18–22, 2026)
  await page.evaluate(() => {
    const preset = document.getElementById('date-preset');
    const fromEl = document.getElementById('date-from');
    const toEl = document.getElementById('date-to');
    const customContainer = document.getElementById('custom-date-container');

    preset.value = 'custom';
    customContainer.classList.remove('hidden');
    fromEl.value = '2026-02-16';
    toEl.value   = '2026-02-22';

    fromEl.dispatchEvent(new Event('change'));
  });

  await new Promise(resolve => setTimeout(resolve, 400));

  // ensure assets directory exists
  const outDir = path.resolve('assets');
  try { await fs.promises.mkdir(outDir, { recursive: true }); } catch {};

  // Dashboard screenshot
  const dashPath = path.join(outDir, 'dashboard.png');
  await page.screenshot({ path: dashPath, fullPage: true });
  console.log('Dashboard screenshot saved to', dashPath);

  // Detailed list screenshot
  await page.evaluate(() => window.switchTab?.('details'));
  await new Promise(resolve => setTimeout(resolve, 400));
  const listPath = path.join(outDir, 'detailed_list.png');
  await page.screenshot({ path: listPath, fullPage: true });
  console.log('Detailed list screenshot saved to', listPath);

  // Settings screenshot
  await page.evaluate(() => window.switchTab?.('settings'));
  await new Promise(resolve => setTimeout(resolve, 400));
  const settingsPath = path.join(outDir, 'settings.png');
  await page.screenshot({ path: settingsPath, fullPage: true });
  console.log('Settings screenshot saved to', settingsPath);

  await browser.close();
})();
