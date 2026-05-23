import { useState } from "react";
import { useParams } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetProject, useListTasks, useCreateTask, useUpdateTask,
  getGetProjectQueryKey, getListTasksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const COLUMNS = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "done", label: "Done" },
];

const priorityColors: Record<string, string> = {
  low: "text-slate-500",
  medium: "text-sky-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.string().default("todo"),
  priority: z.string().default("medium"),
  dueDate: z.string().optional(),
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

function CreateTaskDialog({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const createTask = useCreateTask();

  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { title: "", status: "todo", priority: "medium" },
  });

  const onSubmit = (data: CreateTaskForm) => {
    createTask.mutate({ data: { ...data, projectId } as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey({ projectId }) });
        qc.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        toast({ title: "Task created" });
        setOpen(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="create-task-button">
          <Plus className="w-4 h-4 mr-1" /> Add Task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Task title" data-testid="input-task-title" {...field} />
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
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createTask.isPending} data-testid="submit-create-task">
                {createTask.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TaskCard({ task, onMove }: { task: any; onMove: (id: number, status: string) => void }) {
  return (
    <div
      data-testid={`task-card-${task.id}`}
      className="bg-card border border-border rounded-lg p-3 shadow-sm space-y-2 cursor-default"
    >
      <p className="text-sm font-medium text-foreground">{task.title}</p>
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${priorityColors[task.priority] ?? ""}`}>
          {task.priority}
        </span>
        {task.assigneeName && (
          <Avatar className="w-5 h-5">
            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
              {task.assigneeName[0]}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {COLUMNS.filter(c => c.id !== task.status).map(col => (
          <button
            key={col.id}
            data-testid={`move-task-${task.id}-${col.id}`}
            onClick={() => onMove(task.id, col.id)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {col.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateTask = useUpdateTask();

  const { data: project, isLoading: projLoading } = useGetProject(id, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) }
  });
  const { data: tasks, isLoading: tasksLoading } = useListTasks(
    { projectId: id },
    { query: { enabled: !!id, queryKey: getListTasksQueryKey({ projectId: id }) } }
  );

  const moveTask = (taskId: number, newStatus: string) => {
    updateTask.mutate({ id: taskId, data: { status: newStatus as any } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey({ projectId: id }) });
      },
    });
  };

  if (projLoading) {
    return (
      <Layout title="Project">
        <div className="p-6 space-y-4 max-w-7xl mx-auto">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (!project) return <Layout title="Not found"><div className="p-6 text-muted-foreground">Project not found.</div></Layout>;

  const tasksByStatus = COLUMNS.reduce<Record<string, any[]>>((acc, col) => {
    acc[col.id] = ((tasks as any[]) ?? []).filter((t: any) => t.status === col.id);
    return acc;
  }, {});

  return (
    <Layout title={(project as any).name}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Project header */}
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-foreground" data-testid="project-name">{(project as any).name}</h2>
                {(project as any).description && (
                  <p className="text-sm text-muted-foreground">{(project as any).description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {(project as any).ownerName && <span>Owner: {(project as any).ownerName}</span>}
                  {(project as any).departmentName && <span>· {(project as any).departmentName}</span>}
                  {(project as any).dueDate && <span>· Due {(project as any).dueDate}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Progress</p>
                  <div className="flex items-center gap-2">
                    <Progress value={(project as any).progress} className="w-24 h-2" />
                    <span className="text-sm font-medium" data-testid="project-progress">{(project as any).progress}%</span>
                  </div>
                </div>
                <CreateTaskDialog projectId={id} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kanban board */}
        {tasksLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto">
            {COLUMNS.map(col => (
              <div key={col.id} className="min-w-[200px]" data-testid={`kanban-column-${col.id}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {tasksByStatus[col.id]?.length ?? 0}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {tasksByStatus[col.id]?.map((task: any) => (
                    <TaskCard key={task.id} task={task} onMove={moveTask} />
                  ))}
                  {tasksByStatus[col.id]?.length === 0 && (
                    <div className="h-16 rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
