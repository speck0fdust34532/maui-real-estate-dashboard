import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Lock, Search, RefreshCw, ExternalLink, ChevronDown, ChevronUp,
  Waves, MapPin, BedDouble, Bath, Eye, Phone, Mail, Building2, User,
  Home as HomeIcon, DollarSign, SlidersHorizontal, Calendar, Star
} from "lucide-react";
import { sha256, CORRECT_PASSWORD, checkAuth } from "@/lib/auth";

interface SearchRun { id: string; run_date: string; listing_count: number; }
interface Listing {
  id: string; source: string; listing_type: string; address: string; price: number;
  bedrooms: number; bathrooms: number; sqft: number | null; ocean_view: boolean;
  ocean_view_description: string | null; status: string; description: string | null;
  agent_name: string | null; agent_brokerage: string | null; agent_phone: string | null;
  agent_email: string | null; listing_url: string | null; drive_folder_url: string | null;
  first_seen_date: string; last_seen_date: string; is_active: boolean; location_area: string;
  price_at_first_seen: number;
}

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setChecking(true); setError("");
    const hash = await sha256(password);
    const correctHash = await sha256(CORRECT_PASSWORD);
    if (hash === correctHash) { localStorage.setItem("maui_auth", hash); onAuth(); }
    else { setError("Incorrect password"); }
    setChecking(false);
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0077B6] via-[#0096C7] to-[#F4E4C1] p-4">
      <Card className="w-full max-w-md p-8 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#0077B6]/10 mb-4">
            <Waves className="w-8 h-8 text-[#0077B6]" />
          </div>
          <h1 className="text-2xl font-bold">Maui Property Search</h1>
          <p className="text-muted-foreground mt-2">Enter password to access the dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12 text-base" autoFocus />
          </div>
          {error && <p className="text-sm text-[#FF6B6B] font-medium">{error}</p>}
          <Button type="submit" className="w-full h-12 text-base bg-[#0077B6] hover:bg-[#005F8A] text-white" disabled={checking}>
            {checking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Access Dashboard
          </Button>
        </form>
      </Card>
    </div>
  );
}

const sourceName = (src: string) => {
  if (!src) return "Unknown";
  if (src.includes("realtor")) return "Realtor.com";
  if (src.includes("zillow")) return "Zillow";
  if (src.includes("craigslist")) return "Craigslist";
  if (src.includes("hawaiilife")) return "Hawaii Life";
  if (src.includes("zumper")) return "Zumper";
  return src.charAt(0).toUpperCase() + src.slice(1);
};
const formatPrice = (price: number, type: string) => type === "for_rent" ? `$${price.toLocaleString()}/mo` : `$${price.toLocaleString()}`;
const formatArea = (area: string) => area.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const formatDateShort = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function ListingCard({ listing, today }: { listing: Listing; today: string }) {
  const isNew = listing.first_seen_date === today;
  const sc = listing.status?.toLowerCase() === "active" ? "bg-emerald-100 text-emerald-700" : listing.status?.toLowerCase() === "pending" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700";
  return (
    <Card className="overflow-hidden border border-border/60 hover:shadow-lg transition-all duration-300 bg-card">
      <div className="p-5">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc}`}>{listing.status ? listing.status.charAt(0).toUpperCase() + listing.status.slice(1) : "Unknown"}</span>
          {listing.ocean_view && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0077B6]/10 text-[#0077B6]"><Eye className="w-3 h-3" /> Ocean View</span>}
          {isNew && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FF6B6B]/10 text-[#FF6B6B]"><Star className="w-3 h-3 mr-0.5" /> NEW</span>}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"><MapPin className="w-3 h-3 mr-0.5" /> {formatArea(listing.location_area)}</span>
        </div>
        <h3 className="font-bold text-lg leading-tight mb-1">{listing.address}</h3>
        <p className="text-2xl font-extrabold text-[#0077B6] mb-3">{formatPrice(listing.price, listing.listing_type)}</p>
        <div className="flex gap-4 text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><BedDouble className="w-4 h-4" /> {listing.bedrooms} bed</span>
          <span className="flex items-center gap-1"><Bath className="w-4 h-4" /> {listing.bathrooms} bath</span>
          {listing.sqft && <span className="flex items-center gap-1"><HomeIcon className="w-4 h-4" /> {listing.sqft.toLocaleString()} sqft</span>}
        </div>
        {listing.ocean_view_description && <p className="text-sm text-[#0096C7] italic mb-3 bg-[#0077B6]/5 rounded-md px-3 py-2">"{listing.ocean_view_description}"</p>}
        {listing.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{listing.description}</p>}
        {(listing.agent_name || listing.agent_brokerage) && (
          <div className="border-t border-border/50 pt-3 mt-3 space-y-1">
            {listing.agent_name && <p className="text-sm flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-muted-foreground" /><span className="font-medium">{listing.agent_name}</span></p>}
            {listing.agent_brokerage && <p className="text-sm flex items-center gap-1.5 text-muted-foreground"><Building2 className="w-3.5 h-3.5" /> {listing.agent_brokerage}</p>}
            <div className="flex gap-3 flex-wrap">
              {listing.agent_phone && <a href={`tel:${listing.agent_phone}`} className="text-sm flex items-center gap-1 text-[#0077B6] hover:underline"><Phone className="w-3.5 h-3.5" /> {listing.agent_phone}</a>}
              {listing.agent_email && <a href={`mailto:${listing.agent_email}`} className="text-sm flex items-center gap-1 text-[#0077B6] hover:underline"><Mail className="w-3.5 h-3.5" /> {listing.agent_email}</a>}
            </div>
          </div>
        )}
        <div className="mt-3 mb-1"><span className="text-xs text-muted-foreground">Source: <span className="font-medium">{sourceName(listing.source)}</span></span></div>
        <div className="flex flex-wrap gap-2 mt-2">
          {listing.listing_url && <a href={listing.listing_url} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" className="gap-1.5 text-xs bg-white hover:bg-[#0077B6]/5 border-[#0077B6]/20 text-[#0077B6]"><ExternalLink className="w-3 h-3" /> View on {sourceName(listing.source)}</Button></a>}
          {listing.drive_folder_url && <a href={listing.drive_folder_url} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" className="gap-1.5 text-xs bg-white hover:bg-[#FF6B6B]/5 border-[#FF6B6B]/20 text-[#FF6B6B]"><ExternalLink className="w-3 h-3" /> View Photos</Button></a>}
        </div>
      </div>
    </Card>
  );
}

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
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => { checkAuth().then(ok => { setAuthenticated(ok); setAuthChecked(true); }); }, []);

  const fetchRuns = useCallback(async () => {
    try { const r = await fetch("/api/search-runs"); const d = await r.json(); setSearchRuns(d); if (d.length > 0 && !selectedDate) setSelectedDate(d[0].run_date); } catch (e) { console.error(e); }
  }, [selectedDate]);

  const fetchListings = useCallback(async (date: string) => {
    if (!date) return; setLoading(true);
    try { const r = await fetch(`/api/listings?date=${date}`); const d = await r.json(); setListings(d); } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authenticated) fetchRuns(); }, [authenticated, fetchRuns]);
  useEffect(() => { if (authenticated && selectedDate) fetchListings(selectedDate); }, [authenticated, selectedDate, fetchListings]);

  const handleRefresh = async () => {
    const KEY = "maui_refresh_log"; const now = Date.now(); const todayStr = new Date().toISOString().split("T")[0];
    let log: { date: string; times: number[] } = { date: todayStr, times: [] };
    try { const s = localStorage.getItem(KEY); if (s) { const p = JSON.parse(s); if (p.date === todayStr) log = p; } } catch {}
    if (log.times.length >= 3) { setRefreshError("Daily limit reached (3/day). Try again tomorrow."); return; }
    if (log.times.length > 0 && now - log.times[log.times.length - 1] < 1800000) { const w = Math.ceil((1800000 - (now - log.times[log.times.length - 1])) / 60000); setRefreshError(`Please wait ${w} min before refreshing again.`); return; }
    setRefreshError(""); setRefreshing(true);
    try {
      const r = await fetch("/api/search", { method: "POST" }); const d = await r.json();
      if (d.error) { setRefreshError(d.error); } else { log.times.push(now); localStorage.setItem(KEY, JSON.stringify(log)); await fetchRuns(); setSelectedDate(todayStr); await fetchListings(todayStr); }
    } catch { setRefreshError("Search failed. Try again later."); } finally { setRefreshing(false); }
  };

  const today = new Date().toISOString().split("T")[0];
  const active = useMemo(() => {
    let f = listings.filter(l => l.is_active);
    if (filterLocation !== "all") f = f.filter(l => l.location_area === filterLocation);
    if (oceanViewOnly) f = f.filter(l => l.ocean_view);
    if (sortBy === "price_asc") f.sort((a, b) => a.price - b.price);
    if (sortBy === "price_desc") f.sort((a, b) => b.price - a.price);
    return f;
  }, [listings, filterLocation, oceanViewOnly, sortBy]);
  const sale = useMemo(() => active.filter(l => l.listing_type === "for_sale"), [active]);
  const rent = useMemo(() => active.filter(l => l.listing_type === "for_rent"), [active]);
  const inactive = useMemo(() => { const c = new Date(); c.setDate(c.getDate() - 14); const cs = c.toISOString().split("T")[0]; return listings.filter(l => !l.is_active && l.last_seen_date >= cs); }, [listings]);

  if (!authChecked) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#0077B6]" /></div>;
  if (!authenticated) return <PasswordGate onAuth={() => setAuthenticated(true)} />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border/50">
        <div className="container py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0077B6] to-[#005F8A] flex items-center justify-center"><Waves className="w-5 h-5 text-white" /></div>
              <div>
                <h1 className="text-xl font-bold leading-tight">Maui Property Search</h1>
                <p className="text-xs text-muted-foreground">{selectedDate && formatDateShort(selectedDate)} &middot; {active.length} listing{active.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleRefresh} disabled={refreshing} className="bg-[#0077B6] hover:bg-[#005F8A] text-white gap-2" size="sm">
                {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh Listings
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("maui_auth"); setAuthenticated(false); }} className="text-muted-foreground"><Lock className="w-4 h-4" /></Button>
            </div>
          </div>
          {refreshError && <p className="text-sm text-[#FF6B6B] mt-2 font-medium">{refreshError}</p>}
        </div>
      </header>
      <main className="container py-6 space-y-6">
        <Card className="p-5 bg-gradient-to-r from-[#F4E4C1]/50 to-[#F4E4C1]/30 border-[#F4E4C1]">
          <div className="flex items-start gap-3">
            <Search className="w-5 h-5 text-[#0077B6] mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h2 className="font-semibold">Search Criteria</h2>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="space-y-1"><p className="font-medium text-[#0077B6] flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> For Sale</p><p className="text-muted-foreground">Maui Meadows / Kula / Makawao</p><p className="text-muted-foreground">Max $1.1M &middot; 2+ bed, 1+ bath &middot; Ocean view</p></div>
                <div className="space-y-1"><p className="font-medium text-[#FF6B6B] flex items-center gap-1.5"><HomeIcon className="w-3.5 h-3.5" /> For Rent</p><p className="text-muted-foreground">Maui Meadows / Kula / Makawao</p><p className="text-muted-foreground">Max $6,000/mo &middot; 2+ bed, 1+ bath &middot; Ocean view</p></div>
              </div>
            </div>
          </div>
        </Card>
        {searchRuns.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {searchRuns.map(run => (
              <button key={run.id} onClick={() => setSelectedDate(run.run_date)} className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedDate === run.run_date ? "bg-[#0077B6] text-white shadow-md" : "bg-white text-foreground border border-border hover:border-[#0077B6]/30"}`}>
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDateShort(run.run_date)}<span className={`text-xs ${selectedDate === run.run_date ? "text-white/80" : "text-muted-foreground"}`}>&middot; {run.listing_count}</span></span>
              </button>
            ))}
          </div>
        )}
        <Card className="p-4 bg-white">
          <div className="flex items-center gap-2 mb-3"><SlidersHorizontal className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Filters</span></div>
          <div className="flex flex-wrap gap-4 items-center">
            <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="w-[160px] h-9 text-sm bg-white"><SelectValue placeholder="Sort by" /></SelectTrigger><SelectContent><SelectItem value="price_asc">Price: Low to High</SelectItem><SelectItem value="price_desc">Price: High to Low</SelectItem></SelectContent></Select>
            <Select value={filterLocation} onValueChange={setFilterLocation}><SelectTrigger className="w-[160px] h-9 text-sm bg-white"><SelectValue placeholder="Location" /></SelectTrigger><SelectContent><SelectItem value="all">All Locations</SelectItem><SelectItem value="maui_meadows">Maui Meadows</SelectItem><SelectItem value="kula">Kula</SelectItem><SelectItem value="makawao">Makawao</SelectItem></SelectContent></Select>
            <div className="flex items-center gap-2"><Switch checked={oceanViewOnly} onCheckedChange={setOceanViewOnly} id="ov" /><label htmlFor="ov" className="text-sm text-muted-foreground cursor-pointer">Ocean view only</label></div>
          </div>
        </Card>
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#0077B6]" /><span className="ml-3 text-muted-foreground">Loading listings...</span></div>
        ) : (
          <Tabs defaultValue="for_sale" className="w-full">
            <TabsList className="w-full max-w-md bg-muted/50">
              <TabsTrigger value="for_sale" className="flex-1 gap-1.5 data-[state=active]:bg-[#0077B6] data-[state=active]:text-white"><DollarSign className="w-3.5 h-3.5" /> For Sale ({sale.length})</TabsTrigger>
              <TabsTrigger value="for_rent" className="flex-1 gap-1.5 data-[state=active]:bg-[#FF6B6B] data-[state=active]:text-white"><HomeIcon className="w-3.5 h-3.5" /> For Rent ({rent.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="for_sale" className="mt-4">
              {sale.length === 0 ? <Card className="p-12 text-center"><Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-muted-foreground">No listings found for this date and filters.</p></Card> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{sale.map(l => <ListingCard key={l.id} listing={l} today={today} />)}</div>}
            </TabsContent>
            <TabsContent value="for_rent" className="mt-4">
              {rent.length === 0 ? <Card className="p-12 text-center"><Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-muted-foreground">No listings found for this date and filters.</p></Card> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{rent.map(l => <ListingCard key={l.id} listing={l} today={today} />)}</div>}
            </TabsContent>
          </Tabs>
        )}
        <div className="border-t border-border/50 pt-4">
          <button onClick={() => setShowInactive(!showInactive)} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            {showInactive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} No Longer Listed ({inactive.length})
          </button>
          {showInactive && (inactive.length === 0 ? <p className="text-sm text-muted-foreground py-4">No delisted properties in the last 14 days.</p> : <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-70">{inactive.map(l => <ListingCard key={l.id} listing={l} today={today} />)}</div>)}
        </div>
      </main>
      <footer className="border-t border-border/50 py-6 mt-8"><div className="container text-center text-xs text-muted-foreground">Maui Property Search &middot; Data sourced live from real estate platforms &middot; No fabricated listings</div></footer>
    </div>
  );
}
