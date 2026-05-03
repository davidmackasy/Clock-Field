import { useSearch, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { FileText, BookOpen, NotebookPen, MessageSquare, ClipboardList, Package } from "lucide-react";
import AdminWorkLog from "./work-log";
import AdminReports from "./reports";
import AdminFieldNotes from "./field-notes";
import AdminRequests from "./requests";
import AdminScheduledFieldNotes from "./scheduled-field-notes";
import AdminSupplies from "./supplies";

const TABS = [
  { id: "submissions", label: "Submissions", icon: BookOpen },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "field-notes", label: "Field Notes", icon: NotebookPen },
  { id: "requests", label: "Requests", icon: MessageSquare },
  { id: "scheduled-notes", label: "Scheduled Notes", icon: ClipboardList },
  { id: "supplies", label: "Supplies", icon: Package },
];

export default function AdminWorkLogHub() {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(search);
  // Supplies uses its own path (/admin/work-log/supplies) so it's
  // shareable as a clean URL; all other tabs use ?tab= on /admin/work-log.
  const isSuppliesPath = location.startsWith("/admin/work-log/supplies");
  const activeTab = isSuppliesPath ? "supplies" : (params.get("tab") || "submissions");

  const handleTabChange = (tabId: string) => {
    if (tabId === "submissions") {
      navigate("/admin/work-log");
    } else if (tabId === "supplies") {
      navigate("/admin/work-log/supplies");
    } else {
      navigate(`/admin/work-log?tab=${tabId}`);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab navigation */}
      <div className="border-b bg-background shrink-0 px-4 md:px-6 pt-4 md:pt-6">
        <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                data-testid={`tab-worklog-${tab.id}`}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "submissions" && <AdminWorkLog />}
        {activeTab === "reports" && <AdminReports />}
        {activeTab === "field-notes" && <AdminFieldNotes />}
        {activeTab === "requests" && <AdminRequests />}
        {activeTab === "scheduled-notes" && <AdminScheduledFieldNotes />}
        {activeTab === "supplies" && <AdminSupplies />}
      </div>
    </div>
  );
}
