import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListUsers, useUpdateUser, useDeleteUser, useListDepartments,
  useCreateDepartment, useDeleteDepartment, useGetCurrentUser,
  getListUsersQueryKey, getListDepartmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Building2, Search } from "lucide-react";

const roleColors: Record<string, string> = {
  super_admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  admin: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  hr_manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  team_leader: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  employee: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  guest: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
};

const createDeptSchema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
});

type CreateDeptForm = z.infer<typeof createDeptSchema>;

function CreateDepartmentDialog() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const createDept = useCreateDepartment();

  const form = useForm<CreateDeptForm>({
    resolver: zodResolver(createDeptSchema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = (data: CreateDeptForm) => {
    createDept.mutate({ data: data as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
        toast({ title: "Department created" });
        setOpen(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="create-department-button">
          <Plus className="w-4 h-4 mr-1" /> Add Department
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Department</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Department name" data-testid="input-department-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Optional description" {...field} />
                </FormControl>
              </FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createDept.isPending} data-testid="submit-create-department">
                {createDept.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPage() {
  const [userSearch, setUserSearch] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const deleteDept = useDeleteDepartment();
  const { data: currentUser } = useGetCurrentUser();

  const { data: usersData, isLoading: usersLoading } = useListUsers(
    { search: userSearch || undefined },
    { query: { queryKey: getListUsersQueryKey({ search: userSearch || undefined }) } }
  );
  const { data: departments, isLoading: deptsLoading } = useListDepartments({
    query: { queryKey: getListDepartmentsQueryKey() }
  });

  const handleRoleChange = (userId: number, role: string) => {
    updateUser.mutate({ id: userId, data: { role: role as any } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "Role updated" });
      },
    });
  };

  const handleStatusToggle = (userId: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    updateUser.mutate({ id: userId, data: { status: newStatus as any } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: `User ${newStatus}` });
      },
    });
  };

  const handleDeleteUser = (userId: number) => {
    deleteUser.mutate({ id: userId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "User deleted" });
      },
    });
  };

  const isSuperAdmin = currentUser?.role === "super_admin" || currentUser?.role === "admin";

  return (
    <Layout title="Admin">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="departments" data-testid="tab-departments">Departments</TabsTrigger>
          </TabsList>

          {/* Users tab */}
          <TabsContent value="users" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-9"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                data-testid="search-users"
              />
            </div>

            {usersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {(((usersData as any)?.users ?? []) as any[]).map((user: any) => (
                  <Card key={user.id} data-testid={`user-row-${user.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-9 h-9 flex-shrink-0">
                          <AvatarImage src={user.avatarUrl} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Select value={user.role} onValueChange={(v) => handleRoleChange(user.id, v)}>
                            <SelectTrigger className="h-7 text-xs w-32 hidden sm:flex" data-testid={`user-role-${user.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="hr_manager">HR Manager</SelectItem>
                              <SelectItem value="team_leader">Team Leader</SelectItem>
                              <SelectItem value="employee">Employee</SelectItem>
                              <SelectItem value="guest">Guest</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-7 text-xs hidden md:flex ${user.status === "active" ? "border-emerald-200 text-emerald-600" : "border-slate-200 text-slate-500"}`}
                            data-testid={`toggle-user-status-${user.id}`}
                            onClick={() => handleStatusToggle(user.id, user.status)}
                          >
                            {user.status}
                          </Button>
                          {isSuperAdmin && user.id !== currentUser?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              data-testid={`delete-user-${user.id}`}
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Departments tab */}
          <TabsContent value="departments" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <CreateDepartmentDialog />
            </div>
            {deptsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {((departments as any[]) ?? []).map((dept: any) => (
                  <Card key={dept.id} data-testid={`department-card-${dept.id}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          data-testid={`delete-department-${dept.id}`}
                          onClick={() => {
                            deleteDept.mutate({ id: dept.id }, {
                              onSuccess: () => {
                                qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
                                toast({ title: "Department deleted" });
                              },
                            });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <h3 className="font-semibold text-foreground">{dept.name}</h3>
                      {dept.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{dept.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-3">
                        {dept.memberCount} member{dept.memberCount !== 1 ? "s" : ""}
                      </p>
                    </CardContent>
                  </Card>
                ))}
                {(departments as any[])?.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
                    No departments yet
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
