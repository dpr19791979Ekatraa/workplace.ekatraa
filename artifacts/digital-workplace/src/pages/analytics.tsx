import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  useGetDashboardAnalytics, useGetProductivityAnalytics,
  getGetDashboardAnalyticsQueryKey, getGetProductivityAnalyticsQueryKey,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const COLORS = ["#6366f1", "#38bdf8", "#34d399", "#f59e0b", "#f43f5e"];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("month");

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
    <Layout title="Analytics">
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
              <p className="text-sm text-muted-foreground mt-1">Task Completion Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              {prodLoading ? <Skeleton className="h-10 w-16 mx-auto" /> : (
                <p className="text-3xl font-bold text-foreground" data-testid="kpi-avg-tasks">
                  {(productivity as any)?.avgTasksPerDay ?? 0}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">Avg Tasks/Day</p>
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
              <CardTitle className="text-sm font-semibold">Tasks by Status</CardTitle>
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
              <CardTitle className="text-sm font-semibold">Projects by Status</CardTitle>
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

          {/* Top performers */}
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
        </div>
      </div>
    </Layout>
  );
}
