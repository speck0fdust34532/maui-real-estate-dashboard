# Maui Real Estate Dashboard

A modern, full-stack property search dashboard for Maui County, Hawaii. Aggregates real estate listings from multiple sources including Realtor.com, Zillow, Redfin, and more. Built with React 19, Node.js, tRPC, and Tailwind CSS.

## Features

- **Comprehensive Property Search** — Search across all 17 Maui County zip codes (Maui, Molokai, Lanai)
- **Multi-Source Aggregation** — Listings from Realtor.com, Zillow, Redfin, Craigslist, Hawaii Life, and more
- **High-Resolution Photos** — Full-res photo galleries (276KB+) from Realtor.com CDN
- **Advanced Filtering** — Filter by location, beds, baths, price range, property type (houses, apartments, condos), and view type
- **Real-Time Search** — Trigger live searches with rate limiting (max 3 per day, 30-min cooldown)
- **Responsive Design** — Mobile-optimized interface with smooth interactions
- **Password-Protected** — SHA-256 authentication for dashboard access
- **Price Thresholds** — Only shows properties ≤$1.1M (for sale) or ≤$6,000/mo (for rent)

## Tech Stack

### Frontend
- **React 19** — UI framework
- **Tailwind CSS 4** — Styling with OKLCH color support
- **shadcn/ui** — Pre-built component library
- **Vite** — Build tool and dev server
- **Wouter** — Lightweight routing
- **TanStack Query** — Server state management

### Backend
- **Node.js 22** — Runtime
- **Express 4** — HTTP server
- **tRPC 11** — End-to-end type-safe APIs
- **Drizzle ORM** — Database abstraction
- **MySQL/TiDB** — Primary database (Supabase)
- **JSON File Storage** — Local fallback for listings

### APIs & Services
- **Realtor16 API** (RapidAPI) — Primary property data source
- **Manus OAuth** — Authentication
- **Manus LLM API** — AI integrations (optional)
- **Google Maps API** — Map integrations (via Manus proxy)

## Project Structure

```
maui-dashboard/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/            # Page components (Home, NotFound)
│   │   ├── components/       # Reusable UI components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities (auth, trpc client)
│   │   ├── _core/            # Core hooks (useAuth)
│   │   ├── App.tsx           # Route definitions
│   │   ├── main.tsx          # Entry point
│   │   └── index.css         # Global styles
│   ├── public/               # Static assets (favicon, robots.txt)
│   └── index.html            # HTML template
├── server/                    # Node.js backend
│   ├── _core/                # Framework plumbing (OAuth, context, LLM, etc.)
│   ├── db.ts                 # Database query helpers
│   ├── routers.ts            # tRPC procedure definitions
│   ├── apiRoutes.ts          # REST API routes (search, listings)
│   ├── jsonDb.ts             # JSON file storage abstraction
│   ├── photoScraper.ts       # Photo extraction utilities
│   └── storage.ts            # S3 file storage helpers
├── drizzle/                   # Database schema & migrations
│   ├── schema.ts             # Table definitions
│   └── migrations/           # Migration files
├── shared/                    # Shared types & constants
│   ├── types.ts              # Shared TypeScript types
│   └── const.ts              # Constants
├── vitest.config.ts          # Test configuration
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies
├── .gitignore                # Git ignore rules
└── README.md                 # This file
```

## Setup & Installation

### Prerequisites
- Node.js 22.x or higher
- pnpm (recommended) or npm
- MySQL/TiDB database (or use local JSON storage)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/maui-real-estate-dashboard.git
   cd maui-real-estate-dashboard
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the project root:
   ```env
   # Database
   DATABASE_URL=mysql://user:password@localhost:3306/maui_dashboard
   
   # OAuth
   VITE_APP_ID=your_oauth_app_id
   OAUTH_SERVER_URL=https://api.manus.im
   VITE_OAUTH_PORTAL_URL=https://manus.im/login
   JWT_SECRET=your_jwt_secret
   
   # APIs
   RAPIDAPI_KEY=your_rapidapi_key
   BUILT_IN_FORGE_API_KEY=your_forge_api_key
   BUILT_IN_FORGE_API_URL=https://api.manus.im
   
   # Frontend
   VITE_APP_TITLE=Maui Property Search
   VITE_FRONTEND_FORGE_API_KEY=your_frontend_key
   VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
   
   # Owner info
   OWNER_NAME=Your Name
   OWNER_OPEN_ID=your_open_id
   ```

4. **Push database schema**
   ```bash
   pnpm db:push
   ```

5. **Start development server**
   ```bash
   pnpm dev
   ```
   
   Frontend: http://localhost:5173
   Backend: http://localhost:3000

### Building for Production

```bash
pnpm build
```

Outputs:
- `dist/` — Vite build (React frontend)
- `dist/index.js` — esbuild output (Node.js backend)

## Usage

### Searching for Properties

1. Enter the dashboard password
2. Select a date from the calendar to view listings from that search run
3. Use filters to narrow results:
   - **Location** — All Maui County or specific areas (Maui Meadows, Kihei, etc.)
   - **Beds/Baths** — Minimum bedroom and bathroom count
   - **Price Range** — Min/max price filters
   - **Property Type** — Toggle apartments and condos (default: houses only)
   - **View Type** — Ocean view, any view, or all listings
4. Click on a listing card to see full details and photo gallery
5. Use "Refresh" button to trigger a new search (max 3/day, 30-min cooldown)

### API Endpoints

#### Search
- `POST /api/search` — Trigger comprehensive search across all Maui County zip codes

#### Listings
- `GET /api/listings?date=YYYY-MM-DD` — Get all listings from a specific search run
- `GET /api/listings/:id` — Get a single listing by ID

#### Search Runs
- `GET /api/search-runs` — Get all search run dates and listing counts

## Database Schema

### listings
- `id` — Unique identifier
- `source` — Data source (realtor.com, zillow, etc.)
- `listing_type` — "for_sale" or "for_rent"
- `address` — Full property address
- `price` — List price or monthly rent
- `bedrooms`, `bathrooms` — Property specs
- `sqft` — Square footage (nullable)
- `ocean_view` — Boolean flag
- `ocean_view_description` — Description if ocean view
- `status` — "Active", "Pending", "Sold", etc.
- `description` — Full listing description
- `agent_name`, `agent_brokerage`, `agent_phone`, `agent_email` — Agent info
- `listing_url` — Link to original listing
- `photos` — JSONB array of `{url, source}` objects
- `first_seen_date`, `last_seen_date` — Tracking dates
- `is_active` — Current status
- `location_area` — Maui County area (Kihei, Maui Meadows, etc.)

### search_runs
- `id` — Unique identifier
- `run_date` — Date of search run (YYYY-MM-DD)
- `listing_count` — Total listings found
- `created_at` — Timestamp

## Testing

Run the test suite:
```bash
pnpm test
```

Tests are located in `server/*.test.ts` files and use Vitest.

## Deployment

### Manus Platform
This project is optimized for deployment on Manus:
1. Save a checkpoint in the Manus dashboard
2. Click "Publish" to deploy to production
3. Custom domain support available

### Other Platforms
For deployment to Railway, Render, Vercel, or other platforms:
1. Build the project: `pnpm build`
2. Set environment variables on your platform
3. Run: `node dist/index.js`

## Rate Limiting

- **Search Refresh**: Max 3 per day, 30-minute cooldown between searches
- **API Calls**: Realtor16 API has built-in rate limiting (2.5s between pages, 1.5s between locations)
- **Photo Extraction**: Automatic retry with exponential backoff

## Price Thresholds

The dashboard only stores and displays properties within these price ranges:
- **For Sale**: ≤ $1,100,000
- **For Rent**: ≤ $6,000/month

Properties outside these ranges are filtered out during search to keep the database focused on mid-market properties.

## Known Limitations

1. **Ocean View Data** — The Realtor16 API does not consistently return ocean view information. Ocean view filters will work once data becomes available.
2. **Photo Coverage** — Some listings may have limited photo availability from the API. The dashboard uses high-resolution CDN URLs (276KB–1.2MB per photo).
3. **Real-Time Updates** — Listings are updated via manual search triggers, not real-time streaming.

## Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is provided as-is for personal and educational use. See LICENSE file for details.

## Support

For issues, questions, or feature requests, please open a GitHub issue or contact the project maintainer.

## Acknowledgments

- Data sourced from Realtor.com, Zillow, Redfin, Craigslist, and Hawaii Life
- Built with React, Node.js, and Tailwind CSS
- Hosted on Manus platform
- Photos from Realtor.com CDN (ap.rdcpix.com)

---

**Last Updated:** March 2026  
**Version:** 1.0.0
