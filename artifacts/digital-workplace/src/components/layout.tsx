import { useState } from "react";
import { Link, useLocation, useRouter } from "wouter";
import { useClerk } from "@clerk/react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import NotificationBell from "@/components/notification-bell";
import {
  LayoutDashboard, FolderKanban, CheckSquare, FileText, Users,
  BarChart2, Settings, LogOut, Sun, Moon, Menu, X, Shield, BookOpen, Video, MessageCircle, Receipt, Award,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projects", icon: FolderKanban, label: "Projects" },
  { href: "/tasks", icon: CheckSquare, label: "Tasks" },
  { href: "/documents", icon: FileText, label: "Documents" },
  { href: "/hr", icon: Users, label: "HR" },
  { href: "/reimbursements", icon: Receipt, label: "Reimbursements" },
  { href: "/meetings", icon: Video, label: "Meetings" },
  { href: "/chat", icon: MessageCircle, label: "Chat" },
  { href: "/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/policy", icon: BookOpen, label: "Policy" },
];

const hrNavItems = [
  { href: "/performance", icon: Award, label: "Performance" },
];

const adminNavItems = [
  { href: "/admin", icon: Shield, label: "Admin" },
];

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { theme, setTheme } = useTheme();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { data: currentUser } = useGetCurrentUser();

  const isAdmin = currentUser?.role && ["super_admin", "admin"].includes(currentUser.role);
  const isHR = currentUser?.role && ["super_admin", "admin", "hr_manager"].includes(currentUser.role);
  const userInitials = currentUser
    ? `${currentUser.firstName?.[0] ?? ""}${currentUser.lastName?.[0] ?? ""}`.toUpperCase()
    : "U";

  const handleSignOut = () => {
    signOut({ redirectUrl: basePath || "/" });
  };

  const NavLink = ({ item }: { item: typeof navItems[0] }) => {
    const active = location === item.href || location.startsWith(item.href + "/");
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={item.href}>
            <div
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer group ${
                active
                  ? "bg-sidebar-primary/20 text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-sidebar-primary" : ""}`} />
              <span className="text-sm">{item.label}</span>
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="xl:hidden">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-64 flex-shrink-0
          bg-sidebar flex flex-col
          transform transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="flex gap-2.5 px-4 py-5 border-b border-sidebar-border text-[#000000] justify-center items-center border-t-[#000000] border-r-[#000000] border-b-[#000000] border-l-[#000000]">
          <img src="/logo.png" className="h-24 w-auto" alt="ekatraa" />
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto text-[#000000]">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          {isHR && hrNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          {isAdmin && (
            <>
              <div className="my-3 border-t border-sidebar-border opacity-20" />
              {adminNavItems.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </>
          )}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-sidebar-border border-t-[#000000] border-r-[#000000] border-b-[#000000] border-l-[#000000]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="user-menu-trigger"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-colors text-left"
              >
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={currentUser?.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sidebar-foreground text-sm font-medium truncate">
                    {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Loading..."}
                  </p>
                  <p className="text-sidebar-foreground/50 text-xs truncate">
                    {currentUser?.role?.replace(/_/g, " ")}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">
                    {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : ""}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">{currentUser?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="sign-out-button"
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-background/95 backdrop-blur flex items-center gap-4 px-4 lg:px-6 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            data-testid="mobile-menu-button"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            {currentUser && (
              <Badge variant="outline" className="text-xs hidden sm:flex">
                {currentUser.role?.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
