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
  { labelKey: string; icon: React.ElementType; color: string; bg: string }
> = {
  login: {
    labelKey: "login",
    icon: LogIn,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  },
  register: {
    labelKey: "registration",
    icon: UserPlus,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
  },
  upload: {
    labelKey: "invoiceUpload",
    icon: Upload,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800",
  },
  update_invoice: {
    labelKey: "invoiceUpdate",
    icon: FileEdit,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
  },
  export: {
    labelKey: "export",
    icon: Activity,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800",
  },
  view_invoice: {
    labelKey: "invoiceView",
    icon: Activity,
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800",
  },
  delete_invoice: {
    labelKey: "invoiceDelete",
    icon: Activity,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  },
  update_profile: {
    labelKey: "profileUpdate",
    icon: User,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800",
  },
  advisor_chat: {
    labelKey: "aiAdvisorChat",
    icon: Activity,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
  },
};

function getActionConfig(action: string) {
  return (
    ACTION_CONFIG[action] || {
      labelKey: action,
      icon: Activity,
      color: "text-gray-600 dark:text-gray-400",
      bg: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800",
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

function formatRelativeTime(iso: string, t: (key: string) => string): string {
  if (!iso) return "";
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return t("justNow");
    if (diffMin < 60) return t("minutesAgo").replace("{n}", String(diffMin));
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return t("hoursAgo").replace("{n}", String(diffHr));
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return t("daysAgo").replace("{n}", String(diffDay));
    return t("monthsAgo").replace("{n}", String(Math.floor(diffDay / 30)));
  } catch {
    return "";
  }
}

function renderDetails(details: Record<string, unknown>, t: (key: string) => string): string {
  if (!details || Object.keys(details).length === 0) return "";
  const parts: string[] = [];
  if (details.email) parts.push(`${t("email")}: ${details.email}`);
  if (details.role) parts.push(`${t("role")}: ${details.role}`);
  if (details.invoice_id) parts.push(`${t("invoice")}: ${String(details.invoice_id).slice(0, 8)}`);
  if (details.method) parts.push(`${t("paymentMethod")}: ${details.method}`);
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
      toast.error(t("failedToLoadLogs"));
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, dateFrom, dateTo, t]);

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
              ? t("trackAllActivity")
              : t("viewYourActivity")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="text-sm border-[#0A2540]/20 text-foreground"
          >
            {total} {total === 1 ? t("event") : t("events")}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersVisible((v) => !v)}
            className={`gap-2 ${hasActiveFilters ? "border-[#10B981] text-[#10B981]" : ""}`}
          >
            <Filter className="h-4 w-4" />
            {t("filters")}
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
                  {t("actionType")}
                </Label>
                <Select
                  value={actionFilter}
                  onValueChange={(v) => {
                    setActionFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px] h-9 text-sm">
                    <SelectValue placeholder={t("allActions")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allActions")}</SelectItem>
                    <SelectItem value="login">{t("login")}</SelectItem>
                    <SelectItem value="register">{t("registration")}</SelectItem>
                    <SelectItem value="upload">{t("invoiceUpload")}</SelectItem>
                    <SelectItem value="update_invoice">
                      {t("invoiceUpdate")}
                    </SelectItem>
                    <SelectItem value="export">{t("export")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("dateFrom")}</Label>
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
                <Label className="text-xs text-muted-foreground">{t("dateTo")}</Label>
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
                  {t("clearAll")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Table */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">{t("activityLog")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">{t("noActivityYet")}</p>
              <p className="text-sm mt-1">
                {hasActiveFilters
                  ? t("tryAdjusting")
                  : t("actionsWillAppear")}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">{t("actionType")}</TableHead>
                      {isAdmin && <TableHead>{t("user")}</TableHead>}
                      <TableHead>{t("details")}</TableHead>
                      <TableHead className="w-[130px]">{t("ipAddress")}</TableHead>
                      <TableHead className="w-[200px] text-right">
                        {t("timestamp")}
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
                                {t(config.labelKey)}
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
                              {renderDetails(log.details, t) || "--"}
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
                                {formatRelativeTime(log.timestamp, t)}
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
                    {t("page")} {page} {t("of")} {totalPages} ({total} {t("total")})
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
                      {t("previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="gap-1"
                    >
                      {t("next")}
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
