import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Lock, Search, RefreshCw, ExternalLink, ChevronDown, ChevronUp,
  Waves, MapPin, BedDouble, Bath, Eye, Phone, Mail, Building2, User,
  Home as HomeIcon, DollarSign, SlidersHorizontal, Calendar, Star,
  X, ChevronLeft, ChevronRight, Images
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
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12 text-base"
              autoFocus
            />
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
  area.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const formatDateShort = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

// ─── Photo Lightbox ───────────────────────────────────────────────────────────
function PhotoLightbox({
  photos,
  initialIndex,
  listingAddress,
  onClose,
}: {
  photos: Photo[];
  initialIndex: number;
  listingAddress: string;
  onClose: () => void;
}) {
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
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const photo = photos[current];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white/90 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{listingAddress}</p>
          <p className="text-xs text-white/60 mt-0.5">
            Source: <span className="text-white/80">{photo ? sourceName(photo.source) : ""}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <span className="text-sm text-white/70 font-mono">{current + 1} / {total}</span>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 px-12 sm:px-16">
        {photo && (
          <img
            key={photo.url}
            src={photo.url}
            alt={`Photo ${current + 1} of ${total} — ${listingAddress}`}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />
        )}

        {/* Prev / Next arrows */}
        {total > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 sm:left-4 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 sm:right-4 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </>
        )}
      </div>

      {/* Source label badge */}
      {photo && (
        <div className="flex justify-center pb-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium">
            <Images className="w-3 h-3" />
            {sourceName(photo.source)}
          </span>
        </div>
      )}

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-4 flex-shrink-0 justify-center">
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`flex-shrink-0 w-12 h-9 sm:w-16 sm:h-12 rounded overflow-hidden border-2 transition-all ${
                i === current ? "border-white" : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <img src={p.url} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────
function ListingCard({
  listing,
  today,
  onOpenLightbox,
}: {
  listing: Listing;
  today: string;
  onOpenLightbox: (photos: Photo[], index: number, address: string) => void;
}) {
  const isNew = listing.first_seen_date === today;
  const statusLower = listing.status?.toLowerCase() || "";
  const sc =
    statusLower === "active"
      ? "bg-emerald-100 text-emerald-700"
      : statusLower === "pending"
      ? "bg-amber-100 text-amber-700"
      : "bg-blue-100 text-blue-700";

  const photos: Photo[] = listing.photos || [];
  const hasPhotos = photos.length > 0;
  const coverPhoto = photos[0];

  // Determine all unique source URLs for multi-source buttons
  // Currently each listing has one source + one listing_url, but structure supports multiple
  const sourceButtons: Array<{ label: string; url: string }> = [];
  if (listing.listing_url) {
    sourceButtons.push({ label: `View on ${sourceName(listing.source)}`, url: listing.listing_url });
  }
  if (listing.drive_folder_url) {
    sourceButtons.push({ label: "View Photos (Drive)", url: listing.drive_folder_url });
  }

  return (
    <Card className="overflow-hidden border border-border/60 hover:shadow-lg transition-all duration-300 bg-card flex flex-col">
      {/* Cover photo */}
      {hasPhotos && coverPhoto && (
        <div
          className="relative w-full h-44 sm:h-48 overflow-hidden cursor-pointer group bg-muted"
          onClick={() => onOpenLightbox(photos, 0, listing.address)}
        >
          <img
            src={coverPhoto.url}
            alt={`${listing.address} — photo from ${sourceName(coverPhoto.source)}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            <Images className="w-3 h-3" />
            {photos.length}
          </div>
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            {sourceName(coverPhoto.source)}
          </div>
        </div>
      )}

      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc}`}>
            {listing.status ? listing.status.charAt(0).toUpperCase() + listing.status.slice(1) : "Unknown"}
          </span>
          {listing.ocean_view && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0077B6]/10 text-[#0077B6]">
              <Eye className="w-3 h-3" /> Ocean View
            </span>
          )}
          {isNew && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FF6B6B]/10 text-[#FF6B6B]">
              <Star className="w-3 h-3 mr-0.5" /> NEW
            </span>
          )}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            <MapPin className="w-3 h-3 mr-0.5" /> {formatArea(listing.location_area)}
          </span>
        </div>

        <h3 className="font-bold text-base sm:text-lg leading-tight mb-1">{listing.address}</h3>
        <p className="text-xl sm:text-2xl font-extrabold text-[#0077B6] mb-3">
          {formatPrice(listing.price, listing.listing_type)}
        </p>

        <div className="flex gap-3 sm:gap-4 text-sm text-muted-foreground mb-3 flex-wrap">
          <span className="flex items-center gap-1"><BedDouble className="w-4 h-4" /> {listing.bedrooms} bed</span>
          <span className="flex items-center gap-1"><Bath className="w-4 h-4" /> {listing.bathrooms} bath</span>
          {listing.sqft && (
            <span className="flex items-center gap-1"><HomeIcon className="w-4 h-4" /> {listing.sqft.toLocaleString()} sqft</span>
          )}
        </div>

        {listing.ocean_view_description && (
          <p className="text-sm text-[#0096C7] italic mb-3 bg-[#0077B6]/5 rounded-md px-3 py-2 line-clamp-2">
            "{listing.ocean_view_description}"
          </p>
        )}
        {listing.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{listing.description}</p>
        )}

        {/* Agent info */}
        {(listing.agent_name || listing.agent_brokerage) && (
          <div className="border-t border-border/50 pt-3 mt-auto space-y-1">
            {listing.agent_name && (
              <p className="text-sm flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium truncate">{listing.agent_name}</span>
              </p>
            )}
            {listing.agent_brokerage && (
              <p className="text-sm flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{listing.agent_brokerage}</span>
              </p>
            )}
            <div className="flex gap-3 flex-wrap">
              {listing.agent_phone && (
                <a href={`tel:${listing.agent_phone}`} className="text-sm flex items-center gap-1 text-[#0077B6] hover:underline">
                  <Phone className="w-3.5 h-3.5" /> {listing.agent_phone}
                </a>
              )}
              {listing.agent_email && (
                <a href={`mailto:${listing.agent_email}`} className="text-sm flex items-center gap-1 text-[#0077B6] hover:underline">
                  <Mail className="w-3.5 h-3.5" /> {listing.agent_email}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Source label */}
        <div className="mt-3 mb-2">
          <span className="text-xs text-muted-foreground">
            Source: <span className="font-medium">{sourceName(listing.source)}</span>
          </span>
        </div>

        {/* Multi-source action buttons */}
        <div className="flex flex-wrap gap-2">
          {sourceButtons.map((btn, i) => (
            <a key={i} href={btn.url} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs bg-white hover:bg-[#0077B6]/5 border-[#0077B6]/20 text-[#0077B6]"
              >
                <ExternalLink className="w-3 h-3" /> {btn.label}
              </Button>
            </a>
          ))}
          {hasPhotos && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs bg-white hover:bg-[#0077B6]/5 border-[#0077B6]/20 text-[#0077B6]"
              onClick={() => onOpenLightbox(photos, 0, listing.address)}
            >
              <Images className="w-3 h-3" /> View {photos.length} Photo{photos.length !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [searchRuns, setSearchRuns] = useState<SearchRun[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [sortBy, setSortBy] = useState("price_asc");
  const [filterLocation, setFilterLocation] = useState("all");
  const [oceanViewOnly, setOceanViewOnly] = useState(false);
  const [filterBeds, setFilterBeds] = useState("0");
  const [filterBaths, setFilterBaths] = useState("0");
  const [showInactive, setShowInactive] = useState(false);

  // Lightbox state
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number; address: string } | null>(null);

  useEffect(() => {
    checkAuth().then((ok) => { setAuthenticated(ok); setAuthChecked(true); });
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const r = await fetch("/api/search-runs");
      const d = await r.json();
      setSearchRuns(d);
      if (d.length > 0 && !selectedDate) setSelectedDate(d[0].run_date);
    } catch (e) { console.error(e); }
  }, [selectedDate]);

  const fetchListings = useCallback(async (date: string) => {
    if (!date) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/listings?date=${date}`);
      const d = await r.json();
      setListings(d);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authenticated) fetchRuns(); }, [authenticated, fetchRuns]);
  useEffect(() => { if (authenticated && selectedDate) fetchListings(selectedDate); }, [authenticated, selectedDate, fetchListings]);

  const handleRefresh = async () => {
    const KEY = "maui_refresh_log";
    const now = Date.now();
    const todayStr = new Date().toISOString().split("T")[0];
    let log: { date: string; times: number[] } = { date: todayStr, times: [] };
    try {
      const s = localStorage.getItem(KEY);
      if (s) { const p = JSON.parse(s); if (p.date === todayStr) log = p; }
    } catch {}
    if (log.times.length >= 3) { setRefreshError("Daily limit reached (3/day). Try again tomorrow."); return; }
    if (log.times.length > 0 && now - log.times[log.times.length - 1] < 1800000) {
      const w = Math.ceil((1800000 - (now - log.times[log.times.length - 1])) / 60000);
      setRefreshError(`Please wait ${w} min before refreshing again.`);
      return;
    }
    setRefreshError("");
    setRefreshing(true);
    try {
      const r = await fetch("/api/search", { method: "POST" });
      const d = await r.json();
      if (d.error) { setRefreshError(d.error); }
      else {
        log.times.push(now);
        localStorage.setItem(KEY, JSON.stringify(log));
        await fetchRuns();
        setSelectedDate(todayStr);
        await fetchListings(todayStr);
      }
    } catch { setRefreshError("Search failed. Try again later."); }
    finally { setRefreshing(false); }
  };

  const today = new Date().toISOString().split("T")[0];

  const active = useMemo(() => {
    let f = listings.filter((l) => l.is_active);
    if (filterLocation !== "all") f = f.filter((l) => l.location_area === filterLocation);
    if (oceanViewOnly) f = f.filter((l) => l.ocean_view);
    const minBeds = parseInt(filterBeds);
    const minBaths = parseInt(filterBaths);
    if (minBeds > 0) f = f.filter((l) => (l.bedrooms || 0) >= minBeds);
    if (minBaths > 0) f = f.filter((l) => (l.bathrooms || 0) >= minBaths);
    if (sortBy === "price_asc") f = [...f].sort((a, b) => a.price - b.price);
    if (sortBy === "price_desc") f = [...f].sort((a, b) => b.price - a.price);
    return f;
  }, [listings, filterLocation, oceanViewOnly, filterBeds, filterBaths, sortBy]);

  const sale = useMemo(() => active.filter((l) => l.listing_type === "for_sale"), [active]);
  const rent = useMemo(() => active.filter((l) => l.listing_type === "for_rent"), [active]);
  const inactive = useMemo(() => {
    const c = new Date(); c.setDate(c.getDate() - 14);
    const cs = c.toISOString().split("T")[0];
    return listings.filter((l) => !l.is_active && l.last_seen_date >= cs);
  }, [listings]);

  // Collect all unique location areas from loaded listings for filter dropdown
  const locationAreas = useMemo(() => {
    const areas = new Set(listings.map((l) => l.location_area).filter(Boolean));
    return Array.from(areas).sort();
  }, [listings]);

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
      {/* Lightbox */}
      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          listingAddress={lightbox.address}
          onClose={() => setLightbox(null)}
        />
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
                    {selectedDate ? `Showing results for ${formatDateShort(selectedDate)}` : "All of Maui Island"}
                    {listings.length > 0 && ` · ${listings.filter(l => l.is_active).length} active`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="bg-[#0077B6] hover:bg-[#005F8A] text-white gap-1.5 text-xs sm:text-sm"
                  size="sm"
                >
                  {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span className="hidden xs:inline">Refresh</span>
                  <span className="xs:hidden">↻</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { localStorage.removeItem("maui_auth"); setAuthenticated(false); }}
                  className="text-muted-foreground"
                  title="Lock dashboard"
                >
                  <Lock className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {refreshError && (
              <p className="text-xs sm:text-sm text-[#FF6B6B] mt-2 font-medium">{refreshError}</p>
            )}
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
                    <p className="font-medium text-[#0077B6] flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> For Sale
                    </p>
                    <p className="text-muted-foreground">All of Maui Island (Maui Meadows preferred)</p>
                    <p className="text-muted-foreground">Max $1.1M · 1+ bed, 1+ bath · Ocean view</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-medium text-[#FF6B6B] flex items-center gap-1.5">
                      <HomeIcon className="w-3.5 h-3.5" /> For Rent
                    </p>
                    <p className="text-muted-foreground">All of Maui Island (Maui Meadows preferred)</p>
                    <p className="text-muted-foreground">Max $6,000/mo · 1+ bed, 1+ bath · Ocean view</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Calendar Date Strip */}
          {searchRuns.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {searchRuns.map((run) => (
                <button
                  key={run.id}
                  onClick={() => setSelectedDate(run.run_date)}
                  className={`flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    selectedDate === run.run_date
                      ? "bg-[#0077B6] text-white shadow-md"
                      : "bg-white text-foreground border border-border hover:border-[#0077B6]/30"
                  }`}
                >
                  <span className="flex items-center gap-1 sm:gap-1.5">
                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {formatDateShort(run.run_date)}
                    <span className={`text-xs ${selectedDate === run.run_date ? "text-white/80" : "text-muted-foreground"}`}>
                      · {run.listing_count}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Filters */}
          <Card className="p-3 sm:p-4 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px] sm:w-[160px] h-9 text-xs sm:text-sm bg-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_asc">Price: Low → High</SelectItem>
                  <SelectItem value="price_desc">Price: High → Low</SelectItem>
                </SelectContent>
              </Select>

              {/* Location — dynamic from loaded listings */}
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-[140px] sm:w-[160px] h-9 text-xs sm:text-sm bg-white">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Maui</SelectItem>
                  {locationAreas.map((area) => (
                    <SelectItem key={area} value={area}>{formatArea(area)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Beds */}
              <Select value={filterBeds} onValueChange={setFilterBeds}>
                <SelectTrigger className="w-[100px] sm:w-[110px] h-9 text-xs sm:text-sm bg-white">
                  <SelectValue placeholder="Beds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any Beds</SelectItem>
                  <SelectItem value="1">1+ Beds</SelectItem>
                  <SelectItem value="2">2+ Beds</SelectItem>
                  <SelectItem value="3">3+ Beds</SelectItem>
                  <SelectItem value="4">4+ Beds</SelectItem>
                </SelectContent>
              </Select>

              {/* Baths */}
              <Select value={filterBaths} onValueChange={setFilterBaths}>
                <SelectTrigger className="w-[100px] sm:w-[110px] h-9 text-xs sm:text-sm bg-white">
                  <SelectValue placeholder="Baths" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any Baths</SelectItem>
                  <SelectItem value="1">1+ Baths</SelectItem>
                  <SelectItem value="2">2+ Baths</SelectItem>
                  <SelectItem value="3">3+ Baths</SelectItem>
                </SelectContent>
              </Select>

              {/* Ocean view toggle */}
              <div className="flex items-center gap-2">
                <Switch checked={oceanViewOnly} onCheckedChange={setOceanViewOnly} id="ov" />
                <label htmlFor="ov" className="text-xs sm:text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
                  Ocean view only
                </label>
              </div>
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
                <TabsTrigger
                  value="for_sale"
                  className="flex-1 gap-1 sm:gap-1.5 text-xs sm:text-sm data-[state=active]:bg-[#0077B6] data-[state=active]:text-white"
                >
                  <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> For Sale ({sale.length})
                </TabsTrigger>
                <TabsTrigger
                  value="for_rent"
                  className="flex-1 gap-1 sm:gap-1.5 text-xs sm:text-sm data-[state=active]:bg-[#FF6B6B] data-[state=active]:text-white"
                >
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
                    {sale.map((l) => (
                      <ListingCard key={l.id} listing={l} today={today} onOpenLightbox={openLightbox} />
                    ))}
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
                    {rent.map((l) => (
                      <ListingCard key={l.id} listing={l} today={today} onOpenLightbox={openLightbox} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* No Longer Listed */}
          <div className="border-t border-border/50 pt-4">
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showInactive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              No Longer Listed ({inactive.length})
            </button>
            {showInactive && (
              inactive.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No delisted properties in the last 14 days.</p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-70">
                  {inactive.map((l) => (
                    <ListingCard key={l.id} listing={l} today={today} onOpenLightbox={openLightbox} />
                  ))}
                </div>
              )
            )}
          </div>
        </main>

        <footer className="border-t border-border/50 py-5 mt-8">
          <div className="container text-center text-xs text-muted-foreground">
            Maui Property Search · All of Maui Island · Data sourced live from real estate platforms · No fabricated listings
          </div>
        </footer>
      </div>
    </>
  );
}
