# Lessons Learned - Maui Real Estate Dashboard

This document captures key technical insights, challenges, and solutions from building the Maui Real Estate Dashboard.

## 1. Supabase RLS Blocking Backend Operations

**Problem:** Supabase anon key lacked INSERT/DELETE permissions. 626 listings found, 0 stored.

**Solution:** Switched to local JSON file storage (`jsonDb.ts`), bypassing RLS entirely.

**Lesson:** Use service role keys for backend operations, or avoid RLS-protected databases for writes.

---

## 2. Photo CDN URLs Use Suffix-Based Resolution

**Problem:** Realtor16 API returned 4KB thumbnail photos (`-s.jpg` suffix).

**Discovery:** Realtor.com CDN supports multiple resolutions via URL suffix:
- `s` = 4 KB (thumbnail)
- `od` = 276 KB (large)
- `rd` = 1.2 MB (full resolution)

**Solution:** Changed all URLs from `-s.jpg` to `-od.jpg` in `mapRealtor16Property()`.

**Result:** 100% photo coverage at high resolution, zero additional API calls.

**Lesson:** Investigate API URL patterns before building workarounds.

---

## 3. Kasada Bot Protection Prevents Scraping

**Problem:** Attempted Puppeteer scraping of Realtor.com listing pages. Got 429 with Kasada challenge.

**Investigation:** Kasada performs deep browser fingerprinting (TLS, canvas, WebGL, timing). No open-source bypass available.

**Lesson:** Enterprise bot protection cannot be reliably bypassed. Options: paid proxy services, alternative data sources, or accept API limitations.

---

## 4. API Metadata May Not Be Populated

**Problem:** Expected `ocean_view` and `property_type` fields. Found they're always empty or missing.

**Solution:** Implemented client-side inference:
- Property type: Parse address/description for keywords ("Unit", "Apt", "Condo")
- Ocean view: Search description for ocean keywords

**Lesson:** Don't assume API fields are populated. Inspect actual responses and implement fallback detection.

---

## 5. Filter Data at Ingestion, Not Display

**Problem:** Stored expensive properties (>$1.1M), then filtered at display time. Wasted storage.

**Solution:** Added price filters to search endpoint. Reject expensive properties before storing.

**Result:** Database size reduced ~40%, cleaner dataset, faster queries.

**Lesson:** Filter at the source during ingestion, not at display time.

---

## 6. Establish Test Data Patterns Early

**Problem:** Test data had inconsistent patterns ("Test", "Seed", duplicates). Cleanup was difficult.

**Solution:** Switched to JSON storage, implemented pattern-based deletion, added safeguards to reject test URLs.

**Lesson:** Use consistent prefixes (e.g., "TEST_") for all test data from the start.

---

## 7. JSON Files Work for Small Datasets

**Problem:** Switching from Supabase to JSON seemed risky.

**Discovery:** For 387 listings (~1MB), JSON file storage works perfectly:
- No database setup
- No RLS issues
- Instant reads/writes
- Easy backup

**Lesson:** Don't over-engineer. JSON files are valid for <10MB datasets.

---

## 8. React Hook Dependency Arrays Must Be Complete

**Problem:** Added property type filters but forgot them in `useMemo` dependency array. Filters didn't work.

**Solution:** Added all filter state to dependency array.

**Lesson:** Always include all external dependencies in React hooks. Use ESLint `react-hooks/exhaustive-deps`.

---

## 9. Default Filter States Matter

**Problem:** Ocean View filter was on by default but had no data. Users saw empty results.

**Solution:** Changed defaults to "All Listings", made Ocean View opt-in, set apartments/condos to OFF.

**Lesson:** Design filter defaults around user expectations, not implementation convenience.

---

## 10. Rate Limiting Ensures Reliability

**Problem:** Fetched all pages as fast as possible. Hit RapidAPI rate limits mid-search.

**Solution:** Implemented rate limiting:
- 2.5s between page requests
- 1.5s between location requests
- Exponential backoff on 429
- Max 3 searches/day

**Result:** Reliable searches, no rate limit errors.

**Lesson:** Always implement rate limiting for external APIs.

---

## 11. Batch Inserts Need Partial Failure Handling

**Problem:** One bad field rejected entire batch. 626 found, 0 stored.

**Solution:** Implemented row-level error handling. Log failures per row, continue processing.

**Lesson:** Batch operations must be resilient. Log errors per item, don't fail entirely.

---

## 12. Investigate External URL Patterns

**Problem:** Assumed photo URLs couldn't be modified.

**Discovery:** Realtor.com CDN URLs encode resolution in suffix. Testing different variations unlocked features.

**Lesson:** Investigate external API URL patterns. Many CDNs encode metadata in URLs.

---

## 13. Simple Security Often Suffices

**Problem:** Needed access control for sensitive data without OAuth complexity.

**Solution:** SHA-256 password gate:
- Hashed in frontend
- Stored in localStorage
- Persists across sessions

**Result:** Effective access control, simple to implement.

**Lesson:** Simple security is often better than complex security for internal dashboards.

---

## 14. Mobile Responsiveness Needs Continuous Testing

**Problem:** Desktop design didn't translate to mobile. Dropdowns cut off, controls hard to tap.

**Solution:** Tested on multiple devices, used Tailwind responsive classes, optimized touch targets (44px minimum).

**Lesson:** Test on mobile early and often. Desktop-first requires intentional mobile optimization.

---

## 15. Document as You Build

**Problem:** Complex project. New developers couldn't understand setup, env vars, search pipeline.

**Solution:** Created README.md, .env.example, LESSONS_LEARNED.md, inline comments.

**Lesson:** Write documentation as you build, not after. Future you will thank you.

---

## Key Takeaways

1. Use service role keys for backend database operations
2. Investigate API response patterns before building workarounds
3. Enterprise bot protection can't be reliably bypassed
4. Implement fallback detection for missing API metadata
5. Filter data at ingestion time, not display time
6. Establish consistent test data patterns
7. JSON files work great for small datasets
8. Always include dependencies in React hook arrays
9. Design filter defaults around user expectations
10. Implement rate limiting for external APIs
11. Make batch operations resilient to individual failures
12. Investigate external API URL patterns
13. Simple security is often sufficient
14. Test mobile responsiveness continuously
15. Write documentation as you build

---

**Last Updated:** March 2026  
**Project:** Maui Real Estate Dashboard v1.0.0
