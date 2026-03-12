import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";

export default function SetPasswordPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPin.length < 4) {
      toast({ title: "Password must be at least 4 characters", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/change-password", { newPassword: newPin });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Password set successfully. Welcome!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Set Your Password</h1>
          <p className="text-sm text-muted-foreground">
            Welcome, {user?.firstName}! Please create a new password to activate your account.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create New Password</CardTitle>
            <CardDescription className="text-xs">
              {(user as any)?.role === "employee" ? (
                <>Your Employee ID is <strong className="font-mono">{(user as any)?.employeeId}</strong>. You will use this along with your new password to sign in.</>
              ) : (
                <>You will use your email and new password to sign in.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-pin">New Password</Label>
                <Input
                  id="new-pin"
                  data-testid="input-new-password"
                  type="password"
                  placeholder="At least 4 characters"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  required
                  minLength={4}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pin">Confirm Password</Label>
                <Input
                  id="confirm-pin"
                  data-testid="input-confirm-password"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value)}
                  required
                  minLength={4}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-set-password">
                {isLoading ? "Saving..." : "Set Password & Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Not you?{" "}
          <button onClick={logout} className="underline hover:text-foreground" data-testid="button-not-me-logout">
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
