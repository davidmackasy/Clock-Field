import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X, Clock, MapPin, User, Calendar, CheckCircle, Star, MessageSquare, Shield } from "lucide-react";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          className="focus:outline-none"
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(i)}
          data-testid={`star-${i}`}
        >
          <Star
            className={`w-7 h-7 transition-colors ${i <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
          />
        </button>
      ))}
    </div>
  );
}

function Lightbox({ photos, token, startIdx, onClose }: { photos: any[]; token: string; startIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx);
  const photo = photos[idx];
  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>
      <div className="absolute top-4 left-4 text-white/50 text-sm">{idx + 1} / {photos.length}</div>
      <div className="flex items-center gap-4 w-full max-w-4xl px-16" onClick={e => e.stopPropagation()}>
        <button
          className="p-2 text-white/50 hover:text-white disabled:opacity-20 rounded-full hover:bg-white/10 shrink-0"
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          disabled={idx === 0}
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <img
            src={`/api/public/work-report/${token}/photos/${photo.id}`}
            alt={photo.caption || ""}
            className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
          />
        </div>
        <button
          className="p-2 text-white/50 hover:text-white disabled:opacity-20 rounded-full hover:bg-white/10 shrink-0"
          onClick={() => setIdx(i => Math.min(photos.length - 1, i + 1))}
          disabled={idx === photos.length - 1}
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      </div>
      {photo.caption && <p className="text-white/60 text-sm mt-4">{photo.caption}</p>}
    </div>
  );
}

function PhotoRow({ photos, token, label }: { photos: any[]; token: string; label: string }) {
  const [lb, setLb] = useState<number | null>(null);
  if (photos.length === 0) return null;
  return (
    <div>
      {lb !== null && <Lightbox photos={photos} token={token} startIdx={lb} onClose={() => setLb(null)} />}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((p: any, i: number) => (
          <button
            key={p.id}
            className="group relative aspect-square focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-lg overflow-hidden"
            onClick={() => setLb(i)}
          >
            <img
              src={`/api/public/work-report/${token}/photos/${p.id}`}
              alt={p.caption || ""}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewSection({ token, companyName, existingReview }: { token: string; companyName: string; existingReview: any }) {
  const [showForm, setShowForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [companyNameVal, setCompanyNameVal] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(0);
  const [errors, setErrors] = useState<{ clientName?: string; reviewText?: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/work-report/${token}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, companyName: companyNameVal, reviewText, rating: rating || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to submit review");
      }
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
    onError: (e: any) => setServerError(e.message),
  });

  function validate() {
    const errs: { clientName?: string; reviewText?: string } = {};
    if (!clientName.trim()) errs.clientName = "Your name is required.";
    if (!reviewText.trim()) errs.reviewText = "Please write a review message.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    setServerError(null);
    if (!validate()) return;
    submitMutation.mutate();
  }

  // Already has a review (from initial load) or just submitted
  if (existingReview || submitted) {
    const review = existingReview || { clientName, companyName: companyNameVal, reviewText, rating, submittedAt: new Date().toISOString() };
    return (
      <div className="max-w-2xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Verified Client Review</p>
              <p className="text-[10px] text-gray-400">Submitted through completed service report · Verified by ClockField</p>
            </div>
          </div>
          {review.rating && (
            <div className="mb-3">
              <StarRating value={review.rating} />
            </div>
          )}
          <blockquote className="text-sm text-gray-700 italic leading-relaxed mb-4">
            "{review.reviewText}"
          </blockquote>
          <div>
            <p className="text-sm font-semibold text-gray-800">{review.clientName}</p>
            {review.companyName && <p className="text-xs text-gray-500">{review.companyName}</p>}
            <p className="text-xs text-gray-400 mt-0.5">{fmt(review.submittedAt)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-8">
      {!showForm ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-blue-500" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">Enjoyed the work?</h3>
          <p className="text-sm text-gray-500 mb-5">Leave a review about this service</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
            data-testid="button-leave-review"
          >
            <Star className="w-4 h-4" />
            Leave a Review
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-bold text-gray-900 mb-1">Leave a Review</h3>
          <p className="text-xs text-gray-400 mb-5">Your feedback will be shared with {companyName}</p>

          {serverError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          {/* Rating */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Rating (optional)</label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          {/* Client Name */}
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Your Name *</label>
            <input
              type="text"
              value={clientName}
              onChange={e => { setClientName(e.target.value); setErrors(prev => ({ ...prev, clientName: undefined })); }}
              placeholder="Jane Smith"
              className={`w-full text-sm rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 ${errors.clientName ? "border-red-400 bg-red-50" : "border-gray-200"}`}
              data-testid="input-client-name"
            />
            {errors.clientName && <p className="text-xs text-red-500 mt-1">{errors.clientName}</p>}
          </div>

          {/* Company Name */}
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Company Name (optional)</label>
            <input
              type="text"
              value={companyNameVal}
              onChange={e => setCompanyNameVal(e.target.value)}
              placeholder="Acme Corp"
              className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-400"
              data-testid="input-company-name"
            />
          </div>

          {/* Review Text */}
          <div className="mb-5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Your Review *</label>
            <textarea
              value={reviewText}
              onChange={e => { setReviewText(e.target.value); setErrors(prev => ({ ...prev, reviewText: undefined })); }}
              placeholder="Share your experience with the service..."
              rows={4}
              className={`w-full text-sm rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 resize-none ${errors.reviewText ? "border-red-400 bg-red-50" : "border-gray-200"}`}
              data-testid="input-review-text"
            />
            {errors.reviewText && <p className="text-xs text-red-500 mt-1">{errors.reviewText}</p>}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setShowForm(false); setErrors({}); setServerError(null); }}
              className="flex-1 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
              data-testid="button-cancel-review"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="flex-1 text-sm font-semibold bg-blue-600 text-white rounded-xl py-2.5 hover:bg-blue-700 transition-colors disabled:opacity-60"
              data-testid="button-submit-review"
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublicWorkReport() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/public/work-report", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/work-report/${token}`);
      if (!res.ok) throw new Error("Report not found");
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading report...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <X className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-800">Report Not Found</h1>
          <p className="text-gray-500 text-sm">This report link may have expired or is no longer available.</p>
        </div>
      </div>
    );
  }

  const sections: Record<string, any[]> = {};
  (data.items || []).forEach((item: any) => {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-blue-100 text-xs font-medium uppercase tracking-wide">Service Report</p>
              <h1 className="text-xl font-bold">{data.companyName}</h1>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-1">Cleaning Service Report</h2>
          <p className="text-blue-100 text-sm">Professional service documentation</p>
        </div>
      </div>

      {/* Summary card */}
      <div className="max-w-2xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 grid grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Prepared by</p>
              <p className="text-sm font-semibold text-gray-800">{data.employeeName}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Service Date</p>
              <p className="text-sm font-semibold text-gray-800">{fmtDate(data.workDate)}</p>
            </div>
          </div>
          {data.locationName && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Location</p>
                <p className="text-sm font-semibold text-gray-800">{data.locationName}</p>
              </div>
            </div>
          )}
          {data.submittedAt && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Submitted</p>
                <p className="text-sm font-semibold text-gray-800">{fmt(data.submittedAt)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Work items by section */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {Object.entries(sections).map(([sectionName, items]) => (
          <div key={sectionName}>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 px-2">{sectionName}</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="space-y-4">
              {items.map((item: any) => {
                const before = (item.photos || []).filter((p: any) => p.photoType === "before");
                const after = (item.photos || []).filter((p: any) => p.photoType === "after");
                return (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full mb-1.5">
                          {item.section}
                        </span>
                        <h3 className="text-base font-bold text-gray-900">{item.subArea}</h3>
                      </div>
                    </div>
                    {item.notes && (
                      <div className="bg-gray-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-500 italic">{item.notes}</p>
                      </div>
                    )}
                    {(before.length > 0 || after.length > 0) && (
                      <div className="space-y-4">
                        <PhotoRow photos={before} token={token!} label="Before Photos" />
                        <PhotoRow photos={after} token={token!} label="After Photos" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {data.items?.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No work items in this report.</p>
          </div>
        )}
      </div>

      {/* Review section */}
      <div className="max-w-2xl mx-auto px-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400 px-2">Client Review</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
      </div>
      <ReviewSection token={token!} companyName={data.companyName} existingReview={data.review} />

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white mt-4">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center space-y-1">
          <p className="text-sm font-semibold text-gray-700">Prepared by {data.companyName}</p>
          <p className="text-xs text-gray-400">Service documentation report · Powered by ClockField</p>
        </div>
      </div>
    </div>
  );
}
