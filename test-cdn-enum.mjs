import fs from "fs";
import https from "https";

/**
 * Test CDN URL enumeration to discover additional photos per listing.
 * 
 * Known pattern from realtor16 API:
 *   https://ap.rdcpix.com/[hash]l-m[N]s.jpg
 * 
 * The "l" before "-m" seems to be a size indicator.
 * The number after "-m" is the photo variant/index.
 * The "s" after the number might be size (s=small, x=extra, etc.)
 * 
 * We'll try:
 *   - Changing the size suffix: s -> x, o, od, rd
 *   - Incrementing the photo index beyond what the API returned
 *   - Removing size suffixes entirely
 */

function headRequest(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: "HEAD", timeout: 8000 }, (res) => {
      resolve({ url, status: res.statusCode, contentType: res.headers["content-type"], contentLength: res.headers["content-length"] });
    });
    req.on("error", (err) => resolve({ url, status: "ERROR", error: err.message }));
    req.on("timeout", () => { req.destroy(); resolve({ url, status: "TIMEOUT" }); });
    req.end();
  });
}

// Load one listing from the database
const listings = JSON.parse(fs.readFileSync("./data/listings.json", "utf-8"));
const testListing = listings.find((l) => l.photos && l.photos.length > 0);

if (!testListing) {
  console.error("No listing with photos found!");
  process.exit(1);
}

console.log(`=== CDN URL Enumeration Test ===`);
console.log(`Listing: ${testListing.address}`);
console.log(`Current photos: ${testListing.photos.length}`);
console.log(`\nExisting photo URLs:`);
testListing.photos.forEach((p, i) => console.log(`  ${i + 1}. ${p.url}`));

// Parse the URL pattern
const sampleUrl = testListing.photos[0].url;
console.log(`\nAnalyzing URL pattern: ${sampleUrl}`);

// Extract the hash part and the variant part
// Pattern: https://ap.rdcpix.com/[hash]l-m[number]s.jpg
const match = sampleUrl.match(/^(https:\/\/ap\.rdcpix\.com\/[a-f0-9]+)(l?)-m(\d+)(s|x|o|od|rd)?\.jpg$/);
if (match) {
  const [, baseHash, sizeLetter, photoIndex, sizeCode] = match;
  console.log(`  Base hash: ${baseHash}`);
  console.log(`  Size letter: "${sizeLetter}"`);
  console.log(`  Photo index: ${photoIndex}`);
  console.log(`  Size code: "${sizeCode}"`);
} else {
  console.log(`  Could not parse URL pattern. Trying broader match...`);
  const broadMatch = sampleUrl.match(/^(https:\/\/ap\.rdcpix\.com\/[a-f0-9]+)(.*)$/);
  if (broadMatch) {
    console.log(`  Base: ${broadMatch[1]}`);
    console.log(`  Suffix: ${broadMatch[2]}`);
  }
}

console.log(`\n--- Testing URL variations ---\n`);

// Extract the base (everything before -m)
const baseMatch = sampleUrl.match(/^(https:\/\/ap\.rdcpix\.com\/[a-f0-9]+l?)-m/);
if (!baseMatch) {
  console.error("Cannot extract base URL pattern");
  process.exit(1);
}
const base = baseMatch[1];

// Test 1: Try different photo indices with same size suffix
console.log("Test 1: Incrementing photo index (keeping 's' suffix)");
const indexResults = [];
for (let i = 0; i <= 30; i++) {
  const url = `${base}-m${i}s.jpg`;
  const result = await headRequest(url);
  const status = result.status === 200 ? "✓" : "✗";
  const size = result.contentLength ? `${Math.round(result.contentLength / 1024)}KB` : "N/A";
  console.log(`  ${status} Index ${i}: ${result.status} ${size}`);
  if (result.status === 200) indexResults.push({ index: i, url, size: result.contentLength });
  // Small delay to be polite
  await new Promise(r => setTimeout(r, 200));
}

console.log(`\nFound ${indexResults.length} valid photos via index enumeration`);

// Test 2: Try different size suffixes on the first photo
console.log("\nTest 2: Different size suffixes on first photo");
const sizeSuffixes = ["s", "x", "o", "od", "rd", ""];
for (const suffix of sizeSuffixes) {
  const url = `${base}-m0${suffix}.jpg`;
  const result = await headRequest(url);
  const status = result.status === 200 ? "✓" : "✗";
  const size = result.contentLength ? `${Math.round(result.contentLength / 1024)}KB` : "N/A";
  console.log(`  ${status} Suffix "${suffix}": ${result.status} ${size} → ${url}`);
  await new Promise(r => setTimeout(r, 200));
}

// Test 3: Try without the 'l' before -m
console.log("\nTest 3: Without 'l' prefix");
const baseNoL = sampleUrl.match(/^(https:\/\/ap\.rdcpix\.com\/[a-f0-9]+)/)?.[1];
if (baseNoL) {
  for (let i = 0; i <= 5; i++) {
    const url = `${baseNoL}-m${i}s.jpg`;
    const result = await headRequest(url);
    const status = result.status === 200 ? "✓" : "✗";
    const size = result.contentLength ? `${Math.round(result.contentLength / 1024)}KB` : "N/A";
    console.log(`  ${status} No-L Index ${i}: ${result.status} ${size}`);
    await new Promise(r => setTimeout(r, 200));
  }
}

// Test 4: Try 'w' suffix variants (width-based)
console.log("\nTest 4: Width-based suffixes");
const widths = ["140", "280", "640", "1024", "1280", "2048"];
for (const w of widths) {
  const url = `${base}-m0w${w}.jpg`;
  const result = await headRequest(url);
  const status = result.status === 200 ? "✓" : "✗";
  const size = result.contentLength ? `${Math.round(result.contentLength / 1024)}KB` : "N/A";
  console.log(`  ${status} Width ${w}: ${result.status} ${size}`);
  await new Promise(r => setTimeout(r, 200));
}

console.log(`\n=== SUMMARY ===`);
console.log(`Original photos from API: ${testListing.photos.length}`);
console.log(`Photos found via CDN enumeration: ${indexResults.length}`);
if (indexResults.length > 0) {
  console.log(`Photo sizes range: ${indexResults.map(r => Math.round(r.size/1024) + 'KB').join(', ')}`);
}
