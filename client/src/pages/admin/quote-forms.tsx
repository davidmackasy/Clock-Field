import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  FileText, Plus, ExternalLink, Trash2, Loader2, Copy,
  ClipboardList, Settings2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type QuoteForm = {
  id: string; name: string; slug: string; companyId: string;
  isActive: boolean; createdAt: string; config: any;
};

function FormCard({ form, onEdit, onDelete, onToggle }: {
  form: QuoteForm;
  onEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onToggle: (active: boolean) => void;
}) {
  const { toast } = useToast();
  const publicUrl = `${window.location.origin}/form/${form.companyId}/${form.slug}`;

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(publicUrl).then(() => {
      toast({ title: "Link copied!" });
    });
  };

  return (
    <div
      data-testid={`card-quote-form-${form.id}`}
      className="group rounded-xl border bg-card hover:shadow-md hover:border-primary/20 transition-all duration-150 flex flex-col overflow-hidden cursor-pointer"
      onClick={onEdit}
    >
      <div className={cn("h-1 w-full", form.isActive ? "bg-green-400" : "bg-gray-200")} />

      <button
        data-testid={`button-delete-form-${form.id}`}
        className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md items-center justify-center hidden group-hover:flex transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
        onClick={onDelete}
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="p-4 flex flex-col gap-3 flex-1 relative">
        <div className="flex items-start justify-between gap-2 pr-6">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate leading-tight">{form.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">/{form.slug}</p>
          </div>
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", form.isActive
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-gray-100 text-gray-500"
            )}
          >
            {form.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Created {format(parseISO(form.createdAt), "MMM d, yyyy")}
        </p>

        <div className="flex items-center gap-2 mt-auto pt-2 border-t">
          <button
            data-testid={`button-copy-link-${form.id}`}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
            onClick={copyLink}
          >
            <Copy className="w-3 h-3" /> Copy Link
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" /> Preview
          </a>
          <div className="flex-1" />
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <span className="text-[11px] text-muted-foreground">{form.isActive ? "On" : "Off"}</span>
            <Switch
              data-testid={`switch-form-active-${form.id}`}
              checked={form.isActive}
              onCheckedChange={onToggle}
              className="scale-75"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminQuoteForms() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<QuoteForm | null>(null);

  const { data: forms = [], isLoading } = useQuery<QuoteForm[]>({ queryKey: ["/api/admin/quote-forms"] });

  const createMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/admin/quote-forms", { name }).then(r => r.json()),
    onSuccess: (form) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quote-forms"] });
      setCreateOpen(false);
      setNewName("");
      navigate(`/admin/quote-forms/${form.id}`);
    },
    onError: () => toast({ title: "Failed to create form", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/quote-forms/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quote-forms"] });
      toast({ title: "Form deleted." });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/quote-forms/${id}`, { isActive }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/quote-forms"] }),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-4 md:px-6 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-base font-semibold leading-none">Quote Forms</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Shareable multi-step request forms</p>
          </div>
        </div>
        <Button data-testid="button-new-quote-form" onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> New Form
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
          </div>
        ) : forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-muted-foreground">No quote forms yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
              Create a form to share with clients. They fill it out, you get a lead.
            </p>
            <Button className="mt-5 gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" /> Create First Form
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {forms.map(form => (
              <FormCard
                key={form.id}
                form={form}
                onEdit={() => navigate(`/admin/quote-forms/${form.id}`)}
                onDelete={(e) => { e.stopPropagation(); setDeleteTarget(form); }}
                onToggle={(active) => toggleMutation.mutate({ id: form.id, isActive: active })}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) setNewName(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" /> New Quote Form
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Form Name</Label>
              <Input
                data-testid="input-new-form-name"
                placeholder="e.g. Residential Cleaning Request"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createMutation.mutate(newName.trim()); }}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                URL: /form/…/{newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "form"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              data-testid="button-create-form-confirm"
              className="flex-1"
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(newName.trim())}
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Create & Edit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" /> Delete Form?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <span className="font-medium text-foreground">"{deleteTarget?.name}"</span> and all its submissions.
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              data-testid="button-confirm-delete-form"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
