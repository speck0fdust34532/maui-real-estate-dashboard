import axios from "axios";
import { JSDOM } from "jsdom";

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function scrapeRealtorPhotos(listingUrl) {
  if (!listingUrl) return [];

  try {
    console.log(`[PhotoScraper] Fetching: ${listingUrl}`);

    const response = await axios.get(listingUrl, {
      headers: {
        "User-Agent": CHROME_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 15000,
    });

    const html = response.data;
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const photos = [];

    // Strategy 1: Look for image elements with data-src or src attributes
    const imgElements = document.querySelectorAll("img[src], img[data-src]");
    for (const img of Array.from(imgElements)) {
      const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
      if (
        src &&
        (src.includes("realtor.com") || src.includes("image") || src.includes("photo")) &&
        !src.includes("logo") &&
        !src.includes("icon") &&
        !src.includes("avatar") &&
        !src.includes("badge")
      ) {
        if (!photos.includes(src)) {
          photos.push(src);
        }
      }
    }

    // Strategy 2: Look for picture elements with srcset
    const pictureElements = document.querySelectorAll("picture source[srcset]");
    for (const pic of Array.from(pictureElements)) {
      const srcset = pic.getAttribute("srcset") || "";
      const urls = srcset.split(",").map((s) => s.trim().split(" ")[0]);
      for (const url of urls) {
        if (url && !photos.includes(url)) {
          photos.push(url);
        }
      }
    }

    // Strategy 3: Look for JSON-LD structured data with image URLs
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of Array.from(scripts)) {
      try {
        const json = JSON.parse(script.textContent || "{}");
        if (json.image) {
          const images = Array.isArray(json.image) ? json.image : [json.image];
          for (const img of images) {
            const url = typeof img === "string" ? img : img?.url;
            if (url && !photos.includes(url)) {
              photos.push(url);
            }
          }
        }
      } catch {
        // Skip malformed JSON
      }
    }

    // Strategy 4: Look for data attributes with image URLs
    const dataElements = document.querySelectorAll("[data-image-url], [data-photo-url]");
    for (const el of Array.from(dataElements)) {
      const url = el.getAttribute("data-image-url") || el.getAttribute("data-photo-url") || "";
      if (url && !photos.includes(url)) {
        photos.push(url);
      }
    }

    console.log(`[PhotoScraper] Found ${photos.length} photos`);
    return photos.slice(0, 50);
  } catch (error) {
    console.error(`[PhotoScraper] Error:`, error.message);
    return [];
  }
}

// Test with one listing
const testUrl = "https://www.realtor.com/realestateandhomes-detail/1780-Kauhikoa-Rd_Haiku_HI_96708_M37851-33633";
console.log(`\nTesting scraper with: ${testUrl}\n`);

const photos = await scrapeRealtorPhotos(testUrl);
console.log(`\nResults: Found ${photos.length} photos\n`);

if (photos.length > 0) {
  console.log("First 5 photo URLs:");
  photos.slice(0, 5).forEach((url, i) => {
    console.log(`  ${i + 1}. ${url.substring(0, 80)}...`);
  });
} else {
  console.log("No photos found!");
}
