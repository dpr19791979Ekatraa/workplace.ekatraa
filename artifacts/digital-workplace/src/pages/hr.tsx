import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListUsers, useListLeaves, useUpdateLeaveStatus, useCreateAnnouncement,
  useGetAttendanceSummary, useClockIn, useClockOut, useListAnnouncements,
  useGetCurrentUser, useDeleteAnnouncement, useCreateLeave,
  getListLeavesQueryKey, getListUsersQueryKey, getListAnnouncementsQueryKey,
  getGetAttendanceSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, Plus, Megaphone, Trash2 } from "lucide-react";

const leaveStatusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title required"),
  content: z.string().min(1, "Content required"),
  priority: z.string().default("normal"),
  pinned: z.boolean().default(false),
});

type CreateAnnouncementForm = z.infer<typeof createAnnouncementSchema>;

function CreateAnnouncementDialog() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const createAnn = useCreateAnnouncement();

  const form = useForm<CreateAnnouncementForm>({
    resolver: zodResolver(createAnnouncementSchema),
    defaultValues: { title: "", content: "", priority: "normal", pinned: false },
  });

  const onSubmit = (data: CreateAnnouncementForm) => {
    createAnn.mutate({ data: data as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
        toast({ title: "Announcement posted" });
        setOpen(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="create-announcement-button">
          <Plus className="w-4 h-4 mr-1" /> Post Announcement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post Announcement</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Announcement title" data-testid="input-announcement-title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="content" render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <Textarea placeholder="Announcement content..." rows={4} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="priority" render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createAnn.isPending} data-testid="submit-announcement">
                {createAnn.isPending ? "Posting..." : "Post"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const createLeaveSchema = z.object({
  type: z.string().min(1, "Type required"),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().min(1, "End date required"),
  reason: z.string().optional(),
}).refine(d => d.endDate >= d.startDate, { message: "End date must be after start date", path: ["endDate"] });

type CreateLeaveForm = z.infer<typeof createLeaveSchema>;

function CreateLeaveDialog({ currentUserId }: { currentUserId: number }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const createLeave = useCreateLeave();

  const form = useForm<CreateLeaveForm>({
    resolver: zodResolver(createLeaveSchema),
    defaultValues: { type: "annual", startDate: "", endDate: "", reason: "" },
  });

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const s = new Date(start);
    const e = new Date(end);
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  };

  const onSubmit = (data: CreateLeaveForm) => {
    const days = calcDays(data.startDate, data.endDate);
    createLeave.mutate({ data: { ...data, userId: currentUserId, days, status: "pending" } as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        toast({ title: "Leave request submitted" });
        setOpen(false);
        form.reset();
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? err?.message ?? "Failed to submit leave";
        toast({ title: msg, variant: "destructive" });
      },
    });
  };

  const start = form.watch("startDate");
  const end = form.watch("endDate");
  const previewDays = start && end ? calcDays(start, end) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="create-leave-button">
          <Plus className="w-4 h-4 mr-1" /> Request Leave
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Leave type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-leave-type"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="annual">Annual leave</SelectItem>
                    <SelectItem value="sick">Sick leave</SelectItem>
                    <SelectItem value="casual">Casual leave</SelectItem>
                    <SelectItem value="maternity">Maternity leave</SelectItem>
                    <SelectItem value="paternity">Paternity leave</SelectItem>
                    <SelectItem value="bereavement">Bereavement leave</SelectItem>
                    <SelectItem value="unpaid">Unpaid leave</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start date</FormLabel>
                  <FormControl>
                    <Input type="date" data-testid="input-leave-start" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>End date</FormLabel>
                  <FormControl>
                    <Input type="date" data-testid="input-leave-end" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            {previewDays !== null && (
              <p className="text-xs text-muted-foreground">Total: {previewDays} day{previewDays !== 1 ? "s" : ""}</p>
            )}
            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Reason (optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Briefly explain the reason..." rows={3} data-testid="input-leave-reason" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createLeave.isPending} data-testid="submit-leave">
                {createLeave.isPending ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function HRPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateLeave = useUpdateLeaveStatus();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const deleteAnn = useDeleteAnnouncement();
  const { data: currentUser } = useGetCurrentUser();

  const { data: employees, isLoading: empLoading } = useListUsers(undefined, {
    query: { queryKey: getListUsersQueryKey() }
  });
  const { data: leaves, isLoading: leavesLoading } = useListLeaves(undefined, {
    query: { queryKey: getListLeavesQueryKey() }
  });
  const { data: attendance } = useGetAttendanceSummary(undefined, {
    query: { queryKey: getGetAttendanceSummaryQueryKey() }
  });
  const { data: announcements, isLoading: annLoading } = useListAnnouncements(undefined, {
    query: { queryKey: getListAnnouncementsQueryKey() }
  });

  const isHR = currentUser?.role && ["super_admin", "admin", "hr_manager"].includes(currentUser.role);

  const handleLeaveAction = (id: number, status: "approved" | "rejected") => {
    updateLeave.mutate({ id, data: { status } as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        toast({ title: `Leave ${status}` });
      },
    });
  };

  const handleClockIn = () => {
    clockIn.mutate(undefined, {
      onSuccess: () => toast({ title: "Clocked in" }),
      onError: (e: any) => toast({ title: e?.message ?? "Already clocked in", variant: "destructive" }),
    });
  };

  const handleClockOut = () => {
    clockOut.mutate(undefined, {
      onSuccess: () => toast({ title: "Clocked out" }),
      onError: (e: any) => toast({ title: e?.message ?? "Not clocked in", variant: "destructive" }),
    });
  };

  return (
    <Layout title="HR Management">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Attendance quick actions */}
        <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Attendance</p>
            {attendance && (
              <p className="text-xs text-muted-foreground">
                {(attendance as any).presentDays} present · {(attendance as any).absentDays} absent · avg {(attendance as any).avgHoursPerDay}h/day this month
              </p>
            )}
          </div>
          <Button size="sm" onClick={handleClockIn} disabled={clockIn.isPending} data-testid="clock-in-button">
            Clock In
          </Button>
          <Button size="sm" variant="outline" onClick={handleClockOut} disabled={clockOut.isPending} data-testid="clock-out-button">
            Clock Out
          </Button>
        </div>

        <Tabs defaultValue="employees">
          <TabsList>
            <TabsTrigger value="employees" data-testid="tab-employees">Employees</TabsTrigger>
            <TabsTrigger value="leaves" data-testid="tab-leaves">Leave Requests</TabsTrigger>
            <TabsTrigger value="announcements" data-testid="tab-announcements">Announcements</TabsTrigger>
          </TabsList>

          {/* Employees tab */}
          <TabsContent value="employees" className="mt-4 space-y-3">
            {empLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {((employees as any)?.users ?? []).map((emp: any) => (
                  <Card key={emp.id} data-testid={`employee-card-${emp.id}`}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={emp.avatarUrl} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {emp.firstName?.[0]}{emp.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{emp.jobTitle ?? emp.role?.replace(/_/g, " ")}</p>
                        {emp.departmentName && (
                          <p className="text-xs text-muted-foreground">{emp.departmentName}</p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs flex-shrink-0 ${emp.status === "active" ? "border-emerald-200 text-emerald-600" : "border-slate-200 text-slate-500"}`}
                      >
                        {emp.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Leaves tab */}
          <TabsContent value="leaves" className="mt-4 space-y-3">
            <div className="flex justify-end">
              {currentUser?.id && <CreateLeaveDialog currentUserId={currentUser.id} />}
            </div>
            {leavesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            ) : (leaves as any[])?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No leave requests</div>
            ) : (
              <div className="space-y-3">
                {((leaves as any[]) ?? []).map((leave: any) => (
                  <Card key={leave.id} data-testid={`leave-request-${leave.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={leave.userAvatar} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {leave.userName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{leave.userName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${leaveStatusColors[leave.status] ?? ""}`}>
                              {leave.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {leave.type} · {leave.startDate} to {leave.endDate} ({leave.days} day{leave.days !== 1 ? "s" : ""})
                          </p>
                          {leave.reason && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{leave.reason}</p>
                          )}
                        </div>
                        {isHR && leave.status === "pending" && (
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                              data-testid={`approve-leave-${leave.id}`}
                              onClick={() => handleLeaveAction(leave.id, "approved")}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 border-red-200 text-red-600 hover:bg-red-50"
                              data-testid={`reject-leave-${leave.id}`}
                              onClick={() => handleLeaveAction(leave.id, "rejected")}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Announcements tab */}
          <TabsContent value="announcements" className="mt-4 space-y-4">
            <div className="flex justify-end">
              {isHR && <CreateAnnouncementDialog />}
            </div>
            {annLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            ) : (announcements as any[])?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No announcements</div>
            ) : (
              <div className="space-y-3">
                {((announcements as any[]) ?? []).map((a: any) => (
                  <Card key={a.id} data-testid={`announcement-item-${a.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Megaphone className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{a.title}</span>
                            <Badge variant="outline" className="text-xs">{a.priority}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{a.content}</p>
                          <p className="text-xs text-muted-foreground mt-2">— {a.authorName}</p>
                        </div>
                        {isHR && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                            data-testid={`delete-announcement-${a.id}`}
                            onClick={() => {
                              deleteAnn.mutate({ id: a.id }, {
                                onSuccess: () => qc.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() }),
                              });
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
