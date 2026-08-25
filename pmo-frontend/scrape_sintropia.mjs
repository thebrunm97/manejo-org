import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  console.log('Launching browser...');
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    console.log('Navigating to sintropia.app...');
    await page.goto('https://sintropia.app/#Planos-oficial', { waitUntil: 'networkidle' });
    
    console.log('Scrolling to ensure lazy load...');
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
    
    // go back to section
    await page.goto('https://sintropia.app/#Planos-oficial', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const artifactDir = 'C:\\\\Users\\\\T-GAMER\\\\.gemini\\\\antigravity-ide\\\\brain\\\\15aed9cf-aaf2-437d-ab50-cf5ae5110a42';

    console.log('Taking full page screenshot...');
    await page.screenshot({ path: `${artifactDir}\\\\sintropia_full.png`, fullPage: true });
    
    console.log('Extracting HTML & CSS...');
    const content = await page.content();
    fs.writeFileSync(`${artifactDir}\\\\sintropia_source.html`, content);
    
    await browser.close();
    console.log('Done! Files saved in artifacts directory.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
