const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1080 } });
  await page.goto('https://orth.aydi.com/orth', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const text = await page.evaluate(() => document.body.innerText);
  console.log("\n--- ORTH TEXT START ---");
  console.log(text);
  console.log("--- ORTH TEXT END ---\n");
  
  await browser.close();
})();
