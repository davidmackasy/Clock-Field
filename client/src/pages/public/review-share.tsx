import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";

function StarDisplay({ value }: { value: number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`w-6 h-6 ${i <= value ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function PhotoGrid({ photos, reviewShareToken }: { photos: any[]; reviewShareToken: string }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  if (!photos || photos.length === 0) return null;

  return (
    <div className="mt-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 text-center">Service Work Photos</p>
      <div className={`grid gap-2 ${photos.length === 1 ? "grid-cols-1" : photos.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {photos.map((photo: any, i: number) => (
          <button
            key={photo.id}
            className="relative aspect-square rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400 group"
            onClick={() => setLightboxIdx(i)}
          >
            <img
              src={`/api/public/review/${reviewShareToken}/photos/${photo.id}`}
              alt={photo.caption || photo.subArea || ""}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors rounded-xl" />
          </button>
        ))}
      </div>

      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10"
            onClick={() => setLightboxIdx(null)}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-current fill-none stroke-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="absolute top-4 left-4 text-white/50 text-sm">{lightboxIdx + 1} / {photos.length}</div>
          <div className="flex items-center gap-4 w-full max-w-4xl px-16" onClick={e => e.stopPropagation()}>
            <button
              className="p-2 text-white/50 hover:text-white disabled:opacity-20 rounded-full hover:bg-white/10"
              disabled={lightboxIdx === 0}
              onClick={() => setLightboxIdx(i => Math.max(0, i! - 1))}
            >
              <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-current fill-none stroke-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 flex items-center justify-center">
              <img
                src={`/api/public/review/${reviewShareToken}/photos/${photos[lightboxIdx].id}`}
                alt={photos[lightboxIdx]?.caption || ""}
                className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl"
              />
            </div>
            <button
              className="p-2 text-white/50 hover:text-white disabled:opacity-20 rounded-full hover:bg-white/10"
              disabled={lightboxIdx === photos.length - 1}
              onClick={() => setLightboxIdx(i => Math.min(photos.length - 1, i! + 1))}
            >
              <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-current fill-none stroke-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {photos[lightboxIdx]?.caption && (
            <p className="absolute bottom-6 text-white/60 text-sm">{photos[lightboxIdx].caption}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PublicReviewShare() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/public/review", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/review/${token}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="space-y-3 w-64">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-gray-400 stroke-current fill-none stroke-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Review Not Found</h2>
          <p className="text-sm text-gray-500">This review link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const { review, workDate, locationName, employeeName, companyName, afterPhotos } = data;

  const fmtDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-lg mx-auto px-4 py-10">

        {/* Business header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-5 py-3 shadow-sm mb-4">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-500 fill-emerald-500">
              <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span className="text-sm font-semibold text-gray-700">Verified by ClockField.com</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{companyName}</h1>
          <p className="text-sm text-gray-500 mt-1">Client Testimonial</p>
        </div>

        {/* Review card */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/80 fill-white/80">
                  <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Verified Client Review</span>
              </div>
              <StarDisplay value={review.rating} />
            </div>
          </div>

          <div className="px-6 py-6 space-y-5">
            {/* Quote */}
            <div className="relative">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-blue-100 fill-blue-100 absolute -top-1 -left-1">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              <blockquote className="text-base text-gray-800 leading-relaxed pl-6 font-medium italic">
                "{review.reviewText}"
              </blockquote>
            </div>

            {/* Client info */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-base font-bold text-gray-900">{review.clientName}</p>
              {review.companyName && <p className="text-sm text-gray-500">{review.companyName}</p>}
            </div>

            {/* Service metadata */}
            <div className="space-y-2 text-sm text-gray-500">
              {workDate && (
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-gray-400 stroke-current fill-none stroke-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <span>Service date: {fmtDate(workDate)}</span>
                </div>
              )}
              {locationName && (
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-gray-400 stroke-current fill-none stroke-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span>{locationName}</span>
                </div>
              )}
              {employeeName && (
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-gray-400 stroke-current fill-none stroke-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span>Completed by {employeeName}</span>
                </div>
              )}
            </div>

            {/* Verified footer */}
            <div className="pt-4 border-t border-gray-100 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-500 fill-emerald-500 shrink-0">
                <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <p className="text-xs text-emerald-600 font-medium">Verified by ClockField.com · Submitted through completed service report</p>
            </div>
          </div>
        </div>

        {/* After photos */}
        {afterPhotos && afterPhotos.length > 0 && (
          <div className="mt-6 bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
            <PhotoGrid photos={afterPhotos} reviewShareToken={token!} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-gray-400 space-y-1">
          <p className="font-semibold text-gray-500">{companyName}</p>
          <p>Powered by ClockField.com · Service Documentation Platform</p>
        </div>
      </div>
    </div>
  );
}
