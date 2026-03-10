import puppeteer from "puppeteer";
import fs from "fs";

// Rotating user agents — mix of Chrome versions and OS
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min = 2000, max = 5000) {
  return new Promise((r) => setTimeout(r, Math.floor(Math.random() * (max - min) + min)));
}

async function scrapeListingPhotos(url) {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1920,1080",
    ],
  });

  try {
    const page = await browser.newPage();

    // Anti-detection: override navigator.webdriver
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    });

    const ua = randomUA();
    await page.setUserAgent(ua);
    await page.setViewport({ width: 1920, height: 1080 });

    // Set realistic headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      DNT: "1",
      Referer: "https://www.google.com/search?q=maui+real+estate",
      "Upgrade-Insecure-Requests": "1",
      "Cache-Control": "max-age=0",
    });

    console.log(`[Scraper] Navigating to: ${url}`);
    console.log(`[Scraper] Using UA: ${ua.substring(0, 60)}...`);

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Random delay to simulate human reading
    await randomDelay(1500, 3000);

    // Scroll down to trigger lazy loading
    await page.evaluate(() => { window.scrollTo(0, 500); });
    await randomDelay(500, 1000);
    await page.evaluate(() => { window.scrollTo(0, 1000); });
    await randomDelay(500, 1000);

    // Extract photos from the page
    const photos = await page.evaluate(() => {
      const found = new Set();

      // Strategy 1: All img tags with realtor CDN URLs
      document.querySelectorAll("img").forEach((img) => {
        const src = img.src || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || "";
        if (src && (src.includes("rdcpix.com") || src.includes("realtor.com"))) {
          // Convert thumbnail to full-res by removing size suffix
          const fullRes = src.replace(/-m\d+s\.jpg/, "-m0s.jpg").replace(/-m\d+x\.jpg/, "-m0x.jpg");
          found.add(fullRes);
        }
      });

      // Strategy 2: Look in picture/source srcset
      document.querySelectorAll("source[srcset]").forEach((source) => {
        const srcset = source.getAttribute("srcset") || "";
        srcset.split(",").forEach((entry) => {
          const url = entry.trim().split(" ")[0];
          if (url && (url.includes("rdcpix.com") || url.includes("realtor.com"))) {
            const fullRes = url.replace(/-m\d+s\.jpg/, "-m0s.jpg").replace(/-m\d+x\.jpg/, "-m0x.jpg");
            found.add(fullRes);
          }
        });
      });

      // Strategy 3: JSON-LD structured data
      document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
        try {
          const data = JSON.parse(script.textContent || "{}");
          const images = Array.isArray(data.image) ? data.image : data.image ? [data.image] : [];
          images.forEach((img) => {
            const url = typeof img === "string" ? img : img?.url || img?.contentUrl;
            if (url) found.add(url);
          });
        } catch {}
      });

      // Strategy 4: Next.js __NEXT_DATA__ hydration blob — richest source
      const nextDataEl = document.getElementById("__NEXT_DATA__");
      if (nextDataEl) {
        try {
          const jsonStr = nextDataEl.textContent || "";
          const matches = jsonStr.match(/https:\/\/[^"\\]*rdcpix\.com[^"\\]*/g) || [];
          matches.forEach((url) => {
            const fullRes = url.replace(/-m\d+s\.jpg/, "-m0s.jpg").replace(/-m\d+x\.jpg/, "-m0x.jpg");
            found.add(fullRes);
          });
        } catch {}
      }

      return Array.from(found);
    });

    console.log(`[Scraper] Found ${photos.length} photos`);
    return photos;
  } finally {
    await browser.close();
  }
}

// Get one real listing URL from the database
const listings = JSON.parse(fs.readFileSync("./data/listings.json", "utf-8"));
const testListing = listings.find((l) => l.listing_url && l.listing_url.length > 0);

if (!testListing) {
  console.error("No listing with URL found!");
  process.exit(1);
}

console.log(`\n=== Testing Puppeteer Scraper ===`);
console.log(`Listing: ${testListing.address}`);
console.log(`URL: ${testListing.listing_url}`);
console.log(`Current photos in DB: ${testListing.photos?.length || 0}`);
if (testListing.photos?.length > 0) {
  console.log(`Current photo sample: ${testListing.photos[0].url}`);
}
console.log("");

try {
  const photos = await scrapeListingPhotos(testListing.listing_url);

  console.log(`\n=== RESULTS ===`);
  console.log(`Photos found by scraper: ${photos.length}`);
  if (photos.length > 0) {
    console.log(`\nAll photo URLs:`);
    photos.forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`);
    });
    // Check if they look full-res (m0s vs thumbnail size)
    const fullRes = photos.filter(u => u.includes("-m0s.jpg") || u.includes("-m0x.jpg"));
    console.log(`\nFull-res photos (m0s/m0x): ${fullRes.length}`);
    const thumbs = photos.filter(u => !u.includes("-m0s.jpg") && !u.includes("-m0x.jpg"));
    console.log(`Thumbnail photos: ${thumbs.length}`);
  } else {
    console.log("No photos found from scraper.");
  }
} catch (err) {
  console.error("Scraper error:", err.message);
  console.error(err.stack);
}
