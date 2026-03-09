/**
 * Diagnostic script: fetch ONE listing from realtor16 and try to insert it into Supabase.
 * Captures exact error messages at every step.
 */
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yskhuojnrrmsmxodkamc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7LsJQisWEkUvrdVVfbzdrQ_UIMZoFQm";
const RAPIDAPI_KEY = "e69f67142bmshedd97cdac0ca65bp1c1b13jsne15c476e71ba";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Step 1: Fetch one listing from realtor16
console.log("=== STEP 1: Fetch from realtor16 ===");
let prop;
try {
  const resp = await axios.get("https://realtor16.p.rapidapi.com/search/forsale", {
    params: { location: "96753", offset: 0, limit: 1, sort: "newest" },
    headers: {
      "x-rapidapi-host": "realtor16.p.rapidapi.com",
      "x-rapidapi-key": RAPIDAPI_KEY,
    },
    timeout: 15000,
  });
  const properties = resp.data?.properties || [];
  console.log(`Found ${properties.length} properties`);
  if (properties.length === 0) { console.error("No properties returned!"); process.exit(1); }
  prop = properties[0];
  console.log("Raw property keys:", Object.keys(prop));
  console.log("listing_id:", prop.listing_id);
  console.log("property_id:", prop.property_id);
  console.log("list_price:", prop.list_price);
  console.log("status:", prop.status);
  console.log("description keys:", Object.keys(prop.description || {}));
  console.log("location keys:", Object.keys(prop.location || {}));
  console.log("address:", prop.location?.address);
  console.log("photos count:", prop.photos?.length ?? 0);
  console.log("primary_photo:", prop.primary_photo?.href);
  console.log("advertisers:", JSON.stringify(prop.advertisers?.[0], null, 2));
  console.log("remarks:", (prop.remarks || "").substring(0, 100));
} catch (e) {
  console.error("STEP 1 FAILED:", e.message);
  process.exit(1);
}

// Step 2: Map the property (same logic as apiRoutes.ts)
console.log("\n=== STEP 2: Map property ===");
const desc = prop.description || {};
const location = prop.location?.address || {};
const address = [location.line, location.city, location.state_code, location.postal_code]
  .filter(Boolean).join(", ");
const descriptionText = prop.remarks || prop.description_text || "";
const listingId = prop.listing_id || prop.property_id || "";
const permalink = prop.permalink || "";
const listingUrl = permalink ? `https://www.realtor.com/realestateandhomes-detail/${permalink}` : "";

const photos = [];
if (prop.primary_photo?.href) photos.push({ url: prop.primary_photo.href, source: "realtor.com" });
if (Array.isArray(prop.photos)) {
  for (const p of prop.photos) {
    const url = p?.href || p?.url || (typeof p === "string" ? p : "");
    if (url && !photos.some(e => e.url === url)) photos.push({ url, source: "realtor.com" });
  }
}

const advertiser = prop.advertisers?.[0] || {};
const mapped = {
  source: "realtor.com",
  listing_type: "for_sale",
  address,
  price: prop.list_price || 0,
  bedrooms: desc.beds || 0,
  bathrooms: parseFloat(desc.baths_consolidated || "0") || 0,
  sqft: desc.sqft || null,
  ocean_view: false,
  ocean_view_description: "",
  status: "active",
  description: descriptionText,
  agent_name: advertiser.name || advertiser.agent?.name || "",
  agent_brokerage: prop.branding?.[0]?.name || advertiser.office?.name || "",
  agent_phone: advertiser.phone?.number || advertiser.agent?.phone || "",
  agent_email: advertiser.email || advertiser.agent?.email || null,
  listing_url: listingUrl,
  photos,
  location_area: "kihei_maui_meadows_wailea",
  year_built: desc.year_built || null,
  lot_size: desc.lot_sqft || null,
  property_type: desc.type || desc.sub_type || null,
  listing_id: listingId,
};
console.log("Mapped listing:", JSON.stringify(mapped, null, 2));

// Step 3: Create a test search_run
console.log("\n=== STEP 3: Create search_run ===");
const today = new Date().toISOString().split("T")[0];
const { data: searchRun, error: runError } = await supabase
  .from("search_runs")
  .insert({ run_date: today, total_found: 1, sources_searched: { test: true } })
  .select()
  .single();
if (runError) {
  console.error("search_run insert FAILED:", JSON.stringify(runError, null, 2));
  process.exit(1);
}
console.log("search_run created:", searchRun.id);

// Step 4: Try to insert the listing
console.log("\n=== STEP 4: Insert listing ===");
const row = {
  search_run_id: searchRun.id,
  source: mapped.source,
  listing_type: mapped.listing_type,
  address: mapped.address,
  price: mapped.price,
  bedrooms: mapped.bedrooms,
  bathrooms: mapped.bathrooms,
  sqft: mapped.sqft,
  ocean_view: mapped.ocean_view,
  ocean_view_description: mapped.ocean_view_description,
  status: mapped.status,
  description: mapped.description,
  agent_name: mapped.agent_name,
  agent_brokerage: mapped.agent_brokerage,
  agent_phone: mapped.agent_phone,
  agent_email: mapped.agent_email,
  listing_url: mapped.listing_url,
  photos: mapped.photos,
  first_seen_date: today,
  last_seen_date: today,
  is_active: true,
  location_area: mapped.location_area,
  price_at_first_seen: mapped.price,
};
console.log("Row to insert:", JSON.stringify(row, null, 2));

const { data: insertData, error: insertError } = await supabase.from("listings").insert([row]).select();
if (insertError) {
  console.error("INSERT FAILED:", JSON.stringify(insertError, null, 2));
  console.error("Error code:", insertError.code);
  console.error("Error message:", insertError.message);
  console.error("Error details:", insertError.details);
  console.error("Error hint:", insertError.hint);
} else {
  console.log("INSERT SUCCESS! Stored listing id:", insertData?.[0]?.id);
}

// Step 5: Check what columns the listings table has
console.log("\n=== STEP 5: Check listings table columns ===");
const { data: sample, error: sampleError } = await supabase.from("listings").select("*").limit(1);
if (sampleError) {
  console.error("Could not fetch sample:", sampleError.message);
} else {
  console.log("Existing columns:", Object.keys(sample?.[0] || {}));
}

// Cleanup test search_run
await supabase.from("search_runs").delete().eq("id", searchRun.id);
console.log("\nDone. Test search_run cleaned up.");
