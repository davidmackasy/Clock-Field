import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Inbox, Search, ArrowLeft, ChevronRight, Calendar, Mail, Phone,
  Building2, MapPin,
} from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  new_request: "New Request",
  estimated: "Estimated",
  needs_review: "Needs Review",
  quote_ready: "Quote Ready",
  quote_sent: "Quote Sent",
  follow_up: "Follow Up",
  won: "Won",
  lost: "Lost",
};

const STAGE_COLORS: Record<string, string> = {
  new_request: "bg-blue-100 text-blue-700",
  estimated: "bg-purple-100 text-purple-700",
  needs_review: "bg-yellow-100 text-yellow-700",
  quote_ready: "bg-orange-100 text-orange-700",
  quote_sent: "bg-sky-100 text-sky-700",
  follow_up: "bg-pink-100 text-pink-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-gray-100 text-gray-500",
};

const ALL_STAGES = ["all", ...Object.keys(STAGE_LABELS)];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminSalesLeads() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialStage = params.get("stage") || "all";

  const [stageFilter, setStageFilter] = useState(initialStage);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: submissions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/submissions"],
  });

  const filtered = (submissions as any[]).filter(s => {
    if (stageFilter !== "all" && (s.pipelineStage || "new_request") !== stageFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.clientName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.serviceAddress?.toLowerCase().includes(q) ||
        s.companyName?.toLowerCase().includes(q) ||
        s.serviceType?.toLowerCase().includes(q)
      );
    }
    return true;
  }).sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());

  const stageCounts: Record<string, number> = { all: (submissions as any[]).length };
  (submissions as any[]).forEach(s => {
    const stage = s.pipelineStage || "new_request";
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/admin/sales")} data-testid="button-back-to-hub">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Inbox className="w-4 h-4 text-primary" /> Lead Inbox
            </h1>
            <p className="text-xs text-muted-foreground">All inbound leads from quote requests and form submissions</p>
          </div>
        </div>
      </div>

      {/* Stage filter tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-2 overflow-x-auto flex-shrink-0 border-b">
        {ALL_STAGES.map(stage => (
          <button
            key={stage}
            onClick={() => setStageFilter(stage)}
            data-testid={`tab-stage-${stage}`}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              stageFilter === stage
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {stage === "all" ? "All" : STAGE_LABELS[stage]}
            <span className={`ml-1.5 text-[10px] tabular-nums ${stageFilter === stage ? "opacity-80" : "opacity-60"}`}>
              {stageCounts[stage] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, address…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
            data-testid="input-leads-search"
          />
        </div>
      </div>

      {/* Lead list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <Inbox className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="font-medium text-muted-foreground">
              {searchQuery ? "No leads match your search" : stageFilter !== "all" ? `No leads in "${STAGE_LABELS[stageFilter]}"` : "No leads yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {!searchQuery && stageFilter === "all" ? "Leads will appear here when clients submit quote request forms." : "Try adjusting your search or filter."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map(sub => {
              const stage = sub.pipelineStage || "new_request";
              const data = sub.data || {};
              return (
                <div
                  key={sub.id}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/admin/sales/leads/${sub.id}`)}
                  data-testid={`lead-row-${sub.id}`}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-semibold text-primary">
                      {(sub.clientName || sub.firstName || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{sub.clientName || `${sub.firstName || ""} ${sub.lastName || ""}`.trim() || "Unknown"}</span>
                      {sub.companyName && <span className="text-xs text-muted-foreground">· {sub.companyName}</span>}
                      <Badge className={`text-[10px] h-4 px-1.5 ${STAGE_COLORS[stage] || "bg-gray-100 text-gray-600"}`}>
                        {STAGE_LABELS[stage] || stage}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {sub.serviceAddress && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" /> {sub.serviceAddress}
                        </span>
                      )}
                      {(data.serviceType || sub.serviceType) && (
                        <span className="text-xs text-muted-foreground">{data.serviceType || sub.serviceType}</span>
                      )}
                      {sub.email && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" /> {sub.email}
                        </span>
                      )}
                      {sub.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" /> {sub.phone}
                        </span>
                      )}
                    </div>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3" /> {fmtDate(sub.submittedAt)}
                      {sub.formName && <span className="ml-1">· {sub.formName}</span>}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-2" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
