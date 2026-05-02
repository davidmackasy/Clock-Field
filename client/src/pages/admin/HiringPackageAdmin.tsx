import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Briefcase, Plus, Trash2, Settings, Users, Copy, ExternalLink,
  CheckCircle2, Clock, XCircle, FileText, Eye, Loader2, ChevronDown, ChevronUp,
  AlertCircle, RefreshCw,
} from "lucide-react";

type HiringTemplate = {
  id: string;
  companyId: string;
  name: string;
  policies: { id: string; title: string; content: string }[];
  bootReimbursementAmount: string;
  requireDateOfBirth: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type HiringPackage = {
  id: string;
  companyId: string;
  templateId: string;
  employeeName: string;
  employeeEmail: string;
  position: string;
  publicToken: string;
  status: string;
  sentAt: string | null;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type HiringSubmission = {
  id: string;
  packageId: string;
  publicToken: string;
  currentStep: number;
  status: string;
  reviewStatus: string | null;
  personalInfoJson: any;
  emergencyContactsJson: any;
  medicalInfoJson: any;
  finalAcknowledgement: boolean;
  signatureData: string | null;
  submittedAt: string | null;
  lastSavedAt: string | null;
  adminNotes: string | null;
  missingDocsMessage: string | null;
  requestedMissingDocs: string[] | null;
  createdAt: string;
};

type SubmissionDetail = {
  package: HiringPackage;
  submission: HiringSubmission | null;
  template: HiringTemplate | null;
  policyAcceptances: any[];
  documents: any[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: FileText },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Send },
  started: { label: "In Progress", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  submitted: { label: "Submitted", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-600", icon: FileText };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function formatDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function HiringPackageAdmin() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"packages" | "settings">("packages");
  const [sendDialog, setSendDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState<string | null>(null);
  const [sendForm, setSendForm] = useState({ employeeName: "", employeeEmail: "", position: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);

  // Template state
  const [editingTemplate, setEditingTemplate] = useState<HiringTemplate | null>(null);
  const [newPolicyTitle, setNewPolicyTitle] = useState("");
  const [newPolicyContent, setNewPolicyContent] = useState("");
  const [addingPolicy, setAddingPolicy] = useState(false);

  const { data: template, isLoading: templateLoading } = useQuery<HiringTemplate>({
    queryKey: ["/api/hiring-package/template"],
  });

  const { data: packages = [], isLoading: packagesLoading } = useQuery<HiringPackage[]>({
    queryKey: ["/api/hiring-package/packages"],
  });

  const { data: submissions = [] } = useQuery<HiringSubmission[]>({
    queryKey: ["/api/hiring-package/submissions"],
  });

  const { data: detail, isLoading: detailLoading } = useQuery<SubmissionDetail>({
    queryKey: ["/api/hiring-package/packages", detailDialog, "detail"],
    enabled: !!detailDialog,
  });

  const createPackageMutation = useMutation({
    mutationFn: (data: typeof sendForm) => apiRequest("POST", "/api/hiring-package/packages", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hiring-package/packages"] });
      setSendDialog(false);
      setSendForm({ employeeName: "", employeeEmail: "", position: "" });
      toast({ title: "Package created", description: "The hiring package has been created. You can now send it." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendEmailMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/hiring-package/packages/${id}/send`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hiring-package/packages"] });
      toast({ title: "Email sent", description: "The hiring package link has been emailed to the employee." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePackageMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hiring-package/packages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hiring-package/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hiring-package/submissions"] });
      setDeleteConfirm(null);
      toast({ title: "Deleted", description: "Hiring package removed." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: (data: Partial<HiringTemplate>) => apiRequest("PATCH", `/api/hiring-package/template/${template?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hiring-package/template"] });
      setEditingTemplate(null);
      toast({ title: "Template saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateReviewMutation = useMutation({
    mutationFn: ({ submissionId, data }: { submissionId: string; data: any }) =>
      apiRequest("PATCH", `/api/hiring-package/submissions/${submissionId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hiring-package/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hiring-package/packages", detailDialog, "detail"] });
      toast({ title: "Submission updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getPublicLink = (token: string) => `${window.location.origin}/public/hiring-package/${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getPublicLink(token));
    toast({ title: "Link copied!" });
  };

  const getSubmissionForPackage = (pkgId: string) => submissions.find(s => s.packageId === pkgId);

  const effectiveStatus = (pkg: HiringPackage) => {
    const sub = getSubmissionForPackage(pkg.id);
    if (!sub) return pkg.status;
    if (sub.status === "submitted") return "submitted";
    if (sub.status === "started") return "started";
    return pkg.status;
  };

  // Template editing helpers
  const currentTemplate = editingTemplate ?? template;

  const addPolicy = () => {
    if (!newPolicyTitle.trim() || !newPolicyContent.trim()) return;
    const policies = [...(currentTemplate?.policies ?? []), {
      id: `p_${Date.now()}`,
      title: newPolicyTitle.trim(),
      content: newPolicyContent.trim(),
    }];
    if (editingTemplate) {
      setEditingTemplate({ ...editingTemplate, policies });
    } else if (template) {
      setEditingTemplate({ ...template, policies });
    }
    setNewPolicyTitle("");
    setNewPolicyContent("");
    setAddingPolicy(false);
  };

  const removePolicy = (policyId: string) => {
    const policies = (currentTemplate?.policies ?? []).filter(p => p.id !== policyId);
    if (editingTemplate) {
      setEditingTemplate({ ...editingTemplate, policies });
    } else if (template) {
      setEditingTemplate({ ...template, policies });
    }
  };

  const saveTemplate = () => {
    if (!editingTemplate || !template) return;
    updateTemplateMutation.mutate({
      name: editingTemplate.name,
      policies: editingTemplate.policies,
      bootReimbursementAmount: editingTemplate.bootReimbursementAmount,
      requireDateOfBirth: editingTemplate.requireDateOfBirth,
    });
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("packages")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "packages" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          data-testid="hp-tab-packages">
          <Users className="w-4 h-4" /> Packages
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "settings" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          data-testid="hp-tab-settings">
          <Settings className="w-4 h-4" /> Template Settings
        </button>
      </div>

      {/* ── PACKAGES TAB ── */}
      {activeTab === "packages" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Sent Packages</h3>
              <p className="text-sm text-muted-foreground">Send hiring packages to new employees for them to complete online.</p>
            </div>
            <Button onClick={() => setSendDialog(true)} size="sm" data-testid="btn-send-package">
              <Plus className="w-4 h-4 mr-1" /> Send Package
            </Button>
          </div>

          {packagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg">
              <Briefcase className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No packages yet</p>
              <p className="text-xs text-muted-foreground mb-4">Create your first hiring package to send to a new employee.</p>
              <Button size="sm" onClick={() => setSendDialog(true)} data-testid="btn-send-package-empty">
                <Plus className="w-4 h-4 mr-1" /> Send Package
              </Button>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Position</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sent</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {packages.map(pkg => {
                    const status = effectiveStatus(pkg);
                    const canSend = status === "draft";
                    return (
                      <tr key={pkg.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-package-${pkg.id}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{pkg.employeeName}</div>
                          <div className="text-xs text-muted-foreground">{pkg.employeeEmail}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{pkg.position || "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={status} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(pkg.sentAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setDetailDialog(pkg.id)}
                              data-testid={`btn-view-${pkg.id}`}>
                              <Eye className="w-3.5 h-3.5 mr-1" /> View
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => copyLink(pkg.publicToken)}
                              data-testid={`btn-copy-link-${pkg.id}`}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            {canSend && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => sendEmailMutation.mutate(pkg.id)}
                                disabled={sendEmailMutation.isPending}
                                data-testid={`btn-send-email-${pkg.id}`}>
                                <Send className="w-3.5 h-3.5 mr-1" /> Send Email
                              </Button>
                            )}
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setDeleteConfirm(pkg.id)}
                              className="text-destructive hover:text-destructive"
                              data-testid={`btn-delete-${pkg.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          {templateLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !template ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Template not found</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Hiring Template</h3>
                  <p className="text-sm text-muted-foreground">Configure the policies and settings for new hire packages.</p>
                </div>
                {editingTemplate && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingTemplate(null)} data-testid="btn-cancel-template">
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveTemplate} disabled={updateTemplateMutation.isPending} data-testid="btn-save-template">
                      {updateTemplateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>

              {/* General Settings */}
              <div className="border border-border rounded-lg p-4 space-y-4">
                <h4 className="text-sm font-semibold text-foreground">General Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Boot Reimbursement Amount</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        className="pl-7"
                        value={currentTemplate?.bootReimbursementAmount ?? "60.00"}
                        onChange={e => {
                          const val = e.target.value;
                          if (editingTemplate) setEditingTemplate({ ...editingTemplate, bootReimbursementAmount: val });
                          else if (template) setEditingTemplate({ ...template, bootReimbursementAmount: val });
                        }}
                        data-testid="input-boot-reimbursement"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <Switch
                      checked={currentTemplate?.requireDateOfBirth ?? false}
                      onCheckedChange={val => {
                        if (editingTemplate) setEditingTemplate({ ...editingTemplate, requireDateOfBirth: val });
                        else if (template) setEditingTemplate({ ...template, requireDateOfBirth: val });
                      }}
                      data-testid="switch-require-dob"
                    />
                    <Label className="text-sm cursor-pointer">Require Date of Birth</Label>
                  </div>
                </div>
              </div>

              {/* Policies */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">Company Policies</h4>
                  <Button variant="outline" size="sm" onClick={() => setAddingPolicy(true)} data-testid="btn-add-policy">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Policy
                  </Button>
                </div>
                {(currentTemplate?.policies ?? []).length === 0 && !addingPolicy && (
                  <p className="text-sm text-muted-foreground text-center py-4">No policies added yet. Add your first company policy.</p>
                )}
                {(currentTemplate?.policies ?? []).map(policy => (
                  <div key={policy.id} className="border border-border rounded-md overflow-hidden">
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedPolicy(expandedPolicy === policy.id ? null : policy.id)}>
                      <span className="text-sm font-medium text-foreground">{policy.title}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost" size="sm"
                          className="text-destructive hover:text-destructive h-6 w-6 p-0"
                          onClick={e => { e.stopPropagation(); removePolicy(policy.id); }}
                          data-testid={`btn-remove-policy-${policy.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        {expandedPolicy === policy.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {expandedPolicy === policy.id && (
                      <div className="px-4 pb-3 border-t border-border bg-muted/20">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap pt-3">{policy.content}</p>
                      </div>
                    )}
                  </div>
                ))}
                {addingPolicy && (
                  <div className="border border-border rounded-md p-4 space-y-3 bg-muted/20">
                    <Input
                      placeholder="Policy title (e.g. Health & Safety Policy)"
                      value={newPolicyTitle}
                      onChange={e => setNewPolicyTitle(e.target.value)}
                      data-testid="input-new-policy-title"
                    />
                    <Textarea
                      placeholder="Policy content..."
                      rows={5}
                      value={newPolicyContent}
                      onChange={e => setNewPolicyContent(e.target.value)}
                      data-testid="input-new-policy-content"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => { setAddingPolicy(false); setNewPolicyTitle(""); setNewPolicyContent(""); }}>Cancel</Button>
                      <Button size="sm" onClick={addPolicy} data-testid="btn-save-policy">Add Policy</Button>
                    </div>
                  </div>
                )}
                {editingTemplate && (currentTemplate?.policies ?? []).length > 0 && (
                  <div className="pt-2 flex justify-end">
                    <Button size="sm" onClick={saveTemplate} disabled={updateTemplateMutation.isPending} data-testid="btn-save-template-bottom">
                      {updateTemplateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SEND PACKAGE DIALOG ── */}
      <Dialog open={sendDialog} onOpenChange={setSendDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-send-package">
          <DialogHeader>
            <DialogTitle>Send Hiring Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Employee Name <span className="text-destructive">*</span></Label>
              <Input
                className="mt-1"
                placeholder="Jane Smith"
                value={sendForm.employeeName}
                onChange={e => setSendForm(f => ({ ...f, employeeName: e.target.value }))}
                data-testid="input-employee-name"
              />
            </div>
            <div>
              <Label>Employee Email <span className="text-destructive">*</span></Label>
              <Input
                className="mt-1"
                type="email"
                placeholder="jane@example.com"
                value={sendForm.employeeEmail}
                onChange={e => setSendForm(f => ({ ...f, employeeEmail: e.target.value }))}
                data-testid="input-employee-email"
              />
            </div>
            <div>
              <Label>Position</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Cleaner, Supervisor"
                value={sendForm.position}
                onChange={e => setSendForm(f => ({ ...f, position: e.target.value }))}
                data-testid="input-employee-position"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createPackageMutation.mutate(sendForm)}
              disabled={!sendForm.employeeName.trim() || !sendForm.employeeEmail.trim() || createPackageMutation.isPending}
              data-testid="btn-confirm-send">
              {createPackageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Create Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-delete-confirm">
          <DialogHeader>
            <DialogTitle>Delete Package</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the hiring package and all submission data. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deletePackageMutation.mutate(deleteConfirm)} disabled={deletePackageMutation.isPending} data-testid="btn-confirm-delete">
              {deletePackageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DETAIL DIALOG ── */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-package-detail">
          <DialogHeader>
            <DialogTitle>Package Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !detail ? (
            <p className="text-sm text-muted-foreground text-center py-8">Not found</p>
          ) : (
            <div className="space-y-5">
              {/* Package info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground">Employee</div>
                  <div className="font-medium">{detail.package.employeeName}</div>
                  <div className="text-sm text-muted-foreground">{detail.package.employeeEmail}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Position</div>
                  <div className="font-medium">{detail.package.position || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <StatusBadge status={effectiveStatus(detail.package)} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sent</div>
                  <div className="text-sm">{formatDate(detail.package.sentAt)}</div>
                </div>
              </div>

              {/* Link */}
              <div className="flex items-center gap-2">
                <Input readOnly value={getPublicLink(detail.package.publicToken)} className="text-xs font-mono" />
                <Button variant="outline" size="sm" onClick={() => copyLink(detail.package.publicToken)} data-testid="btn-detail-copy">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open(getPublicLink(detail.package.publicToken), "_blank")} data-testid="btn-detail-open">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
                {effectiveStatus(detail.package) === "draft" && (
                  <Button size="sm" onClick={() => { sendEmailMutation.mutate(detail.package.id); }} disabled={sendEmailMutation.isPending} data-testid="btn-detail-send-email">
                    <Send className="w-3.5 h-3.5 mr-1" /> Send Email
                  </Button>
                )}
                {effectiveStatus(detail.package) === "sent" && (
                  <Button variant="outline" size="sm" onClick={() => { sendEmailMutation.mutate(detail.package.id); }} disabled={sendEmailMutation.isPending} data-testid="btn-detail-resend-email">
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Resend
                  </Button>
                )}
              </div>

              {/* Submission */}
              {!detail.submission ? (
                <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  <AlertCircle className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                  The employee has not started filling out this package yet.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Submission</h4>
                    <StatusBadge status={detail.submission.status} />
                  </div>

                  {/* Personal Info */}
                  {detail.submission.personalInfoJson && (
                    <div className="border border-border rounded-md p-3 space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Personal Information</div>
                      {Object.entries(detail.submission.personalInfoJson as Record<string, string>).map(([k, v]) => (
                        <div key={k} className="grid grid-cols-2 text-sm gap-1">
                          <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="text-foreground font-medium">{String(v) || "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Emergency Contacts */}
                  {detail.submission.emergencyContactsJson && Array.isArray(detail.submission.emergencyContactsJson) && (
                    <div className="border border-border rounded-md p-3 space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Emergency Contacts</div>
                      {(detail.submission.emergencyContactsJson as any[]).map((c, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-medium">{c.name}</span>
                          {c.relationship && <span className="text-muted-foreground"> — {c.relationship}</span>}
                          {c.phone && <span className="text-muted-foreground"> · {c.phone}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Policy Acceptances */}
                  {detail.policyAcceptances.length > 0 && (
                    <div className="border border-border rounded-md p-3">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Policy Acceptances</div>
                      <div className="space-y-1">
                        {detail.policyAcceptances.map(pa => (
                          <div key={pa.id} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            <span>{pa.policyTitle}</span>
                            <span className="text-muted-foreground text-xs ml-auto">{formatDate(pa.acceptedAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documents */}
                  {detail.documents.length > 0 && (
                    <div className="border border-border rounded-md p-3">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Uploaded Documents</div>
                      <div className="space-y-1">
                        {detail.documents.map(doc => (
                          <div key={doc.id} className="flex items-center gap-2 text-sm">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="capitalize">{doc.documentType.replace(/_/g, " ")}</span>
                            <span className="text-muted-foreground text-xs">— {doc.originalName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Signature */}
                  {detail.submission.signatureData && (
                    <div className="border border-border rounded-md p-3">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Signature</div>
                      <img src={detail.submission.signatureData} alt="Signature" className="max-h-24 border border-border rounded bg-white" />
                    </div>
                  )}

                  {/* Admin actions */}
                  {detail.submission.status === "submitted" && (
                    <div className="border border-border rounded-md p-3 space-y-3">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Review</div>
                      <div className="flex gap-2">
                        <Button
                          size="sm" variant="outline"
                          className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => updateReviewMutation.mutate({ submissionId: detail.submission!.id, data: { reviewStatus: "approved" } })}
                          disabled={updateReviewMutation.isPending}
                          data-testid="btn-approve-submission">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => updateReviewMutation.mutate({ submissionId: detail.submission!.id, data: { reviewStatus: "rejected" } })}
                          disabled={updateReviewMutation.isPending}
                          data-testid="btn-reject-submission">
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                      <div>
                        <Label className="text-xs">Admin Notes</Label>
                        <Textarea
                          className="mt-1 text-sm"
                          rows={3}
                          defaultValue={detail.submission.adminNotes ?? ""}
                          placeholder="Internal notes..."
                          onBlur={e => updateReviewMutation.mutate({ submissionId: detail.submission!.id, data: { adminNotes: e.target.value } })}
                          data-testid="input-admin-notes"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
