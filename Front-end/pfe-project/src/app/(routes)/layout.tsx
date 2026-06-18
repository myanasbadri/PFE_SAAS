"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import "@/styles/notification_styles.css";
import {
  LayoutDashboard,
  FileText,
  Sparkles,
  MessageSquare,
  ClipboardList,
  Users,
  Bell,
  LogOut,
  Menu,
  X,
  Loader2,
  Moon,
  Sun,
  Globe,
  Monitor,
  Settings,
  UsersRound,
  Receipt,
  ScanLine,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ChevronRight,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { useTheme } from "next-themes";
import OrgSwitcher from "@/components/OrgSwitcher";
import { NotificationBellNew as NotificationBell } from "@/components/NotificationSystem";
import { getMyInvitations, acceptInvitation, type MyInvitation } from "@/lib/api";
import { toast } from "sonner";

// ── Navigation structure ─────────────────────────────────────────────────────

interface NavItem {
  key: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "navMain",
    items: [
      { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
      { key: "invoices", href: "/invoices", icon: FileText },
    ],
  },
  {
    labelKey: "navAITools",
    items: [
      { key: "aiExtraction", href: "/extraction", icon: Sparkles },
      { key: "scanImport", href: "/scan", icon: ScanLine },
      { key: "aiAdvisor", href: "/advisor", icon: MessageSquare },
    ],
  },
  {
    labelKey: "navFinance",
    items: [
      { key: "withholdingTax", href: "/withholding", icon: Receipt },
    ],
  },
  {
    labelKey: "navSystem",
    items: [
      { key: "notifications", href: "/notifications", icon: Bell },
      { key: "auditTrail", href: "/activity", icon: ClipboardList },
      { key: "team", href: "/team", icon: UsersRound },
      { key: "settings", href: "/settings", icon: Settings },
      { key: "userManagement", href: "/users", icon: Users, adminOnly: true },
    ],
  },
];

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "EN" },
  { code: "fr", label: "Français", flag: "FR" },
  { code: "ar", label: "العربية", flag: "AR" },
];

// ── Breadcrumb helper ────────────────────────────────────────────────────────

function getPageTitle(pathname: string, t: (k: string) => string): string {
  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const match = allItems.find((item) => item.href === pathname);
  return match ? t(match.key) : "";
}

// ── Layout ───────────────────────────────────────────────────────────────────

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout, setOrgs, setCurrentOrgId, orgs } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<MyInvitation[]>([]);
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // Fetch pending invitations for the current user
  const fetchInvites = useCallback(async () => {
    try {
      const res = await getMyInvitations();
      setPendingInvites(res.invitations || []);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      fetchInvites();
    }
  }, [loading, user, fetchInvites]);

  const handleAcceptInvite = async (invite: MyInvitation) => {
    setAcceptingToken(invite.token);
    try {
      const res = await acceptInvitation(invite.token);
      toast.success(`Joined ${invite.org_name} successfully!`);
      if (res.org) {
        setOrgs([...orgs, res.org]);
        setCurrentOrgId(res.org.id);
      }
      setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err: any) {
      toast.error(err?.message || "Failed to accept invitation");
    } finally {
      setAcceptingToken(null);
    }
  };

  // Keyboard shortcut: Ctrl+B to toggle sidebar collapse
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [loading, user, router]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const ready = mounted && !loading && !!user;
  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
  const pageTitle = getPageTitle(pathname, t);
  const sidebarPx = collapsed ? 68 : 256;

  // ── SSR / loading state ──────────────────────────────────────────────
  // Render NO Radix components during SSR to prevent hydration ID mismatches.
  // {children} is kept in the DOM (hidden) so Next.js router doesn't lose it.
  if (!ready) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
        <div hidden>{children}</div>
      </div>
    );
  }

  // ── Authenticated app shell (client-only, no SSR) ─────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out lg:translate-x-0 rtl:left-auto rtl:right-0 rtl:lg:translate-x-0 flex flex-col",
          sidebarOpen
            ? "translate-x-0 rtl:translate-x-0"
            : "-translate-x-full rtl:translate-x-full",
        )}
        style={{ width: sidebarPx }}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center h-16 border-b border-sidebar-border shrink-0",
          collapsed ? "justify-center px-2" : "justify-between px-5",
        )}>
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#10B981] to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-[15px] font-bold text-sidebar-foreground leading-tight tracking-tight">
                  SmartInvoice
                </span>
                <span className="text-[10px] text-sidebar-foreground/40 font-medium tracking-widest uppercase">
                  AI Platform
                </span>
              </div>
            )}
          </Link>
          {/* Mobile close */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Org Switcher */}
        {!collapsed && (
          <div className="px-3 py-3 border-b border-sidebar-border shrink-0">
            <OrgSwitcher />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-thin">
          {NAV_GROUPS.map((group) => {
            const filteredItems = group.items.filter(
              (item) => !item.adminOnly || user?.role === "admin"
            );
            if (filteredItems.length === 0) return null;

            return (
              <div key={group.labelKey} className="mb-2">
                {/* Group label */}
                {!collapsed && (
                  <p className="px-5 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                    {t(group.labelKey) || group.labelKey}
                  </p>
                )}
                {collapsed && <div className="mx-3 mb-2 border-t border-sidebar-border" />}

                <div className={cn("space-y-0.5", collapsed ? "px-1.5" : "px-3")}>
                  {filteredItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    const linkContent = (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "group relative flex items-center rounded-lg transition-all duration-200",
                          collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2.5",
                          isActive
                            ? "bg-[#10B981]/10 text-[#10B981]"
                            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                        )}
                      >
                        {/* Active indicator bar */}
                        {isActive && (
                          <div className={cn(
                            "absolute top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#10B981] rounded-full",
                            collapsed ? "ltr:-left-1.5 rtl:-right-1.5" : "ltr:-left-0 rtl:-right-0",
                          )} />
                        )}
                        <Icon className={cn(
                          "shrink-0 transition-colors",
                          collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                          isActive ? "text-[#10B981]" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                        )} />
                        {!collapsed && (
                          <span className={cn(
                            "text-[13px] font-medium transition-colors truncate",
                            isActive ? "text-[#10B981]" : "",
                          )}>
                            {t(item.key)}
                          </span>
                        )}
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip key={item.key}>
                          <TooltipTrigger asChild>
                            {linkContent}
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={8}>
                            {t(item.key)}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return linkContent;
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="shrink-0 border-t border-sidebar-border">
          {/* Collapse toggle (desktop only) */}
          <div className="hidden lg:block">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCollapsed((c) => !c)}
                  className={cn(
                    "w-full flex items-center gap-2 py-2.5 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors",
                    collapsed ? "justify-center px-2" : "px-5",
                  )}
                >
                  {collapsed ? (
                    <ChevronsRight className="h-4 w-4" />
                  ) : (
                    <>
                      <ChevronsLeft className="h-4 w-4" />
                      <span className="text-xs">Collapse</span>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {collapsed ? "Expand sidebar" : "Collapse sidebar"} (Ctrl+B)
              </TooltipContent>
            </Tooltip>
          </div>

          {/* User profile */}
          <div className={cn(
            "border-t border-sidebar-border",
            collapsed ? "p-2" : "p-3",
          )}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center h-10 w-10 mx-auto rounded-lg text-sidebar-foreground/50 hover:text-red-400 hover:bg-sidebar-accent transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {t("logout")}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#0A2540] to-[#1a3a5c] flex items-center justify-center shrink-0 ring-1 ring-sidebar-border">
                  <span className="text-sm font-bold text-white/90">
                    {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-sidebar-foreground truncate leading-tight">
                    {user?.name || "User"}
                  </p>
                  <p className="text-[11px] text-sidebar-foreground/40 truncate leading-tight">
                    {user?.email}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleLogout}
                      className="shrink-0 p-1.5 rounded-md text-sidebar-foreground/30 hover:text-red-400 hover:bg-sidebar-accent transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{t("logout")}</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div
        className="transition-all duration-300 max-lg:!pl-0 max-lg:!pr-0"
        style={{
          [language === "ar" ? "paddingRight" : "paddingLeft"]: `${sidebarPx}px`,
        }}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between h-14 px-4 lg:px-6">
            {/* Left: hamburger + breadcrumb */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-9 w-9 text-muted-foreground"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* Breadcrumb */}
              {pageTitle && (
                <div className="hidden sm:flex items-center gap-1.5 text-sm">
                  <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t("dashboard")}
                  </Link>
                  {pathname !== "/dashboard" && (
                    <>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <span className="font-medium text-foreground">{pageTitle}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-1.5">
              {/* Notifications */}
              <NotificationBell />

              {/* Language */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {LANGUAGES.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className={cn(
                        "gap-2 cursor-pointer",
                        language === lang.code && "bg-accent/10 text-accent",
                      )}
                    >
                      <span className="text-xs font-bold w-6 text-center">
                        {lang.flag}
                      </span>
                      <span className="text-sm">{lang.label}</span>
                      {language === lang.code && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Theme */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  >
                    {theme === "dark" ? (
                      <Moon className="h-4 w-4" />
                    ) : theme === "light" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Monitor className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onClick={() => setTheme("light")}
                    className={cn("gap-2 cursor-pointer", theme === "light" && "bg-accent/10 text-accent")}
                  >
                    <Sun className="h-4 w-4" />
                    <span className="text-sm">{t("lightMode")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("dark")}
                    className={cn("gap-2 cursor-pointer", theme === "dark" && "bg-accent/10 text-accent")}
                  >
                    <Moon className="h-4 w-4" />
                    <span className="text-sm">{t("darkMode")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setTheme("system")}
                    className={cn("gap-2 cursor-pointer", theme === "system" && "bg-accent/10 text-accent")}
                  >
                    <Monitor className="h-4 w-4" />
                    <span className="text-sm">{t("systemTheme")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User avatar menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#0A2540] to-[#1a3a5c] flex items-center justify-center ring-1 ring-border hover:ring-2 hover:ring-[#10B981]/50 transition-all ml-1">
                    <span className="text-sm font-bold text-white/90">
                      {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#0A2540] to-[#1a3a5c] flex items-center justify-center shrink-0">
                        <span className="text-base font-bold text-white/90">
                          {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{user?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                    <Link href="/settings">
                      <Settings className="h-4 w-4" />
                      {t("settings")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Pending invitations banner */}
        {pendingInvites.length > 0 && (
          <div className="px-4 lg:px-6 pt-4 space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-sm text-foreground truncate">
                    You&apos;re invited to join <strong>{invite.org_name}</strong> as <strong>{invite.role}</strong>
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAcceptInvite(invite)}
                  disabled={acceptingToken === invite.token}
                  className="shrink-0 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  {acceptingToken === invite.token ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Accept
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
