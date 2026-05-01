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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";

const OrgSwitcher = dynamic(() => import("@/components/OrgSwitcher"), { ssr: false });

const NotificationBell = dynamic(
  () => import("@/components/NotificationSystem").then(mod => ({ default: mod.NotificationBellNew })),
  { ssr: false },
);

const navigation = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "invoices", href: "/invoices", icon: FileText },
  { key: "aiExtraction", href: "/extraction", icon: Sparkles },
  { key: "aiAdvisor", href: "/advisor", icon: MessageSquare },
  { key: "notifications", href: "/notifications", icon: Bell },
  { key: "auditTrail", href: "/activity", icon: ClipboardList },
  { key: "team", href: "/team", icon: UsersRound },
  { key: "settings", href: "/settings", icon: Settings },
  { key: "userManagement", href: "/users", icon: Users, adminOnly: true },
] as const;

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "EN" },
  { code: "fr", label: "Français", flag: "FR" },
  { code: "ar", label: "العربية", flag: "AR" },
];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [loading, user, router]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-overlay backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 rtl:left-auto rtl:right-0 rtl:lg:translate-x-0",
          sidebarOpen
            ? "translate-x-0 rtl:translate-x-0"
            : "-translate-x-full rtl:translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#0A2540] to-[#10B981] flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-sidebar-foreground">
                SmartInvoice
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Org Switcher */}
          <div className="px-3 py-3 border-b border-sidebar-border">
            <OrgSwitcher />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation
              .filter((item) => !("adminOnly" in item && item.adminOnly) || user?.role === "admin")
              .map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{t(item.key)}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-sidebar-border">
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5 ltr:mr-3 rtl:ml-3" />
              {t("logout")}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ltr:pl-64 lg:rtl:pr-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-background border-b border-border flex items-center justify-between px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <NotificationBell />

            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-9 px-3 text-sm"
                >
                  <Globe className="h-4 w-4" />
                  <span className="font-semibold">{currentLang.flag}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={cn(
                      "gap-2 cursor-pointer",
                      language === lang.code && "bg-accent",
                    )}
                  >
                    <span className="font-semibold text-xs w-6">
                      {lang.flag}
                    </span>
                    <span>{lang.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            {mounted && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
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
                    className={cn(
                      "gap-2 cursor-pointer",
                      theme === "light" && "bg-accent",
                    )}
                  >
                    <Sun className="h-4 w-4" />
                    {t("lightMode")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("dark")}
                    className={cn(
                      "gap-2 cursor-pointer",
                      theme === "dark" && "bg-accent",
                    )}
                  >
                    <Moon className="h-4 w-4" />
                    {t("darkMode")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setTheme("system")}
                    className={cn(
                      "gap-2 cursor-pointer",
                      theme === "system" && "bg-accent",
                    )}
                  >
                    <Monitor className="h-4 w-4" />
                    {t("systemTheme")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
