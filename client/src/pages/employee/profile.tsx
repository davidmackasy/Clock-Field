import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Mail, Phone, DollarSign, KeyRound, IdCard, Clock, ChevronRight, ScrollText, Receipt, Package, GraduationCap } from "lucide-react";

export default function EmployeeProfile() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!user) return null;

  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPw.length < 4) {
      toast({ title: "Password must be at least 4 characters", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/change-password", { currentPassword: currentPw, newPassword: newPw });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Password updated" });
      setShowChangePw(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 pb-24 space-y-5">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-profile-title">Profile</h1>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="text-xl bg-primary/10">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold" data-testid="text-user-name">{user.firstName} {user.lastName}</p>
              <Badge variant="secondary" className="text-xs mt-1">{user.role}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            {(user as any).employeeId && (
              <div className="flex items-center gap-2 text-sm">
                <IdCard className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-muted-foreground" data-testid="text-user-employee-id">{(user as any).employeeId}</span>
              </div>
            )}
            {user.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span data-testid="text-user-email">{user.email}</span>
              </div>
            )}
            {user.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{user.phone}</span>
              </div>
            )}
            {user.hourlyRate && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span>${user.hourlyRate}/hr</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Link href="/employee/hours">
        <Card className="cursor-pointer hover:shadow-sm transition-shadow active:scale-[0.99]" data-testid="link-my-hours">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">My Hours</p>
                  <p className="text-xs text-muted-foreground">View your work history</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link href="/employee/timesheets">
        <Card className="cursor-pointer hover:shadow-sm transition-shadow active:scale-[0.99]" data-testid="link-my-timesheets">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <ScrollText className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">My Timesheets</p>
                  <p className="text-xs text-muted-foreground">Review and submit pay period timesheets</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link href="/employee/pay-stubs">
        <Card className="cursor-pointer hover:shadow-sm transition-shadow active:scale-[0.99]" data-testid="link-pay-stubs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Pay Stubs</p>
                  <p className="text-xs text-muted-foreground">View and download your payroll records</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link href="/employee/supplies">
        <Card className="cursor-pointer hover:shadow-sm transition-shadow active:scale-[0.99]" data-testid="link-supplies">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Supplies</p>
                  <p className="text-xs text-muted-foreground">View and report supply status</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link href="/employee/training">
        <Card className="cursor-pointer hover:shadow-sm transition-shadow active:scale-[0.99]" data-testid="link-training">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">My Training</p>
                  <p className="text-xs text-muted-foreground">Complete courses and earn certificates</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>

      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Password
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {!showChangePw ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChangePw(true)}
              data-testid="button-change-password"
            >
              Change Password
            </Button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Current Password</Label>
                <Input
                  data-testid="input-current-password"
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  required
                  placeholder="Enter current password"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New Password</Label>
                <Input
                  data-testid="input-new-password-profile"
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  required
                  minLength={4}
                  placeholder="At least 4 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confirm New Password</Label>
                <Input
                  data-testid="input-confirm-password-profile"
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                  minLength={4}
                  placeholder="Repeat new password"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isLoading} data-testid="button-save-password">
                  {isLoading ? "Saving..." : "Save"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowChangePw(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full" onClick={logout} data-testid="button-logout">
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
