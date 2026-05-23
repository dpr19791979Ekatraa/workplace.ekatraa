import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";

type User = {
  id?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  jobTitle?: string | null;
  departmentId?: number | null;
};

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function baseSalaryFor(user: User | undefined): number {
  const role = (user?.role || "employee").toLowerCase();
  const map: Record<string, number> = {
    super_admin: 180000,
    admin: 140000,
    hr_manager: 95000,
    manager: 110000,
    team_leader: 80000,
    employee: 55000,
  };
  return map[role] ?? 55000;
}

function inr(n: number): string {
  return "₹ " + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

type Payslip = {
  id: string;
  month: string;
  year: number;
  monthIndex: number;
  basic: number;
  hra: number;
  special: number;
  gross: number;
  pf: number;
  professionalTax: number;
  tds: number;
  totalDeductions: number;
  net: number;
};

function buildPayslips(user: User | undefined): Payslip[] {
  const base = baseSalaryFor(user);
  const now = new Date();
  const list: Payslip[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const basic = Math.round(base * 0.5);
    const hra = Math.round(base * 0.25);
    const special = base - basic - hra;
    const gross = basic + hra + special;
    const pf = Math.round(basic * 0.12);
    const professionalTax = 200;
    const tds = Math.round(gross * 0.05);
    const totalDeductions = pf + professionalTax + tds;
    const net = gross - totalDeductions;
    list.push({
      id: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      month: MONTHS[d.getMonth()],
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      basic, hra, special, gross, pf, professionalTax, tds, totalDeductions, net,
    });
  }
  return list;
}

function downloadPayslip(p: Payslip, user: User | undefined) {
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Employee";
  const empId = user?.id != null ? `EKA-${String(user.id).padStart(4, "0")}` : "—";
  const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Payslip ${p.month} ${p.year} — ${fullName}</title>
<style>
  * { box-sizing: border-box; }
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
  @media print { body { padding: 0; } .wrap { border: none; } .noprint { display: none; } }
</style></head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <h1>EKATRAA</h1>
        <div class="sub">Payslip · ${p.month} ${p.year}</div>
      </div>
      <div style="text-align:right; font-size: 11px; opacity: 0.8;">
        Generated ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </div>
    </div>
    <div class="body">
      <div class="meta">
        <div><div class="k">Employee</div><div class="v">${fullName}</div></div>
        <div><div class="k">Employee ID</div><div class="v">${empId}</div></div>
        <div><div class="k">Email</div><div class="v">${user?.email ?? "—"}</div></div>
        <div><div class="k">Designation</div><div class="v">${user?.jobTitle || (user?.role ?? "").replace(/_/g, " ")}</div></div>
        <div><div class="k">Pay period</div><div class="v">${p.month} ${p.year}</div></div>
        <div><div class="k">Pay date</div><div class="v">${new Date(p.year, p.monthIndex + 1, 0).toLocaleDateString("en-IN")}</div></div>
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
        This is a system-generated payslip and does not require a signature.<br/>
        For any queries, contact hr@ekatraa.in
      </div>
    </div>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    // popup blocked — fallback to direct download
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip-${p.id}-${fullName.replace(/\s+/g, "_")}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function PayslipsTab({ user }: { user: User | undefined }) {
  const payslips = useMemo(() => buildPayslips(user), [user]);
  const latest = payslips[0];

  return (
    <div className="space-y-4">
      {latest && (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Latest net pay</p>
                <p className="text-3xl font-bold mt-1" data-testid="text-latest-net">{inr(latest.net)}</p>
                <p className="text-sm text-muted-foreground mt-1">{latest.month} {latest.year}</p>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Gross</p>
                  <p className="font-semibold">{inr(latest.gross)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Deductions</p>
                  <p className="font-semibold">{inr(latest.totalDeductions)}</p>
                </div>
              </div>
              <Button onClick={() => downloadPayslip(latest, user)} data-testid="btn-download-latest">
                <Download className="w-4 h-4 mr-2" />
                Download latest
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {payslips.map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors"
                data-testid={`row-payslip-${p.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{p.month} {p.year}</p>
                    <p className="text-xs text-muted-foreground">
                      Gross {inr(p.gross)} · Deductions {inr(p.totalDeductions)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-sm">{inr(p.net)}</p>
                    <Badge variant="secondary" className="mt-0.5 text-[10px]">Paid</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadPayslip(p, user)}
                    data-testid={`btn-download-${p.id}`}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Payslips are generated based on your role's standard pay structure. For corrections, contact HR.
      </p>
    </div>
  );
}
