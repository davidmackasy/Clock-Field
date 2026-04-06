import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

type InviteInfo = {
  valid: boolean;
  firstName: string;
  lastName: string;
  email: string;
  managementRole: string;
  companyName: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  assistant: "Assistant",
  team: "Team",
};

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) { setError("Invalid invite link."); setLoading(false); return; }
    fetch(`/api/invite/accept/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) setInviteInfo(data);
        else setError(data.message || "Invalid invite");
      })
      .catch(() => setError("Could not load invite details."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invite/accept/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to accept invite"); return; }
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">ClockField</span>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border p-8">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading invite...</p>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1">Access activated!</h2>
                <p className="text-muted-foreground text-sm">Your account is ready. You can now sign in to ClockField.</p>
              </div>
              <Button className="w-full mt-2" onClick={() => navigate("/auth")} data-testid="button-go-to-login">
                Sign In
              </Button>
            </div>
          ) : error && !inviteInfo ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1">Invite unavailable</h2>
                <p className="text-muted-foreground text-sm">{error}</p>
              </div>
              <Button variant="outline" className="w-full mt-2" onClick={() => navigate("/auth")}>
                Go to login
              </Button>
            </div>
          ) : inviteInfo ? (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold mb-1">You've been invited</h2>
                <p className="text-muted-foreground text-sm">
                  <strong>{inviteInfo.companyName}</strong> has invited you to join ClockField as a <strong>{ROLE_LABELS[inviteInfo.managementRole] ?? inviteInfo.managementRole}</strong>.
                </p>
              </div>

              <div className="bg-muted/40 rounded-lg p-3 text-sm">
                <p className="font-medium">{inviteInfo.firstName} {inviteInfo.lastName}</p>
                <p className="text-muted-foreground">{inviteInfo.email}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Create a password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    data-testid="input-invite-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm password</Label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    data-testid="input-invite-confirm"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" data-testid="text-invite-error">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={submitting} data-testid="button-accept-invite">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {submitting ? "Activating..." : "Activate Account"}
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
