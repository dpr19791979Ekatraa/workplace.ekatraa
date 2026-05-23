import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Building2, LayoutDashboard, Users, FileText, BarChart2, CheckSquare, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon.svg" className="h-9 w-auto" alt="" />
            <span className="font-bold text-xl tracking-tight text-foreground">ekatraa</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild data-testid="sign-in-link">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild data-testid="get-started-button">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium mb-6">
          <span className="w-1.5 h-1.5 bg-primary rounded-full" />
          Enterprise digital workplace platform
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-foreground max-w-3xl mx-auto leading-tight">
          Your team's command center
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          ekatraa brings together documents, projects, tasks, HR management, and analytics into one unified platform. Built for teams that want to move fast.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button size="lg" asChild data-testid="hero-get-started">
            <Link href="/sign-up" className="flex items-center gap-2">
              Get started free <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">Sign in to workspace</Link>
          </Button>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: LayoutDashboard, title: "Unified Dashboard", desc: "Real-time visibility into projects, tasks, announcements, and team activity in one view." },
            { icon: CheckSquare, title: "Project & Task Tracking", desc: "Kanban boards, priority management, and time tracking to keep your team aligned." },
            { icon: FileText, title: "Document Management", desc: "Store, search, and organize company documents with role-based access control." },
            { icon: Users, title: "HR Management", desc: "Employee directory, leave requests, and attendance tracking built into the platform." },
            { icon: BarChart2, title: "Analytics & Insights", desc: "Productivity trends, team performance, and task completion metrics at a glance." },
            { icon: Building2, title: "Admin Control", desc: "Full control over users, departments, and platform configuration." },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
