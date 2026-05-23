import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  useGetDashboardAnalytics, useGetProductivityAnalytics, useGetCurrentUser,
  getGetDashboardAnalyticsQueryKey, getGetProductivityAnalyticsQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const COLORS = ["#6366f1", "#38bdf8", "#34d399", "#f59e0b", "#f43f5e"];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("month");

  const { data: currentUser } = useGetCurrentUser();
  const isManager = currentUser?.role && ["super_admin", "admin", "hr_manager", "manager", "team_leader"].includes(currentUser.role);
  const isAdmin = currentUser?.role && ["super_admin", "admin"].includes(currentUser.role);

  const { data: teamPerf, isLoading: teamLoading } = useQuery({
    queryKey: ["analytics", "team-performance"],
    queryFn: () => customFetch<any[]>("/api/analytics/team-performance"),
    enabled: !!isAdmin,
  });

  const { data: dashboard, isLoading: dashLoading } = useGetDashboardAnalytics({
    query: { queryKey: getGetDashboardAnalyticsQueryKey() }
  });
  const { data: productivity, isLoading: prodLoading } = useGetProductivityAnalytics(
    { period },
    { query: { queryKey: getGetProductivityAnalyticsQueryKey({ period }) } }
  );

  const tasksByStatus = ((dashboard as any)?.tasksByStatus ?? []) as { label: string; count: number }[];
  const projectsByStatus = ((dashboard as any)?.projectsByStatus ?? []) as { label: string; count: number }[];
  const weeklyTrend = ((productivity as any)?.weeklyTrend ?? []) as { label: string; value: number }[];
  const topPerformers = ((productivity as any)?.topPerformers ?? []) as any[];

  return (
    <Layout title={isManager ? "Analytics" : "My Analytics"}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 text-center">
              {prodLoading ? <Skeleton className="h-10 w-16 mx-auto" /> : (
                <p className="text-3xl font-bold text-foreground" data-testid="kpi-completion-rate">
                  {(productivity as any)?.taskCompletionRate ?? 0}%
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">{isManager ? "Task Completion Rate" : "My Completion Rate"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              {prodLoading ? <Skeleton className="h-10 w-16 mx-auto" /> : (
                <p className="text-3xl font-bold text-foreground" data-testid="kpi-avg-tasks">
                  {(productivity as any)?.avgTasksPerDay ?? 0}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">{isManager ? "Avg Tasks/Day" : "My Avg Tasks/Day"}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 lg:col-span-1">
            <CardContent className="p-5 text-center">
              {dashLoading ? <Skeleton className="h-10 w-16 mx-auto" /> : (
                <p className="text-3xl font-bold text-foreground">
                  {(dashboard as any)?.activeProjects ?? 0}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">Active Projects</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks by status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{isManager ? "Tasks by Status" : "My Tasks by Status"}</CardTitle>
            </CardHeader>
            <CardContent>
              {dashLoading ? <Skeleton className="h-48 w-full" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={tasksByStatus} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Projects by status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{isManager ? "Projects by Status" : "My Projects by Status"}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {dashLoading ? <Skeleton className="h-48 w-48 rounded-full" /> : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={projectsByStatus}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {projectsByStatus.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5">
                    {projectsByStatus.map((item, idx) => (
                      <div key={item.label} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: COLORS[idx % COLORS.length] }}
                        />
                        <span className="text-muted-foreground capitalize">{item.label.replace("_", " ")}</span>
                        <span className="font-medium text-foreground ml-auto pl-2">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly trend */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Task Completion Trend</CardTitle>
              <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                <SelectTrigger className="h-7 text-xs w-28" data-testid="period-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="quarter">Quarter</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {prodLoading ? <Skeleton className="h-48 w-full" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weeklyTrend} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top performers (managers only) */}
          {isManager && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Top Performers</CardTitle>
            </CardHeader>
            <CardContent>
              {prodLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : topPerformers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
              ) : (
                <div className="space-y-3">
                  {topPerformers.map((p, idx) => (
                    <div key={p.userId} data-testid={`performer-${p.userId}`} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-4">{idx + 1}</span>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={p.avatarUrl} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {p.userName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.userName}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {p.completedTasks} tasks
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </div>

        {/* Team performance — admins only */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Team Performance</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {teamPerf?.length ?? 0} employees
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {teamLoading ? (
                <div className="p-5 space-y-2">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : !teamPerf || teamPerf.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No employees yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="text-left px-5 py-3 font-medium">Employee</th>
                        <th className="text-left px-3 py-3 font-medium">Department</th>
                        <th className="text-center px-3 py-3 font-medium">Total</th>
                        <th className="text-center px-3 py-3 font-medium">Done</th>
                        <th className="text-center px-3 py-3 font-medium">In Progress</th>
                        <th className="text-center px-3 py-3 font-medium">Overdue</th>
                        <th className="text-center px-3 py-3 font-medium">Projects</th>
                        <th className="text-left px-5 py-3 font-medium w-56">Completion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {teamPerf.map((p: any) => (
                        <tr key={p.userId} className="hover:bg-muted/30" data-testid={`row-perf-${p.userId}`}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={p.avatarUrl} />
                                <AvatarFallback className="text-[11px] bg-primary/10 text-primary">
                                  {p.name?.split(" ").map((s: string) => s[0]).slice(0, 2).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {p.jobTitle ?? p.role?.replace(/_/g, " ")}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{p.departmentName ?? "—"}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{p.totalTasks}</td>
                          <td className="px-3 py-3 text-center tabular-nums font-medium text-emerald-600">{p.doneTasks}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{p.inProgressTasks}</td>
                          <td className="px-3 py-3 text-center tabular-nums">
                            {p.overdueTasks > 0
                              ? <span className="text-red-600 font-medium">{p.overdueTasks}</span>
                              : <span className="text-muted-foreground">0</span>}
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums">{p.ownedProjects}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <Progress value={p.completionRate} className="h-2 flex-1" />
                              <span className="text-xs font-medium w-10 text-right tabular-nums">{p.completionRate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
