import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Loader2, ArrowLeft, ExternalLink, MapPin, BedDouble, Bath, Eye, Phone,
  Mail, Building2, User, Home as HomeIcon, Star, ChevronLeft, ChevronRight,
  X, Images, Waves
} from "lucide-react";
import { checkAuth } from "@/lib/auth";

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

const sourceName = (src: string) => {
  if (!src) return "Unknown";
  if (src.includes("realtor")) return "Realtor.com";
  if (src.includes("zillow")) return "Zillow";
  if (src.includes("craigslist")) return "Craigslist";
  if (src.includes("hawaiilife")) return "Hawaii Life";
  if (src.includes("redfin")) return "Redfin";
  return src.charAt(0).toUpperCase() + src.slice(1).replace(/\.(com|org|net)/, "");
};

const formatPrice = (price: number, type: string) =>
  type === "for_rent" ? `$${price.toLocaleString()}/mo` : `$${price.toLocaleString()}`;

const formatArea = (area: string) =>
  area?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "";

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function DetailLightbox({
  photos, initialIndex, onClose
}: { photos: Photo[]; initialIndex: number; onClose: () => void }) {
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
        <span className="text-xs text-white/60">Source: <span className="text-white/80">{photo ? sourceName(photo.source) : ""}</span></span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/70 font-mono">{current + 1} / {total}</span>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center relative min-h-0 px-12 sm:px-16">
        {photo && <img key={photo.url} src={photo.url} alt="" className="max-w-full max-h-full object-contain select-none" draggable={false} />}
        {total > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 sm:left-4 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white"><ChevronLeft className="w-6 h-6" /></button>
            <button onClick={next} className="absolute right-2 sm:right-4 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white"><ChevronRight className="w-6 h-6" /></button>
          </>
        )}
      </div>
      {total > 1 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-4 flex-shrink-0 justify-center">
          {photos.map((p, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={`flex-shrink-0 w-14 h-10 rounded overflow-hidden border-2 transition-all ${i === current ? "border-white" : "border-transparent opacity-50 hover:opacity-80"}`}>
              <img src={p.url} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Detail Page ──────────────────────────────────────────────────────────────
export default function ListingDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    checkAuth().then((ok) => { if (!ok) setLocation("/"); else setAuthed(true); });
  }, [setLocation]);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/listings/${id}`);
        if (r.ok) setListing(await r.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id, authed]);

  if (!authed) return null;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-[#0077B6]" />
    </div>
  );

  if (!listing) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <p className="text-muted-foreground">Listing not found.</p>
      <Button onClick={() => setLocation("/")} variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard</Button>
    </div>
  );

  const photos: Photo[] = listing.photos || [];
  const today = new Date().toISOString().split("T")[0];
  const isNew = listing.first_seen_date === today;
  const statusLower = listing.status?.toLowerCase() || "";
  const sc = statusLower === "active" ? "bg-emerald-100 text-emerald-700" : statusLower === "pending" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700";

  const sourceButtons: Array<{ label: string; url: string }> = [];
  if (listing.listing_url) sourceButtons.push({ label: `View on ${sourceName(listing.source)}`, url: listing.listing_url });
  if (listing.drive_folder_url) sourceButtons.push({ label: "View Photos (Drive)", url: listing.drive_folder_url });

  return (
    <>
      {lightbox && <DetailLightbox photos={lightbox.photos} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />}

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border/50">
          <div className="container py-3 flex items-center gap-3">
            <Button onClick={() => setLocation("/")} variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <Waves className="w-5 h-5 text-[#0077B6] flex-shrink-0" />
              <span className="text-sm font-medium truncate text-muted-foreground">Maui Property Search</span>
            </div>
          </div>
        </header>

        {/* Photo Gallery */}
        {photos.length > 0 && (
          <div className="bg-muted">
            <div className="container py-0">
              <div className="grid grid-cols-4 gap-1 sm:gap-2 max-h-[400px] sm:max-h-[500px] overflow-hidden rounded-b-xl">
                {/* Main photo */}
                <div
                  className={`${photos.length === 1 ? "col-span-4" : "col-span-4 sm:col-span-2 sm:row-span-2"} relative cursor-pointer group`}
                  onClick={() => setLightbox({ photos, index: 0 })}
                >
                  <img src={photos[0].url} alt={listing.address} className="w-full h-full object-cover min-h-[200px] sm:min-h-[300px] group-hover:brightness-90 transition-all" />
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">{sourceName(photos[0].source)}</div>
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1"><Images className="w-3 h-3" />{photos.length}</div>
                </div>
                {/* Secondary photos */}
                {photos.slice(1, 5).map((p, i) => (
                  <div
                    key={i}
                    className="hidden sm:block relative cursor-pointer group"
                    onClick={() => setLightbox({ photos, index: i + 1 })}
                  >
                    <img src={p.url} alt="" className="w-full h-full object-cover min-h-[140px] group-hover:brightness-90 transition-all" />
                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">{sourceName(p.source)}</div>
                    {i === 3 && photos.length > 5 && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-bold text-lg">+{photos.length - 5}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <main className="container py-6 sm:py-8">
          <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Left column — main info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Price + Address + Badges */}
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${sc}`}>
                    {listing.status ? listing.status.charAt(0).toUpperCase() + listing.status.slice(1) : "Unknown"}
                  </span>
                  {listing.ocean_view && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#0077B6]/10 text-[#0077B6]"><Eye className="w-3 h-3" /> Ocean View</span>
                  )}
                  {isNew && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#FF6B6B]/10 text-[#FF6B6B]"><Star className="w-3 h-3 mr-0.5" /> NEW</span>
                  )}
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                    <MapPin className="w-3 h-3 mr-0.5" /> {formatArea(listing.location_area)}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground capitalize">
                    {listing.listing_type.replace("_", " ")}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0077B6] mb-1">
                  {formatPrice(listing.price, listing.listing_type)}
                </h1>
                <h2 className="text-lg sm:text-xl font-bold mb-3">{listing.address}</h2>

                <div className="flex gap-4 sm:gap-6 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5"><BedDouble className="w-4 h-4" /> {listing.bedrooms} bed{listing.bedrooms !== 1 ? "s" : ""}</span>
                  <span className="flex items-center gap-1.5"><Bath className="w-4 h-4" /> {listing.bathrooms} bath{listing.bathrooms !== 1 ? "s" : ""}</span>
                  {listing.sqft && <span className="flex items-center gap-1.5"><HomeIcon className="w-4 h-4" /> {listing.sqft.toLocaleString()} sqft</span>}
                </div>
              </div>

              {/* Ocean view description */}
              {listing.ocean_view_description && (
                <div className="bg-[#0077B6]/5 rounded-xl p-4 border border-[#0077B6]/10">
                  <p className="text-sm font-medium text-[#0077B6] mb-1 flex items-center gap-1.5"><Eye className="w-4 h-4" /> Ocean View Details</p>
                  <p className="text-sm text-[#0096C7] italic">"{listing.ocean_view_description}"</p>
                </div>
              )}

              {/* Full description */}
              {listing.description && (
                <div>
                  <h3 className="text-lg font-bold mb-3">Description</h3>
                  <div className="bg-white rounded-xl border border-border/50 p-4 sm:p-5">
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{listing.description}</p>
                    <p className="text-xs text-muted-foreground/60 mt-3">Source: {sourceName(listing.source)}</p>
                  </div>
                </div>
              )}

              {/* Listing history */}
              <div>
                <h3 className="text-lg font-bold mb-3">Listing History</h3>
                <Card className="p-4 sm:p-5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">First seen</span>
                    <span className="font-medium">{new Date(listing.first_seen_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last seen</span>
                    <span className="font-medium">{new Date(listing.last_seen_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price at first seen</span>
                    <span className="font-medium">{formatPrice(listing.price_at_first_seen, listing.listing_type)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current price</span>
                    <span className="font-medium">{formatPrice(listing.price, listing.listing_type)}</span>
                  </div>
                  {listing.price !== listing.price_at_first_seen && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price change</span>
                      <span className={`font-medium ${listing.price < listing.price_at_first_seen ? "text-emerald-600" : "text-[#FF6B6B]"}`}>
                        {listing.price < listing.price_at_first_seen ? "↓" : "↑"} ${Math.abs(listing.price - listing.price_at_first_seen).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`font-medium ${listing.is_active ? "text-emerald-600" : "text-muted-foreground"}`}>{listing.is_active ? "Active" : "No longer listed"}</span>
                  </div>
                </Card>
              </div>
            </div>

            {/* Right column — agent + actions */}
            <div className="space-y-6">
              {/* Source links */}
              <Card className="p-4 sm:p-5 space-y-3">
                <h3 className="font-bold text-sm">View Original Listing</h3>
                <div className="space-y-2">
                  {sourceButtons.map((btn, i) => (
                    <a key={i} href={btn.url} target="_blank" rel="noopener noreferrer" className="block">
                      <Button className="w-full gap-2 bg-[#0077B6] hover:bg-[#005F8A] text-white">
                        <ExternalLink className="w-4 h-4" /> {btn.label}
                      </Button>
                    </a>
                  ))}
                </div>
              </Card>

              {/* Agent info */}
              {(listing.agent_name || listing.agent_brokerage) && (
                <Card className="p-4 sm:p-5 space-y-3">
                  <h3 className="font-bold text-sm">Listed By</h3>
                  {listing.agent_name && (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#0077B6]/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-[#0077B6]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{listing.agent_name}</p>
                        {listing.agent_brokerage && <p className="text-xs text-muted-foreground truncate">{listing.agent_brokerage}</p>}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {listing.agent_phone && (
                      <a href={`tel:${listing.agent_phone}`} className="flex items-center gap-2 text-sm text-[#0077B6] hover:underline">
                        <Phone className="w-4 h-4" /> {listing.agent_phone}
                      </a>
                    )}
                    {listing.agent_email && (
                      <a href={`mailto:${listing.agent_email}`} className="flex items-center gap-2 text-sm text-[#0077B6] hover:underline">
                        <Mail className="w-4 h-4" /> {listing.agent_email}
                      </a>
                    )}
                    {listing.agent_brokerage && !listing.agent_name && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="w-4 h-4" /> {listing.agent_brokerage}
                      </p>
                    )}
                  </div>
                </Card>
              )}

              {/* Photo sources */}
              {photos.length > 0 && (
                <Card className="p-4 sm:p-5 space-y-3">
                  <h3 className="font-bold text-sm">Photos by Source</h3>
                  {(() => {
                    const bySource = new Map<string, Photo[]>();
                    photos.forEach((p) => {
                      const s = sourceName(p.source);
                      if (!bySource.has(s)) bySource.set(s, []);
                      bySource.get(s)!.push(p);
                    });
                    return Array.from(bySource.entries()).map(([src, srcPhotos]) => (
                      <button
                        key={src}
                        onClick={() => setLightbox({ photos: srcPhotos, index: 0 })}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <Images className="w-4 h-4 text-[#0077B6]" />
                          {src}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">{srcPhotos.length} photo{srcPhotos.length !== 1 ? "s" : ""}</span>
                      </button>
                    ));
                  })()}
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
