// PWA install-prompt ke liye manifest.json me use hone wale screenshots capture karta hai.
// Sirf ek baar manually chalane ke liye — koi CI/test suite ka hissa nahi hai.
// Chalayein: node scripts/capture-screenshots.js (local server pehle se 8080 par chalna chahiye)
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "screenshots");
const EXEC_PATH = process.env.PW_CHROMIUM || undefined;

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

  const browser = await chromium.launch({ executablePath: EXEC_PATH });
  const page = await browser.newPage({ viewport: { width: 420, height: 820 } });

  // 1. Home screen
  await page.goto("http://127.0.0.1:8080/");
  await page.waitForFunction(() => document.getElementById("home-view").classList.contains("active"));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, "home.png") });

  // 2. DC Dashboard (Lakhnadon -> ADEGAON)
  await page.click(".list-item.bg-orange-grad");
  await page.waitForFunction(() => document.getElementById("dc-selection-view").classList.contains("active"));
  await page.click("#prof-trigger");
  await page.click("#dc-menu .option-item >> nth=0");
  await page.waitForFunction(() => document.getElementById("dc-dashboard-view").classList.contains("active"));
  await page.waitForTimeout(600); // fade-in animation poori hone dein
  await page.screenshot({ path: path.join(OUT_DIR, "dc-dashboard.png") });

  await browser.close();
  console.log("Screenshots saved to", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
