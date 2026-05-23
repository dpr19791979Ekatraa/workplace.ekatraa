import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Receipt, Download, Mail } from "lucide-react";
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
  "July", "August", "September", "October", "November", "December"];

const roleBase: Record<string, number> = {
  super_admin: 180000,
  admin: 140000,
  hr_manager: 95000,
  manager: 110000,
  team_leader: 80000,
  employee: 55000,
};

function defaultSalary(role?: string): number {
  return roleBase[(role || "employee").toLowerCase()] ?? 55000;
}

function inr(n: number): string {
  return "₹ " + Math.round(n).toLocaleString("en-IN");
}

function buildPayslip(emp: Employee, base: number, monthIdx: number, year: number) {
  const basic = Math.round(base * 0.5);
  const hra = Math.round(base * 0.25);
  const special = base - basic - hra;
  const gross = basic + hra + special;
  const pf = Math.round(basic * 0.12);
  const professionalTax = 200;
  const tds = Math.round(gross * 0.05);
  const totalDeductions = pf + professionalTax + tds;
  const net = gross - totalDeductions;
  return { basic, hra, special, gross, pf, professionalTax, tds, totalDeductions, net, monthIdx, year };
}

function downloadHtml(emp: Employee, p: ReturnType<typeof buildPayslip>) {
  const fullName = `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() || "Employee";
  const empId = emp.id != null ? `EKA-${String(emp.id).padStart(4, "0")}` : "—";
  const month = MONTHS[p.monthIdx];
  const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Payslip ${month} ${p.year} — ${fullName}</title>
<style>
  body { font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
  .wrap { max-width: 760px; margin: 0 auto; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; }
  .head { background: #111; color: #fff; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; }
  .head h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
  .head .sub { color: #ff9555; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1.5px; }
  .body { padding: 24px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 32px; margin-bottom: 24px; font-size: 13px; }
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
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media print { body { padding: 0; } .wrap { border: none; } }
</style></head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <h1>EKATRAA</h1>
        <div class="sub">Payslip · ${month} ${p.year}</div>
      </div>
      <div style="text-align:right; font-size: 11px; opacity: 0.8;">
        Issued ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </div>
    </div>
    <div class="body">
      <div class="meta">
        <div><div class="k">Employee</div><div class="v">${fullName}</div></div>
        <div><div class="k">Employee ID</div><div class="v">${empId}</div></div>
        <div><div class="k">Email</div><div class="v">${emp.email ?? "—"}</div></div>
        <div><div class="k">Designation</div><div class="v">${emp.jobTitle || (emp.role ?? "").replace(/_/g, " ")}</div></div>
        <div><div class="k">Pay period</div><div class="v">${month} ${p.year}</div></div>
        <div><div class="k">Pay date</div><div class="v">${new Date(p.year, p.monthIdx + 1, 0).toLocaleDateString("en-IN")}</div></div>
      </div>
      <div class="grid2">
        <div>
          <table>
            <thead><tr><th>Earnings</th><th class="amt">Amount</th></tr></thead>
            <tbody>
              <tr><td>Basic</td><td class="amt">${inr(p.basic)}</td></tr>
              <tr><td>HRA</td><td class="amt">${inr(p.hra)}</td></tr>
              <tr><td>Special allowance</td><td class="amt">${inr(p.special)}</td></tr>
              <tr class="total"><td>Gross earnings</td><td class="amt">${inr(p.gross)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <table>
            <thead><tr><th>Deductions</th><th class="amt">Amount</th></tr></thead>
            <tbody>
              <tr><td>Provident fund</td><td class="amt">${inr(p.pf)}</td></tr>
              <tr><td>Professional tax</td><td class="amt">${inr(p.professionalTax)}</td></tr>
              <tr><td>TDS</td><td class="amt">${inr(p.tds)}</td></tr>
              <tr class="total"><td>Total deductions</td><td class="amt">${inr(p.totalDeductions)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="net">
        <div class="label">Net pay</div>
        <div class="amount">${inr(p.net)}</div>
      </div>
      <div class="foot">
        System-generated payslip from EKATRAA HR. For queries contact hr@ekatraa.in
      </div>
    </div>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip-${p.year}-${String(p.monthIdx + 1).padStart(2, "0")}-${fullName.replace(/\s+/g, "_")}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function emailPayslip(emp: Employee, p: ReturnType<typeof buildPayslip>) {
  const fullName = `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() || "Employee";
  const month = MONTHS[p.monthIdx];
  const subject = `Payslip for ${month} ${p.year}`;
  const body = `Hi ${emp.firstName ?? ""},

Please find your salary breakdown for ${month} ${p.year} below.

Earnings
  Basic            ${inr(p.basic)}
  HRA              ${inr(p.hra)}
  Special          ${inr(p.special)}
  Gross            ${inr(p.gross)}

Deductions
  Provident fund   ${inr(p.pf)}
  Professional tax ${inr(p.professionalTax)}
  TDS              ${inr(p.tds)}
  Total            ${inr(p.totalDeductions)}

Net pay: ${inr(p.net)}

The detailed payslip PDF is also available on your EKATRAA portal under HR > Payslips.

Regards,
HR Team
EKATRAA`;
  window.location.href = `mailto:${encodeURIComponent(emp.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function DispatchPayslipDialog({ employee }: { employee: Employee }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [base, setBase] = useState<number>(defaultSalary(employee.role));
  const { toast } = useToast();

  const slip = useMemo(() => buildPayslip(employee, base, monthIdx, year), [employee, base, monthIdx, year]);
  const years = useMemo(() => [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2], []);

  const handleDispatch = () => {
    if (!employee.email) {
      toast({ title: "No email on file", variant: "destructive" });
      return;
    }
    downloadHtml(employee, slip);
    setTimeout(() => emailPayslip(employee, slip), 400);
    toast({ title: "Payslip dispatched", description: `Sent to ${employee.email}` });
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Dispatch payslip — {employee.firstName} {employee.lastName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Month</label>
              <Select value={String(monthIdx)} onValueChange={v => setMonthIdx(Number(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Year</label>
              <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Monthly CTC (₹)</label>
              <Input
                type="number"
                value={base}
                onChange={e => setBase(Number(e.target.value) || 0)}
                className="mt-1"
                data-testid="input-dispatch-salary"
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 bg-muted/30 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Gross</span><span className="font-medium">{inr(slip.gross)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Deductions</span><span className="font-medium">{inr(slip.totalDeductions)}</span></div>
            <div className="flex justify-between pt-2 border-t mt-2"><span className="font-semibold">Net pay</span><span className="font-bold text-primary">{inr(slip.net)}</span></div>
          </div>

          <p className="text-xs text-muted-foreground">
            Dispatch will download the PDF and open your email app with the payslip summary pre-filled to <span className="font-medium">{employee.email || "—"}</span>. Attach the downloaded file before sending.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => downloadHtml(employee, slip)}>
            <Download className="w-4 h-4 mr-2" />
            Download only
          </Button>
          <Button onClick={handleDispatch} disabled={!employee.email} data-testid="btn-dispatch-send">
            <Mail className="w-4 h-4 mr-2" />
            Dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
