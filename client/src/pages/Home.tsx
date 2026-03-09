import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Lock, Search, RefreshCw, ExternalLink, ChevronDown, ChevronUp,
  Waves, MapPin, BedDouble, Bath, Eye, Phone, Mail, Building2, User,
  Home as HomeIcon, DollarSign, SlidersHorizontal, Calendar, Star,
  X, ChevronLeft, ChevronRight, Images, Mountain, TreePalm, Info
} from "lucide-react";
import { checkPassword, sha256, checkAuth } from "@/lib/auth";

interface SearchRun { id: string; run_date: string; listing_count: number; }
interface Photo { url: string; source: string; }
interface Listing {
  id: string; source: string; listing_type: string; address: string; price: number;
  bedrooms: number; bathrooms: number; sqft: number | null; ocean_view: boolean;
  ocean_view_description: string | null; status: string; description: string | null;
  agent_name: string | null; agent_brokerage: string | null; agent_phone: string | null;
  agent_email: string | null; listing_url: string | null; drive_folder_url: string | null;
  first_seen_date: string; last_seen_date: string; is_active: boolean; location_area: string;
  price_at_first_seen: number; photos?: Photo[];
}

// ─── Password Gate ────────────────────────────────────────────────────────────
function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError("");
    const ok = await checkPassword(password);
    if (ok) {
      const hash = await sha256(password);
      localStorage.setItem("maui_auth", hash);
      onAuth();
    } else {
      setError("Incorrect password");
    }
    setChecking(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0077B6] via-[#0096C7] to-[#F4E4C1] p-4">
      <Card className="w-full max-w-sm sm:max-w-md p-6 sm:p-8 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#0077B6]/10 mb-3 sm:mb-4">
            <Waves className="w-7 h-7 sm:w-8 sm:h-8 text-[#0077B6]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Maui Property Search</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">Enter password to access the dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12 text-base" autoFocus />
          </div>
          {error && <p className="text-sm text-[#FF6B6B] font-medium">{error}</p>}
          <Button type="submit" className="w-full h-12 text-base bg-[#0077B6] hover:bg-[#005F8A] text-white" disabled={checking}>
            {checking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Access Dashboard
          </Button>
        </form>
      </Card>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sourceName = (src: string) => {
  if (!src) return "Unknown";
  if (src.includes("realtor")) return "Realtor.com";
  if (src.includes("zillow")) return "Zillow";
  if (src.includes("craigslist")) return "Craigslist";
  if (src.includes("hawaiilife")) return "Hawaii Life";
  if (src.includes("zumper")) return "Zumper";
  if (src.includes("trulia")) return "Trulia";
  if (src.includes("redfin")) return "Redfin";
  return src.charAt(0).toUpperCase() + src.slice(1).replace(/\.(com|org|net)/, "");
};

const formatPrice = (price: number, type: string) =>
  type === "for_rent" ? `$${price.toLocaleString()}/mo` : `$${price.toLocaleString()}`;

const formatArea = (area: string) =>
  area?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "";

const formatDateShort = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

const OCEAN_VIEW_KEYWORDS = [
  "ocean view", "ocean views", "ocean glimpse", "panoramic ocean",
  "see the ocean", "unobstructed view", "ocean peek", "outer island views",
  "ocean vista", "pacific ocean", "views of the ocean",
];

const ANY_VIEW_KEYWORDS = [
  ...OCEAN_VIEW_KEYWORDS,
  "mountain view", "mountain views", "garden view", "garden views",
  "valley view", "valley views", "lanai view", "balcony view",
  "haleakala view", "west maui", "island view", "tropical view",
  "sunset view", "sunrise view", "scenic view", "panoramic view",
  "city view", "pool view", "courtyard view", "partial view",
];

function hasOceanView(listing: Listing): boolean {
  if (listing.ocean_view) return true;
  const text = `${listing.description || ""} ${listing.address || ""}`.toLowerCase();
  return OCEAN_VIEW_KEYWORDS.some((kw) => text.includes(kw));
}

function hasAnyView(listing: Listing): boolean {
  if (listing.ocean_view) return true;
  const text = `${listing.description || ""} ${listing.address || ""}`.toLowerCase();
  return ANY_VIEW_KEYWORDS.some((kw) => text.includes(kw));
}

// Location parent-child: Kihei and Wailea both include Maui Meadows
const LOCATION_CHILDREN: Record<string, string[]> = {
  kihei: ["maui_meadows"],
  wailea: ["maui_meadows"],
};

function matchesLocation(listing: Listing, filter: string): boolean {
  if (filter === "all") return true;
  const area = (listing.location_area || "").toLowerCase();
  if (area === filter) return true;
  // Check parent-child: if filter is "kihei", also match "maui_meadows"
  const children = LOCATION_CHILDREN[filter];
  if (children && children.some((child) => area === child || area.includes(child))) return true;
  // Partial match for Maui Meadows in address
  if (filter === "kihei" || filter === "wailea") {
    const addr = (listing.address || "").toLowerCase();
    if (addr.includes("maui meadows")) return true;
  }
  return false;
}

// ─── Photo Lightbox ───────────────────────────────────────────────────────────
function PhotoLightbox({
  photos, initialIndex, listingAddress, onClose,
}: { photos: Photo[]; initialIndex: number; listingAddress: string; onClose: () => void; }) {
  const [current, setCurrent] = useState(initialIndex);
  const total = photos.length;
  const prev = useCallback(() => setCurrent((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setCurrent((i) => (i + 1) % total), [total]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [onClose, prev, next]);

  const photo = photos[current];
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex items-center justify-between px-4 py-3 text-white/90 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{listingAddress}</p>
          <p className="text-xs text-white/60 mt-0.5">Source: <span className="text-white/80">{photo ? sourceName(photo.source) : ""}</span></p>
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <span className="text-sm text-white/70 font-mono">{current + 1} / {total}</span>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center relative min-h-0 px-12 sm:px-16">
        {photo && <img key={photo.url} src={photo.url} alt={`Photo ${current + 1}`} className="max-w-full max-h-full object-contain select-none" draggable={false} />}
        {total > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 sm:left-4 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white"><ChevronLeft className="w-6 h-6" /></button>
            <button onClick={next} className="absolute right-2 sm:right-4 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white"><ChevronRight className="w-6 h-6" /></button>
          </>
        )}
      </div>
      {photo && (
        <div className="flex justify-center pb-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium"><Images className="w-3 h-3" />{sourceName(photo.source)}</span>
        </div>
      )}
      {total > 1 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-4 flex-shrink-0 justify-center">
          {photos.map((p, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={`flex-shrink-0 w-12 h-9 sm:w-16 sm:h-12 rounded overflow-hidden border-2 transition-all ${i === current ? "border-white" : "border-transparent opacity-50 hover:opacity-80"}`}>
              <img src={p.url} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Photo Carousel on Card ──────────────────────────────────────────────────
function CardCarousel({ photos, onOpenLightbox, address }: { photos: Photo[]; onOpenLightbox: (photos: Photo[], index: number, address: string) => void; address: string }) {
  const [idx, setIdx] = useState(0);
  const total = photos.length;
  if (total === 0) return (
    <div className="aspect-[16/10] bg-gradient-to-br from-[#0077B6]/10 to-[#F4E4C1]/30 flex items-center justify-center">
      <HomeIcon className="w-12 h-12 text-muted-foreground/20" />
    </div>
  );

  return (
    <div className="aspect-[16/10] relative group overflow-hidden bg-muted">
      <img
        src={photos[idx].url}
        alt={address}
        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
        onClick={() => onOpenLightbox(photos, idx, address)}
        draggable={false}
      />
      {/* Source label */}
      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
        {sourceName(photos[idx].source)}
      </div>
      {/* Photo count */}
      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
        <Images className="w-2.5 h-2.5" /> {idx + 1}/{total}
      </div>
      {/* Arrows */}
      {total > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + total) % total); }}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          ><ChevronLeft className="w-4 h-4" /></button>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % total); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          ><ChevronRight className="w-4 h-4" /></button>
        </>
      )}
      {/* Dots */}
      {total > 1 && total <= 8 && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex gap-1">
          {photos.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-white" : "bg-white/40"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Listing Card (Realtor.com style) ────────────────────────────────────────
function ListingCard({
  listing, today, onOpenLightbox,
}: { listing: Listing; today: string; onOpenLightbox: (photos: Photo[], index: number, address: string) => void; }) {
  const [, setLocation] = useLocation();
  const isNew = listing.first_seen_date === today;
  const statusLower = listing.status?.toLowerCase() || "";
  const sc = statusLower === "active" ? "bg-emerald-100 text-emerald-700" : statusLower === "pending" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700";

  const photos: Photo[] = listing.photos || [];
  const isOcean = hasOceanView(listing);

  // Source buttons
  const sourceButtons: Array<{ label: string; url: string }> = [];
  if (listing.listing_url) sourceButtons.push({ label: `View on ${sourceName(listing.source)}`, url: listing.listing_url });
  if (listing.drive_folder_url) sourceButtons.push({ label: "Photos (Drive)", url: listing.drive_folder_url });

  // Photo source counts
  const photoSourceCounts = useMemo(() => {
    const map = new Map<string, number>();
    photos.forEach((p) => {
      const s = sourceName(p.source);
      map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map.entries());
  }, [photos]);

  return (
    <Card className="overflow-hidden border border-border/60 hover:shadow-lg transition-shadow duration-300 group bg-white">
      {/* Photo Carousel */}
      <div className="relative">
        <CardCarousel photos={photos} onOpenLightbox={onOpenLightbox} address={listing.address} />
        {/* Badges overlay */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc}`}>
            {listing.status ? listing.status.charAt(0).toUpperCase() + listing.status.slice(1) : "Unknown"}
          </span>
          {isOcean && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0077B6]/90 text-white flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" /> Ocean</span>
          )}
          {isNew && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF6B6B] text-white flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> NEW</span>
          )}
        </div>
      </div>

      {/* Card body — clickable to detail page */}
      <div
        className="p-3 sm:p-4 cursor-pointer"
        onClick={() => setLocation(`/listing/${listing.id}`)}
      >
        {/* Price */}
        <p className="text-lg sm:text-xl font-extrabold text-[#0077B6] leading-tight">
          {formatPrice(listing.price, listing.listing_type)}
        </p>

        {/* Bed/Bath/Sqft */}
        <div className="flex items-center gap-3 mt-1 text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> {listing.bedrooms}</span>
          <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {listing.bathrooms}</span>
          {listing.sqft && <span>{listing.sqft.toLocaleString()} sqft</span>}
        </div>

        {/* Address */}
        <p className="text-sm font-medium mt-1.5 truncate flex items-center gap-1">
          <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          {listing.address}
        </p>

        {/* Location area */}
        <p className="text-xs text-muted-foreground mt-0.5">{formatArea(listing.location_area)}</p>

        {/* Description snippet */}
        {listing.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{listing.description}</p>
        )}

        {/* Agent */}
        {listing.agent_name && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{listing.agent_name}</span>
            {listing.agent_brokerage && <span className="truncate">· {listing.agent_brokerage}</span>}
          </div>
        )}
      </div>

      {/* Photo source sub-buttons */}
      {photoSourceCounts.length > 0 && (
        <div className="px-3 sm:px-4 pb-2 flex flex-wrap gap-1.5">
          {photoSourceCounts.map(([src, count]) => (
            <button
              key={src}
              onClick={() => {
                const srcPhotos = photos.filter((p) => sourceName(p.source) === src);
                onOpenLightbox(srcPhotos, 0, listing.address);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 hover:bg-muted text-[10px] text-muted-foreground font-medium transition-colors"
            >
              <Images className="w-2.5 h-2.5" /> {src} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Source buttons */}
      <div className="px-3 sm:px-4 pb-3 flex flex-wrap gap-1.5">
        {sourceButtons.map((btn, i) => (
          <a key={i} href={btn.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" className="h-7 text-[10px] sm:text-xs gap-1 border-[#0077B6]/30 text-[#0077B6] hover:bg-[#0077B6]/5">
              <ExternalLink className="w-3 h-3" /> {btn.label}
            </Button>
          </a>
        ))}
      </div>
    </Card>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [searchRuns, setSearchRuns] = useState<SearchRun[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [sortBy, setSortBy] = useState("price_asc");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterBeds, setFilterBeds] = useState("0");
  const [filterBaths, setFilterBaths] = useState("0");
  const [viewFilter, setViewFilter] = useState<"none" | "ocean" | "any">("none");
  const [showInactive, setShowInactive] = useState(false);
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number; address: string } | null>(null);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Auth check
  useEffect(() => {
    checkAuth().then((ok) => { setAuthenticated(ok); setAuthChecked(true); });
  }, []);

  // Load search runs
  useEffect(() => {
    if (!authenticated) return;
    fetch("/api/search-runs").then((r) => r.json()).then((data) => {
      setSearchRuns(data);
      if (data.length > 0) {
        const todayRun = data.find((r: SearchRun) => r.run_date === today);
        setSelectedDate(todayRun ? todayRun.run_date : data[0].run_date);
      }
    }).catch(console.error);
  }, [authenticated, today]);

  // Load listings for selected date
  useEffect(() => {
    if (!selectedDate || !authenticated) return;
    setLoading(true);
    fetch(`/api/listings?date=${selectedDate}`).then((r) => r.json()).then((data) => {
      setListings(data);
      setLoading(false);
    }).catch((e) => { console.error(e); setLoading(false); });
  }, [selectedDate, authenticated]);

  // Refresh handler
  const handleRefresh = async () => {
    const REFRESH_KEY = "maui_refresh_log";
    const now = Date.now();
    const log: number[] = JSON.parse(localStorage.getItem(REFRESH_KEY) || "[]");
    const todayLog = log.filter((t) => now - t < 86400000);
    if (todayLog.length >= 3) {
      const nextAvail = new Date(todayLog[0] + 86400000);
      setRefreshError(`Limit reached (3/day). Next refresh available at ${nextAvail.toLocaleTimeString()}.`);
      return;
    }
    if (todayLog.length > 0 && now - todayLog[todayLog.length - 1] < 1800000) {
      const nextAvail = new Date(todayLog[todayLog.length - 1] + 1800000);
      setRefreshError(`Please wait 30 minutes between refreshes. Next: ${nextAvail.toLocaleTimeString()}.`);
      return;
    }
    setRefreshError("");
    setRefreshing(true);
    try {
      const r = await fetch("/api/search", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Search failed");
      todayLog.push(now);
      localStorage.setItem(REFRESH_KEY, JSON.stringify(todayLog));
      // Reload
      const runsR = await fetch("/api/search-runs");
      const runs = await runsR.json();
      setSearchRuns(runs);
      setSelectedDate(today);
      const listR = await fetch(`/api/listings?date=${today}`);
      setListings(await listR.json());
    } catch (e: any) {
      setRefreshError(e.message || "Search failed");
    }
    setRefreshing(false);
  };

  // Dynamic location areas from loaded listings
  const locationAreas = useMemo(() => {
    const areas = new Set<string>();
    listings.forEach((l) => { if (l.location_area) areas.add(l.location_area.toLowerCase()); });
    return Array.from(areas).sort();
  }, [listings]);

  // Filtered + sorted listings
  const filteredListings = useMemo(() => {
    let result = listings.filter((l) => l.is_active);
    // Location filter with parent-child
    if (filterLocation !== "all") result = result.filter((l) => matchesLocation(l, filterLocation));
    // Beds
    const minBeds = parseInt(filterBeds);
    if (minBeds > 0) result = result.filter((l) => l.bedrooms >= minBeds);
    // Baths
    const minBaths = parseInt(filterBaths);
    if (minBaths > 0) result = result.filter((l) => l.bathrooms >= minBaths);
    // View filter
    if (viewFilter === "ocean") result = result.filter(hasOceanView);
    else if (viewFilter === "any") result = result.filter(hasAnyView);
    // Sort
    result.sort((a, b) => sortBy === "price_asc" ? a.price - b.price : b.price - a.price);
    return result;
  }, [listings, filterLocation, filterBeds, filterBaths, viewFilter, sortBy]);

  const sale = useMemo(() => filteredListings.filter((l) => l.listing_type === "for_sale"), [filteredListings]);
  const rent = useMemo(() => filteredListings.filter((l) => l.listing_type === "for_rent"), [filteredListings]);
  const inactive = useMemo(() => listings.filter((l) => !l.is_active), [listings]);

  const openLightbox = useCallback((photos: Photo[], index: number, address: string) => {
    setLightbox({ photos, index, address });
  }, []);

  if (!authChecked) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0077B6] to-[#F4E4C1]">
      <Loader2 className="w-8 h-8 animate-spin text-white" />
    </div>
  );
  if (!authenticated) return <PasswordGate onAuth={() => setAuthenticated(true)} />;

  return (
    <>
      {lightbox && (
        <PhotoLightbox photos={lightbox.photos} initialIndex={lightbox.index} listingAddress={lightbox.address} onClose={() => setLightbox(null)} />
      )}

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border/50">
          <div className="container py-3 sm:py-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#0077B6] to-[#005F8A] flex items-center justify-center flex-shrink-0">
                  <Waves className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-xl font-bold leading-tight truncate">Maui Property Search</h1>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {selectedDate ? `Results for ${formatDateShort(selectedDate)}` : "All of Maui Island"}
                    {listings.length > 0 && ` · ${listings.filter((l) => l.is_active).length} active`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button onClick={handleRefresh} disabled={refreshing} className="bg-[#0077B6] hover:bg-[#005F8A] text-white gap-1.5 text-xs sm:text-sm" size="sm">
                  {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Refresh Listings</span>
                  <span className="sm:hidden">Refresh</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("maui_auth"); setAuthenticated(false); }} className="text-muted-foreground" title="Lock">
                  <Lock className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {refreshError && <p className="text-xs sm:text-sm text-[#FF6B6B] mt-2 font-medium">{refreshError}</p>}
          </div>
        </header>

        <main className="container py-4 sm:py-6 space-y-4 sm:space-y-6">
          {/* Search Criteria Card */}
          <Card className="p-4 sm:p-5 bg-gradient-to-r from-[#F4E4C1]/50 to-[#F4E4C1]/30 border-[#F4E4C1]">
            <div className="flex items-start gap-3">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-[#0077B6] mt-0.5 flex-shrink-0" />
              <div className="space-y-2 min-w-0">
                <h2 className="font-semibold text-sm sm:text-base">Search Criteria</h2>
                <div className="grid sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div className="space-y-0.5">
                    <p className="font-medium text-[#0077B6] flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> For Sale</p>
                    <p className="text-muted-foreground">All of Maui Island (Maui Meadows preferred)</p>
                    <p className="text-muted-foreground">Max $1.1M · 1+ bed, 1+ bath</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-medium text-[#FF6B6B] flex items-center gap-1.5"><HomeIcon className="w-3.5 h-3.5" /> For Rent</p>
                    <p className="text-muted-foreground">All of Maui Island (Maui Meadows preferred)</p>
                    <p className="text-muted-foreground">Max $6,000/mo · 1+ bed, 1+ bath</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Header Blurb */}
          <div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-[#0077B6]/5 border border-[#0077B6]/10">
            <Info className="w-4 h-4 text-[#0077B6] mt-0.5 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-[#0077B6]/80 leading-relaxed">
              Listings are aggregated from all major sources including Realtor.com, Zillow, Redfin, Craigslist, Hawaii Life, and more. Photos and listing text are collected from every available source and combined into each listing for your convenience.
            </p>
          </div>

          {/* Calendar Date Strip */}
          {searchRuns.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {searchRuns.map((run) => (
                <button
                  key={run.id}
                  onClick={() => setSelectedDate(run.run_date)}
                  className={`flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    selectedDate === run.run_date ? "bg-[#0077B6] text-white shadow-md" : "bg-white text-foreground border border-border hover:border-[#0077B6]/30"
                  }`}
                >
                  <span className="flex items-center gap-1 sm:gap-1.5">
                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {formatDateShort(run.run_date)}
                    <span className={`text-xs ${selectedDate === run.run_date ? "text-white/80" : "text-muted-foreground"}`}>· {run.listing_count}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* View Toggle Buttons — prominent */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setViewFilter(viewFilter === "ocean" ? "none" : "ocean")}
              className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm sm:text-base font-bold transition-all border-2 ${
                viewFilter === "ocean"
                  ? "bg-[#0077B6] text-white border-[#0077B6] shadow-lg shadow-[#0077B6]/30"
                  : "bg-white text-[#0077B6] border-[#0077B6]/30 hover:border-[#0077B6]/60 hover:bg-[#0077B6]/5"
              }`}
            >
              <Waves className="w-5 h-5 sm:w-6 sm:h-6" />
              Ocean View
            </button>
            <button
              onClick={() => setViewFilter(viewFilter === "any" ? "none" : "any")}
              className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm sm:text-base font-bold transition-all border-2 ${
                viewFilter === "any"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/30"
                  : "bg-white text-emerald-700 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50"
              }`}
            >
              <Mountain className="w-5 h-5 sm:w-6 sm:h-6" />
              Any View
            </button>
          </div>

          {/* Filters */}
          <Card className="p-3 sm:p-4 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px] sm:w-[160px] h-9 text-xs sm:text-sm bg-white"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-[140px] sm:w-[170px] h-9 text-xs sm:text-sm bg-white"><SelectValue placeholder="Location" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Maui</SelectItem>
                  {locationAreas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {formatArea(area)}
                      {(area === "kihei" || area === "wailea") ? " (incl. Maui Meadows)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterBeds} onValueChange={setFilterBeds}>
                <SelectTrigger className="w-[100px] sm:w-[110px] h-9 text-xs sm:text-sm bg-white"><SelectValue placeholder="Beds" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any Beds</SelectItem>
                  <SelectItem value="1">1+ Beds</SelectItem>
                  <SelectItem value="2">2+ Beds</SelectItem>
                  <SelectItem value="3">3+ Beds</SelectItem>
                  <SelectItem value="4">4+ Beds</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterBaths} onValueChange={setFilterBaths}>
                <SelectTrigger className="w-[100px] sm:w-[110px] h-9 text-xs sm:text-sm bg-white"><SelectValue placeholder="Baths" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any Baths</SelectItem>
                  <SelectItem value="1">1+ Baths</SelectItem>
                  <SelectItem value="2">2+ Baths</SelectItem>
                  <SelectItem value="3">3+ Baths</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Listings */}
          {loading ? (
            <div className="flex items-center justify-center py-16 sm:py-20">
              <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-[#0077B6]" />
              <span className="ml-3 text-muted-foreground text-sm">Loading listings...</span>
            </div>
          ) : (
            <Tabs defaultValue="for_sale" className="w-full">
              <TabsList className="w-full max-w-sm sm:max-w-md bg-muted/50">
                <TabsTrigger value="for_sale" className="flex-1 gap-1 sm:gap-1.5 text-xs sm:text-sm data-[state=active]:bg-[#0077B6] data-[state=active]:text-white">
                  <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> For Sale ({sale.length})
                </TabsTrigger>
                <TabsTrigger value="for_rent" className="flex-1 gap-1 sm:gap-1.5 text-xs sm:text-sm data-[state=active]:bg-[#FF6B6B] data-[state=active]:text-white">
                  <HomeIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> For Rent ({rent.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="for_sale" className="mt-4">
                {sale.length === 0 ? (
                  <Card className="p-10 sm:p-12 text-center">
                    <Search className="w-9 h-9 sm:w-10 sm:h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No listings found for this date and filters.</p>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {sale.map((l) => <ListingCard key={l.id} listing={l} today={today} onOpenLightbox={openLightbox} />)}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="for_rent" className="mt-4">
                {rent.length === 0 ? (
                  <Card className="p-10 sm:p-12 text-center">
                    <Search className="w-9 h-9 sm:w-10 sm:h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No listings found for this date and filters.</p>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rent.map((l) => <ListingCard key={l.id} listing={l} today={today} onOpenLightbox={openLightbox} />)}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* No Longer Listed */}
          <div className="border-t border-border/50 pt-4">
            <button onClick={() => setShowInactive(!showInactive)} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {showInactive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              No Longer Listed ({inactive.length})
            </button>
            {showInactive && (
              inactive.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No delisted properties in the last 14 days.</p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-70">
                  {inactive.map((l) => <ListingCard key={l.id} listing={l} today={today} onOpenLightbox={openLightbox} />)}
                </div>
              )
            )}
          </div>
        </main>

        <footer className="border-t border-border/50 py-5 mt-8">
          <div className="container text-center text-xs text-muted-foreground">
            Maui Property Search · All of Maui Island · Data sourced live from real estate platforms
          </div>
        </footer>
      </div>
    </>
  );
}
