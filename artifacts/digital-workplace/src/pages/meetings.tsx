import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  useListMeetings, useCreateMeeting, useDeleteMeeting,
  getListMeetingsQueryKey, useGetCurrentUser,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Video, Plus, Trash2, Calendar, Clock, Copy, ExternalLink } from "lucide-react";

const JITSI_BASE = "https://meet.jit.si";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function randomRoom(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "ekatraa-instant-";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function CreateMeetingDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset() + 30);
  const defaultWhen = now.toISOString().slice(0, 16);
  const [scheduledAt, setScheduledAt] = useState(defaultWhen);
  const [duration, setDuration] = useState(30);
  const create = useCreateMeeting();
  const { toast } = useToast();

  const reset = () => {
    setTitle(""); setDescription(""); setDuration(30);
  };

  const submit = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        data: {
          title: title.trim(),
          description: description.trim() || null,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMinutes: duration,
        } as any,
      });
      toast({ title: "Meeting scheduled" });
      setOpen(false);
      reset();
      onCreated();
    } catch (e: any) {
      toast({ title: "Failed to schedule", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button data-testid="button-schedule-meeting" variant="outline" className="gap-2">
          <Plus className="w-4 h-4" /> Schedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="m-title">Title</Label>
            <Input id="m-title" data-testid="input-meeting-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly sync" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Description</Label>
            <Textarea id="m-desc" data-testid="input-meeting-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Agenda or notes (optional)" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-when">When</Label>
              <Input id="m-when" data-testid="input-meeting-when" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-dur">Duration (min)</Label>
              <Input id="m-dur" data-testid="input-meeting-duration" type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 30)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button data-testid="button-save-meeting" onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Saving..." : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeetingCard({ m, currentUserId, isAdmin, onDeleted }: {
  m: any; currentUserId?: number; isAdmin: boolean; onDeleted: () => void;
}) {
  const del = useDeleteMeeting();
  const { toast } = useToast();
  const canDelete = isAdmin || m.hostId === currentUserId;
  const initials = (m.hostName || "?").split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  const join = () => window.open(m.joinUrl, "_blank", "noopener,noreferrer");
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(m.joinUrl);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };
  const remove = async () => {
    if (!confirm(`Cancel meeting "${m.title}"?`)) return;
    try {
      await del.mutateAsync({ id: m.id });
      toast({ title: "Meeting cancelled" });
      onDeleted();
    } catch (e: any) {
      toast({ title: "Failed to cancel", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Card data-testid={`meeting-card-${m.id}`}>
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-primary flex-shrink-0" />
              <h3 className="font-semibold truncate">{m.title}</h3>
            </div>
            {m.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{m.description}</p>
            )}
          </div>
          {canDelete && (
            <Button data-testid={`button-cancel-meeting-${m.id}`} size="icon" variant="ghost" onClick={remove} title="Cancel">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDateTime(m.scheduledAt)}</span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{m.durationMinutes}m</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="w-6 h-6">
              <AvatarImage src={m.hostAvatar ?? undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">{m.hostName ?? "Unknown host"}</span>
            <Badge variant="secondary" className="text-xs">{m.status}</Badge>
          </div>
          <div className="flex gap-1">
            <Button data-testid={`button-copy-link-${m.id}`} size="icon" variant="ghost" onClick={copyLink} title="Copy link">
              <Copy className="w-4 h-4" />
            </Button>
            <Button data-testid={`button-join-meeting-${m.id}`} size="sm" onClick={join} className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Join
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MeetingsPage() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const { data: meetings, isLoading } = useListMeetings({ scope: tab });
  const { data: currentUser } = useGetCurrentUser();
  const qc = useQueryClient();
  const { toast } = useToast();

  const isAdmin = !!currentUser?.role && ["super_admin", "admin"].includes(currentUser.role);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListMeetingsQueryKey({ scope: "upcoming" }) });
    qc.invalidateQueries({ queryKey: getListMeetingsQueryKey({ scope: "past" }) });
  };

  const startInstant = () => {
    const room = randomRoom();
    const url = `${JITSI_BASE}/${room}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast({ title: "Instant meeting started", description: "Share the link from the call window." });
  };

  return (
    <Layout title="Meetings">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" /> Group Calls
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Powered by Jitsi Meet — no account required. Share the link with your team.
              </p>
            </div>
            <div className="flex gap-2">
              <CreateMeetingDialog onCreated={invalidate} />
              <Button data-testid="button-start-instant" onClick={startInstant} className="gap-2">
                <Video className="w-4 h-4" /> Start Instant
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "upcoming" | "past")}>
          <TabsList>
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="grid gap-3 md:grid-cols-2">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
              </div>
            ) : !meetings || meetings.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                  No {tab} meetings.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {meetings.map((m: any) => (
                  <MeetingCard
                    key={m.id}
                    m={m}
                    currentUserId={currentUser?.id}
                    isAdmin={isAdmin}
                    onDeleted={invalidate}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
