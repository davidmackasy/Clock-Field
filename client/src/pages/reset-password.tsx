import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

type TokenState = "loading" | "valid" | "invalid" | "expired" | "used";

export default function ResetPasswordPage() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [tokenState, setTokenState] = useState<TokenState>("loading");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setTokenState("invalid"); return; }
    fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) setTokenState("valid");
        else if (data.reason === "expired") setTokenState("expired");
        else if (data.reason === "used") setTokenState("used");
        else setTokenState("invalid");
      })
      .catch(() => setTokenState("invalid"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Reset failed");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBody = () => {
    if (tokenState === "loading") {
      return (
        <div className="flex items-center justify-center py-8" data-testid="loading-validate-token">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (tokenState === "expired") {
      return (
        <div className="space-y-4" data-testid="state-token-expired">
          <div className="flex items-start gap-3 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-900">Link expired</p>
              <p className="text-sm text-yellow-800 mt-0.5">This reset link has expired. Links are valid for 20 minutes.</p>
            </div>
          </div>
          <Link href="/forgot-password">
            <Button className="w-full" data-testid="link-request-new-link">Request a new link</Button>
          </Link>
        </div>
      );
    }

    if (tokenState === "used") {
      return (
        <div className="space-y-4" data-testid="state-token-used">
          <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Link already used</p>
              <p className="text-sm text-blue-800 mt-0.5">This reset link has already been used. If you need to reset again, request a new link.</p>
            </div>
          </div>
          <Link href="/forgot-password">
            <Button className="w-full" data-testid="link-request-new-link-used">Request a new link</Button>
          </Link>
        </div>
      );
    }

    if (tokenState === "invalid") {
      return (
        <div className="space-y-4" data-testid="state-token-invalid">
          <div className="flex items-start gap-3 rounded-md border border-red-100 bg-red-50 px-4 py-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-900">Invalid reset link</p>
              <p className="text-sm text-red-800 mt-0.5">This link is not valid. Please request a new one.</p>
            </div>
          </div>
          <Link href="/forgot-password">
            <Button className="w-full" data-testid="link-request-new-link-invalid">Request a new link</Button>
          </Link>
        </div>
      );
    }

    if (success) {
      return (
        <div className="space-y-4" data-testid="state-reset-success">
          <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">Password updated</p>
              <p className="text-sm text-green-800 mt-0.5">Your password has been reset. You can now sign in with your new password.</p>
            </div>
          </div>
          <Link href="/">
            <Button className="w-full" data-testid="link-go-to-login">Sign in</Button>
          </Link>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-reset-password">
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            data-testid="input-new-password"
            type="password"
            placeholder="Min 6 characters"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setError(""); }}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            data-testid="input-confirm-password"
            type="password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        {error && (
          <div className="flex items-start gap-2.5 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2.5" data-testid="error-reset-password">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground/80">{error}</p>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-set-new-password">
          {isSubmitting ? "Saving..." : "Set new password"}
        </Button>
      </form>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">ClockField</span>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {success ? "Password updated" : "Choose a new password"}
            </CardTitle>
            {!success && tokenState === "valid" && (
              <CardDescription>Enter and confirm your new password below.</CardDescription>
            )}
          </CardHeader>
          <CardContent>{renderBody()}</CardContent>
        </Card>
        {tokenState === "valid" && !success && (
          <p className="text-center mt-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline" data-testid="link-back-to-login-reset">
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
