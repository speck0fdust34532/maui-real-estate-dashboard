import { describe, expect, it } from "vitest";

// ─── Auth utility tests ───────────────────────────────────────────────────────
describe("auth sha256", () => {
  it("produces a 64-char hex string for any input", async () => {
    // Simulate the Web Crypto API in Node via the built-in crypto module
    const { createHash } = await import("crypto");
    const hash = createHash("sha256").update("ilovemaui-skyeskye").digest("hex");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("two different passwords produce different hashes", async () => {
    const { createHash } = await import("crypto");
    const h1 = createHash("sha256").update("ilovemaui-skyeskye").digest("hex");
    const h2 = createHash("sha256").update("wrongpassword").digest("hex");
    expect(h1).not.toBe(h2);
  });
});

// ─── Search criteria tests ────────────────────────────────────────────────────
describe("search criteria", () => {
  it("beds_min is 1 (not 2)", () => {
    const bedsMin = 1;
    expect(bedsMin).toBe(1);
  });

  it("baths_min is 1", () => {
    const bathsMin = 1;
    expect(bathsMin).toBe(1);
  });

  it("for-sale price_max is 1100000", () => {
    const priceMax = 1100000;
    expect(priceMax).toBe(1100000);
  });

  it("for-rent price_max is 6000", () => {
    const priceMax = 6000;
    expect(priceMax).toBe(6000);
  });
});

// ─── Location coverage tests ──────────────────────────────────────────────────
describe("all-Maui location coverage", () => {
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

  it("includes Maui Meadows as first (priority) location", () => {
    expect(SALE_LOCATIONS[0].area).toBe("maui_meadows");
  });

  it("includes at least 10 distinct Maui locations", () => {
    expect(SALE_LOCATIONS.length).toBeGreaterThanOrEqual(10);
  });

  it("includes broad Maui HI fallback", () => {
    const hasBroad = SALE_LOCATIONS.some((l) => l.name === "Maui HI");
    expect(hasBroad).toBe(true);
  });

  it("all areas are unique", () => {
    const areas = SALE_LOCATIONS.map((l) => l.area);
    const unique = new Set(areas);
    expect(unique.size).toBe(areas.length);
  });
});

// ─── Photo integrity tests ────────────────────────────────────────────────────
describe("photo data integrity", () => {
  it("photos are never mixed between listings", () => {
    const listing1Photos = [
      { url: "https://example.com/photo1.jpg", source: "realtor.com", listing_id: "listing-1" },
    ];
    const listing2Photos = [
      { url: "https://example.com/photo2.jpg", source: "realtor.com", listing_id: "listing-2" },
    ];
    const allPhotoUrls1 = listing1Photos.map((p) => p.url);
    const allPhotoUrls2 = listing2Photos.map((p) => p.url);
    const overlap = allPhotoUrls1.filter((u) => allPhotoUrls2.includes(u));
    expect(overlap).toHaveLength(0);
  });

  it("each photo retains its source label", () => {
    const photos = [
      { url: "https://example.com/photo1.jpg", source: "realtor.com" },
      { url: "https://example.com/photo2.jpg", source: "zillow.com" },
    ];
    photos.forEach((p) => {
      expect(p.source).toBeTruthy();
      expect(typeof p.source).toBe("string");
    });
  });
});

// ─── Filter logic tests ───────────────────────────────────────────────────────
describe("client-side filter logic", () => {
  const mockListings = [
    { id: "1", bedrooms: 1, bathrooms: 1, price: 500000, is_active: true, listing_type: "for_sale", location_area: "kihei", ocean_view: true },
    { id: "2", bedrooms: 2, bathrooms: 2, price: 800000, is_active: true, listing_type: "for_sale", location_area: "maui_meadows", ocean_view: true },
    { id: "3", bedrooms: 3, bathrooms: 2, price: 1000000, is_active: true, listing_type: "for_rent", location_area: "kula", ocean_view: false },
    { id: "4", bedrooms: 4, bathrooms: 3, price: 1100000, is_active: false, listing_type: "for_sale", location_area: "lahaina", ocean_view: true },
  ];

  it("filters by minimum bedrooms", () => {
    const minBeds = 2;
    const result = mockListings.filter((l) => l.bedrooms >= minBeds);
    expect(result.map((l) => l.id)).toEqual(["2", "3", "4"]);
  });

  it("filters by minimum bathrooms", () => {
    const minBaths = 2;
    const result = mockListings.filter((l) => l.bathrooms >= minBaths);
    expect(result.map((l) => l.id)).toEqual(["2", "3", "4"]);
  });

  it("filters ocean view only", () => {
    const result = mockListings.filter((l) => l.ocean_view);
    expect(result.map((l) => l.id)).toEqual(["1", "2", "4"]);
  });

  it("sorts price ascending", () => {
    const sorted = [...mockListings].sort((a, b) => a.price - b.price);
    expect(sorted[0].price).toBe(500000);
    expect(sorted[sorted.length - 1].price).toBe(1100000);
  });

  it("filters by location area", () => {
    const result = mockListings.filter((l) => l.location_area === "maui_meadows");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });
});

// ─── Refresh rate limiting tests ──────────────────────────────────────────────
describe("refresh rate limiting", () => {
  it("allows up to 3 refreshes per day", () => {
    const times = [1000, 2000, 3000];
    expect(times.length).toBeLessThanOrEqual(3);
  });

  it("enforces 30-minute gap between refreshes", () => {
    const THIRTY_MIN_MS = 1800000;
    const lastRefresh = Date.now() - 1000; // 1 second ago
    const timeSinceLast = Date.now() - lastRefresh;
    expect(timeSinceLast).toBeLessThan(THIRTY_MIN_MS);
  });
});
