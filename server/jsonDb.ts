/**
 * JSON-based database abstraction layer
 * Stores listings and search_runs in JSON files to bypass Supabase RLS issues
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, "../data");
const SEARCH_RUNS_FILE = path.join(DB_DIR, "search_runs.json");
const LISTINGS_FILE = path.join(DB_DIR, "listings.json");

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

interface SearchRun {
  id: string;
  run_date: string;
  total_found: number;
  sources_searched: any;
  created_at: string;
}

interface Listing {
  id: string;
  search_run_id: string;
  source: string;
  listing_type: string;
  address: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  ocean_view: boolean;
  ocean_view_description: string | null;
  status: string | null;
  description: string | null;
  agent_name: string | null;
  agent_brokerage: string | null;
  agent_phone: string | null;
  agent_email: string | null;
  listing_url: string | null;
  photos: Array<{ url: string; source: string }> | null;
  first_seen_date: string;
  last_seen_date: string;
  is_active: boolean;
  location_area: string | null;
  price_at_first_seen: number | null;
  created_at: string;
}

// Initialize files if they don't exist
function initFiles() {
  if (!fs.existsSync(SEARCH_RUNS_FILE)) {
    fs.writeFileSync(SEARCH_RUNS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(LISTINGS_FILE)) {
    fs.writeFileSync(LISTINGS_FILE, JSON.stringify([], null, 2));
  }
}

function readSearchRuns(): SearchRun[] {
  initFiles();
  const data = fs.readFileSync(SEARCH_RUNS_FILE, "utf-8");
  return JSON.parse(data);
}

function writeSearchRuns(runs: SearchRun[]) {
  fs.writeFileSync(SEARCH_RUNS_FILE, JSON.stringify(runs, null, 2));
}

function readListings(): Listing[] {
  initFiles();
  const data = fs.readFileSync(LISTINGS_FILE, "utf-8");
  return JSON.parse(data);
}

function writeListings(listings: Listing[]) {
  fs.writeFileSync(LISTINGS_FILE, JSON.stringify(listings, null, 2));
}

export const jsonDb = {
  // Search Runs
  async insertSearchRun(data: Omit<SearchRun, "id" | "created_at">) {
    const runs = readSearchRuns();
    const newRun: SearchRun = {
      id: uuidv4(),
      created_at: new Date().toISOString(),
      ...data,
    };
    runs.push(newRun);
    writeSearchRuns(runs);
    return newRun;
  },

  async getSearchRuns(limit = 100) {
    const runs = readSearchRuns();
    return runs.sort((a, b) => new Date(b.run_date).getTime() - new Date(a.run_date).getTime()).slice(0, limit);
  },

  async getSearchRunById(id: string) {
    const runs = readSearchRuns();
    return runs.find((r) => r.id === id);
  },

  // Listings
  async insertListings(listings: Omit<Listing, "id" | "created_at">[]) {
    const existing = readListings();
    const newListings: Listing[] = listings.map((l) => ({
      id: uuidv4(),
      created_at: new Date().toISOString(),
      ...l,
    }));

    // Upsert: update if address + listing_type exists, otherwise insert
    const updated = [...existing];
    for (const newListing of newListings) {
      const existingIndex = updated.findIndex(
        (l) => l.address === newListing.address && l.listing_type === newListing.listing_type
      );
      if (existingIndex >= 0) {
        // Update existing
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...newListing,
          id: updated[existingIndex].id, // Keep original ID
          created_at: updated[existingIndex].created_at, // Keep original created_at
        };
      } else {
        // Insert new
        updated.push(newListing);
      }
    }

    writeListings(updated);
    return newListings;
  },

  async getListings(filters?: { listing_type?: string; location_area?: string }) {
    let listings = readListings();

    if (filters?.listing_type) {
      listings = listings.filter((l) => l.listing_type === filters.listing_type);
    }
    if (filters?.location_area) {
      listings = listings.filter((l) => l.location_area === filters.location_area);
    }

    return listings;
  },

  async getListingById(id: string) {
    const listings = readListings();
    return listings.find((l) => l.id === id);
  },

  async deleteListings(predicate: (l: Listing) => boolean) {
    const listings = readListings();
    const filtered = listings.filter((l) => !predicate(l));
    writeListings(filtered);
    return listings.length - filtered.length; // Return count deleted
  },

  async deleteAllTestListings() {
    const listings = readListings();
    const testListings = listings.filter(
      (l) =>
        l.address.toLowerCase().includes("test") ||
        l.address.toLowerCase().includes("seed") ||
        l.address.toLowerCase().includes("undisclosed") ||
        l.address.includes("TEST") ||
        (l.photos && JSON.stringify(l.photos).includes("example.com"))
    );

    const filtered = listings.filter((l) => !testListings.some((t) => t.id === l.id));
    writeListings(filtered);
    return testListings.length;
  },
};
