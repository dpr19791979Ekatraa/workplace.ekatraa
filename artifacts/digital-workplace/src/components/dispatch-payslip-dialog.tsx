import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Receipt, Download, Mail, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Employee = {
  id?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  jobTitle?: string | null;
};

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "September", "October", "November", "December"]
  .slice(0, 12);

const roleBase: Record<string, number> = {
  super_admin: 180000, admin: 140000, hr_manager: 95000,
  manager: 110000, team_leader: 80000, employee: 55000,
};

function defaultSalary(role?: string): number {
  return roleBase[(role || "employee").toLowerCase()] ?? 55000;
}

function inr(n: number): string {
  return "₹ " + Math.round(n).toLocaleString("en-IN");
}

type LineItem = { id: string; label: string; amount: number };

const uid = () => Math.random().toString(36).slice(2, 9);

function defaultEarnings(base: number): LineItem[] {
  const basic = Math.round(base * 0.5);
  const hra = Math.round(base * 0.25);
  const special = base - basic - hra;
  return [
    { id: uid(), label: "Basic", amount: basic },
    { id: uid(), label: "HRA", amount: hra },
    { id: uid(), label: "Special allowance", amount: special },
  ];
}

function defaultDeductions(base: number): LineItem[] {
  const basic = Math.round(base * 0.5);
  return [
    { id: uid(), label: "Provident fund", amount: Math.round(basic * 0.12) },
    { id: uid(), label: "Professional tax", amount: 200 },
    { id: uid(), label: "TDS", amount: Math.round(base * 0.05) },
  ];
}

type SlipState = {
  empName: string;
  empId: string;
  empEmail: string;
  designation: string;
  department: string;
  monthIdx: number;
  year: number;
  payDate: string;
  paidDays: number;
  lopDays: number;
  bankAccount: string;
  panNumber: string;
  earnings: LineItem[];
  deductions: LineItem[];
  notes: string;
};

function buildHtml(s: SlipState): string {
  const month = MONTHS[s.monthIdx];
  const gross = s.earnings.reduce((a, b) => a + (b.amount || 0), 0);
  const totalDeductions = s.deductions.reduce((a, b) => a + (b.amount || 0), 0);
  const net = gross - totalDeductions;

  const earningsRows = s.earnings.map(e => `
    <tr><td>${e.label}</td><td class="amt">${inr(e.amount)}</td></tr>`).join("");
  const deductionRows = s.deductions.map(d => `
    <tr><td>${d.label}</td><td class="amt">${inr(d.amount)}</td></tr>`).join("");

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Payslip ${month} ${s.year} — ${s.empName}</title>
<style>
  body { font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
  .wrap { max-width: 760px; margin: 0 auto; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; }
  .head { background: #111; color: #fff; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; }
  .head h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
  .head .sub { color: #ff9555; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1.5px; }
  .body { padding: 24px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 32px; margin-bottom: 24px; font-size: 13px; }
  .meta .k { color: #777; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .meta .v { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #fafafa; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
  td.amt, th.amt { text-align: right; font-variant-numeric: tabular-nums; }
  .total { font-weight: 700; background: #fafafa; }
  .net { display: flex; justify-content: space-between; align-items: center; background: #111; color: #fff; padding: 14px 20px; border-radius: 6px; margin-top: 8px; }
  .net .label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #ff9555; }
  .net .amount { font-size: 22px; font-weight: 700; }
  .foot { font-size: 11px; color: #888; text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px dashed #ddd; }
  .notes { font-size: 12px; color: #555; margin-top: 16px; padding: 12px; background: #fafafa; border-radius: 6px; white-space: pre-wrap; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media print { body { padding: 0; } .wrap { border: none; } }
</style></head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <h1>EKATRAA</h1>
        <div class="sub">Payslip · ${month} ${s.year}</div>
      </div>
      <div style="text-align:right; font-size: 11px; opacity: 0.8;">
        Issued ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </div>
    </div>
    <div class="body">
      <div class="meta">
        <div><div class="k">Employee</div><div class="v">${s.empName || "—"}</div></div>
        <div><div class="k">Employee ID</div><div class="v">${s.empId || "—"}</div></div>
        <div><div class="k">Email</div><div class="v">${s.empEmail || "—"}</div></div>
        <div><div class="k">Designation</div><div class="v">${s.designation || "—"}</div></div>
        <div><div class="k">Department</div><div class="v">${s.department || "—"}</div></div>
        <div><div class="k">Pay period</div><div class="v">${month} ${s.year}</div></div>
        <div><div class="k">Pay date</div><div class="v">${s.payDate || "—"}</div></div>
        <div><div class="k">Paid days / LOP</div><div class="v">${s.paidDays} / ${s.lopDays}</div></div>
        <div><div class="k">Bank account</div><div class="v">${s.bankAccount || "—"}</div></div>
        <div><div class="k">PAN</div><div class="v">${s.panNumber || "—"}</div></div>
      </div>
      <div class="grid2">
        <div>
          <table>
            <thead><tr><th>Earnings</th><th class="amt">Amount</th></tr></thead>
            <tbody>
              ${earningsRows}
              <tr class="total"><td>Gross earnings</td><td class="amt">${inr(gross)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <table>
            <thead><tr><th>Deductions</th><th class="amt">Amount</th></tr></thead>
            <tbody>
              ${deductionRows}
              <tr class="total"><td>Total deductions</td><td class="amt">${inr(totalDeductions)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="net">
        <div class="label">Net pay</div>
        <div class="amount">${inr(net)}</div>
      </div>
      ${s.notes ? `<div class="notes">${s.notes}</div>` : ""}
      <div class="foot">System-generated payslip from EKATRAA HR. For queries contact hr@ekatraa.in</div>
    </div>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;
}

function downloadSlip(s: SlipState) {
  const html = buildHtml(s);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip-${s.year}-${String(s.monthIdx + 1).padStart(2, "0")}-${(s.empName || "employee").replace(/\s+/g, "_")}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function emailSlip(s: SlipState) {
  const month = MONTHS[s.monthIdx];
  const gross = s.earnings.reduce((a, b) => a + (b.amount || 0), 0);
  const totalDeductions = s.deductions.reduce((a, b) => a + (b.amount || 0), 0);
  const net = gross - totalDeductions;
  const subject = `Payslip for ${month} ${s.year}`;
  const earnings = s.earnings.map(e => `  ${e.label.padEnd(20)} ${inr(e.amount)}`).join("\n");
  const deductions = s.deductions.map(d => `  ${d.label.padEnd(20)} ${inr(d.amount)}`).join("\n");
  const body = `Hi ${s.empName.split(" ")[0] || ""},

Please find your salary breakdown for ${month} ${s.year}.

Earnings
${earnings}
  Gross                ${inr(gross)}

Deductions
${deductions}
  Total                ${inr(totalDeductions)}

Net pay: ${inr(net)}

Detailed payslip is also available on the EKATRAA portal under HR > Payslips.

Regards,
HR Team
EKATRAA`;
  window.location.href = `mailto:${encodeURIComponent(s.empEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function DispatchPayslipDialog({ employee }: { employee: Employee }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const now = new Date();
  const base = defaultSalary(employee.role);

  const [s, setS] = useState<SlipState>({
    empName: `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim(),
    empId: employee.id != null ? `EKA-${String(employee.id).padStart(4, "0")}` : "",
    empEmail: employee.email ?? "",
    designation: employee.jobTitle || (employee.role ?? "").replace(/_/g, " "),
    department: "",
    monthIdx: now.getMonth(),
    year: now.getFullYear(),
    payDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString("en-IN"),
    paidDays: 30,
    lopDays: 0,
    bankAccount: "",
    panNumber: "",
    earnings: defaultEarnings(base),
    deductions: defaultDeductions(base),
    notes: "",
  });

  // Recompute pay date when month/year changes
  useEffect(() => {
    setS(prev => ({
      ...prev,
      payDate: new Date(prev.year, prev.monthIdx + 1, 0).toLocaleDateString("en-IN"),
    }));
  }, [s.monthIdx, s.year]);

  const gross = useMemo(() => s.earnings.reduce((a, b) => a + (Number(b.amount) || 0), 0), [s.earnings]);
  const totalDeductions = useMemo(() => s.deductions.reduce((a, b) => a + (Number(b.amount) || 0), 0), [s.deductions]);
  const net = gross - totalDeductions;

  const years = useMemo(() => [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2], []);

  const update = <K extends keyof SlipState>(k: K, v: SlipState[K]) => setS(prev => ({ ...prev, [k]: v }));

  const updateLine = (kind: "earnings" | "deductions", id: string, patch: Partial<LineItem>) => {
    setS(prev => ({
      ...prev,
      [kind]: prev[kind].map(li => li.id === id ? { ...li, ...patch } : li),
    }));
  };
  const addLine = (kind: "earnings" | "deductions") => {
    setS(prev => ({ ...prev, [kind]: [...prev[kind], { id: uid(), label: "", amount: 0 }] }));
  };
  const removeLine = (kind: "earnings" | "deductions", id: string) => {
    setS(prev => ({ ...prev, [kind]: prev[kind].filter(li => li.id !== id) }));
  };

  const handleDispatch = () => {
    if (!s.empEmail) {
      toast({ title: "No email address", variant: "destructive" });
      return;
    }
    downloadSlip(s);
    setTimeout(() => emailSlip(s), 400);
    toast({ title: "Payslip dispatched", description: `Sent to ${s.empEmail}` });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          title="Dispatch payslip"
          data-testid={`btn-dispatch-${employee.id}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Receipt className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit & dispatch payslip</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Employee details */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Employee</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full name" value={s.empName} onChange={v => update("empName", v)} />
              <Field label="Employee ID" value={s.empId} onChange={v => update("empId", v)} />
              <Field label="Email" value={s.empEmail} onChange={v => update("empEmail", v)} />
              <Field label="Designation" value={s.designation} onChange={v => update("designation", v)} />
              <Field label="Department" value={s.department} onChange={v => update("department", v)} />
              <Field label="PAN" value={s.panNumber} onChange={v => update("panNumber", v)} />
              <Field label="Bank account" value={s.bankAccount} onChange={v => update("bankAccount", v)} />
              <Field label="Pay date" value={s.payDate} onChange={v => update("payDate", v)} />
            </div>
          </section>

          {/* Period */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Pay period</h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Month</label>
                <Select value={String(s.monthIdx)} onValueChange={v => update("monthIdx", Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Year</label>
                <Select value={String(s.year)} onValueChange={v => update("year", Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <NumField label="Paid days" value={s.paidDays} onChange={v => update("paidDays", v)} />
              <NumField label="LOP days" value={s.lopDays} onChange={v => update("lopDays", v)} />
            </div>
          </section>

          {/* Earnings */}
          <LineSection
            title="Earnings"
            items={s.earnings}
            onChange={(id, patch) => updateLine("earnings", id, patch)}
            onAdd={() => addLine("earnings")}
            onRemove={id => removeLine("earnings", id)}
            total={gross}
            totalLabel="Gross"
          />

          {/* Deductions */}
          <LineSection
            title="Deductions"
            items={s.deductions}
            onChange={(id, patch) => updateLine("deductions", id, patch)}
            onAdd={() => addLine("deductions")}
            onRemove={id => removeLine("deductions", id)}
            total={totalDeductions}
            totalLabel="Total"
          />

          {/* Net */}
          <div className="rounded-lg bg-black text-white px-5 py-4 flex justify-between items-center">
            <span className="text-xs uppercase tracking-wider text-orange-400">Net pay</span>
            <span className="text-2xl font-bold">{inr(net)}</span>
          </div>

          {/* Notes */}
          <section>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes (optional)</label>
            <Textarea
              value={s.notes}
              onChange={e => update("notes", e.target.value)}
              placeholder="Any additional remarks to print on the payslip…"
              rows={3}
              className="mt-1 resize-none"
            />
          </section>

          <p className="text-xs text-muted-foreground">
            Dispatch downloads the PDF and opens your email app with the summary pre-filled. Attach the downloaded file before sending.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => downloadSlip(s)}>
            <Download className="w-4 h-4 mr-2" />
            Download only
          </Button>
          <Button onClick={handleDispatch} disabled={!s.empEmail} data-testid="btn-dispatch-send">
            <Mail className="w-4 h-4 mr-2" />
            Dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="mt-1" />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="mt-1"
      />
    </div>
  );
}

function LineSection({
  title, items, onChange, onAdd, onRemove, total, totalLabel,
}: {
  title: string;
  items: LineItem[];
  onChange: (id: string, patch: Partial<LineItem>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  total: number;
  totalLabel: string;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add row
        </Button>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex gap-2">
            <Input
              value={item.label}
              onChange={e => onChange(item.id, { label: e.target.value })}
              placeholder="Label"
              className="flex-1"
            />
            <Input
              type="number"
              value={item.amount}
              onChange={e => onChange(item.id, { amount: Number(e.target.value) || 0 })}
              placeholder="Amount"
              className="w-32"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(item.id)}
              className="flex-shrink-0"
            >
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">No rows. Click "Add row" to begin.</p>
        )}
        <div className="flex justify-between items-center pt-2 border-t text-sm">
          <span className="font-medium">{totalLabel}</span>
          <span className="font-bold tabular-nums">{inr(total)}</span>
        </div>
      </div>
    </section>
  );
}
