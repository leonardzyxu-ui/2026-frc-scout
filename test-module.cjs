const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

fs.writeFileSync('test-module.html', `
<!DOCTYPE html>
<html>
<body>
  <div id="root">Initial</div>
  <script type="module">
    document.getElementById('root').innerHTML = 'Module executed';
  </script>
</body>
</html>
`);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  const filePath = 'file://' + path.resolve('test-module.html');
  console.log('Opening:', filePath);
  
  await page.goto(filePath);
  await page.waitForTimeout(500);
  
  const content = await page.evaluate(() => document.getElementById('root').innerHTML);
  console.log('Root content:', content);
  
  await browser.close();
})();
