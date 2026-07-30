import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, ScanFace, FileSpreadsheet, LogOut, Menu, X, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealthCheck } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/scan", label: "Scanner", icon: ScanFace },
  { href: "/reports", label: "Reports", icon: FileSpreadsheet },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: health } = useHealthCheck();
  const { user, logout } = useAuth();
  const isHealthy = health?.status === "ok";

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden text-foreground flex-col md:flex-row">
      {/* Mobile Top Navigation Bar */}
      <header className="md:hidden h-14 bg-sidebar text-sidebar-foreground border-b border-sidebar-border px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-sidebar-primary text-sidebar-primary-foreground p-1 rounded-md">
              <ScanFace className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-wide">SmartAccess</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {isHealthy && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>}
            <span className={cn("relative inline-flex rounded-full h-2 w-2", isHealthy ? "bg-success" : "bg-destructive")}></span>
          </span>
          <span className="text-xs text-sidebar-foreground/60">{isHealthy ? "Online" : "Offline"}</span>
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0 transition-transform duration-300 ease-in-out z-50",
          "fixed inset-y-0 left-0 w-64 md:static md:translate-x-0 md:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-sidebar-primary text-sidebar-primary-foreground p-1.5 rounded-md">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide block leading-none">SmartAccess</span>
              <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest block mt-1 leading-none">Lecturer Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5" title={isHealthy ? "System Online" : "System Offline"}>
              <span className="relative flex h-2 w-2">
                {isHealthy && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>}
                <span className={cn("relative inline-flex rounded-full h-2 w-2", isHealthy ? "bg-success" : "bg-destructive")}></span>
              </span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Sign Out Footer */}
        <div className="p-4 border-t border-sidebar-border/50 shrink-0 space-y-3">
          {user && (
            <div className="flex items-center gap-3 px-2 py-1.5 rounded-md bg-sidebar-accent/40 text-sidebar-foreground">
              <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate leading-none">{user.name}</p>
                <p className="text-[11px] text-sidebar-foreground/60 truncate mt-0.5">{user.department}</p>
              </div>
            </div>
          )}

          <button
            onClick={logout}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-auto bg-background p-4 sm:p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
