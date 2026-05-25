import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen, Search, Shield, Clock, Users, Briefcase, Heart, AlertTriangle,
} from "lucide-react";

const policies = [
  {
    id: "code-of-conduct",
    title: "Code of Conduct",
    icon: Shield,
    category: "General",
    updated: "Jan 2026",
    summary: "Standards of behaviour expected from every employee.",
    sections: [
      { heading: "Professional behaviour", body: "Treat all colleagues, clients, and partners with respect. Harassment, discrimination, or bullying of any kind will not be tolerated." },
      { heading: "Integrity", body: "Be honest in all dealings. Avoid conflicts of interest. Report any unethical behaviour to HR or your manager immediately." },
      { heading: "Confidentiality", body: "Protect company, client, and employee information. Do not share confidential data outside of work." },
    ],
  },
  {
    id: "leave",
    title: "Leave Policy",
    icon: Heart,
    category: "HR",
    updated: "Mar 2026",
    summary: "Annual, sick, casual, and special leave entitlements.",
    sections: [
      { heading: "Annual leave", body: "Every full-time employee is entitled to 18 days of paid annual leave per calendar year. Unused leave (up to 10 days) may be carried to the next year." },
      { heading: "Sick leave", body: "12 days of paid sick leave per year. A medical certificate is required for absences of more than 2 consecutive days." },
      { heading: "Casual leave", body: "6 days of casual leave per year for personal needs. Should be applied at least 1 day in advance, except in emergencies." },
      { heading: "Maternity / paternity", body: "26 weeks paid maternity leave and 15 days paid paternity leave as per applicable law." },
      { heading: "How to apply", body: "Submit leave requests through the HR section. Approvals come from your reporting manager." },
    ],
  },
  {
    id: "attendance",
    title: "Attendance & Working Hours",
    icon: Clock,
    category: "HR",
    updated: "Feb 2026",
    summary: "Office hours, clock-in expectations, and remote work.",
    sections: [
      { heading: "Working hours", body: "Standard hours are 9:30 AM – 6:30 PM, Monday to Friday, with a 1-hour lunch break." },
      { heading: "Clock in / clock out", body: "Every employee must clock in and out daily using the HR module. Repeated missed punches will be reviewed by HR." },
      { heading: "Late arrival", body: "More than 3 late arrivals (>15 min) in a month will be marked as half-day leave." },
      { heading: "Remote work", body: "Hybrid model: up to 2 work-from-home days per week with manager approval." },
    ],
  },
  {
    id: "it-security",
    title: "IT & Data Security",
    icon: Shield,
    category: "Security",
    updated: "Apr 2026",
    summary: "Acceptable use of devices, accounts, and company data.",
    sections: [
      { heading: "Account security", body: "Use strong, unique passwords. Enable 2-factor authentication on all company accounts. Never share login credentials." },
      { heading: "Device usage", body: "Company laptops are for work use. Personal use should be reasonable and must not compromise security." },
      { heading: "Data handling", body: "Store company data only on approved platforms (Drive, internal systems). Do not email confidential files to personal accounts." },
      { heading: "Incidents", body: "Report any suspected security incident (phishing, lost device, data leak) to IT within 1 hour." },
    ],
  },
  {
    id: "harassment",
    title: "Anti-Harassment (POSH)",
    icon: AlertTriangle,
    category: "HR",
    updated: "Jan 2026",
    summary: "Zero-tolerance policy on harassment at the workplace.",
    sections: [
      { heading: "Scope", body: "Applies to all employees, contractors, vendors, and visitors at any company location or company-related event." },
      { heading: "What is harassment", body: "Any unwelcome conduct — verbal, physical, visual, or written — that creates an intimidating or hostile work environment." },
      { heading: "How to report", body: "Reach out to HR or the Internal Complaints Committee (ICC). All complaints are kept confidential and investigated within 30 days." },
      { heading: "No retaliation", body: "No employee will face retaliation for reporting a concern in good faith." },
    ],
  },
  {
    id: "travel",
    title: "Travel & Expense",
    icon: Briefcase,
    category: "Finance",
    updated: "Dec 2025",
    summary: "Business travel approvals and reimbursement rules.",
    sections: [
      { heading: "Pre-approval", body: "All business travel requires manager approval at least 5 working days in advance." },
      { heading: "Booking", body: "Use the approved travel desk for flights and hotels. Economy class for flights under 6 hours." },
      { heading: "Reimbursement", body: "Submit expense reports with receipts within 7 days of return. Daily allowance applies as per grade." },
    ],
  },
  {
    id: "insurance",
    title: "Insurance Policies",
    icon: Heart,
    category: "HR",
    updated: "May 2026",
    summary: "Group health, accident, and life insurance benefits.",
    sections: [
      { heading: "Group health insurance", body: "All full-time employees and their immediate dependents (spouse and up to 2 children) are covered under the group health insurance plan from the date of joining. Sum insured: ₹5,00,000 per family per year on a floater basis." },
      { heading: "Personal accident cover", body: "Every employee is covered for personal accident insurance up to ₹10,00,000, covering accidental death and permanent disability, 24x7 worldwide." },
      { heading: "Group term life insurance", body: "Group term life cover of 3x annual CTC (up to ₹50,00,000) is provided. The nominee on record will receive the benefit in the event of the employee's death during service." },
      { heading: "Hospitalisation & cashless network", body: "Use the TPA network of cashless hospitals for planned and emergency admissions. For non-network hospitals, submit original bills + discharge summary to HR within 30 days for reimbursement." },
      { heading: "Adding / removing dependents", body: "New marriages, births, or changes in dependents must be reported to HR within 30 days of the event to update the insurance records. Mid-year additions follow insurer rules." },
      { heading: "Claims & support", body: "For any insurance claim or query, reach out to HR with your employee ID. HR will share the TPA / insurer contact and help with documentation." },
    ],
  },
  {
    id: "referral",
    title: "Employee Referral",
    icon: Users,
    category: "HR",
    updated: "Nov 2025",
    summary: "Refer talent and earn referral bonuses.",
    sections: [
      { heading: "Eligibility", body: "All full-time employees (except hiring managers and HR) can refer candidates." },
      { heading: "Bonus", body: "Referral bonus paid in two parts — 50% on joining, 50% after the referee completes 6 months." },
      { heading: "How to refer", body: "Share the candidate's resume with HR mentioning the open role. Tracked in the referral tracker." },
    ],
  },
];

const categories = ["All", "General", "HR", "Security", "Finance"];

export default function PolicyPage() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("All");

  const filtered = policies.filter(p => {
    const matchCat = activeCat === "All" || p.category === activeCat;
    const q = query.trim().toLowerCase();
    const matchQuery = !q ||
      p.title.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.sections.some(s => s.heading.toLowerCase().includes(q) || s.body.toLowerCase().includes(q));
    return matchCat && matchQuery;
  });

  return (
    <Layout title="Company Policies">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Workplace policies</h2>
                <p className="text-sm text-muted-foreground">
                  Please read carefully. Reach out to HR for any clarifications.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search policies…"
                  className="pl-9"
                  data-testid="input-policy-search"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveCat(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      activeCat === c
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    data-testid={`btn-cat-${c.toLowerCase()}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              No policies match your search.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filtered.map(p => {
              const Icon = p.icon;
              return (
                <Card key={p.id} data-testid={`card-policy-${p.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{p.title}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">{p.summary}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="secondary">{p.category}</Badge>
                        <span className="text-[11px] text-muted-foreground">Updated {p.updated}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible>
                      {p.sections.map((s, i) => (
                        <AccordionItem key={i} value={`${p.id}-${i}`}>
                          <AccordionTrigger className="text-sm font-medium">
                            {s.heading}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                            {s.body}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
