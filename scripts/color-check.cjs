const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  const data = await page.evaluate(() => {
    const results = [];
    const allEls = document.querySelectorAll("a, button, span");
    for (const el of allEls) {
      const s = getComputedStyle(el);
      const bg = s.backgroundColor;
      const color = s.color;
      if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        results.push({ tag: el.tagName, text: (el.textContent||"").slice(0,30), bg, color });
      }
    }
    return results.slice(0, 20);
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
