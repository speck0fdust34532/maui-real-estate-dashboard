import { Router } from "express";
import axios from "axios";
import { supabase } from "./supabase";

const api = Router();

// Ocean view keywords
const OCEAN_VIEW_KEYWORDS = [
  "ocean view", "ocean views", "ocean glimpse", "panoramic view",
  "see the ocean", "unobstructed view", "ocean peek", "outer island views",
  "ocean and", "views of the ocean",
];

const LOCATIONS = [
  { name: "Maui Meadows HI", area: "maui_meadows" },
  { name: "Kula HI", area: "kula" },
  { name: "Makawao HI", area: "makawao" },
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

    // For each run, get listing count
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

    // Find the search run for this date
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

// POST /api/search — live search via RapidAPI, upsert into Supabase
api.post("/api/search", async (_req, res) => {
  try {
    const allListings: any[] = [];
    const today = new Date().toISOString().split("T")[0];

    // Search for sale
    for (const location of LOCATIONS) {
      const saleData = await callRealtorAPI("/properties/search-buy", {
        location: location.name,
        beds_min: 2,
        baths_min: 1,
        price_max: 1100000,
      });
      if (saleData?.listings && Array.isArray(saleData.listings)) {
        for (const listing of saleData.listings) {
          const kw =
            hasOceanViewKeyword(listing.description || "") ||
            hasOceanViewKeyword(listing.title || "");
          if (kw) allListings.push(mapListing(listing, "buy", location.area));
        }
      }
    }

    // Search for rent
    for (const location of LOCATIONS) {
      const rentData = await callRealtorAPI("/properties/search-rent", {
        location: location.name,
        beds_min: 2,
        baths_min: 1,
        price_max: 6000,
      });
      if (rentData?.listings && Array.isArray(rentData.listings)) {
        for (const listing of rentData.listings) {
          const kw =
            hasOceanViewKeyword(listing.description || "") ||
            hasOceanViewKeyword(listing.title || "");
          if (kw) allListings.push(mapListing(listing, "rent", location.area));
        }
      }
    }

    // Create a search run
    const { data: searchRun, error: runError } = await supabase
      .from("search_runs")
      .insert({
        run_date: today,
        total_found: allListings.length,
        sources_searched: { realtor_api: true },
      })
      .select()
      .single();
    if (runError) throw runError;

    // Upsert listings
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

      const { error: insertError } = await supabase
        .from("listings")
        .insert(rows);
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
