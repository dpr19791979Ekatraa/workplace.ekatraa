import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListReimbursements,
  useCreateReimbursement,
  useUpdateReimbursementStatus,
  useGetReimbursementSummary,
  useGetCurrentUser,
  useRequestUploadUrl,
  getListReimbursementsQueryKey,
  getGetReimbursementSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, X, Receipt, Paperclip, Wallet, CircleDollarSign, Clock, IndianRupee } from "lucide-react";

const CATEGORIES = [
  { value: "travel", label: "Travel" },
  { value: "meals", label: "Meals" },
  { value: "accommodation", label: "Accommodation" },
  { value: "supplies", label: "Supplies" },
  { value: "software", label: "Software" },
  { value: "training", label: "Training" },
  { value: "client", label: "Client expense" },
  { value: "other", label: "Other" },
];

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  paid: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const createSchema = z.object({
  category: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be > 0"),
  currency: z.string().default("INR"),
  expenseDate: z.string().min(1, "Date required"),
  description: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function SubmitDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateReimbursement();
  const requestUploadUrl = useRequestUploadUrl();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      category: "travel",
      amount: 0,
      currency: "INR",
      expenseDate: new Date().toISOString().slice(0, 10),
      description: "",
    },
  });

  const reset = () => {
    setFile(null);
    setUploading(false);
    form.reset();
  };

  const onSubmit = async (data: CreateForm) => {
    try {
      let receiptUrl: string | null = null;
      if (file) {
        setUploading(true);
        const presign = await requestUploadUrl.mutateAsync({
          data: { name: file.name, size: file.size, contentType: file.type || "application/octet-stream" } as any,
        });
        const { uploadURL, objectPath } = presign as any;
        const putRes = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!putRes.ok) throw new Error("Receipt upload failed");
        receiptUrl = objectPath;
      }

      await create.mutateAsync({
        data: {
          category: data.category as any,
          amount: Number(data.amount),
          currency: data.currency || "INR",
          expenseDate: data.expenseDate,
          description: data.description?.trim() || null,
          receiptUrl,
        } as any,
      });

      qc.invalidateQueries({ queryKey: getListReimbursementsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetReimbursementSummaryQueryKey() });
      toast({ title: "Reimbursement submitted" });
      setOpen(false);
      reset();
    } catch (err: any) {
      toast({ title: err?.message ?? "Submit failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="submit-reimbursement-button">
          <Plus className="w-4 h-4 mr-1" /> New Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Reimbursement</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" data-testid="input-amount" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="INR">INR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="expenseDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Expense date</FormLabel>
                <FormControl>
                  <Input type="date" data-testid="input-expense-date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="What was this expense for?" data-testid="input-description" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="space-y-2">
              <label className="text-sm font-medium">Receipt (optional)</label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                data-testid="input-receipt"
              />
              {file && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Paperclip className="w-3 h-3" /> {file.name} ({(file.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending || uploading} data-testid="confirm-submit-reimbursement">
                {uploading ? "Uploading..." : create.isPending ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ReimbursementCard({ r, isReviewer, onAction }: {
  r: any;
  isReviewer: boolean;
  onAction: (id: number, status: "approved" | "rejected" | "paid") => void;
}) {
  const receiptHref = r.receiptUrl
    ? (r.receiptUrl.startsWith("http") ? r.receiptUrl : `/api/storage${r.receiptUrl}`)
    : null;

  return (
    <Card data-testid={`reimbursement-${r.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="w-9 h-9">
            <AvatarImage src={r.userAvatar ?? undefined} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {r.userName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{r.userName}</span>
              <Badge variant="outline" className="text-xs capitalize">{r.category}</Badge>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[r.status] ?? ""}`}>
                {r.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatAmount(r.amount, r.currency)} · {r.expenseDate}
            </p>
            {r.description && (
              <p className="text-sm text-foreground/80 mt-1.5 line-clamp-2">{r.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {receiptHref && (
                <a
                  href={receiptHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  data-testid={`receipt-link-${r.id}`}
                >
                  <Receipt className="w-3 h-3" /> View receipt
                </a>
              )}
              {r.reviewerName && (
                <span className="text-xs text-muted-foreground">Reviewed by {r.reviewerName}</span>
              )}
            </div>
            {r.reviewNotes && (
              <p className="text-xs text-muted-foreground mt-1 italic">"{r.reviewNotes}"</p>
            )}
          </div>
          {isReviewer && r.status === "pending" && (
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                data-testid={`approve-${r.id}`}
                onClick={() => onAction(r.id, "approved")}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 border-red-200 text-red-600 hover:bg-red-50"
                data-testid={`reject-${r.id}`}
                onClick={() => onAction(r.id, "rejected")}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          {isReviewer && r.status === "approved" && (
            <Button
              size="sm"
              variant="outline"
              className="flex-shrink-0 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              data-testid={`mark-paid-${r.id}`}
              onClick={() => onAction(r.id, "paid")}
            >
              Mark paid
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReimbursementsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();
  const updateStatus = useUpdateReimbursementStatus();

  const isReviewer = currentUser?.role && ["super_admin", "admin", "hr_manager", "finance_manager"].includes(currentUser.role);

  const { data: list, isLoading } = useListReimbursements(undefined, {
    query: { queryKey: getListReimbursementsQueryKey() },
  });
  const { data: summary } = useGetReimbursementSummary({
    query: { queryKey: getGetReimbursementSummaryQueryKey() },
  });

  const items = (list as any[]) ?? [];
  const sum = summary as any;

  const handleAction = (id: number, status: "approved" | "rejected" | "paid") => {
    updateStatus.mutate({ id, data: { status } as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListReimbursementsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetReimbursementSummaryQueryKey() });
        toast({ title: `Reimbursement ${status}` });
      },
      onError: (err: any) => {
        toast({ title: err?.message ?? "Update failed", variant: "destructive" });
      },
    });
  };

  const filterByStatus = (status: string) =>
    status === "all" ? items : items.filter(r => r.status === status);

  return (
    <Layout title="Reimbursements">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Summary tiles (employee view) */}
        {sum && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-lg font-semibold" data-testid="summary-pending-count">{sum.pendingCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending amount</p>
                  <p className="text-lg font-semibold">{formatAmount(sum.pendingAmount, sum.currency)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30">
                  <CircleDollarSign className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Approved</p>
                  <p className="text-lg font-semibold">{formatAmount(sum.approvedAmount, sum.currency)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="text-lg font-semibold">{formatAmount(sum.paidAmount, sum.currency)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isReviewer ? "Review and approve team expense reimbursements" : "Submit and track your expense reimbursements"}
          </p>
          <SubmitDialog />
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
            <TabsTrigger value="approved" data-testid="tab-approved">Approved</TabsTrigger>
            <TabsTrigger value="paid" data-testid="tab-paid">Paid</TabsTrigger>
            <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected</TabsTrigger>
          </TabsList>

          {["all", "pending", "approved", "paid", "rejected"].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
                </div>
              ) : filterByStatus(tab).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No {tab === "all" ? "" : tab + " "}reimbursements
                </div>
              ) : (
                filterByStatus(tab).map(r => (
                  <ReimbursementCard key={r.id} r={r} isReviewer={!!isReviewer} onAction={handleAction} />
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Layout>
  );
}
