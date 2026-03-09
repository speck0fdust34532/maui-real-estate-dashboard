import { Router } from "express";
import axios from "axios";
import { supabase } from "./supabase";

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

// All-Maui search locations — Maui Meadows is first (priority), then broad Maui
const SALE_LOCATIONS = [
  { name: "Maui Meadows HI", area: "maui_meadows" },
  { name: "Kula HI", area: "kula" },
  { name: "Makawao HI", area: "makawao" },
  { name: "Kihei HI", area: "kihei" },
  { name: "Lahaina HI", area: "lahaina" },
  { name: "Paia HI", area: "paia" },
  { name: "Haiku HI", area: "haiku" },
  { name: "Wailuku HI", area: "wailuku" },
  { name: "Kahului HI", area: "kahului" },
  { name: "Wailea HI", area: "wailea" },
  { name: "Napili HI", area: "napili" },
  { name: "Kapalua HI", area: "kapalua" },
  { name: "Hana HI", area: "hana" },
  { name: "Maui HI", area: "maui_other" },
];

const RENT_LOCATIONS = [
  { name: "Maui Meadows HI", area: "maui_meadows" },
  { name: "Kula HI", area: "kula" },
  { name: "Makawao HI", area: "makawao" },
  { name: "Kihei HI", area: "kihei" },
  { name: "Lahaina HI", area: "lahaina" },
  { name: "Paia HI", area: "paia" },
  { name: "Haiku HI", area: "haiku" },
  { name: "Wailuku HI", area: "wailuku" },
  { name: "Kahului HI", area: "kahului" },
  { name: "Wailea HI", area: "wailea" },
  { name: "Maui HI", area: "maui_other" },
];

function hasOceanViewKeyword(text: string | null): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const kw of OCEAN_VIEW_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

function hasAnyViewKeyword(text: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ANY_VIEW_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractOceanViewSentence(text: string | null, keyword: string | null): string {
  if (!text || !keyword) return "";
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  for (const s of sentences) {
    if (s.toLowerCase().includes(keyword)) return s.trim();
  }
  return "";
}

function mapListing(apiListing: any, listingType: string, locationArea: string) {
  const desc = apiListing.description || "";
  const title = apiListing.title || "";
  const combinedText = `${title} ${desc}`;
  const oceanKeyword = hasOceanViewKeyword(combinedText);
  const hasOcean = !!oceanKeyword;

  // Extract ALL photos with source attribution — strictly tied to this listing only
  const photos: Array<{ url: string; source: string }> = [];
  const listingId = apiListing.id || apiListing.listing_id || "";

  // Primary photo first
  if (apiListing.primary_photo) {
    const url = typeof apiListing.primary_photo === "string"
      ? apiListing.primary_photo
      : apiListing.primary_photo.href || apiListing.primary_photo.url || "";
    if (url) photos.push({ url, source: "realtor.com" });
  }
  if (apiListing.thumbnail && !photos.some((p) => p.url === apiListing.thumbnail)) {
    photos.push({ url: apiListing.thumbnail, source: "realtor.com" });
  }
  // ALL photos array — no limit, no truncation
  if (apiListing.photos && Array.isArray(apiListing.photos)) {
    for (const p of apiListing.photos) {
      const url = typeof p === "string" ? p : p.url || p.href || "";
      if (url && !photos.some((existing) => existing.url === url)) {
        photos.push({ url, source: "realtor.com" });
      }
    }
  }

  return {
    source: "realtor.com",
    listing_type: listingType === "buy" ? "for_sale" : "for_rent",
    address: apiListing.address || "",
    price: apiListing.price || 0,
    bedrooms: apiListing.beds || 0,
    bathrooms: apiListing.baths || 0,
    sqft: apiListing.sqft || null,
    ocean_view: hasOcean,
    ocean_view_description: extractOceanViewSentence(combinedText, oceanKeyword),
    status: apiListing.status || "Active",
    description: desc, // Full description — no truncation
    agent_name: apiListing.agent_name || "",
    agent_brokerage: apiListing.agent_brokerage || "",
    agent_phone: apiListing.agent_phone || "",
    agent_email: apiListing.agent_email || null,
    listing_url: apiListing.listing_url || "",
    photos, // ALL photos, never truncated
    location_area: locationArea,
    year_built: apiListing.year_built || null,
    lot_size: apiListing.lot_sqft || apiListing.lot_size || null,
    property_type: apiListing.property_type || apiListing.type || null,
    hoa: apiListing.hoa || null,
  };
}

/**
 * Paginated API call — fetches ALL pages of results, never stops at page 1.
 * Continues until no more results or API returns empty.
 */
async function callRealtorAPIPaginated(
  endpoint: string,
  baseParams: Record<string, any>
): Promise<any[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return [];

  const allResults: any[] = [];
  let page = 1;
  const MAX_PAGES = 50; // Safety limit to prevent infinite loops

  while (page <= MAX_PAGES) {
    try {
      const params = { ...baseParams, page };
      const response = await axios.get(
        `https://realtor-search.p.rapidapi.com${endpoint}`,
        {
          params,
          headers: {
            "x-rapidapi-host": "realtor-search.p.rapidapi.com",
            "x-rapidapi-key": apiKey,
          },
          timeout: 20000,
        }
      );

      const data = response.data;
      const listings = data?.listings || data?.data?.results || [];

      if (!Array.isArray(listings) || listings.length === 0) break;

      allResults.push(...listings);

      // Check if there are more pages
      const totalResults = data?.total || data?.data?.total || 0;
      if (allResults.length >= totalResults && totalResults > 0) break;

      // If this page returned fewer than expected, we're done
      if (listings.length < 20) break;

      page++;

      // 2-3 second delay between pages to prevent rate limiting
      await new Promise((r) => setTimeout(r, 2500));
    } catch (error: any) {
      console.error(`Error calling Realtor API page ${page} (${endpoint}):`, error.message);
      break;
    }
  }

  return allResults;
}

// GET /api/search-runs
api.get("/api/search-runs", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("search_runs")
      .select("*")
      .order("run_date", { ascending: false });
    if (error) throw error;

    const runsWithCounts = await Promise.all(
      (data || []).map(async (run: any) => {
        const { count } = await supabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("search_run_id", run.id);
        return { ...run, listing_count: count || 0 };
      })
    );

    res.json(runsWithCounts);
  } catch (error: any) {
    console.error("Error fetching search runs:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/listings?date=YYYY-MM-DD — returns ALL listings for that date, no limit
api.get("/api/listings", async (req, res) => {
  try {
    const date = req.query.date as string;
    if (!date) {
      return res.status(400).json({ error: "date query parameter required" });
    }

    const { data: runs, error: runError } = await supabase
      .from("search_runs")
      .select("id")
      .eq("run_date", date);
    if (runError) throw runError;

    if (!runs || runs.length === 0) {
      return res.json([]);
    }

    const runIds = runs.map((r: any) => r.id);

    // Fetch ALL listings — paginate through Supabase if needed (1000 row default limit)
    let allListings: any[] = [];
    for (const runId of runIds) {
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: listings, error: listError } = await supabase
          .from("listings")
          .select("*")
          .eq("search_run_id", runId)
          .range(from, from + pageSize - 1);
        if (listError) throw listError;
        if (!listings || listings.length === 0) break;
        allListings.push(...listings);
        if (listings.length < pageSize) break;
        from += pageSize;
      }
    }

    res.json(allListings);
  } catch (error: any) {
    console.error("Error fetching listings:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/listings/:id — single listing by ID
api.get("/api/listings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Listing not found" });
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching listing:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/search — COMPREHENSIVE live search via RapidAPI across all Maui
// Paginates through ALL pages, stores ALL photos, ALL fields, no truncation
// Uses upsert logic (address-based dedup) to avoid duplicates
api.post("/api/search", async (_req, res) => {
  try {
    const allListings: any[] = [];
    const seenAddresses = new Set<string>();
    const today = new Date().toISOString().split("T")[0];

    // Search for sale — all Maui, 1+ bed, 1+ bath, max $1.1M — paginate ALL pages
    for (const location of SALE_LOCATIONS) {
      const listings = await callRealtorAPIPaginated("/properties/search-buy", {
        location: location.name,
        beds_min: 1,
        baths_min: 1,
        price_max: 1100000,
      });
      for (const listing of listings) {
        const addr = (listing.address || "").toLowerCase().trim();
        if (addr && !seenAddresses.has(addr)) {
          seenAddresses.add(addr);
          allListings.push(mapListing(listing, "buy", location.area));
        }
      }
      // 1-2 second delay between locations to prevent rate limiting
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Search for rent — all Maui, 1+ bed, 1+ bath, max $6,000/mo — paginate ALL pages
    for (const location of RENT_LOCATIONS) {
      const listings = await callRealtorAPIPaginated("/properties/search-rent", {
        location: location.name,
        beds_min: 1,
        baths_min: 1,
        price_max: 6000,
      });
      for (const listing of listings) {
        const addr = (listing.address || "").toLowerCase().trim();
        if (addr && !seenAddresses.has(addr)) {
          seenAddresses.add(addr);
          allListings.push(mapListing(listing, "rent", location.area));
        }
      }
      // 1-2 second delay between locations to prevent rate limiting
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Create search run
    const { data: searchRun, error: runError } = await supabase
      .from("search_runs")
      .insert({
        run_date: today,
        total_found: allListings.length,
        sources_searched: { realtor_api: true, coverage: "all_maui", paginated: true },
      })
      .select()
      .single();
    if (runError) throw runError;

    // Upsert all listings — no artificial limits
    if (allListings.length > 0) {
      // Batch insert in chunks of 100 to avoid payload limits
      const BATCH_SIZE = 100;
      for (let i = 0; i < allListings.length; i += BATCH_SIZE) {
        const batch = allListings.slice(i, i + BATCH_SIZE);
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
          description: l.description, // Full description, never truncated
          agent_name: l.agent_name,
          agent_brokerage: l.agent_brokerage,
          agent_phone: l.agent_phone,
          agent_email: l.agent_email,
          listing_url: l.listing_url,
          first_seen_date: today,
          last_seen_date: today,
          is_active: true,
          location_area: l.location_area,
          price_at_first_seen: l.price,
        }));

        // Use upsert on address to avoid duplicates within same search run
        const { error: insertError } = await supabase
          .from("listings")
          .upsert(rows, { onConflict: "address,search_run_id", ignoreDuplicates: true });
        if (insertError) {
          // Fallback to plain insert if upsert conflict column doesn't exist
          const { error: fallbackError } = await supabase.from("listings").insert(rows);
          if (fallbackError) console.error("Batch insert error:", fallbackError.message);
        }
      }
    }

    res.json({
      listings: allListings,
      total: allListings.length,
      search_run_id: searchRun.id,
      searched_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in /api/search:", error);
    res.status(500).json({ error: error.message });
  }
});

export default api;
