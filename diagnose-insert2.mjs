/**
 * Insert-only diagnostic — no API call needed.
 * Tests inserting a realistic listing row into Supabase to find the exact column/constraint issue.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yskhuojnrrmsmxodkamc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7LsJQisWEkUvrdVVfbzdrQ_UIMZoFQm";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Step 1: Check what columns actually exist
console.log("=== STEP 1: Check existing columns ===");
const { data: sample } = await supabase.from("listings").select("*").limit(1);
const existingCols = Object.keys(sample?.[0] || {});
console.log("Columns in listings table:", existingCols);

// Step 2: Create a test search_run
console.log("\n=== STEP 2: Create test search_run ===");
const today = new Date().toISOString().split("T")[0];
const { data: searchRun, error: runError } = await supabase
  .from("search_runs")
  .insert({ run_date: today, total_found: 1, sources_searched: { test: true } })
  .select().single();
if (runError) { console.error("search_run insert FAILED:", JSON.stringify(runError)); process.exit(1); }
console.log("search_run id:", searchRun.id);

// Step 3: Try minimal insert (only required fields)
console.log("\n=== STEP 3: Minimal insert (required fields only) ===");
const minimal = {
  search_run_id: searchRun.id,
  source: "realtor.com",
  listing_type: "for_sale",
  address: "123 Test St, Kihei, HI 96753",
  price: 850000,
  bedrooms: 2,
  bathrooms: 1,
  is_active: true,
  first_seen_date: today,
  last_seen_date: today,
  price_at_first_seen: 850000,
};
const { data: d1, error: e1 } = await supabase.from("listings").insert([minimal]).select();
if (e1) console.error("Minimal insert FAILED:", JSON.stringify(e1));
else console.log("Minimal insert SUCCESS, id:", d1?.[0]?.id);

// Step 4: Try with status field (the status column — check if it's an enum)
console.log("\n=== STEP 4: Insert with status='active' ===");
const withStatus = { ...minimal, address: "124 Test St, Kihei, HI 96753", status: "active" };
const { data: d2, error: e2 } = await supabase.from("listings").insert([withStatus]).select();
if (e2) console.error("status='active' FAILED:", JSON.stringify(e2));
else console.log("status='active' SUCCESS, id:", d2?.[0]?.id);

// Step 5: Try status='Active' (capitalized)
console.log("\n=== STEP 5: Insert with status='Active' ===");
const withStatusCap = { ...minimal, address: "125 Test St, Kihei, HI 96753", status: "Active" };
const { data: d3, error: e3 } = await supabase.from("listings").insert([withStatusCap]).select();
if (e3) console.error("status='Active' FAILED:", JSON.stringify(e3));
else console.log("status='Active' SUCCESS, id:", d3?.[0]?.id);

// Step 6: Try with photos JSONB
console.log("\n=== STEP 6: Insert with photos JSONB ===");
const withPhotos = { ...minimal, address: "126 Test St, Kihei, HI 96753", photos: [{ url: "https://example.com/photo.jpg", source: "realtor.com" }] };
const { data: d4, error: e4 } = await supabase.from("listings").insert([withPhotos]).select();
if (e4) console.error("photos insert FAILED:", JSON.stringify(e4));
else console.log("photos insert SUCCESS, id:", d4?.[0]?.id);

// Step 7: Try with ocean_view_description (check if column exists)
console.log("\n=== STEP 7: Insert with ocean_view_description ===");
const withOvd = { ...minimal, address: "127 Test St, Kihei, HI 96753", ocean_view_description: "Beautiful ocean view" };
const { data: d5, error: e5 } = await supabase.from("listings").insert([withOvd]).select();
if (e5) console.error("ocean_view_description FAILED:", JSON.stringify(e5));
else console.log("ocean_view_description SUCCESS, id:", d5?.[0]?.id);

// Step 8: Full row as apiRoutes.ts would send it
console.log("\n=== STEP 8: Full row (as apiRoutes.ts sends it) ===");
const fullRow = {
  search_run_id: searchRun.id,
  source: "realtor.com",
  listing_type: "for_sale",
  address: "128 Test St, Kihei, HI 96753",
  price: 850000,
  bedrooms: 2,
  bathrooms: 1.5,
  sqft: 1200,
  ocean_view: false,
  ocean_view_description: "",
  status: "active",
  description: "A lovely home in Kihei with great views.",
  agent_name: "Jane Doe",
  agent_brokerage: "Maui Realty",
  agent_phone: "808-555-1234",
  agent_email: null,
  listing_url: "https://www.realtor.com/realestateandhomes-detail/test",
  photos: [{ url: "https://example.com/photo.jpg", source: "realtor.com" }],
  first_seen_date: today,
  last_seen_date: today,
  is_active: true,
  location_area: "kihei_maui_meadows_wailea",
  price_at_first_seen: 850000,
};
const { data: d6, error: e6 } = await supabase.from("listings").insert([fullRow]).select();
if (e6) {
  console.error("Full row FAILED:", JSON.stringify(e6));
  console.error("Code:", e6.code, "| Message:", e6.message, "| Details:", e6.details, "| Hint:", e6.hint);
} else {
  console.log("Full row SUCCESS, id:", d6?.[0]?.id);
}

// Step 9: Try without year_built/lot_size/property_type (extra fields from mapRealtor16Property)
console.log("\n=== STEP 9: Full row + extra fields (year_built, lot_size, property_type) ===");
const extraRow = { ...fullRow, address: "129 Test St, Kihei, HI 96753", year_built: 2005, lot_size: 5000, property_type: "single_family" };
const { data: d7, error: e7 } = await supabase.from("listings").insert([extraRow]).select();
if (e7) {
  console.error("Extra fields FAILED:", JSON.stringify(e7));
  console.error("Code:", e7.code, "| Message:", e7.message, "| Details:", e7.details, "| Hint:", e7.hint);
} else {
  console.log("Extra fields SUCCESS, id:", d7?.[0]?.id);
}

// Cleanup
console.log("\n=== Cleanup ===");
await supabase.from("listings").delete().eq("search_run_id", searchRun.id);
await supabase.from("search_runs").delete().eq("id", searchRun.id);
console.log("Cleaned up test rows.");
