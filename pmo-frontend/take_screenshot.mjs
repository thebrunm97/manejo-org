import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser...');
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    console.log('Navigating to askorth.com...');
    await page.goto('https://askorth.com/', { waitUntil: 'networkidle' });
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'C:\\\\Users\\\\T-GAMER\\\\.gemini\\\\antigravity-ide\\\\brain\\\\35f3e32c-ee74-4a82-bbb9-aa5e920857c1\\\\askorth_screenshot.png', fullPage: true });
    await browser.close();
    console.log('Done!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
