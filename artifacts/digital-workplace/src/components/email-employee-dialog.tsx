import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Mail, Send, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  email: string;
  name: string;
};

export default function EmailEmployeeDialog({ email, name }: Props) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const sendMail = () => {
    if (!email) {
      toast({ title: "No email address", variant: "destructive" });
      return;
    }
    const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    setOpen(false);
    setSubject("");
    setBody("");
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast({ title: "Email copied" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          title={`Email ${name}`}
          data-testid={`btn-email-${email}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Mail className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Email {name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2">
            <span className="text-muted-foreground">To:</span>
            <span className="font-medium flex-1 truncate">{email || "—"}</span>
            {email && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyEmail}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="mt-1"
              data-testid="input-email-subject"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Message</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={8}
              className="mt-1 resize-none"
              data-testid="input-email-body"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This will open your default email app (Gmail / Outlook) with the message ready to send.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={sendMail} disabled={!email} data-testid="btn-email-send">
            <Send className="w-4 h-4 mr-2" />
            Open in email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
