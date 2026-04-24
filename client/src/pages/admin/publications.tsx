import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Newspaper, Search, ExternalLink, Copy, Pencil, Trash2,
  Globe, FileText, EyeOff, Archive
} from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:       { label: "Draft",       color: "bg-gray-100 text-gray-600" },
  published:   { label: "Published",   color: "bg-green-100 text-green-700" },
  unpublished: { label: "Unpublished", color: "bg-yellow-100 text-yellow-700" },
  archived:    { label: "Archived",    color: "bg-slate-100 text-slate-500" },
};

const STATUS_ICON: Record<string, any> = {
  draft:       FileText,
  published:   Globe,
  unpublished: EyeOff,
  archived:    Archive,
};

export default function AdminPublications() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: publications = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/publications"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/publications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publications"] });
      toast({ title: "Publication deleted" });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = publications.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.subtitle || "").toLowerCase().includes(search.toLowerCase())
  );

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/p/${slug}`;
    navigator.clipboard.writeText(url).then(() =>
      toast({ title: "Link copied!", description: url })
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Publications</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and manage your public-facing service pages</p>
          </div>
          <Link href="/admin/publications/new">
            <Button data-testid="button-new-publication">
              <Plus className="w-4 h-4 mr-2" />
              New Publication
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search publications…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-publications"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Newspaper className="w-6 h-6 text-gray-400" />
            </div>
            {search ? (
              <>
                <p className="text-sm font-medium text-gray-700">No results for "{search}"</p>
                <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">No publications yet</p>
                <p className="text-xs text-gray-400 mt-1">Create your first publication to share with clients</p>
                <Link href="/admin/publications/new">
                  <Button className="mt-4" size="sm" data-testid="button-empty-new">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Publication
                  </Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(pub => {
              const meta = STATUS_META[pub.status] || STATUS_META.draft;
              const Icon = STATUS_ICON[pub.status] || FileText;
              return (
                <Card key={pub.id} className="hover:shadow-sm transition-shadow" data-testid={`card-publication-${pub.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-blue-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{pub.title}</h3>
                          <Badge className={`text-[10px] px-2 py-0 h-4 rounded-full font-medium ${meta.color}`}>
                            {meta.label}
                          </Badge>
                          {pub.category && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0 h-4 rounded-full flex items-center">{pub.category}</span>
                          )}
                        </div>
                        {pub.subtitle && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{pub.subtitle}</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-1">
                          {pub.status === "published"
                            ? `Published ${pub.publishedAt ? new Date(pub.publishedAt).toLocaleDateString() : ""}`
                            : `Created ${new Date(pub.createdAt).toLocaleDateString()}`}
                          {" · "}
                          <span className="font-mono text-[10px]">/p/{pub.slug}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {pub.status === "published" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-gray-400 hover:text-blue-600"
                            onClick={() => window.open(`/p/${pub.slug}`, "_blank")}
                            title="View public page"
                            data-testid={`button-view-${pub.id}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-gray-400 hover:text-gray-600"
                          onClick={() => copyLink(pub.slug)}
                          title="Copy public link"
                          data-testid={`button-copy-${pub.id}`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Link href={`/admin/publications/${pub.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-gray-400 hover:text-gray-700"
                            title="Edit"
                            data-testid={`button-edit-${pub.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-gray-400 hover:text-destructive"
                          onClick={() => setDeleteTarget(pub.id)}
                          title="Delete"
                          data-testid={`button-delete-${pub.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Publication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the publication, all its sections, images, and pricing. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
