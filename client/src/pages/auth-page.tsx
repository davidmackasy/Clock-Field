import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Clock, Users, Shield, IdCard, AlertCircle } from "lucide-react";

export default function AuthPage() {
  const { login, employeeLogin, register, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [empId, setEmpId] = useState("");
  const [empPin, setEmpPin] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [empLoginError, setEmpLoginError] = useState("");

  if (user) {
    if (user.role === "admin") setLocation("/admin");
    else if (user.role === "client") setLocation("/client");
    else setLocation("/employee");
    return null;
  }

  const loginErrorMessage = (err: any): string => {
    const msg: string = err?.message || "";
    if (msg.includes("401") || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials") || msg.toLowerCase().includes("incorrect"))
      return "Incorrect email or password. Please try again.";
    if (msg.includes("403") || msg.toLowerCase().includes("inactive") || msg.toLowerCase().includes("disabled"))
      return "Your account is not active. Please contact your administrator.";
    if (msg.includes("fetch") || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("failed to fetch"))
      return "Unable to sign in right now. Please try again in a moment.";
    return "Something went wrong. Please try again.";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoading(true);
    try {
      await login(loginEmail, loginPassword);
      toast({ title: "Welcome back!" });
    } catch (err: any) {
      setLoginError(loginErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpLoginError("");
    setIsLoading(true);
    try {
      await employeeLogin(empId.trim().toUpperCase(), empPin.trim());
      toast({ title: "Welcome!" });
    } catch (err: any) {
      setEmpLoginError(loginErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await register({ email: regEmail, password: regPassword, firstName: regFirstName, lastName: regLastName, companyName: regCompany });
      toast({ title: "Account created!" });
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold">ClockField</span>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Workforce operations platform for service businesses
            </p>
          </div>

          <Tabs defaultValue="employee" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="employee" data-testid="tab-employee-login">Employee</TabsTrigger>
              <TabsTrigger value="login" data-testid="tab-login">Admin / Client</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="employee">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <IdCard className="w-4 h-4" />
                    Employee Login
                  </CardTitle>
                  <CardDescription>Use your Employee ID and PIN to sign in</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleEmployeeLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="emp-id">Employee ID</Label>
                      <Input
                        id="emp-id"
                        data-testid="input-employee-id"
                        placeholder="EMP-1001"
                        value={empId}
                        onChange={e => setEmpId(e.target.value)}
                        required
                        autoComplete="username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emp-pin">PIN / Password</Label>
                      <Input
                        id="emp-pin"
                        data-testid="input-employee-pin"
                        type="password"
                        placeholder="Enter your PIN"
                        value={empPin}
                        onChange={e => setEmpPin(e.target.value)}
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    {empLoginError && (
                      <div className="flex items-start gap-2.5 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2.5" data-testid="error-employee-login">
                        <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-foreground/80">{empLoginError}</p>
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-employee-login">
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Your Employee ID and temporary PIN are provided by your manager.
                    </p>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="login">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Sign in to your account</CardTitle>
                  <CardDescription>Admin and client accounts use email and password</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" data-testid="input-login-email" type="email" placeholder="name@company.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input id="login-password" data-testid="input-login-password" type="password" placeholder="Enter your password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                    </div>
                    {loginError && (
                      <div className="flex items-start gap-2.5 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2.5" data-testid="error-admin-login">
                        <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-foreground/80">{loginError}</p>
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Create your account</CardTitle>
                  <CardDescription>Set up your company and admin account</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="reg-first">First Name</Label>
                        <Input id="reg-first" data-testid="input-reg-first" placeholder="John" value={regFirstName} onChange={e => setRegFirstName(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-last">Last Name</Label>
                        <Input id="reg-last" data-testid="input-reg-last" placeholder="Doe" value={regLastName} onChange={e => setRegLastName(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-company">Company Name</Label>
                      <Input id="reg-company" data-testid="input-reg-company" placeholder="Acme Cleaning Co." value={regCompany} onChange={e => setRegCompany(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Email</Label>
                      <Input id="reg-email" data-testid="input-reg-email" type="email" placeholder="name@company.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Password</Label>
                      <Input id="reg-password" data-testid="input-reg-password" type="password" placeholder="Min 6 characters" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={6} />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-register">
                      {isLoading ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-primary/5 items-center justify-center p-12">
        <div className="max-w-lg">
          <h1 className="text-3xl font-bold mb-4">
            Manage your workforce in one place
          </h1>
          <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
            Schedule shifts, track attendance, estimate payroll, and keep clients informed - all from a single platform built for service businesses.
          </p>
          <div className="space-y-4">
            {[
              { icon: Clock, title: "Real-time Tracking", desc: "Know who's working, who's late, and who's missing in real time" },
              { icon: Users, title: "Team Management", desc: "Create schedules, manage employees, and track hours effortlessly" },
              { icon: Shield, title: "Client Portal", desc: "Give clients visibility into completed work and service reports" },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-background">
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{f.title}</p>
                  <p className="text-muted-foreground text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
