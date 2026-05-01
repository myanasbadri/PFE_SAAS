"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  LogIn,
  UserPlus,
  Upload,
  FileEdit,
  Activity,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Globe,
  Clock,
  User,
  Filter,
  X,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { getActivityLogs, type ActivityLog } from "@/lib/api";

// ── Action display config ──────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  login: {
    label: "Login",
    icon: LogIn,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
  },
  register: {
    label: "Registration",
    icon: UserPlus,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
  },
  upload: {
    label: "Invoice Upload",
    icon: Upload,
    color: "text-violet-600",
    bg: "bg-violet-50 border-violet-200",
  },
  update_invoice: {
    label: "Invoice Update",
    icon: FileEdit,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
  },
  export: {
    label: "Export",
    icon: Activity,
    color: "text-cyan-600",
    bg: "bg-cyan-50 border-cyan-200",
  },
  view_invoice: {
    label: "Invoice View",
    icon: Activity,
    color: "text-gray-600",
    bg: "bg-gray-50 border-gray-200",
  },
  delete_invoice: {
    label: "Invoice Delete",
    icon: Activity,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
  },
  update_profile: {
    label: "Profile Update",
    icon: User,
    color: "text-indigo-600",
    bg: "bg-indigo-50 border-indigo-200",
  },
  advisor_chat: {
    label: "AI Advisor Chat",
    icon: Activity,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
  },
};

function getActionConfig(action: string) {
  return (
    ACTION_CONFIG[action] || {
      label: action,
      icon: Activity,
      color: "text-gray-600",
      bg: "bg-gray-50 border-gray-200",
    }
  );
}

function formatTimestamp(iso: string): string {
  if (!iso) return "N/A";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatRelativeTime(iso: string): string {
  if (!iso) return "";
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return `${Math.floor(diffDay / 30)}mo ago`;
  } catch {
    return "";
  }
}

function renderDetails(details: Record<string, unknown>): string {
  if (!details || Object.keys(details).length === 0) return "";
  const parts: string[] = [];
  if (details.email) parts.push(`Email: ${details.email}`);
  if (details.role) parts.push(`Role: ${details.role}`);
  if (details.invoice_id) parts.push(`Invoice: ${String(details.invoice_id).slice(0, 8)}`);
  if (details.method) parts.push(`Method: ${details.method}`);
  return parts.join(" | ");
}

// ── Component ──────────────────────────────────────────────────────────────

export const AuditTrail = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersVisible, setFiltersVisible] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (actionFilter && actionFilter !== "all") params.action = actionFilter;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;

      const res = await getActivityLogs(params as Parameters<typeof getActivityLogs>[0]);
      setLogs(res.logs);
      setTotalPages(res.pages);
      setTotal(res.total);
    } catch {
      toast.error("Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const clearFilters = () => {
    setActionFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters =
    (actionFilter && actionFilter !== "all") || dateFrom || dateTo;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            {t("auditTrail")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "Track all user activity across the system"
              : "View your recent activity and actions"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="text-sm border-[#0A2540]/20 text-foreground"
          >
            {total} {total === 1 ? "event" : "events"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersVisible((v) => !v)}
            className={`gap-2 ${hasActiveFilters ? "border-[#10B981] text-[#10B981]" : ""}`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 h-2 w-2 rounded-full bg-[#10B981]" />
            )}
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {filtersVisible && (
        <Card className="bg-card border-dashed">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Action Type
                </Label>
                <Select
                  value={actionFilter}
                  onValueChange={(v) => {
                    setActionFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px] h-9 text-sm">
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="register">Registration</SelectItem>
                    <SelectItem value="upload">Invoice Upload</SelectItem>
                    <SelectItem value="update_invoice">
                      Invoice Update
                    </SelectItem>
                    <SelectItem value="export">Export</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-[160px] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-[160px] text-sm"
                />
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground gap-1.5 h-9"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Table */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No activity recorded yet</p>
              <p className="text-sm mt-1">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "Actions will appear here as you use the system"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Action</TableHead>
                      {isAdmin && <TableHead>User</TableHead>}
                      <TableHead>Details</TableHead>
                      <TableHead className="w-[130px]">IP Address</TableHead>
                      <TableHead className="w-[200px] text-right">
                        Time
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const config = getActionConfig(log.action);
                      const Icon = config.icon;
                      return (
                        <TableRow key={log.id} className="hover:bg-muted/50">
                          {/* Action */}
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`h-8 w-8 rounded-lg flex items-center justify-center border ${config.bg}`}
                              >
                                <Icon
                                  className={`h-4 w-4 ${config.color}`}
                                />
                              </div>
                              <span className="font-medium text-sm">
                                {config.label}
                              </span>
                            </div>
                          </TableCell>

                          {/* User (admin only) */}
                          {isAdmin && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-[#0A2540]/10 flex items-center justify-center">
                                  <User className="h-3.5 w-3.5 text-foreground" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium leading-none">
                                    {log.user_name || "Unknown"}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {log.user_email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                          )}

                          {/* Details */}
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {renderDetails(log.details) || "--"}
                            </span>
                          </TableCell>

                          {/* IP */}
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Globe className="h-3.5 w-3.5" />
                              {log.ip_address || "N/A"}
                            </div>
                          </TableCell>

                          {/* Timestamp */}
                          <TableCell className="text-right">
                            <div>
                              <div className="flex items-center justify-end gap-1.5 text-sm">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                {formatTimestamp(log.timestamp)}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatRelativeTime(log.timestamp)}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="gap-1"
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
};
