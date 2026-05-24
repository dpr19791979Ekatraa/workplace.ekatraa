import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal,
  useListKpis, useCreateKpi, useUpdateKpi, useDeleteKpi,
  useListPerfReviews, useCreatePerfReview,
  useListAppraisals, useCreateAppraisal, useUpdateAppraisalStatus,
  useListPromotions, useCreatePromotion, useUpdatePromotionStatus,
  useGetPerformanceAnalytics, useGetCurrentUser, useListUsers,
  getListGoalsQueryKey, getListKpisQueryKey, getListPerfReviewsQueryKey,
  getListAppraisalsQueryKey, getListPromotionsQueryKey, getGetPerformanceAnalyticsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Target, TrendingUp, MessageSquare, Users as UsersIcon, Star, Award, BarChart3,
  Plus, Trash2, Check, X, Edit, Sparkles, Briefcase,
} from "lucide-react";

const GOAL_CATEGORIES = ["personal", "team", "business", "learning", "leadership"];
const REVIEW_TYPES = [
  { value: "self", label: "Self review" },
  { value: "manager", label: "Manager review" },
  { value: "peer", label: "Peer feedback" },
  { value: "upward", label: "Upward feedback" },
];
const RATING_CRITERIA = ["Communication", "Teamwork", "Quality", "Initiative", "Leadership"];

const statusColors: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  missed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  proposed: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  effective: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
}

function StatTile({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold leading-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Goals tab ─────────────────────────────────────────────────────────
function GoalsTab({ isHr, users, currentUserId }: { isHr: boolean; users: any[]; currentUserId?: number }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("personal");
  const [weight, setWeight] = useState(1);
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");

  const { data: goals, isLoading } = useListGoals();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const del = useDeleteGoal();
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });

  const reset = () => {
    setTitle(""); setDescription(""); setCategory("personal"); setWeight(1);
    setTargetValue(""); setUnit(""); setDueDate(""); setAssigneeId("");
  };

  const submit = async () => {
    if (!title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    try {
      await create.mutateAsync({
        data: {
          title: title.trim(),
          description: description.trim() || null,
          category,
          weight,
          targetValue: targetValue ? Number(targetValue) : null,
          unit: unit.trim() || null,
          dueDate: dueDate || null,
          userId: isHr && assigneeId ? Number(assigneeId) : null,
        } as any,
      });
      toast({ title: "Goal created" });
      setOpen(false); reset(); invalidate();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  const updateProgress = async (id: number, currentValue: number) => {
    try {
      await update.mutateAsync({ id, data: { currentValue } as any });
      invalidate();
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message, variant: "destructive" });
    }
  };

  const changeStatus = async (id: number, status: string) => {
    try {
      await update.mutateAsync({ id, data: { status } as any });
      toast({ title: `Goal ${status.replace("_", " ")}` });
      invalidate();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this goal?")) return;
    try {
      await del.mutateAsync({ id });
      invalidate();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-goal" className="gap-2"><Plus className="w-4 h-4" /> New goal</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create goal</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              {isHr && (
                <div className="space-y-1.5">
                  <Label>Assign to</Label>
                  <Select value={assigneeId || "self"} onValueChange={(v) => setAssigneeId(v === "self" ? "" : v)}>
                    <SelectTrigger data-testid="select-goal-assignee"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">Myself</SelectItem>
                      {users.filter((u: any) => u.id !== currentUserId).map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="g-title">Title</Label>
                <Input id="g-title" data-testid="input-goal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ship Q3 release" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-desc">Description</Label>
                <Textarea id="g-desc" data-testid="input-goal-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger data-testid="select-goal-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GOAL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="g-weight">Weight (1-10)</Label>
                  <Input id="g-weight" type="number" min={1} max={10} value={weight} onChange={(e) => setWeight(Number(e.target.value) || 1)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="g-target">Target</Label>
                  <Input id="g-target" type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="100" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="g-unit">Unit</Label>
                  <Input id="g-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, $, units" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="g-due">Due</Label>
                  <Input id="g-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="button-save-goal" onClick={submit} disabled={create.isPending}>{create.isPending ? "Saving..." : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : !goals || goals.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No goals yet. Create your first one.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((g: any) => (
            <Card key={g.id} data-testid={`goal-card-${g.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Target className="w-4 h-4 text-primary flex-shrink-0" />
                      <h3 className="font-semibold truncate">{g.title}</h3>
                      <Badge variant="outline" className="text-[10px]">{g.category}</Badge>
                      <Badge className={`${statusColors[g.status]} text-[10px]`}>{g.status.replace("_", " ")}</Badge>
                    </div>
                    {g.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{g.description}</p>}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>Owner: {g.userName}</span>
                      {g.dueDate && <span>· Due {new Date(g.dueDate).toLocaleDateString()}</span>}
                      <span>· W{g.weight}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(g.id)} data-testid={`button-delete-goal-${g.id}`}><Trash2 className="w-4 h-4" /></Button>
                </div>
                {g.targetValue ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span>{g.currentValue ?? 0} / {g.targetValue} {g.unit ?? ""}</span>
                      <span className="font-medium">{g.progressPercent}%</span>
                    </div>
                    <Progress value={g.progressPercent} className="h-2" />
                    <div className="flex gap-1.5 items-center">
                      <Input
                        type="number"
                        defaultValue={g.currentValue ?? 0}
                        className="h-7 text-xs"
                        data-testid={`input-progress-${g.id}`}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== (g.currentValue ?? 0)) updateProgress(g.id, v);
                        }}
                      />
                      {g.status !== "completed" && (
                        <Button size="sm" variant="outline" onClick={() => changeStatus(g.id, "completed")} data-testid={`button-complete-${g.id}`}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    {g.status !== "in_progress" && <Button size="sm" variant="outline" onClick={() => changeStatus(g.id, "in_progress")}>Start</Button>}
                    {g.status !== "completed" && <Button size="sm" variant="outline" onClick={() => changeStatus(g.id, "completed")}><Check className="w-3.5 h-3.5 mr-1" />Complete</Button>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KPIs tab ──────────────────────────────────────────────────────────
function KpisTab({ isHr, users, currentUserId }: { isHr: boolean; users: any[]; currentUserId?: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [unit, setUnit] = useState("");
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("quarterly");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");

  const { data: kpis, isLoading } = useListKpis();
  const create = useCreateKpi();
  const update = useUpdateKpi();
  const del = useDeleteKpi();
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListKpisQueryKey() });

  const reset = () => {
    setName(""); setTarget(""); setCurrent("0"); setUnit("");
    setPeriod("quarterly"); setPeriodStart(""); setPeriodEnd(""); setAssigneeId("");
  };

  const submit = async () => {
    if (!name.trim() || !target || !periodStart || !periodEnd) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    try {
      await create.mutateAsync({
        data: {
          name: name.trim(),
          target: Number(target),
          current: Number(current) || 0,
          unit: unit.trim() || null,
          period,
          periodStart,
          periodEnd,
          userId: isHr && assigneeId ? Number(assigneeId) : null,
        } as any,
      });
      toast({ title: "KPI created" });
      setOpen(false); reset(); invalidate();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  const updateCurrent = async (id: number, v: number) => {
    try { await update.mutateAsync({ id, data: { current: v } as any }); invalidate(); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete KPI?")) return;
    try { await del.mutateAsync({ id }); invalidate(); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-kpi" className="gap-2"><Plus className="w-4 h-4" /> New KPI</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create KPI</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              {isHr && (
                <div className="space-y-1.5">
                  <Label>Assign to</Label>
                  <Select value={assigneeId || "self"} onValueChange={(v) => setAssigneeId(v === "self" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">Myself</SelectItem>
                      {users.filter((u: any) => u.id !== currentUserId).map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="k-name">Metric name</Label>
                <Input id="k-name" data-testid="input-kpi-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly revenue" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Target</Label>
                  <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="100000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Current</Label>
                  <Input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="$, %, count" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Period</Label>
                  <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Start</Label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>End</Label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="button-save-kpi" onClick={submit} disabled={create.isPending}>{create.isPending ? "Saving..." : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : !kpis || kpis.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No KPIs yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {kpis.map((k: any) => {
            const onTrack = k.attainmentPercent >= 80;
            return (
              <Card key={k.id} data-testid={`kpi-card-${k.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold truncate">{k.name}</h3>
                        <Badge variant="outline" className="text-[10px]">{k.period}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {k.userName} · {new Date(k.periodStart).toLocaleDateString()} → {new Date(k.periodEnd).toLocaleDateString()}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => remove(k.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span>{k.current} / {k.target} {k.unit ?? ""}</span>
                      <span className={`font-medium ${onTrack ? "text-emerald-600" : "text-amber-600"}`}>{k.attainmentPercent}%</span>
                    </div>
                    <Progress value={Math.min(100, k.attainmentPercent)} className="h-2" />
                    <Input
                      type="number"
                      defaultValue={k.current}
                      className="h-7 text-xs"
                      data-testid={`input-kpi-current-${k.id}`}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== k.current) updateCurrent(k.id, v);
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Reviews tab (covers reviews + 360 via 'type') ────────────────────
function ReviewsTab({ users, currentUserId, type }: { users: any[]; currentUserId?: number; type: "review" | "360" }) {
  const [open, setOpen] = useState(false);
  const [revieweeId, setRevieweeId] = useState<string>("");
  const [cycle, setCycle] = useState(`${new Date().getFullYear()}-H${Math.ceil((new Date().getMonth() + 1) / 6)}`);
  const [reviewType, setReviewType] = useState<string>(type === "360" ? "peer" : "manager");
  const [anonymous, setAnonymous] = useState(type === "360");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [comments, setComments] = useState("");

  const { data: reviews, isLoading } = useListPerfReviews();
  const create = useCreatePerfReview();
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListPerfReviewsQueryKey() });

  // Filter by type set
  const filtered = (reviews || []).filter((r: any) =>
    type === "360" ? (r.type === "peer" || r.type === "upward") : (r.type === "self" || r.type === "manager")
  );

  const overall = Object.values(ratings).length > 0
    ? Math.round((Object.values(ratings).reduce((a, b) => a + b, 0) / Object.values(ratings).length) * 100) / 100
    : null;

  const reset = () => {
    setRevieweeId(""); setReviewType(type === "360" ? "peer" : "manager");
    setRatings({}); setStrengths(""); setImprovements(""); setComments(""); setAnonymous(type === "360");
  };

  const submit = async () => {
    const id = reviewType === "self" ? currentUserId : Number(revieweeId);
    if (!id) { toast({ title: "Select reviewee", variant: "destructive" }); return; }
    if (!cycle.trim()) { toast({ title: "Cycle required", variant: "destructive" }); return; }
    try {
      await create.mutateAsync({
        data: {
          revieweeId: id,
          cycle: cycle.trim(),
          type: reviewType,
          anonymous,
          ratings,
          overallRating: overall,
          strengths: strengths.trim() || null,
          improvements: improvements.trim() || null,
          comments: comments.trim() || null,
          submit: true,
        } as any,
      });
      toast({ title: "Feedback submitted" });
      setOpen(false); reset(); invalidate();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid={`button-add-${type}`} className="gap-2"><Plus className="w-4 h-4" /> Give feedback</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{type === "360" ? "360° Feedback" : "Performance Review"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={reviewType} onValueChange={setReviewType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(type === "360"
                        ? REVIEW_TYPES.filter((t) => t.value === "peer" || t.value === "upward")
                        : REVIEW_TYPES.filter((t) => t.value === "self" || t.value === "manager")
                      ).map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cycle</Label>
                  <Input value={cycle} onChange={(e) => setCycle(e.target.value)} placeholder="2026-H1" />
                </div>
              </div>
              {reviewType !== "self" && (
                <div className="space-y-1.5">
                  <Label>Reviewee</Label>
                  <Select value={revieweeId} onValueChange={setRevieweeId}>
                    <SelectTrigger data-testid="select-reviewee"><SelectValue placeholder="Pick teammate" /></SelectTrigger>
                    <SelectContent>
                      {users.filter((u: any) => u.id !== currentUserId).map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {type === "360" && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={anonymous} onCheckedChange={(c) => setAnonymous(c === true)} />
                  Submit anonymously
                </label>
              )}
              <div className="space-y-2">
                <Label>Ratings (1-5)</Label>
                {RATING_CRITERIA.map((c) => (
                  <div key={c} className="flex items-center justify-between gap-3">
                    <span className="text-sm w-32">{c}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRatings((p) => ({ ...p, [c]: n }))}
                          className="p-0.5"
                          data-testid={`rating-${c}-${n}`}
                        >
                          <Star className={`w-5 h-5 ${(ratings[c] ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {overall !== null && (
                  <p className="text-xs text-muted-foreground text-right">Overall: <span className="font-medium">{overall} / 5</span></p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Strengths</Label>
                <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} placeholder="What they do well" />
              </div>
              <div className="space-y-1.5">
                <Label>Areas to improve</Label>
                <Textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={2} placeholder="Growth areas" />
              </div>
              <div className="space-y-1.5">
                <Label>Additional comments</Label>
                <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="button-submit-review" onClick={submit} disabled={create.isPending}>{create.isPending ? "Sending..." : "Submit"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No feedback yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((r: any) => (
            <Card key={r.id} data-testid={`review-card-${r.id}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">{r.type}</Badge>
                    <Badge className={`${statusColors[r.status]} text-[10px]`}>{r.status}</Badge>
                    <span className="text-xs text-muted-foreground">{r.cycle}</span>
                  </div>
                  {r.overallRating != null && (
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> {r.overallRating}
                    </div>
                  )}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">For </span>
                  <span className="font-medium">{r.revieweeName}</span>
                  <span className="text-muted-foreground"> by {r.reviewerName}</span>
                </div>
                {r.strengths && <p className="text-xs"><span className="font-medium text-emerald-700 dark:text-emerald-400">Strengths:</span> {r.strengths}</p>}
                {r.improvements && <p className="text-xs"><span className="font-medium text-amber-700 dark:text-amber-400">Improve:</span> {r.improvements}</p>}
                {r.comments && <p className="text-xs text-muted-foreground italic">"{r.comments}"</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Appraisals tab ────────────────────────────────────────────────────
function AppraisalsTab({ isHr, users, currentUserId }: { isHr: boolean; users: any[]; currentUserId?: number }) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [cycle, setCycle] = useState(`${new Date().getFullYear()}-Annual`);
  const [finalRating, setFinalRating] = useState(3);
  const [salaryChangePercent, setSalaryChangePercent] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: appraisals, isLoading } = useListAppraisals();
  const create = useCreateAppraisal();
  const updateStatus = useUpdateAppraisalStatus();
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListAppraisalsQueryKey() });

  const reset = () => { setUserId(""); setFinalRating(3); setSalaryChangePercent(""); setBonusAmount(""); setNotes(""); };

  const submit = async () => {
    if (!userId) { toast({ title: "Select employee", variant: "destructive" }); return; }
    try {
      await create.mutateAsync({
        data: {
          userId: Number(userId),
          cycle: cycle.trim(),
          finalRating,
          salaryChangePercent: salaryChangePercent ? Number(salaryChangePercent) : null,
          bonusAmount: bonusAmount ? Number(bonusAmount) : null,
          currency: "INR",
          notes: notes.trim() || null,
        } as any,
      });
      toast({ title: "Appraisal proposed" });
      setOpen(false); reset(); invalidate();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  const decide = async (id: number, status: "approved" | "rejected") => {
    try {
      await updateStatus.mutateAsync({ id, data: { status } });
      toast({ title: `Appraisal ${status}` });
      invalidate();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {isHr && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-appraisal" className="gap-2"><Plus className="w-4 h-4" /> Propose appraisal</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Propose appraisal</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Employee</Label>
                    <Select value={userId} onValueChange={setUserId}>
                      <SelectTrigger data-testid="select-appraisal-user"><SelectValue placeholder="Pick" /></SelectTrigger>
                      <SelectContent>
                        {users.filter((u: any) => u.id !== currentUserId).map((u: any) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cycle</Label>
                    <Input value={cycle} onChange={(e) => setCycle(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Final rating (1-5)</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setFinalRating(n)} className="p-0.5">
                        <Star className={`w-6 h-6 ${finalRating >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Salary change %</Label>
                    <Input type="number" step="0.1" value={salaryChangePercent} onChange={(e) => setSalaryChangePercent(e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bonus (₹)</Label>
                    <Input type="number" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} placeholder="0" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button data-testid="button-save-appraisal" onClick={submit} disabled={create.isPending}>{create.isPending ? "Saving..." : "Propose"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : !appraisals || appraisals.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No appraisals yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {appraisals.map((a: any) => (
            <Card key={a.id} data-testid={`appraisal-card-${a.id}`}>
              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-9 h-9"><AvatarImage src={a.userAvatar ?? undefined} /><AvatarFallback>{initials(a.userName)}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <p className="font-medium">{a.userName}</p>
                    <p className="text-xs text-muted-foreground">{a.cycle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm font-medium">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> {a.finalRating}
                </div>
                <div className="text-sm">
                  {a.salaryChangePercent != null && <span className="mr-3">📈 {a.salaryChangePercent}%</span>}
                  {a.bonusAmount != null && <span>💰 ₹{a.bonusAmount.toLocaleString()}</span>}
                </div>
                <Badge className={statusColors[a.status]}>{a.status}</Badge>
                {isHr && a.status === "pending" && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => decide(a.id, "approved")} data-testid={`button-approve-appraisal-${a.id}`}><Check className="w-3.5 h-3.5 mr-1" />Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(a.id, "rejected")} data-testid={`button-reject-appraisal-${a.id}`}><X className="w-3.5 h-3.5 mr-1" />Reject</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Promotions tab ────────────────────────────────────────────────────
function PromotionsTab({ isHr, users, currentUserId }: { isHr: boolean; users: any[]; currentUserId?: number }) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [fromTitle, setFromTitle] = useState("");
  const [toTitle, setToTitle] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: promotions, isLoading } = useListPromotions();
  const create = useCreatePromotion();
  const updateStatus = useUpdatePromotionStatus();
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() });

  const reset = () => { setUserId(""); setFromTitle(""); setToTitle(""); setEffectiveDate(""); setReason(""); };

  const submit = async () => {
    if (!userId || !fromTitle.trim() || !toTitle.trim() || !effectiveDate) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    try {
      await create.mutateAsync({
        data: {
          userId: Number(userId),
          fromTitle: fromTitle.trim(),
          toTitle: toTitle.trim(),
          effectiveDate,
          reason: reason.trim() || null,
        } as any,
      });
      toast({ title: "Promotion proposed" });
      setOpen(false); reset(); invalidate();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  const decide = async (id: number, status: "approved" | "rejected" | "effective") => {
    try {
      await updateStatus.mutateAsync({ id, data: { status } });
      toast({ title: `Promotion ${status}` });
      invalidate();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  const userSelected = users.find((u: any) => String(u.id) === userId);

  return (
    <div className="space-y-4">
      {isHr && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-promotion" className="gap-2"><Plus className="w-4 h-4" /> Propose promotion</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Propose promotion</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label>Employee</Label>
                  <Select value={userId} onValueChange={(v) => {
                    setUserId(v);
                    const u = users.find((x: any) => String(x.id) === v);
                    if (u?.jobTitle) setFromTitle(u.jobTitle);
                  }}>
                    <SelectTrigger data-testid="select-promotion-user"><SelectValue placeholder="Pick" /></SelectTrigger>
                    <SelectContent>
                      {users.filter((u: any) => u.id !== currentUserId).map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName} {u.jobTitle ? `— ${u.jobTitle}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>From title</Label>
                    <Input value={fromTitle} onChange={(e) => setFromTitle(e.target.value)} placeholder={userSelected?.jobTitle ?? "Junior Engineer"} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>To title</Label>
                    <Input value={toTitle} onChange={(e) => setToTitle(e.target.value)} placeholder="Senior Engineer" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Effective date</Label>
                  <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Performance, scope expansion..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button data-testid="button-save-promotion" onClick={submit} disabled={create.isPending}>{create.isPending ? "Saving..." : "Propose"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : !promotions || promotions.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No promotion proposals.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {promotions.map((p: any) => (
            <Card key={p.id} data-testid={`promotion-card-${p.id}`}>
              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-9 h-9"><AvatarImage src={p.userAvatar ?? undefined} /><AvatarFallback>{initials(p.userName)}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <p className="font-medium">{p.userName}</p>
                    <p className="text-xs text-muted-foreground">{p.fromTitle} → <span className="text-primary font-medium">{p.toTitle}</span></p>
                    <p className="text-xs text-muted-foreground">Effective {new Date(p.effectiveDate).toLocaleDateString()}{p.requestedByName ? ` · by ${p.requestedByName}` : ""}</p>
                  </div>
                </div>
                <Badge className={statusColors[p.status]}>{p.status}</Badge>
                {isHr && p.status === "proposed" && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => decide(p.id, "approved")}><Check className="w-3.5 h-3.5 mr-1" />Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(p.id, "rejected")}><X className="w-3.5 h-3.5 mr-1" />Reject</Button>
                  </div>
                )}
                {isHr && p.status === "approved" && (
                  <Button size="sm" onClick={() => decide(p.id, "effective")} data-testid={`button-effective-${p.id}`}>Mark effective</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────
function AnalyticsTab() {
  const { data, isLoading } = useGetPerformanceAnalytics();
  if (isLoading || !data) return <div className="grid gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  const maxBucket = Math.max(1, ...data.ratingDistribution.map((b: any) => b.count));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <StatTile icon={Target} label="Goal completion" value={`${data.goalCompletionRate}%`} sub={`${data.completedGoals}/${data.totalGoals}`} />
        <StatTile icon={TrendingUp} label="Avg KPI attainment" value={`${data.avgKpiAttainment}%`} />
        <StatTile icon={Star} label="Avg rating" value={data.avgOverallRating} sub={`${data.reviewsSubmitted} reviews`} />
        <StatTile icon={Award} label="Pending decisions" value={data.pendingAppraisals + data.pendingPromotions} sub={`${data.pendingAppraisals} appraisals · ${data.pendingPromotions} promos`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Top performers</CardTitle></CardHeader>
          <CardContent>
            {data.topPerformers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Not enough data yet.</p>
            ) : (
              <div className="space-y-2.5">
                {data.topPerformers.map((p: any) => (
                  <div key={p.userId} className="flex items-center justify-between gap-3" data-testid={`top-performer-${p.userId}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="w-8 h-8"><AvatarImage src={p.userAvatar ?? undefined} /><AvatarFallback className="text-xs">{initials(p.userName)}</AvatarFallback></Avatar>
                      <span className="text-sm font-medium truncate">{p.userName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{p.avgRating}</span>
                      <span className="text-muted-foreground text-xs">{p.goalsCompleted} ✓</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Rating distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.ratingDistribution.map((b: any) => (
                <div key={b.bucket} className="flex items-center gap-2">
                  <span className="text-xs w-6 text-muted-foreground">{b.bucket}★</span>
                  <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                    <div className="h-full bg-primary/60 transition-all" style={{ width: `${(b.count / maxBucket) * 100}%` }} />
                  </div>
                  <span className="text-xs w-8 text-right tabular-nums">{b.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function PerformancePage() {
  const [tab, setTab] = useState("goals");
  const { data: currentUser } = useGetCurrentUser();
  const { data: usersData } = useListUsers();
  const users: any[] = Array.isArray(usersData) ? usersData : (usersData as any)?.users ?? [];
  const isHr = !!currentUser?.role && ["super_admin", "admin", "hr_manager"].includes(currentUser.role);

  return (
    <Layout title="Performance">
      <div className="p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" /> Performance Management
            </CardTitle>
            <p className="text-sm text-muted-foreground">Set goals, track KPIs, run reviews, manage appraisals and promotions.</p>
          </CardHeader>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="goals" data-testid="tab-goals"><Target className="w-4 h-4 mr-1.5" />Goals</TabsTrigger>
            <TabsTrigger value="kpis" data-testid="tab-kpis"><TrendingUp className="w-4 h-4 mr-1.5" />KPIs</TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews"><MessageSquare className="w-4 h-4 mr-1.5" />Reviews</TabsTrigger>
            <TabsTrigger value="360" data-testid="tab-360"><UsersIcon className="w-4 h-4 mr-1.5" />360° Feedback</TabsTrigger>
            <TabsTrigger value="appraisals" data-testid="tab-appraisals"><Award className="w-4 h-4 mr-1.5" />Appraisals</TabsTrigger>
            <TabsTrigger value="promotions" data-testid="tab-promotions"><Edit className="w-4 h-4 mr-1.5" />Promotions</TabsTrigger>
            {isHr && <TabsTrigger value="analytics" data-testid="tab-analytics"><BarChart3 className="w-4 h-4 mr-1.5" />Analytics</TabsTrigger>}
          </TabsList>
          <TabsContent value="goals" className="mt-4"><GoalsTab isHr={isHr} users={users} currentUserId={currentUser?.id} /></TabsContent>
          <TabsContent value="kpis" className="mt-4"><KpisTab isHr={isHr} users={users} currentUserId={currentUser?.id} /></TabsContent>
          <TabsContent value="reviews" className="mt-4"><ReviewsTab users={users} currentUserId={currentUser?.id} type="review" /></TabsContent>
          <TabsContent value="360" className="mt-4"><ReviewsTab users={users} currentUserId={currentUser?.id} type="360" /></TabsContent>
          <TabsContent value="appraisals" className="mt-4"><AppraisalsTab isHr={isHr} users={users} currentUserId={currentUser?.id} /></TabsContent>
          <TabsContent value="promotions" className="mt-4"><PromotionsTab isHr={isHr} users={users} currentUserId={currentUser?.id} /></TabsContent>
          {isHr && <TabsContent value="analytics" className="mt-4"><AnalyticsTab /></TabsContent>}
        </Tabs>
      </div>
    </Layout>
  );
}
