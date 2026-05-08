"use client";

import { useState, useEffect } from "react";
import {
  FileText, DollarSign, TrendingDown, Hash, Loader2, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useLanguage } from "../contexts/LanguageContext";
import {
  tejGetDashboard,
  type TEJDashboardStats, type TEJCertificate,
} from "@/lib/api";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";

interface WithholdingDashboardProps {
  onViewCert: (cert: TEJCertificate) => void;
  refreshKey?: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#f59e0b",
  submitted: "#3b82f6",
  approved: "#10b981",
  rejected: "#ef4444",
};

const TYPE_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e"];

export default function WithholdingDashboard({ onViewCert, refreshKey }: WithholdingDashboardProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TEJDashboardStats | null>(null);
  const [recent, setRecent] = useState<TEJCertificate[]>([]);

  useEffect(() => {
    setLoading(true);
    tejGetDashboard()
      .then((res) => {
        setStats(res.stats);
        setRecent(res.recent);
      })
      .catch(() => toast.error(t("tejLoadFailed")))
      .finally(() => setLoading(false));
  }, [t, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  const { totals, by_status, by_type, timeline } = stats;

  const pieData = Object.entries(by_status).map(([status, count]) => ({
    name: status, value: count, fill: STATUS_COLORS[status] || "#94a3b8",
  }));

  const barData = by_type.map((item, i) => ({
    name: item.type,
    count: item.count,
    amount: Math.round(item.amount),
    fill: TYPE_COLORS[i % TYPE_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("tejTotalCertificates")}</p>
                <p className="text-3xl font-bold">{totals.count}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Hash className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("tejTotalGross")}</p>
                <p className="text-2xl font-bold font-mono">{totals.total_gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-muted-foreground">TND</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("tejTotalWithholding")}</p>
                <p className="text-2xl font-bold font-mono text-amber-600">{totals.total_withholding.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-muted-foreground">TND</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("tejTotalNet")}</p>
                <p className="text-2xl font-bold font-mono text-emerald-600">{totals.total_net.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-muted-foreground">TND</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tejStatusBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {pieData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                      <span className="capitalize">{entry.name}</span>
                      <span className="font-bold">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">{t("noData")}</p>
            )}
          </CardContent>
        </Card>

        {/* Type Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tejByType")}</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">{t("noData")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tejTimeline")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Certificates */}
      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tejRecentCertificates")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2 font-medium">{t("tejReference")}</th>
                    <th className="text-left px-4 py-2 font-medium">{t("tejDeclarant")}</th>
                    <th className="text-right px-4 py-2 font-medium">{t("tejGrossAmount")}</th>
                    <th className="text-center px-4 py-2 font-medium">{t("status")}</th>
                    <th className="text-right px-4 py-2 font-medium">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((cert) => (
                    <tr key={cert.certificate_id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{cert.reference}</td>
                      <td className="px-4 py-2">{cert.declarant?.name}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {(cert.totals?.total_gross || 0).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Badge variant="outline" className="text-xs capitalize">{cert.status}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewCert(cert)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
