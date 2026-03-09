import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Mail, Phone, DollarSign } from "lucide-react";

export default function AdminEmployees() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "password123", hourlyRate: "" });

  const { data: employees, isLoading } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/employees", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee created" });
      setOpen(false);
      setFormData({ firstName: "", lastName: "", email: "", phone: "", password: "password123", hourlyRate: "" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = (employees || []).filter(e =>
    `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-employees-title">Employees</h1>
          <p className="text-muted-foreground text-sm mt-1">{employees?.length || 0} team members</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-employee"><Plus className="w-4 h-4 mr-1.5" />Add Employee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input data-testid="input-emp-first" value={formData.firstName} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input data-testid="input-emp-last" value={formData.lastName} onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input data-testid="input-emp-email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input data-testid="input-emp-phone" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Hourly Rate ($)</Label>
                <Input data-testid="input-emp-rate" type="number" step="0.01" value={formData.hourlyRate} onChange={e => setFormData(p => ({ ...p, hourlyRate: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-save-employee">
                {createMutation.isPending ? "Creating..." : "Create Employee"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input data-testid="input-search-employees" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No employees found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((emp: any) => (
            <Card key={emp.id} data-testid={`card-employee-${emp.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-sm">{emp.firstName[0]}{emp.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{emp.firstName} {emp.lastName}</p>
                      <Badge variant={emp.isActive ? "default" : "secondary"} className="text-xs">{emp.isActive ? "Active" : "Inactive"}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                    </div>
                    {emp.phone && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{emp.phone}</p>
                      </div>
                    )}
                    {emp.hourlyRate && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <DollarSign className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">${emp.hourlyRate}/hr</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Users(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
