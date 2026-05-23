import { Link } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  useGetDashboardAnalytics,
  useListAnnouncements,
  useGetActivityFeed,
  getGetDashboardAnalyticsQueryKey,
} from "@workspace/api-client-react";
import { Users, FolderKanban, CheckSquare, Clock, FileText, CalendarOff, ArrowRight, Pin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function StatCard({ title, value, icon: Icon, color, testId }: {
  title: string; value: number | undefined; icon: React.ComponentType<{ className?: string }>;
  color: string; testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {value === undefined ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-3xl font-bold text-foreground mt-1" data-testid={`${testId}-value`}>{value}</p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function priorityColor(p: string) {
  switch (p) {
    case "urgent": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "high": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "normal": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
  }
}

export default function DashboardPage() {
  const { data: analytics, isLoading: analyticsLoading } = useGetDashboardAnalytics({
    query: { queryKey: getGetDashboardAnalyticsQueryKey() }
  });
  const { data: announcements, isLoading: annLoading } = useListAnnouncements();
  const { data: activity, isLoading: actLoading } = useGetActivityFeed();

  return (
    <Layout title="Dashboard">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="Employees" value={analytics?.totalEmployees} icon={Users} color="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" testId="stat-employees" />
          <StatCard title="Active Projects" value={analytics?.activeProjects} icon={FolderKanban} color="bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" testId="stat-projects" />
          <StatCard title="Pending Tasks" value={analytics?.pendingTasks} icon={CheckSquare} color="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400" testId="stat-tasks" />
          <StatCard title="Present Today" value={analytics?.presentToday} icon={Clock} color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" testId="stat-present" />
          <StatCard title="Documents" value={analytics?.documentsUploaded} icon={FileText} color="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" testId="stat-documents" />
          <StatCard title="Pending Leaves" value={analytics?.pendingLeaves} icon={CalendarOff} color="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" testId="stat-leaves" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Announcements */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Announcements</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/hr" className="flex items-center gap-1 text-sm text-muted-foreground">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </Button>
            </div>
            {annLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            ) : (announcements as any[])?.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  No announcements yet
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {((announcements as any[]) ?? []).slice(0, 5).map((a: any) => (
                  <Card key={a.id} data-testid={`announcement-${a.id}`} className="relative overflow-hidden">
                    {a.pinned && (
                      <div className="absolute top-3 right-3">
                        <Pin className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-8 h-8 flex-shrink-0 mt-0.5">
                          <AvatarImage src={a.authorAvatar} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {a.authorName?.[0] ?? "A"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{a.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor(a.priority)}`}>
                              {a.priority}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{a.content}</p>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {a.authorName} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Recent Activity</h2>
            {actLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {((activity as any[]) ?? []).slice(0, 8).map((item: any) => (
                    <div key={item.id} className="p-4" data-testid={`activity-${item.id}`}>
                      <div className="flex items-start gap-3">
                        <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
                          <AvatarImage src={item.actorAvatar} />
                          <AvatarFallback className="text-xs bg-muted">
                            {item.actorName?.[0] ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground leading-snug">{item.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!activity || (activity as any[]).length === 0) && (
                    <div className="p-8 text-center text-muted-foreground text-sm">No activity yet</div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Upcoming deadlines */}
        {analytics?.upcomingDeadlines && (analytics.upcomingDeadlines as any[]).length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-4">Upcoming Deadlines</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {(analytics.upcomingDeadlines as any[]).map((task: any) => (
                <Card key={task.id} data-testid={`deadline-task-${task.id}`}>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    {task.projectName && (
                      <p className="text-xs text-muted-foreground truncate">{task.projectName}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{task.dueDate}</p>
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${task.priority === "critical" ? "border-red-300 text-red-600" : task.priority === "high" ? "border-orange-300 text-orange-600" : ""}`}
                      >
                        {task.priority}
                      </Badge>
                      {task.assigneeName && (
                        <div className="flex items-center gap-1.5">
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={task.assigneeAvatar} />
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                              {task.assigneeName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground truncate max-w-[80px]">{task.assigneeName}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
