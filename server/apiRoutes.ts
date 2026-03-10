import { Router } from "express";
import axios from "axios";
import { jsonDb } from "./jsonDb";

const api = Router();

const OCEAN_VIEW_KEYWORDS = [
  "ocean view", "ocean views", "ocean glimpse", "panoramic ocean",
  "see the ocean", "unobstructed view", "ocean peek", "outer island views",
  "ocean and", "views of the ocean", "ocean vista", "pacific ocean",
];

const ANY_VIEW_KEYWORDS = [
  ...OCEAN_VIEW_KEYWORDS,
  "mountain view", "mountain views", "garden view", "garden views",
  "valley view", "valley views", "lanai view", "balcony view",
  "haleakala view", "west maui", "island view", "tropical view",
  "sunset view", "sunrise view", "scenic view", "panoramic view",
  "city view", "pool view", "courtyard view", "partial view",
];

/**
 * All 17 Maui County zip codes — queried individually to maximize coverage.
 * No zip codes skipped.
 */
const MAUI_ZIPS = [
  { zip: "96708", area: "haiku" },
  { zip: "96713", area: "hana" },
  { zip: "96732", area: "kahului" },
  { zip: "96733", area: "kahului" },
  { zip: "96748", area: "kaunakakai_molokai" },
  { zip: "96753", area: "kihei_maui_meadows_wailea" },
  { zip: "96757", area: "kualapuu_molokai" },
  { zip: "96761", area: "lahaina_napili_kapalua" },
  { zip: "96763", area: "lanai_city" },
  { zip: "96768", area: "makawao" },
  { zip: "96770", area: "maunaloa_molokai" },
  { zip: "96779", area: "paia" },
  { zip: "96784", area: "pukalani" },
  { zip: "96788", area: "pukalani_makawao" },
  { zip: "96790", area: "kula" },
  { zip: "96793", area: "wailuku" },
  { zip: "96796", area: "wailuku" },
];

function hasOceanViewKeyword(text: string | null): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const kw of OCEAN_VIEW_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

function extractOceanViewSentence(text: string | null, keyword: string | null): string {
  if (!text || !keyword) return "";
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  for (const s of sentences) {
    if (s.toLowerCase().includes(keyword)) return s.trim();
  }
  return "";
}

/**
 * Map a realtor16 API property to our listing schema.
 * Photos are strictly tied to this property only — never mixed with other listings.
 */
function mapRealtor16Property(
  prop: any,
  listingType: string,
  locationArea: string
) {
  const desc = prop.description || {};
  const location = prop.location?.address || {};
  const address = [
    location.line,
    location.city,
    location.state_code,
    location.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  // SAFEGUARD: Reject test data — never store fake listings
  if (address.includes("Test") || address.includes("test") || address.includes("Seed")) {
    return null; // Skip test data
  }
  if (prop.photos && JSON.stringify(prop.photos).includes("example.com")) {
    return null; // Skip test data with example.com URLs
  }

  const descriptionText = prop.remarks || prop.description_text || "";
  const titleText = prop.name || "";
  const combinedText = `${titleText} ${descriptionText}`;
  const oceanKeyword = hasOceanViewKeyword(combinedText);
  const hasOcean = !!oceanKeyword;

  // Extract ALL photos — strictly from this property only, never mixed
  const photos: Array<{ url: string; source: string }> = [];
  const listingId = prop.listing_id || prop.property_id || "";

  // Primary photo first
  if (prop.primary_photo?.href) {
    photos.push({ url: prop.primary_photo.href, source: "realtor.com" });
  }
  // All photos array — no limit, no truncation
  if (Array.isArray(prop.photos)) {
    for (const p of prop.photos) {
      const url = p?.href || p?.url || (typeof p === "string" ? p : "");
      if (url && !photos.some((existing) => existing.url === url)) {
        photos.push({ url, source: "realtor.com" });
      }
    }
  }

  // Agent info from advertisers
  const advertiser = prop.advertisers?.[0] || {};
  const agentName = advertiser.name || advertiser.agent?.name || "";
  const agentPhone = advertiser.phone?.number || advertiser.agent?.phone || "";
  const agentEmail = advertiser.email || advertiser.agent?.email || null;
  const brokerage = prop.branding?.[0]?.name || advertiser.office?.name || "";

  // Build listing URL from permalink
  const permalink = prop.permalink || "";
  const listingUrl = permalink
    ? `https://www.realtor.com/realestateandhomes-detail/${permalink}`
    : "";

  return {
    source: "realtor.com",
    listing_type: listingType,
    address,
    price: prop.list_price || 0,
    bedrooms: desc.beds || 0,
    bathrooms: parseFloat(desc.baths_consolidated || "0") || 0,
    sqft: desc.sqft || null,
    ocean_view: hasOcean,
    ocean_view_description: extractOceanViewSentence(combinedText, oceanKeyword),
    status: prop.status === "for_sale" ? "Active" : prop.status === "for_rent" ? "Available" : prop.status || "Active",
    description: descriptionText, // Full description, never truncated
    agent_name: agentName,
    agent_brokerage: brokerage,
    agent_phone: agentPhone,
    agent_email: agentEmail,
    listing_url: listingUrl,
    photos, // ALL photos, never truncated, strictly from this listing
    location_area: locationArea,
    listing_id: listingId,
  }; // SAFEGUARD: year_built, lot_size, property_type excluded — not in Supabase schema
}

/**
 * Fetch ALL pages from realtor16 for a given zip code and listing type.
 * Paginates until no more results. Rate-limited between pages.
 */
async function fetchAllPages(
  endpoint: "forsale" | "forrent",
  zip: string,
  priceMax: number
): Promise<any[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return [];

  const allResults: any[] = [];
  const PAGE_SIZE = 42; // realtor16 default page size
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    try {
      const params: Record<string, any> = {
        location: zip,
        offset,
        limit: PAGE_SIZE,
        sort: "newest",
      };
      if (endpoint === "forsale") {
        params.price_max = priceMax;
        params.beds_min = 1;
        params.baths_min = 1;
      } else {
        params.price_max = priceMax;
        params.beds_min = 1;
      }

      const resp = await axios.get(
        `https://realtor16.p.rapidapi.com/search/${endpoint}`,
        {
          params,
          headers: {
            "x-rapidapi-host": "realtor16.p.rapidapi.com",
            "x-rapidapi-key": apiKey,
          },
          timeout: 20000,
        }
      );

      const properties: any[] = resp.data?.properties || [];
      if (properties.length === 0) break;

      allResults.push(...properties);

      // Update total from API response
      if (resp.data?.total && total === Infinity) {
        total = resp.data.total;
      }

      offset += properties.length;

      // Stop if we got fewer than expected (last page)
      if (properties.length < PAGE_SIZE) break;

      // 2-3 second delay between pages to prevent rate limiting
      await new Promise((r) => setTimeout(r, 2500));
    } catch (error: any) {
      console.error(`Error fetching ${endpoint} zip=${zip} offset=${offset}:`, error.message);
      break;
    }
  }

  return allResults;
}

// ─── GET /api/search-runs ────────────────────────────────────────────────────
api.get("/api/search-runs", async (_req, res) => {
  try {
    const data = await jsonDb.getSearchRuns(100);

    // Group by date and aggregate listing counts
    const dateMap = new Map<string, { id: string; run_date: string; listing_count: number }>();

    for (const run of data || []) {
      const listings = await jsonDb.getListings();
      const count = listings.filter((l) => l.search_run_id === run.id).length;

      const existing = dateMap.get(run.run_date);
      if (!existing) {
        dateMap.set(run.run_date, {
          id: run.id,
          run_date: run.run_date,
          listing_count: count,
        });
      } else {
        // Accumulate counts across multiple runs on the same date
        existing.listing_count += count;
      }
    }

    res.json(Array.from(dateMap.values()).sort((a, b) => b.run_date.localeCompare(a.run_date)));
  } catch (error: any) {
    console.error("Error fetching search runs:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/listings?date=YYYY-MM-DD ────────────────────────────────────────────────────
api.get("/api/listings", async (req, res) => {
  try {
    const date = req.query.date as string;
    if (!date) return res.status(400).json({ error: "date query parameter required" });

    // Get ALL search runs for this date
    const allRuns = await jsonDb.getSearchRuns(1000);
    const runsForDate = allRuns.filter((r) => r.run_date === date);
    if (!runsForDate || runsForDate.length === 0) return res.json([]);

    const runIds = runsForDate.map((r) => r.id);

    // Fetch ALL listings across all runs for this date
    const allListings: any[] = [];
    const seenIds = new Set<string>();

    for (const runId of runIds) {
      const listings = await jsonDb.getListings();
      for (const l of listings) {
        if (l.search_run_id === runId && !seenIds.has(l.id)) {
          seenIds.add(l.id);
          allListings.push(l);
        }
      }
    }

    res.json(allListings);
  } catch (error: any) {
    console.error("Error fetching listings:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/listings/:id ───────────────────────────────────────────────────
api.get("/api/listings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = await jsonDb.getListingById(id);
    if (!data) return res.status(404).json({ error: "Listing not found" });
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching listing:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/search ────────────────────────────────────────────────────────
// Comprehensive search across ALL 17 Maui County zip codes via realtor16 API.
// Paginates ALL pages, stores ALL photos, ALL fields. Upserts to avoid duplicates.
api.post("/api/search", async (_req, res) => {
  try {
    const allListings: any[] = [];
    const seenAddresses = new Set<string>();
    const today = new Date().toISOString().split("T")[0];

    console.log(`[Search] Starting comprehensive Maui search across ${MAUI_ZIPS.length} zip codes...`);

    // FOR SALE — all zip codes, 1+ bed, 1+ bath, max $1.1M
    for (const { zip, area } of MAUI_ZIPS) {
      console.log(`[Search] For sale: zip ${zip} (${area})`);
      const properties = await fetchAllPages("forsale", zip, 1100000);
      console.log(`  → ${properties.length} properties found`);

      for (const prop of properties) {
        const mapped = mapRealtor16Property(prop, "for_sale", area);
        if (mapped === null) continue; // Skip test data
        const addrKey = mapped.address.toLowerCase().trim();
        if (addrKey && !seenAddresses.has(addrKey)) {
          seenAddresses.add(addrKey);
          allListings.push(mapped);
        }
      }
      // 1.5 second delay between zip codes to prevent rate limiting
      await new Promise((r) => setTimeout(r, 1500));
    }

    // FOR RENT — all zip codes, 1+ bed, max $6,000/mo
    for (const { zip, area } of MAUI_ZIPS) {
      console.log(`[Search] For rent: zip ${zip} (${area})`);
      const properties = await fetchAllPages("forrent", zip, 6000);
      console.log(`  → ${properties.length} properties found`);

      for (const prop of properties) {
        const mapped = mapRealtor16Property(prop, "for_rent", area);
        if (mapped === null) continue; // Skip test data
        const addrKey = mapped.address.toLowerCase().trim();
        if (addrKey && !seenAddresses.has(addrKey)) {
          seenAddresses.add(addrKey);
          allListings.push(mapped);
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    console.log(`[Search] Total unique listings: ${allListings.length}`);

    // Create search run record
    const searchRun = await jsonDb.insertSearchRun({
      run_date: today,
      total_found: allListings.length,
      sources_searched: {
        realtor16_api: true,
        coverage: "all_maui_county",
        zip_codes: MAUI_ZIPS.map((z) => z.zip),
        paginated: true,
      },
    });

    // Batch upsert all listings — no artificial limits, 100 per batch
    let storedCount = 0;
    if (allListings.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < allListings.length; i += BATCH_SIZE) {
        const batch = allListings.slice(i, i + BATCH_SIZE);
        console.log(`[Batch ${i / BATCH_SIZE + 1}] Processing ${batch.length} listings...`);
        const rows = batch.map((l) => ({
          search_run_id: searchRun.id,
          source: l.source,
          listing_type: l.listing_type,
          address: l.address,
          price: l.price,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          sqft: l.sqft,
          ocean_view: l.ocean_view,
          ocean_view_description: l.ocean_view_description,
          status: l.status?.toLowerCase(),
          description: l.description,
          agent_name: l.agent_name,
          agent_brokerage: l.agent_brokerage,
          agent_phone: l.agent_phone,
          agent_email: l.agent_email,
          listing_url: l.listing_url,
          photos: l.photos, // JSONB array of {url, source} — strictly per-listing
          first_seen_date: today,
          last_seen_date: today,
          is_active: true,
          location_area: l.location_area,
          price_at_first_seen: l.price,
          // NOTE: year_built, lot_size, property_type are NOT in the Supabase schema — omitted intentionally
        }));

        // Log sample of photos before insert
        const photoCounts = rows.map(r => r.photos?.length || 0);
        const withPhotos = photoCounts.filter(c => c > 0).length;
        console.log(`  → ${withPhotos}/${rows.length} rows have photos (${photoCounts.slice(0, 3).join(', ')} photos in first 3)`);
        
        try {
          await jsonDb.insertListings(rows);
          console.log(`Batch ${i / BATCH_SIZE + 1} stored ${rows.length} rows successfully`);
          storedCount += rows.length;
        } catch (batchError: any) {
          console.error(`Batch ${i / BATCH_SIZE + 1} insert error:`, batchError.message);
        }
      }
    }

    res.json({
      success: true,
      total: allListings.length,
      search_run_id: searchRun.id,
      searched_at: new Date().toISOString(),
      zip_codes_searched: MAUI_ZIPS.length,
    });
  } catch (error: any) {
    console.error("Error in /api/search:", error);
    res.status(500).json({ error: error.message });
  }
});

export default api;
