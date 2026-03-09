import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, FileText, MessageSquare } from "lucide-react";
import { Link } from "wouter";

export default function ClientDashboard() {
  const { user } = useAuth();

  return (
    <div className="p-4 pb-24 space-y-5">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-client-welcome">Welcome, {user?.firstName}</h1>
        <p className="text-sm text-muted-foreground">Your service portal</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Service Requests</p>
                <p className="text-sm text-muted-foreground">Submit and track service requests</p>
              </div>
            </div>
            <Link href="/client/requests">
              <Button variant="secondary" className="w-full" data-testid="link-requests">
                View Requests
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Your Account</p>
                <p className="text-sm text-muted-foreground">View your profile and locations</p>
              </div>
            </div>
            <Link href="/client/profile">
              <Button variant="secondary" className="w-full" data-testid="link-profile">
                View Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
