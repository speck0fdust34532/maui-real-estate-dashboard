import { Router } from "express";
import axios from "axios";
import { supabase } from "./supabase";

const api = Router();

const OCEAN_VIEW_KEYWORDS = [
  "ocean view", "ocean views", "ocean glimpse", "panoramic view",
  "see the ocean", "unobstructed view", "ocean peek", "outer island views",
  "ocean and", "views of the ocean",
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

function extractOceanViewSentence(text: string | null, keyword: string | null): string {
  if (!text || !keyword) return "";
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  for (const s of sentences) {
    if (s.toLowerCase().includes(keyword)) return s.trim();
  }
  return "";
}

function mapListing(apiListing: any, listingType: string, locationArea: string) {
  const oceanKeyword =
    hasOceanViewKeyword(apiListing.description || "") ||
    hasOceanViewKeyword(apiListing.title || "");

  // Extract photos with source attribution — strictly tied to this listing
  const photos: Array<{ url: string; source: string; listing_id?: string }> = [];
  const listingId = apiListing.id || apiListing.listing_id || "";

  if (apiListing.photos && Array.isArray(apiListing.photos)) {
    for (const p of apiListing.photos) {
      const url = typeof p === "string" ? p : p.url || p.href || "";
      if (url) photos.push({ url, source: "realtor.com", listing_id: listingId });
    }
  }
  if (apiListing.primary_photo) {
    const url = typeof apiListing.primary_photo === "string"
      ? apiListing.primary_photo
      : apiListing.primary_photo.href || apiListing.primary_photo.url || "";
    if (url && !photos.some(p => p.url === url)) {
      photos.unshift({ url, source: "realtor.com", listing_id: listingId });
    }
  }
  if (apiListing.thumbnail && !photos.some(p => p.url === apiListing.thumbnail)) {
    photos.unshift({ url: apiListing.thumbnail, source: "realtor.com", listing_id: listingId });
  }

  return {
    source: "realtor.com",
    listing_type: listingType === "buy" ? "for_sale" : "for_rent",
    address: apiListing.address || "",
    price: apiListing.price || 0,
    bedrooms: apiListing.beds || 0,
    bathrooms: apiListing.baths || 0,
    sqft: apiListing.sqft || null,
    ocean_view: true,
    ocean_view_description: extractOceanViewSentence(
      apiListing.description || apiListing.title || "",
      oceanKeyword
    ),
    status: apiListing.status || "Active",
    description: apiListing.description || "",
    agent_name: apiListing.agent_name || "",
    agent_brokerage: apiListing.agent_brokerage || "",
    agent_phone: apiListing.agent_phone || "",
    agent_email: apiListing.agent_email || null,
    listing_url: apiListing.listing_url || "",
    photos,
    location_area: locationArea,
  };
}

async function callRealtorAPI(endpoint: string, params: Record<string, any>) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null;
  try {
    const response = await axios.get(
      `https://realtor-search.p.rapidapi.com${endpoint}`,
      {
        params,
        headers: {
          "x-rapidapi-host": "realtor-search.p.rapidapi.com",
          "x-rapidapi-key": apiKey,
        },
        timeout: 15000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error(`Error calling Realtor API (${endpoint}):`, error.message);
    return null;
  }
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

// GET /api/listings?date=YYYY-MM-DD
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

    const { data: listings, error: listError } = await supabase
      .from("listings")
      .select("*")
      .in("search_run_id", runIds);
    if (listError) throw listError;

    res.json(listings || []);
  } catch (error: any) {
    console.error("Error fetching listings:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/search — live search via RapidAPI across all Maui, upsert into Supabase
api.post("/api/search", async (_req, res) => {
  try {
    const allListings: any[] = [];
    const seenAddresses = new Set<string>();
    const today = new Date().toISOString().split("T")[0];

    // Search for sale — all Maui locations, 1+ bed, 1+ bath, max $1.1M, ocean view
    for (const location of SALE_LOCATIONS) {
      const saleData = await callRealtorAPI("/properties/search-buy", {
        location: location.name,
        beds_min: 1,
        baths_min: 1,
        price_max: 1100000,
      });
      if (saleData?.listings && Array.isArray(saleData.listings)) {
        for (const listing of saleData.listings) {
          const kw =
            hasOceanViewKeyword(listing.description || "") ||
            hasOceanViewKeyword(listing.title || "");
          if (kw) {
            const addr = (listing.address || "").toLowerCase().trim();
            if (!seenAddresses.has(addr)) {
              seenAddresses.add(addr);
              allListings.push(mapListing(listing, "buy", location.area));
            }
          }
        }
      }
    }

    // Search for rent — all Maui locations, 1+ bed, 1+ bath, max $6,000/mo, ocean view
    for (const location of RENT_LOCATIONS) {
      const rentData = await callRealtorAPI("/properties/search-rent", {
        location: location.name,
        beds_min: 1,
        baths_min: 1,
        price_max: 6000,
      });
      if (rentData?.listings && Array.isArray(rentData.listings)) {
        for (const listing of rentData.listings) {
          const kw =
            hasOceanViewKeyword(listing.description || "") ||
            hasOceanViewKeyword(listing.title || "");
          if (kw) {
            const addr = (listing.address || "").toLowerCase().trim();
            if (!seenAddresses.has(addr)) {
              seenAddresses.add(addr);
              allListings.push(mapListing(listing, "rent", location.area));
            }
          }
        }
      }
    }

    const { data: searchRun, error: runError } = await supabase
      .from("search_runs")
      .insert({
        run_date: today,
        total_found: allListings.length,
        sources_searched: { realtor_api: true, coverage: "all_maui" },
      })
      .select()
      .single();
    if (runError) throw runError;

    if (allListings.length > 0) {
      const rows = allListings.map((l) => ({
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
        first_seen_date: today,
        last_seen_date: today,
        is_active: true,
        location_area: l.location_area,
        price_at_first_seen: l.price,
      }));

      const { error: insertError } = await supabase.from("listings").insert(rows);
      if (insertError) throw insertError;
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
