"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  DollarSign,
  FileText,
  AlertCircle,
  Loader2,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { useLanguage } from "../contexts/LanguageContext";
import { Badge } from "./ui/badge";
import {
  getStats,
  getInvoices,
  type Invoice,
  type MonthlySeries,
  type VendorBreakdown,
  type StatusBreakdown,
} from "@/lib/api";

// ── Palette ────────────────────────────────────────────────────────────────

const VENDOR_COLORS = [
  "#0A2540",
  "#10B981",
  "#3B82F6",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
];

const STATUS_COLORS: Record<string, string> = {
  completed: "#10B981",
  reviewed: "#3B82F6",
  processing: "#F59E0B",
  failed: "#EF4444",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatMonth(key: string): string {
  if (!key || key.length < 7) return key;
  const [y, m] = key.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(m, 10) - 1] || m} ${y.slice(2)}`;
}

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Component ──────────────────────────────────────────────────────────────

export const Dashboard = () => {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [needsReview, setNeedsReview] = useState(0);
  const [monthlySeries, setMonthlySeries] = useState<MonthlySeries[]>([]);
  const [vendorBreakdown, setVendorBreakdown] = useState<VendorBreakdown[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, invoicesRes] = await Promise.all([
          getStats(),
          getInvoices(),
        ]);
        const s = statsRes.stats;
        setTotalInvoices(s.total_invoices);
        setTotalAmount(s.total_amount);
        setNeedsReview(s.needs_review);
        setMonthlySeries(s.monthly_series || []);
        setVendorBreakdown(s.vendor_breakdown || []);
        setStatusBreakdown(s.status_breakdown || []);
        setRecentInvoices(invoicesRes.invoices.slice(0, 5));
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Chart-ready data
  const monthlyChartData = monthlySeries.map((m) => ({
    month: formatMonth(m.month),
    amount: m.amount,
    count: m.count,
  }));

  const vendorPieData = vendorBreakdown.map((v, i) => ({
    name: v.name,
    value: v.total,
    color: VENDOR_COLORS[i % VENDOR_COLORS.length],
  }));

  const statusBarData = statusBreakdown.map((s) => ({
    status: s.status.charAt(0).toUpperCase() + s.status.slice(1),
    count: s.count,
    fill: STATUS_COLORS[s.status] || "#94A3B8",
  }));

  // Avg invoice value
  const avgInvoice = totalInvoices > 0 ? totalAmount / totalInvoices : 0;

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Amount */}
        <Card className="bg-card border-l-4 border-l-[#10B981] hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalAmount")}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-[#10B981]/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-[#10B981]" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-3xl font-bold text-foreground">
                {fmtCurrency(totalAmount)}
              </p>
            )}
            <div className="pt-2 border-t border-border/50 mt-2">
              <p className="text-xs text-muted-foreground">
                {t("totalAmountDesc")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Invoices */}
        <Card className="bg-card border-l-4 border-l-[#3B82F6] hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalInvoices")}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-[#3B82F6]/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-[#3B82F6]" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-3xl font-bold text-foreground">
                {totalInvoices}
              </p>
            )}
            <div className="pt-2 border-t border-border/50 mt-2">
              <p className="text-xs text-muted-foreground">
                {t("totalInvoicesDesc")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Needs Review */}
        <Card className="bg-card border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("needsReview")}</CardTitle>
            <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-3xl font-bold text-foreground">
                {needsReview}
              </p>
            )}
            <div className="pt-2 border-t border-border/50 mt-2">
              <p className="text-xs text-muted-foreground">
                {t("needsReviewDesc")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Average Invoice */}
        <Card className="bg-card border-l-4 border-l-[#8B5CF6] hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("avgInvoiceValue")}
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-[#8B5CF6]" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-3xl font-bold text-foreground">
                {fmtCurrency(avgInvoice)}
              </p>
            )}
            <div className="pt-2 border-t border-border/50 mt-2">
              <p className="text-xs text-muted-foreground">
                {t("avgInvoiceValueDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row 1 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend – 2 cols */}
        <Card className="bg-card lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground">
                  {t("monthlyInvoiceTrend")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("monthlyInvoiceTrendDesc")}
                </p>
              </div>
              {monthlyChartData.length >= 2 && (
                <Badge className="bg-[#10B981]/10 text-[#10B981] border-0">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {monthlyChartData.length} {t("months")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[350px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : monthlyChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                <p>{t("noMonthlyData")}</p>
              </div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyChartData}>
                    <defs>
                      <linearGradient
                        id="gradAmount"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#10B981"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#10B981"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis dataKey="month" className="text-sm" />
                    <YAxis className="text-sm" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number | undefined) =>
                        value != null
                          ? [fmtCurrency(value), t("amount")]
                          : ["-", t("amount")]
                      }
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#10B981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#gradAmount)"
                      name={t("totalAmount")}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vendor Breakdown Pie – 1 col */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">{t("topVendors")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("byInvoiceAmount")}</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[350px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : vendorPieData.length === 0 ? (
              <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                <p className="text-center text-sm">
                  {t("noVendorData")}
                </p>
              </div>
            ) : (
              <div className="h-[350px] w-full flex flex-col items-center justify-center">
                <div className="w-full h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={vendorPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {vendorPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number | undefined) =>
                          value != null ? fmtCurrency(value) : "-"
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full mt-2">
                  {vendorPieData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-muted-foreground truncate">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row 2 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Status Breakdown */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">
              {t("invoiceStatusBreakdown")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("statusDistributionDesc")}
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : statusBarData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <p>{t("noStatusData")}</p>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusBarData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis dataKey="status" className="text-sm" />
                    <YAxis allowDecimals={false} className="text-sm" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" name={t("invoices")} radius={[8, 8, 0, 0]}>
                      {statusBarData.map((entry, i) => (
                        <Cell key={`bar-${i}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card className="bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground">
                  {t("recentInvoices")}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t("latestProcessedInvoices")}
                </p>
              </div>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentInvoices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t("noInvoicesYet")}
              </p>
            ) : (
              <div className="space-y-4">
                {recentInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[#10B981]/10">
                        <FileText className="h-5 w-5 text-[#10B981]" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {inv.data?.vendor_name || inv.original_filename}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {inv.data?.invoice_no || inv.id.slice(0, 8)}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              inv.status === "completed"
                                ? "border-[#10B981] text-[#10B981] bg-[#10B981]/5"
                                : inv.status === "processing"
                                  ? "border-yellow-500 text-yellow-500 bg-yellow-500/5"
                                  : "border-red-500 text-red-500 bg-red-500/5"
                            }`}
                          >
                            {inv.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#10B981]">
                        {inv.data?.totals?.grand_total != null
                          ? fmtCurrency(Number(inv.data.totals.grand_total))
                          : "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inv.data?.date || inv.created_at?.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Monthly Volume Bar + AI Insights ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Invoice Count */}
        <Card className="bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground">
              {t("monthlyInvoiceVolume")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("monthlyVolumeDesc")}
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : monthlyChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <p>{t("noData")}</p>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis dataKey="month" className="text-sm" />
                    <YAxis allowDecimals={false} className="text-sm" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="count"
                      fill="#3B82F6"
                      name={t("invoices")}
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card className="bg-gradient-to-br from-[#0A2540] to-[#0A2540]/90 text-white border-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-[#10B981] flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">{t("quickStats")}</CardTitle>
                <p className="text-sm text-white/70">{t("realTimeSummary")}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-card/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70 mb-1">{t("totalProcessed")}</p>
                <p className="text-2xl font-bold text-white">
                  {loading ? "..." : totalInvoices}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {t("invoicesInSystem")}
                </p>
              </div>
              <div className="bg-card/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70 mb-1">{t("reviewRate")}</p>
                <p className="text-2xl font-bold text-[#10B981]">
                  {loading || totalInvoices === 0
                    ? "--"
                    : `${Math.round((needsReview / totalInvoices) * 100)}%`}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {t("invoicesFlaggedReview")}
                </p>
              </div>
              <div className="bg-card/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70 mb-1">{t("topVendor")}</p>
                <p className="text-lg font-bold text-white truncate">
                  {loading || vendorBreakdown.length === 0
                    ? "--"
                    : vendorBreakdown[0].name}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {vendorBreakdown.length > 0
                    ? fmtCurrency(vendorBreakdown[0].total)
                    : t("noData")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
