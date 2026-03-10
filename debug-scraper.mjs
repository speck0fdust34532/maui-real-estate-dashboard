import puppeteer from "puppeteer";
import fs from "fs";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
];

const url = "https://www.realtor.com/realestateandhomes-detail/2175-Kauhikoa-Rd_Haiku_HI_96708_M97366-08213";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium-browser",
  headless: true,
  args: [
    "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas", "--no-first-run", "--no-zygote",
    "--disable-gpu", "--disable-blink-features=AutomationControlled",
    "--window-size=1920,1080",
  ],
});

const page = await browser.newPage();

await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
});

await page.setUserAgent(USER_AGENTS[0]);
await page.setViewport({ width: 1920, height: 1080 });
await page.setExtraHTTPHeaders({
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  Referer: "https://www.google.com/search?q=maui+real+estate",
  "Upgrade-Insecure-Requests": "1",
});

console.log("Navigating...");
const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
console.log(`HTTP Status: ${response.status()}`);
console.log(`Final URL: ${page.url()}`);

// Wait a bit more
await new Promise(r => setTimeout(r, 3000));

// Dump page title and key info
const title = await page.title();
console.log(`Page title: ${title}`);

// Check if we got blocked/redirected
const pageUrl = page.url();
if (pageUrl.includes("captcha") || pageUrl.includes("blocked") || pageUrl.includes("403")) {
  console.log("BLOCKED! Page redirected to:", pageUrl);
} else {
  console.log("Page loaded successfully");
}

// Count all images on page
const imgCount = await page.evaluate(() => document.querySelectorAll("img").length);
console.log(`Total img elements on page: ${imgCount}`);

// Get all image src attributes
const allImgSrcs = await page.evaluate(() => {
  const srcs = [];
  document.querySelectorAll("img").forEach(img => {
    const src = img.src || img.getAttribute("data-src") || "";
    if (src) srcs.push(src.substring(0, 100));
  });
  return srcs.slice(0, 20); // First 20
});
console.log(`\nFirst 20 image sources:`);
allImgSrcs.forEach((src, i) => console.log(`  ${i+1}. ${src}`));

// Check for __NEXT_DATA__
const hasNextData = await page.evaluate(() => !!document.getElementById("__NEXT_DATA__"));
console.log(`\nHas __NEXT_DATA__: ${hasNextData}`);

if (hasNextData) {
  const nextDataLength = await page.evaluate(() => {
    const el = document.getElementById("__NEXT_DATA__");
    return el ? el.textContent.length : 0;
  });
  console.log(`__NEXT_DATA__ size: ${nextDataLength} chars`);

  // Search for rdcpix in __NEXT_DATA__
  const rdcpixCount = await page.evaluate(() => {
    const el = document.getElementById("__NEXT_DATA__");
    if (!el) return 0;
    const matches = (el.textContent || "").match(/rdcpix/g);
    return matches ? matches.length : 0;
  });
  console.log(`rdcpix.com mentions in __NEXT_DATA__: ${rdcpixCount}`);

  if (rdcpixCount > 0) {
    // Extract a few sample URLs
    const sampleUrls = await page.evaluate(() => {
      const el = document.getElementById("__NEXT_DATA__");
      if (!el) return [];
      const matches = (el.textContent || "").match(/https:\/\/[^"\\]*rdcpix\.com[^"\\]*/g) || [];
      return [...new Set(matches)].slice(0, 10);
    });
    console.log(`\nSample rdcpix URLs from __NEXT_DATA__:`);
    sampleUrls.forEach((url, i) => console.log(`  ${i+1}. ${url}`));
  }
}

// Save a snippet of the HTML for inspection
const html = await page.content();
fs.writeFileSync("/tmp/page-dump.html", html.substring(0, 50000));
console.log(`\nSaved first 50KB of HTML to /tmp/page-dump.html`);

await browser.close();
