import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, Mail } from "lucide-react";

export default function ClientProfile() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`;

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
              <p className="text-lg font-semibold">{user.firstName} {user.lastName}</p>
              <Badge variant="secondary" className="text-xs mt-1">Client</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span>{user.email}</span>
          </div>
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full" onClick={logout} data-testid="button-logout">
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
