"use client";
/**
 * =============================================================================
 *  MULTI-CHANNEL NOTIFICATION SYSTEM — Frontend Components
 *  For: SmartInvoice AI (Next.js / TypeScript / shadcn-ui / Tailwind)
 * =============================================================================
 *
 * This file contains:
 *   1. API service functions (notificationApi)
 *   2. useNotifications hook
 *   3. NotificationBellNew — bell icon + dropdown
 *   4. NotificationCenter — full-page notification history
 *   5. NotificationPreferences — user preference panel
 *
 * Usage:
 *   import { NotificationBellNew } from "@/components/NotificationSystem";
 *   import { NotificationCenter } from "@/components/NotificationSystem";
 *   import { NotificationPreferences } from "@/components/NotificationSystem";
 *
 * =============================================================================
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

// ── shadcn/ui components ────────────────────────────────────────────────
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Bell,
  Check,
  CheckCheck,
  FileText,
  Sparkles,
  AlertTriangle,
  X,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Settings,
  Mail,
  MessageSquare,
  Monitor,
  Moon,
  Clock,
  Megaphone,
  Info,
} from "lucide-react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — API Service
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

// ── Types ────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  content: string;
  category: string;
  action_url: string;
  is_read: boolean;
  priority: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationPrefs {
  channels: { in_app: boolean; email: boolean; sms: boolean };
  types: { extraction: boolean; invoice: boolean; review: boolean; system: boolean };
  quiet_hours: { enabled: boolean; start: string; end: string; timezone: string };
  digest: { enabled: boolean; frequency: string; time: string };
}

interface NotificationsResponse {
  success: boolean;
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  unread_count: number;
}

interface UnreadCountResponse {
  success: boolean;
  unread_count: number;
}

interface PrefsResponse {
  success: boolean;
  preferences: NotificationPrefs;
}

// ── API functions ────────────────────────────────────────────────────────

export const notificationApi = {
  getNotifications(params?: {
    page?: number;
    limit?: number;
    category?: string;
    is_read?: string;
  }) {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.category) sp.set("category", params.category);
    if (params?.is_read) sp.set("is_read", params.is_read);
    const qs = sp.toString();
    return apiRequest<NotificationsResponse>(`/api/notifications/user${qs ? `?${qs}` : ""}`);
  },

  getUnreadCount() {
    return apiRequest<UnreadCountResponse>("/api/notifications/unread-count");
  },

  markAsRead(id: string) {
    return apiRequest<{ success: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" });
  },

  markAllAsRead() {
    return apiRequest<{ success: boolean; marked: number }>("/api/notifications/read-all", {
      method: "PATCH",
    });
  },

  deleteNotification(id: string) {
    return apiRequest<{ success: boolean }>(`/api/notifications/${id}`, { method: "DELETE" });
  },

  getPreferences() {
    return apiRequest<PrefsResponse>("/api/notifications/preferences");
  },

  updatePreferences(prefs: Partial<NotificationPrefs>) {
    return apiRequest<PrefsResponse>("/api/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify(prefs),
    });
  },

  adminBroadcast(data: {
    title: string;
    message: string;
    target: string;
    user_ids?: string[];
    channels?: string[];
  }) {
    return apiRequest<{ success: boolean; sent_count: number }>(
      "/api/notifications/admin/broadcast",
      { method: "POST", body: JSON.stringify(data) },
    );
  },

  sendTest() {
    return apiRequest<{ success: boolean }>("/api/notifications/test", { method: "POST" });
  },

  sendTestEmail() {
    return apiRequest<{ success: boolean }>("/api/notifications/test-email", { method: "POST" });
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — useNotifications Hook
// ═══════════════════════════════════════════════════════════════════════════

const POLL_INTERVAL = 30_000;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchNotifications = useCallback(
    async (p = page, limit = 20, category = "", isRead = "") => {
      setLoading(true);
      try {
        const res = await notificationApi.getNotifications({
          page: p,
          limit,
          category: category || undefined,
          is_read: isRead || undefined,
        });
        setNotifications(res.notifications);
        setUnreadCount(res.unread_count);
        setTotalPages(res.pages);
        setTotal(res.total);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [page],
  );

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationApi.getUnreadCount();
      setUnreadCount(res.unread_count);
    } catch {
      // silent
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await notificationApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => t - 1);
    } catch {
      // silent
    }
  }, []);

  // Poll unread count
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    page,
    setPage,
    totalPages,
    total,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — Helpers
// ═══════════════════════════════════════════════════════════════════════════

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "invoice":
      return <FileText className="h-4 w-4 text-blue-500" />;
    case "extraction":
      return <Sparkles className="h-4 w-4 text-[#10B981]" />;
    case "review":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "system":
      return <Megaphone className="h-4 w-4 text-purple-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    invoice: "Invoice",
    extraction: "Extraction",
    review: "Review",
    system: "System",
  };
  return labels[category] || category;
}

function getPriorityColor(priority: string): string {
  if (priority === "high") return "bg-red-100 text-red-700 border-red-200";
  if (priority === "low") return "bg-gray-100 text-gray-600 border-gray-200";
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — NotificationBellNew Component
// ═══════════════════════════════════════════════════════════════════════════

export function NotificationBellNew() {
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch when dropdown opens
  useEffect(() => {
    if (isOpen) fetchNotifications(1, 10);
  }, [isOpen, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleRead = async (n: Notification) => {
    if (!n.is_read) await markAsRead(n.id);
    if (n.action_url) {
      router.push(n.action_url);
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    await markAllAsRead();
    setMarkingAll(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="notification-bell-btn relative h-9 w-9 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className={`h-4 w-4 text-foreground ${unreadCount > 0 ? "notification-bell-ring" : ""}`} />
        {unreadCount > 0 && (
          <span className="notification-badge absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 flex items-center justify-center rounded-full bg-[#10B981] text-white text-[10px] font-bold leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="notification-dropdown absolute right-0 top-full mt-2 w-[400px] max-h-[520px] bg-card border border-border rounded-xl shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-[#10B981]/10 text-[#10B981]">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="flex items-center gap-1 text-xs text-[#10B981] hover:text-[#10B981]/80 transition-colors disabled:opacity-50"
                >
                  {markingAll ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3 w-3" />
                  )}
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleRead(n)}
                  className={`notification-item w-full text-left px-4 py-3 flex gap-3 border-b border-border/50 transition-all hover:bg-muted/50 ${
                    !n.is_read ? "bg-[#10B981]/5" : ""
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">{getCategoryIcon(n.category)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm leading-tight ${
                          !n.is_read ? "font-semibold text-foreground" : "text-foreground/80"
                        }`}
                      >
                        {n.title}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {n.priority === "high" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        )}
                        {!n.is_read && <span className="h-2 w-2 rounded-full bg-[#10B981]" />}
                      </div>
                    </div>
                    <p
                      className="text-xs text-muted-foreground mt-0.5 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: n.content || "" }}
                    />
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border flex items-center justify-between bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              {unreadCount === 0 && <Check className="inline h-3 w-3 ml-1 text-[#10B981]" />}
            </span>
            <button
              onClick={() => {
                router.push("/notifications");
                setIsOpen(false);
              }}
              className="text-xs text-[#10B981] hover:text-[#10B981]/80 font-medium transition-colors"
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — NotificationCenter (Full Page)
// ═══════════════════════════════════════════════════════════════════════════

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    loading,
    page,
    setPage,
    totalPages,
    total,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const router = useRouter();

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [filtersVisible, setFiltersVisible] = useState(false);

  useEffect(() => {
    const cat = categoryFilter === "all" ? "" : categoryFilter;
    const read = readFilter === "all" ? "" : readFilter;
    fetchNotifications(page, 20, cat, read);
  }, [page, categoryFilter, readFilter, fetchNotifications]);

  const clearFilters = () => {
    setCategoryFilter("all");
    setReadFilter("all");
    setPage(1);
  };

  const hasActiveFilters = categoryFilter !== "all" || readFilter !== "all";

  const handleClick = async (n: Notification) => {
    if (!n.is_read) await markAsRead(n.id);
    if (n.action_url) router.push(n.action_url);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteNotification(id);
    toast.success("Notification deleted");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Notifications</h2>
          <p className="text-sm text-muted-foreground mt-1">
            All your notifications and alerts in one place
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            {total} total
          </Badge>
          {unreadCount > 0 && (
            <Badge className="bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 hover:bg-[#10B981]/10">
              {unreadCount} unread
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersVisible((v) => !v)}
            className={`gap-2 ${hasActiveFilters ? "border-[#10B981] text-[#10B981]" : ""}`}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => router.push("/notifications/preferences")}
          >
            <Settings className="h-4 w-4" />
            Preferences
          </Button>
        </div>
      </div>

      {/* Filters */}
      {filtersVisible && (
        <Card className="bg-card border-dashed">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-[160px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="extraction">Extraction</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={readFilter} onValueChange={(v) => { setReadFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-[140px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="false">Unread</SelectItem>
                    <SelectItem value="true">Read</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 h-9">
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications Table */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm mt-1">
                {hasActiveFilters ? "Try adjusting your filters" : "You're all caught up!"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Type</TableHead>
                      <TableHead>Notification</TableHead>
                      <TableHead className="w-[100px]">Category</TableHead>
                      <TableHead className="w-[150px]">Date</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((n) => (
                      <TableRow
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                          !n.is_read ? "bg-[#10B981]/5" : ""
                        }`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {!n.is_read && <span className="h-2 w-2 rounded-full bg-[#10B981] flex-shrink-0" />}
                            {getCategoryIcon(n.category)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className={`text-sm ${!n.is_read ? "font-semibold" : ""}`}>{n.title}</p>
                            <p
                              className="text-xs text-muted-foreground mt-0.5 line-clamp-1"
                              dangerouslySetInnerHTML={{ __html: n.content }}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getCategoryLabel(n.category)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm text-muted-foreground">{formatDate(n.created_at)}</p>
                            <p className="text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!n.is_read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Mark as read"
                                onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Delete"
                              onClick={(e) => handleDelete(e, n.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — NotificationPreferences Component
// ═══════════════════════════════════════════════════════════════════════════

export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    notificationApi
      .getPreferences()
      .then((res) => setPrefs(res.preferences))
      .catch(() => toast.error("Failed to load preferences"))
      .finally(() => setLoading(false));
  }, []);

  const save = async (updates: Partial<NotificationPrefs>) => {
    setSaving(true);
    try {
      const res = await notificationApi.updatePreferences(updates);
      setPrefs(res.preferences);
      toast.success("Preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (ch: keyof NotificationPrefs["channels"]) => {
    if (!prefs) return;
    const updated = { ...prefs.channels, [ch]: !prefs.channels[ch] };
    setPrefs({ ...prefs, channels: updated });
    save({ channels: updated });
  };

  const toggleType = (t: keyof NotificationPrefs["types"]) => {
    if (!prefs) return;
    const updated = { ...prefs.types, [t]: !prefs.types[t] };
    setPrefs({ ...prefs, types: updated });
    save({ types: updated });
  };

  const updateQuietHours = (field: string, value: string | boolean) => {
    if (!prefs) return;
    const updated = { ...prefs.quiet_hours, [field]: value };
    setPrefs({ ...prefs, quiet_hours: updated });
    save({ quiet_hours: updated });
  };

  const updateDigest = (field: string, value: string | boolean) => {
    if (!prefs) return;
    const updated = { ...prefs.digest, [field]: value };
    setPrefs({ ...prefs, digest: updated });
    save({ digest: updated });
  };

  if (!prefs) {
    return loading ? (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ) : null;
  }

  const channelInfo = [
    { key: "in_app" as const, label: "In-App Notifications", desc: "Show notifications inside the app", icon: Monitor },
    { key: "email" as const, label: "Email Notifications", desc: "Receive emails for important events", icon: Mail },
    { key: "sms" as const, label: "SMS Notifications", desc: "Get text messages for critical alerts", icon: MessageSquare },
  ];

  const typeInfo = [
    { key: "extraction" as const, label: "Extraction", desc: "AI extraction started, completed, or failed" },
    { key: "invoice" as const, label: "Invoice", desc: "Invoice created, updated, deleted, status changed" },
    { key: "review" as const, label: "Review", desc: "Invoices flagged for human review" },
    { key: "system" as const, label: "System", desc: "Admin broadcasts and system announcements" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Notification Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Control how and when you receive notifications
        </p>
      </div>

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Delivery Channels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {channelInfo.map((ch) => {
            const Icon = ch.icon;
            return (
              <div key={ch.key} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ch.label}</p>
                    <p className="text-xs text-muted-foreground">{ch.desc}</p>
                  </div>
                </div>
                <Switch
                  checked={prefs.channels[ch.key]}
                  onCheckedChange={() => toggleChannel(ch.key)}
                  disabled={ch.key === "in_app"} // in-app always on
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Types
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {typeInfo.map((t) => (
            <div key={t.key} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                {getCategoryIcon(t.key)}
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              </div>
              <Switch
                checked={prefs.types[t.key]}
                onCheckedChange={() => toggleType(t.key)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Quiet Hours</p>
              <p className="text-xs text-muted-foreground">
                Pause email & SMS during specific hours (in-app still active)
              </p>
            </div>
            <Switch
              checked={prefs.quiet_hours.enabled}
              onCheckedChange={(v) => updateQuietHours("enabled", v)}
            />
          </div>
          {prefs.quiet_hours.enabled && (
            <div className="flex items-center gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input
                  type="time"
                  value={prefs.quiet_hours.start}
                  onChange={(e) => updateQuietHours("start", e.target.value)}
                  className="h-9 w-[130px] text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input
                  type="time"
                  value={prefs.quiet_hours.end}
                  onChange={(e) => updateQuietHours("end", e.target.value)}
                  className="h-9 w-[130px] text-sm"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Digest */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Email Digest
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Daily Email Digest</p>
              <p className="text-xs text-muted-foreground">
                Receive a summary of yesterday&apos;s activity
              </p>
            </div>
            <Switch
              checked={prefs.digest.enabled}
              onCheckedChange={(v) => updateDigest("enabled", v)}
            />
          </div>
          {prefs.digest.enabled && (
            <div className="flex items-center gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Delivery Time</Label>
                <Input
                  type="time"
                  value={prefs.digest.time}
                  onChange={(e) => updateDigest("time", e.target.value)}
                  className="h-9 w-[130px] text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Frequency</Label>
                <Select value={prefs.digest.frequency} onValueChange={(v) => updateDigest("frequency", v)}>
                  <SelectTrigger className="w-[140px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">About Notifications</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            In-app notifications are always stored. Email and SMS delivery depends on your channel
            settings and quiet hours. During quiet hours, only in-app notifications are delivered —
            emails and SMS will not be sent.
          </p>
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-6 right-6 bg-card border border-border rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 z-50">
          <Loader2 className="h-4 w-4 animate-spin text-[#10B981]" />
          <span className="text-sm text-foreground">Saving...</span>
        </div>
      )}
    </div>
  );
}
