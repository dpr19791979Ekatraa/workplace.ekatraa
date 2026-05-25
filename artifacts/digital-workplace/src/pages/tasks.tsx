import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListTasks, useCreateTask, useUpdateTask, useDeleteTask,
  useListProjects, useListUsers, useRequestUploadUrl,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Trash2, Plus, Paperclip } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.string().default("todo"),
  priority: z.string().default("medium"),
  projectId: z.number().optional(),
  assigneeId: z.number().optional(),
  dueDate: z.string().optional(),
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

function CreateTaskDialog() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const createTask = useCreateTask();

  const { data: projects } = useListProjects({});
  const { data: usersData } = useListUsers({});

  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { title: "", description: "", status: "todo", priority: "medium" },
  });

  const onSubmit = (data: CreateTaskForm) => {
    const payload: any = { ...data };
    if (!payload.description) delete payload.description;
    if (!payload.projectId) delete payload.projectId;
    if (!payload.assigneeId) delete payload.assigneeId;
    if (!payload.dueDate) delete payload.dueDate;
    createTask.mutate({ data: payload }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        toast({ title: "Task created" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="create-task-button">
          <Plus className="w-4 h-4 mr-2" /> New Task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
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
                  <Textarea placeholder="Optional description" rows={3} {...field} />
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
                      <SelectItem value="backlog">Backlog</SelectItem>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
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
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={v => field.onChange(v !== "none" ? Number(v) : undefined)}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {((projects as any[]) ?? []).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="assigneeId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignee</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={v => field.onChange(v !== "none" ? Number(v) : undefined)}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {(((usersData as any)?.users ?? []) as any[]).map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.firstName} {u.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="dueDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
              </FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createTask.isPending} data-testid="submit-create-task">
                {createTask.isPending ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const statusColors: Record<string, string> = {
  backlog: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  todo: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  in_review: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const priorityColors: Record<string, string> = {
  low: "border-slate-200 text-slate-500",
  medium: "border-sky-200 text-sky-600",
  high: "border-orange-200 text-orange-600",
  critical: "border-red-200 text-red-600",
};

function CompleteTaskDialog({
  task, open, onOpenChange,
}: { task: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const requestUploadUrl = useRequestUploadUrl();
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!notes.trim()) {
      toast({ title: "Completion notes are required", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Please attach a completion file", variant: "destructive" });
      return;
    }
    try {
      setBusy(true);
      const presign = await requestUploadUrl.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type || "application/octet-stream" } as any,
      });
      const { uploadURL, objectPath } = presign as any;
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed");
      await updateTask.mutateAsync({
        id: task.id,
        data: { status: "done", completionNotes: notes.trim(), completionFileUrl: objectPath } as any,
      });
      qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
      toast({ title: "Task marked as done" });
      onOpenChange(false);
      setNotes("");
      setFile(null);
    } catch (err: any) {
      toast({ title: err?.response?.data?.error ?? "Failed to complete task", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">{task?.title}</p>
            <p className="text-xs text-muted-foreground">Please add completion notes and attach proof of work.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Completion notes <span className="text-destructive">*</span></label>
            <Textarea
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe what was done..."
              data-testid="input-completion-notes"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Completion file <span className="text-destructive">*</span></label>
            <Input
              type="file"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              data-testid="input-completion-file"
            />
            {file && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy} data-testid="confirm-complete-task">
            {busy ? "Submitting..." : "Mark as Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TasksPage() {
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [completingTask, setCompletingTask] = useState<any | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const params = {
    status: status !== "all" ? (status as any) : undefined,
    priority: priority !== "all" ? (priority as any) : undefined,
  };

  const { data: tasks, isLoading } = useListTasks(params, {
    query: { queryKey: getListTasksQueryKey(params) }
  });

  const handleStatusChange = (task: any, newStatus: string) => {
    if (newStatus === "done" && task.status !== "done") {
      setCompletingTask(task);
      return;
    }
    updateTask.mutate({ id: task.id, data: { status: newStatus as any } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        toast({ title: "Task updated" });
      },
    });
  };

  const handleDelete = (taskId: number) => {
    deleteTask.mutate({ id: taskId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        toast({ title: "Task deleted" });
      },
    });
  };

  return (
    <Layout title="Tasks">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-40" data-testid="filter-task-status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="backlog">Backlog</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-full sm:w-40" data-testid="filter-task-priority">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <div className="sm:ml-auto">
            <CreateTaskDialog />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : (tasks as any[])?.length === 0 ? (
          <div className="text-center py-20">
            <CheckSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No tasks found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {((tasks as any[]) ?? []).map((task: any) => (
              <Card key={task.id} data-testid={`task-row-${task.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{task.title}</span>
                        {task.projectName && (
                          <span className="text-xs text-muted-foreground">{task.projectName}</span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {task.assigneeName && (
                        <div className="hidden sm:flex items-center gap-1.5">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={task.assigneeAvatar} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {task.assigneeName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground hidden md:block">{task.assigneeName}</span>
                        </div>
                      )}

                      <Badge variant="outline" className={`text-xs hidden sm:flex ${priorityColors[task.priority] ?? ""}`}>
                        {task.priority}
                      </Badge>

                      <Select value={task.status} onValueChange={(v) => handleStatusChange(task, v)}>
                        <SelectTrigger className={`h-7 text-xs px-2 py-0 border-0 w-auto ${statusColors[task.status] ?? ""}`} data-testid={`task-status-${task.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="backlog">Backlog</SelectItem>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        data-testid={`delete-task-${task.id}`}
                        onClick={() => handleDelete(task.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      {completingTask && (
        <CompleteTaskDialog
          task={completingTask}
          open={!!completingTask}
          onOpenChange={(v) => { if (!v) setCompletingTask(null); }}
        />
      )}
    </Layout>
  );
}
