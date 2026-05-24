import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListConversations, useListMessages, useSendMessage,
  useOpenDirectConversation, useCreateGroupConversation, useMarkConversationRead,
  useGetCurrentUser, useListUsers,
  getListConversationsQueryKey, getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Plus, Send, Users, User, Search } from "lucide-react";

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function convoTitle(c: any, meId?: number): string {
  if (c.kind === "group") return c.name || "Group";
  const other = (c.members || []).find((m: any) => m.id !== meId) || c.members?.[0];
  return other ? `${other.firstName} ${other.lastName}` : "Direct chat";
}

function convoAvatar(c: any, meId?: number): string | undefined {
  if (c.kind === "group") return undefined;
  const other = (c.members || []).find((m: any) => m.id !== meId);
  return other?.avatarUrl ?? undefined;
}

function NewChatDialog({ meId, onCreated }: { meId?: number; onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"direct" | "group">("direct");
  const [directId, setDirectId] = useState("");
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [filter, setFilter] = useState("");
  const { data: users } = useListUsers();
  const openDirect = useOpenDirectConversation();
  const createGroup = useCreateGroupConversation();
  const { toast } = useToast();

  const list: any[] = Array.isArray(users) ? users : (users as any)?.users ?? [];
  const others = list.filter((u: any) => u.id !== meId && u.status !== "inactive");
  const filtered = others.filter((u: any) => {
    const q = filter.toLowerCase();
    if (!q) return true;
    return `${u.firstName} ${u.lastName} ${u.email ?? ""} ${u.jobTitle ?? ""}`.toLowerCase().includes(q);
  });

  const reset = () => {
    setKind("direct"); setDirectId(""); setName(""); setMemberIds([]); setFilter("");
  };

  const toggle = (id: number) => {
    setMemberIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };

  const submit = async () => {
    try {
      if (kind === "direct") {
        const id = Number(directId);
        if (!id) { toast({ title: "Pick a teammate", variant: "destructive" }); return; }
        const c: any = await openDirect.mutateAsync({ data: { userId: id } });
        onCreated(c.id);
      } else {
        if (!name.trim()) { toast({ title: "Group name required", variant: "destructive" }); return; }
        if (memberIds.length === 0) { toast({ title: "Pick at least one member", variant: "destructive" }); return; }
        const c: any = await createGroup.mutateAsync({ data: { name: name.trim(), memberIds } });
        onCreated(c.id);
      }
      setOpen(false);
      reset();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-chat" size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> New
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a new chat</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <RadioGroup value={kind} onValueChange={(v) => setKind(v as any)} className="grid grid-cols-2 gap-2">
            <label data-testid="radio-chat-direct" className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer ${kind === "direct" ? "border-primary bg-primary/5" : "border-input"}`}>
              <RadioGroupItem value="direct" />
              <User className="w-4 h-4" /> 1-on-1
            </label>
            <label data-testid="radio-chat-group" className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer ${kind === "group" ? "border-primary bg-primary/5" : "border-input"}`}>
              <RadioGroupItem value="group" />
              <Users className="w-4 h-4" /> Group
            </label>
          </RadioGroup>

          {kind === "direct" ? (
            <div className="space-y-1.5">
              <Label>Teammate</Label>
              <Select value={directId} onValueChange={setDirectId}>
                <SelectTrigger data-testid="select-chat-direct-user">
                  <SelectValue placeholder="Pick a teammate" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.firstName} {u.lastName}{u.jobTitle ? ` — ${u.jobTitle}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="g-name">Group name</Label>
                <Input id="g-name" data-testid="input-group-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering, Project X..." />
              </div>
              <div className="space-y-1.5">
                <Label>Members</Label>
                <Input data-testid="input-member-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search teammates..." />
                <div className="max-h-56 overflow-y-auto border rounded-md divide-y">
                  {filtered.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No matches.</p>
                  ) : filtered.map((u: any) => (
                    <label key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent">
                      <Checkbox
                        data-testid={`checkbox-member-${u.id}`}
                        checked={memberIds.includes(u.id)}
                        onCheckedChange={() => toggle(u.id)}
                      />
                      <span className="flex-1">{u.firstName} {u.lastName}</span>
                      {u.jobTitle && <span className="text-xs text-muted-foreground">{u.jobTitle}</span>}
                    </label>
                  ))}
                </div>
                {memberIds.length > 0 && <p className="text-xs text-muted-foreground">{memberIds.length} selected</p>}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button data-testid="button-create-chat" onClick={submit} disabled={openDirect.isPending || createGroup.isPending}>
            {(openDirect.isPending || createGroup.isPending) ? "Starting..." : "Start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessagePane({ conversationId, meId }: { conversationId: number; meId?: number }) {
  const { data: messages, isLoading } = useListMessages(conversationId, {
    query: { queryKey: getListMessagesQueryKey(conversationId), refetchInterval: 3000 },
  });
  const send = useSendMessage();
  const markRead = useMarkConversationRead();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Mark read whenever conversation opens or new messages arrive
    if (!messages || messages.length === 0) return;
    markRead.mutate({ id: conversationId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages?.length]);

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setBody("");
    try {
      await send.mutateAsync({ id: conversationId, data: { body: text } });
      qc.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) });
      qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message, variant: "destructive" });
      setBody(text);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No messages yet. Say hi!
          </div>
        ) : (
          messages.map((m: any) => {
            const mine = m.senderId === meId;
            return (
              <div key={m.id} data-testid={`message-${m.id}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                  {!mine && <div className="text-xs font-medium opacity-70 mb-0.5">{m.senderName}</div>}
                  <div className="whitespace-pre-wrap break-words text-sm">{m.body}</div>
                  <div className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>{timeAgo(m.createdAt)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t p-3 flex gap-2 bg-background">
        <Input
          data-testid="input-message-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Type a message..."
        />
        <Button data-testid="button-send-message" onClick={submit} disabled={send.isPending || !body.trim()} className="gap-1.5">
          <Send className="w-4 h-4" /> Send
        </Button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { data: currentUser } = useGetCurrentUser();
  const meId = currentUser?.id;
  const { data: conversations, isLoading } = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), refetchInterval: 5000 },
  });
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Auto-select from ?c= query param or first conversation
  useEffect(() => {
    if (selectedId != null) return;
    const params = new URLSearchParams(window.location.search);
    const c = params.get("c");
    if (c) {
      const n = Number(c);
      if (Number.isFinite(n)) { setSelectedId(n); return; }
    }
    if (conversations && conversations.length > 0) {
      setSelectedId((conversations[0] as any).id);
    }
  }, [conversations, selectedId]);

  const filteredConvos = useMemo(() => {
    const list: any[] = (conversations as any) ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((c) => convoTitle(c, meId).toLowerCase().includes(q));
  }, [conversations, search, meId]);

  const selected = useMemo(() => {
    const list: any[] = (conversations as any) ?? [];
    return list.find((c) => c.id === selectedId) ?? null;
  }, [conversations, selectedId]);

  const handleCreated = (id: number) => {
    qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    setSelectedId(id);
  };

  return (
    <Layout title="Chat">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100vh-12rem)] min-h-[500px]">
            {/* Sidebar */}
            <div className="border-r flex flex-col bg-card">
              <div className="p-3 border-b flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                <h2 className="font-semibold flex-1">Chats</h2>
                <NewChatDialog meId={meId} onCreated={handleCreated} />
              </div>
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    data-testid="input-search-chats"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search chats..."
                    className="pl-8 h-9"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="p-3 space-y-2">
                    {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : filteredConvos.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {search ? "No matches." : "No chats yet. Start one!"}
                  </div>
                ) : (
                  filteredConvos.map((c: any) => {
                    const title = convoTitle(c, meId);
                    const av = convoAvatar(c, meId);
                    const active = c.id === selectedId;
                    return (
                      <button
                        key={c.id}
                        data-testid={`conversation-${c.id}`}
                        onClick={() => setSelectedId(c.id)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 border-b hover:bg-accent transition-colors ${active ? "bg-accent" : ""}`}
                      >
                        <Avatar className="w-10 h-10 flex-shrink-0">
                          <AvatarImage src={av} />
                          <AvatarFallback className="text-xs">
                            {c.kind === "group" ? <Users className="w-4 h-4" /> : initials(title)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate text-sm">{title}</span>
                            {c.lastMessage && (
                              <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(c.lastMessage.createdAt)}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground truncate">
                              {c.lastMessage?.body ?? (c.kind === "group" ? `${c.members?.length ?? 0} members` : "No messages yet")}
                            </span>
                            {c.unreadCount > 0 && (
                              <Badge data-testid={`unread-${c.id}`} className="h-5 min-w-5 px-1.5 text-[10px]">{c.unreadCount}</Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Main pane */}
            <div className="flex flex-col h-full min-w-0">
              {selected ? (
                <>
                  <div className="border-b px-4 py-3 flex items-center gap-3 bg-background">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={convoAvatar(selected, meId)} />
                      <AvatarFallback className="text-xs">
                        {selected.kind === "group" ? <Users className="w-4 h-4" /> : initials(convoTitle(selected, meId))}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{convoTitle(selected, meId)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {selected.kind === "group"
                          ? `${selected.members?.length ?? 0} members`
                          : (selected.members?.find((m: any) => m.id !== meId)?.jobTitle ?? "Direct message")}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {selected.kind === "group" ? "Group" : "1-on-1"}
                    </Badge>
                  </div>
                  <div className="flex-1 min-h-0">
                    <MessagePane conversationId={selected.id} meId={meId} />
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground gap-2">
                  <MessageCircle className="w-12 h-12 opacity-40" />
                  <p>Select a chat or start a new one.</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
