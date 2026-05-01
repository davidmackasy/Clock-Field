import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X, ChevronLeft, ChevronRight, ThumbsUp, ThumbsDown, Phone, Mail, MapPin, ExternalLink, Clock, Globe } from "lucide-react";

function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: { src: string; caption?: string }[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        onClick={onClose}
        data-testid="button-lightbox-close"
      >
        <X className="w-5 h-5" />
      </button>
      {images.length > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            onClick={e => { e.stopPropagation(); prev(); }}
            data-testid="button-lightbox-prev"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            onClick={e => { e.stopPropagation(); next(); }}
            data-testid="button-lightbox-next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
      <div
        className="max-w-4xl max-h-[80vh] w-full px-4 flex flex-col items-center gap-3"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={images[idx].src}
          alt={images[idx].caption || ""}
          className="max-h-[70vh] max-w-full object-contain rounded-lg"
        />
        {images[idx].caption && (
          <p className="text-white/80 text-sm text-center">{images[idx].caption}</p>
        )}
        {images.length > 1 && (
          <p className="text-white/50 text-xs">{idx + 1} / {images.length}</p>
        )}
      </div>
    </div>
  );
}

function SectionPricingBlock({ pricingItems }: { pricingItems: any[] }) {
  if (!pricingItems || pricingItems.length === 0) return null;

  return (
    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden" data-testid="section-pricing-block">
      {pricingItems.map((item: any, idx: number) => (
        <div
          key={item.id || idx}
          className={`flex items-start gap-4 px-4 py-3 ${idx < pricingItems.length - 1 ? "border-b border-gray-100" : ""} ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
          data-testid={`section-pricing-item-${item.id || idx}`}
        >
          <div className="flex-1 min-w-0">
            {item.title && (
              <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
            )}
            {item.description && (
              <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
            )}
          </div>
          {item.price && (
            <div className="text-right shrink-0">
              <p className="font-bold text-gray-900 text-sm">{item.price}</p>
              {item.unit && <p className="text-xs text-gray-400">{item.unit}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const SECTION_TYPE_STYLE: Record<string, string> = {
  callout: "bg-blue-50 border border-blue-200 rounded-xl px-5 py-4",
  cta: "bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-center",
  faq: "",
  text: "",
  gallery: "",
};

export default function PublicPublication() {
  const [, params] = useRoute("/p/:slug");
  const slug = params?.slug || "";
  const [voted, setVoted] = useState<"yes" | "no" | null>(null);
  const [lightboxImages, setLightboxImages] = useState<{ src: string; caption?: string }[]>([]);
  const [lightboxStart, setLightboxStart] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/public/publications", slug],
    queryFn: () => fetch(`/api/public/publications/${slug}`).then(r => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
    retry: false,
  });

  const voteMutation = useMutation({
    mutationFn: (vote: "yes" | "no") =>
      apiRequest("POST", `/api/public/publications/${slug}/vote`, {
        vote,
        sessionId: sessionStorage.getItem("cf_pub_session") || (() => {
          const id = Math.random().toString(36).slice(2);
          sessionStorage.setItem("cf_pub_session", id);
          return id;
        })(),
      }).then(r => r.json()),
    onSuccess: (_, vote) => {
      setVoted(vote);
      queryClient.invalidateQueries({ queryKey: ["/api/public/publications", slug] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-800">Page Not Found</h1>
          <p className="text-gray-500 mt-2 text-sm">This publication doesn't exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  const pub = data;
  const company = data.company;
  // Use branding (custom or company fallback) for the header logo/name
  const branding = data.branding || data.company;
  const contactInfo = data.contactInfo;
  const sections: any[] = data.sections || [];
  const pricing: any[] = data.pricing || [];
  const votes: { yes: number; no: number } = data.votes || { yes: 0, no: 0 };

  const allImages = sections.flatMap((s: any) =>
    (s.media || []).map((m: any) => ({ src: m.imageData, caption: m.caption || undefined }))
  );

  const openLightbox = (images: { src: string; caption?: string }[], startIdx: number) => {
    setLightboxImages(images);
    setLightboxStart(startIdx);
    setShowLightbox(true);
  };

  const publishedDate = pub.publishedAt ? new Date(pub.publishedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  }) : null;

  return (
    <div className="min-h-screen bg-white">
      {(() => {
        document.title = `${pub.seoTitle || pub.title} | ${branding?.name || company?.name || "Publication"}`;
        return null;
      })()}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-4">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.name || ""}
              className="h-10 w-10 object-contain rounded-lg border border-gray-100"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {branding?.name?.[0] || "B"}
            </div>
          )}
          <div>
            {branding?.name && (
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{branding.name}</p>
            )}
            {pub.category && (
              <p className="text-xs text-gray-400">{pub.category}</p>
            )}
          </div>
        </div>
      </header>

      {/* ── Cover Image ──────────────────────────────────────────────────── */}
      {pub.coverImageData && (
        <div
          className="w-full max-h-72 overflow-hidden cursor-zoom-in"
          onClick={() => openLightbox([{ src: pub.coverImageData, caption: pub.title }], 0)}
        >
          <img
            src={pub.coverImageData}
            alt={pub.title}
            className="w-full object-cover max-h-72"
            data-testid="img-cover"
          />
        </div>
      )}

      {/* ── Article Body ─────────────────────────────────────────────────── */}
      <article className="max-w-3xl mx-auto px-4 py-10">

        {/* Title + meta */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2" data-testid="text-pub-title">
            {pub.title}
          </h1>
          {pub.subtitle && (
            <p className="text-lg text-gray-500 mb-3" data-testid="text-pub-subtitle">{pub.subtitle}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            {branding?.name && <span>{branding.name}</span>}
            {publishedDate && (
              <>
                <span>·</span>
                <time>{publishedDate}</time>
              </>
            )}
          </div>
        </header>

        {/* Intro */}
        {pub.introText && (
          <div className="prose prose-gray max-w-none mb-8">
            <p className="text-base text-gray-700 leading-relaxed whitespace-pre-line" data-testid="text-pub-intro">
              {pub.introText}
            </p>
          </div>
        )}

        {/* Sections — format-aware rendering */}
        {(() => {
          const fmt = pub.publicationFormat || "standard";
          return sections.map((section: any, sectionIdx: number) => {
            const sectionMedia: any[] = section.media || [];
            const sectionImages = sectionMedia.map((m: any) => ({ src: m.imageData, caption: m.caption || undefined }));
            const sectionPricing = section.pricingItems
              ? (() => { try { return JSON.parse(section.pricingItems); } catch { return []; } })()
              : [];

            const imageGrid = sectionImages.length > 0 ? (
              <div className={`grid gap-2 my-3 ${sectionImages.length === 1 ? "grid-cols-1" : sectionImages.length === 2 ? "grid-cols-2" : sectionImages.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
                {sectionImages.map((img, imgIdx) => {
                  const globalIdx = allImages.findIndex(a => a.src === img.src);
                  return (
                    <div
                      key={imgIdx}
                      className="cursor-zoom-in group"
                      onClick={() => openLightbox(allImages, globalIdx >= 0 ? globalIdx : imgIdx)}
                      data-testid={`img-section-${section.id}-${imgIdx}`}
                    >
                      <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                        <img
                          src={img.src}
                          alt={img.caption || ""}
                          className="w-full object-cover aspect-video group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      {img.caption && (
                        <p className="text-xs text-gray-400 mt-1 text-center italic">{img.caption}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null;

            // ── Walkthrough: numbered step blocks ───────────────────────────
            if (fmt === "walkthrough") {
              return (
                <section key={section.id} className="mb-8" data-testid={`section-${section.id}`}>
                  <div className="flex gap-4">
                    <div className="shrink-0 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mt-0.5">
                      {sectionIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0 pb-8 border-b border-gray-100">
                      {section.title && (
                        <h2 className="font-bold text-gray-900 mb-2 text-lg leading-snug" data-testid={`text-step-title-${section.id}`}>
                          {section.title}
                        </h2>
                      )}
                      {section.body && (
                        <p className="text-gray-600 leading-relaxed whitespace-pre-line text-sm mb-3">
                          {section.body}
                        </p>
                      )}
                      {imageGrid}
                      <SectionPricingBlock pricingItems={sectionPricing} />
                    </div>
                  </div>
                </section>
              );
            }

            // ── Tutorial: structured card sections ──────────────────────────
            if (fmt === "tutorial") {
              return (
                <section key={section.id} className="mb-6 border border-gray-100 rounded-xl overflow-hidden" data-testid={`section-${section.id}`}>
                  {section.title && (
                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                      <h2 className="font-bold text-gray-900 text-base">{section.title}</h2>
                    </div>
                  )}
                  <div className="px-5 py-4">
                    {section.body && (
                      <p className="text-gray-700 leading-relaxed whitespace-pre-line text-base mb-3">
                        {section.body}
                      </p>
                    )}
                    {imageGrid}
                    <SectionPricingBlock pricingItems={sectionPricing} />
                  </div>
                </section>
              );
            }

            // ── Blog: paragraph-forward editorial layout ────────────────────
            if (fmt === "blog") {
              return (
                <section key={section.id} className="mb-10" data-testid={`section-${section.id}`}>
                  {section.title && (
                    <h2 className="font-bold text-gray-900 mb-4 text-2xl leading-snug">
                      {section.title}
                    </h2>
                  )}
                  {section.body && (
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line text-base mb-4">
                      {section.body}
                    </p>
                  )}
                  {imageGrid}
                  <SectionPricingBlock pricingItems={sectionPricing} />
                </section>
              );
            }

            // ── Standard (default) ──────────────────────────────────────────
            const containerClass = SECTION_TYPE_STYLE[section.sectionType] || "";
            return (
              <section key={section.id} className={`mb-10 ${containerClass}`} data-testid={`section-${section.id}`}>
                {section.title && (
                  <h2 className="font-bold text-gray-900 mb-3 text-xl">{section.title}</h2>
                )}
                {section.body && (
                  <p className={`text-gray-700 leading-relaxed whitespace-pre-line mb-3 ${section.sectionType === "callout" ? "text-sm" : "text-base"}`}>
                    {section.body}
                  </p>
                )}
                {section.sectionType === "cta" && contactInfo?.email && (
                  <a
                    href={`mailto:${contactInfo.email}`}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors mt-2"
                    data-testid="button-section-cta"
                  >
                    Contact {contactInfo.name || company?.name}
                  </a>
                )}
                {imageGrid}
                <SectionPricingBlock pricingItems={sectionPricing} />
              </section>
            );
          });
        })()}

        {/* ── Publication-level Pricing (legacy/global) ─────────────────── */}
        {pricing.length > 0 && (
          <section className="mb-10" data-testid="section-pricing">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Pricing</h2>
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              {pricing.map((item: any, idx: number) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-4 px-5 py-4 ${idx < pricing.length - 1 ? "border-b border-gray-100" : ""}`}
                  data-testid={`pricing-item-${item.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{item.itemName}</p>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-gray-400 mt-0.5 italic">{item.notes}</p>
                    )}
                  </div>
                  {item.price && (
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900">{item.price}</p>
                      {item.unit && <p className="text-xs text-gray-400">{item.unit}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Contact Business ─────────────────────────────────────────────── */}
        {contactInfo && (contactInfo.phone || contactInfo.email || contactInfo.address || contactInfo.website) && (
          <section className="mb-10 bg-gray-50 rounded-2xl border border-gray-200 p-6" data-testid="section-contact">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Contact {contactInfo.name || company?.name || "Us"}
            </h2>
            <div className="space-y-2.5">
              {contactInfo.phone && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <a href={`tel:${contactInfo.phone}`} className="hover:text-blue-600 transition-colors">{contactInfo.phone}</a>
                </div>
              )}
              {contactInfo.email && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <a href={`mailto:${contactInfo.email}`} className="hover:text-blue-600 transition-colors">{contactInfo.email}</a>
                </div>
              )}
              {contactInfo.address && (
                <div className="flex items-start gap-3 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span>{contactInfo.address}</span>
                </div>
              )}
              {contactInfo.website && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                  <a
                    href={contactInfo.website.startsWith("http") ? contactInfo.website : `https://${contactInfo.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 transition-colors truncate"
                  >
                    {contactInfo.website}
                  </a>
                </div>
              )}
            </div>

            {/* CTA button */}
            {(contactInfo.ctaLink || contactInfo.email) && (
              <a
                href={contactInfo.ctaLink || `mailto:${contactInfo.email}`}
                target={contactInfo.ctaLink && !contactInfo.ctaLink.startsWith("mailto") && !contactInfo.ctaLink.startsWith("tel") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                data-testid="button-contact-cta"
              >
                {contactInfo.ctaText || `Contact ${contactInfo.name || company?.name || "Us"}`}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </section>
        )}

        {/* ── Helpful Voting ────────────────────────────────────────────────── */}
        {pub.helpfulVotingEnabled && (
          <section className="mb-10 text-center py-8 border-t border-gray-100" data-testid="section-voting">
            <p className="text-sm font-semibold text-gray-700 mb-4">Was this helpful?</p>
            {voted ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-gray-500">
                  Thanks for your feedback! {voted === "yes" ? "👍" : "👎"}
                </p>
                <p className="text-xs text-gray-400">{votes.yes} yes · {votes.no} no</p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => voteMutation.mutate("yes")}
                  disabled={voteMutation.isPending}
                  className="gap-1.5"
                  data-testid="button-vote-yes"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Yes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => voteMutation.mutate("no")}
                  disabled={voteMutation.isPending}
                  className="gap-1.5"
                  data-testid="button-vote-no"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  No
                </Button>
              </div>
            )}
          </section>
        )}
      </article>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            {company?.name && (
              <p className="text-sm font-semibold text-gray-700">{company.name}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">Business publication</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2.5"/>
                <polyline points="12 7 12 12 15 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-xs text-gray-400">
              Powered by{" "}
              <a href="https://clockfield.com" target="_blank" rel="noopener noreferrer"
                className="font-semibold text-gray-600 hover:text-blue-600 transition-colors">
                Clockfield
              </a>
            </span>
          </div>
        </div>
      </footer>

      {showLightbox && lightboxImages.length > 0 && (
        <Lightbox images={lightboxImages} startIndex={lightboxStart} onClose={() => setShowLightbox(false)} />
      )}
    </div>
  );
}
