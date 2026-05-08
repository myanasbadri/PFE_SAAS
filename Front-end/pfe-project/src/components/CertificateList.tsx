"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Download, Trash2, Send, Eye, Loader2, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { useLanguage } from "../contexts/LanguageContext";
import {
  tejListCertificates, tejDeleteCertificate, tejSubmitCertificate, tejDownloadCertificatePDF,
  type TEJCertificate,
} from "@/lib/api";
import { toast } from "sonner";

interface CertificateListProps {
  onView: (cert: TEJCertificate) => void;
  refreshKey?: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function CertificateList({ onView, refreshKey }: CertificateListProps) {
  const { t } = useLanguage();
  const [certificates, setCertificates] = useState<TEJCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tejListCertificates({
        page,
        per_page: 20,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setCertificates(res.certificates);
      setTotalPages(res.total_pages);
      setTotal(res.total);
    } catch {
      toast.error(t("tejLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, t]);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates, refreshKey]);

  const handleDelete = async (certId: string) => {
    if (!confirm(t("tejDeleteConfirm"))) return;
    setActionLoading(certId);
    try {
      await tejDeleteCertificate(certId);
      toast.success(t("tejDeleteSuccess"));
      loadCertificates();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmit = async (certId: string) => {
    if (!confirm(t("tejSubmitConfirm"))) return;
    setActionLoading(certId);
    try {
      const res = await tejSubmitCertificate(certId);
      toast.success(`${t("tejSubmitSuccess")} — ${res.tej_reference}`);
      loadCertificates();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadPdf = async (cert: TEJCertificate) => {
    setActionLoading(cert.certificate_id);
    try {
      const blob = await tejDownloadCertificatePDF(cert.certificate_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificat_${cert.reference}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
            placeholder={t("tejSearchCertificates")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">{t("allStatuses")}</option>
          <option value="draft">{t("tejDraft")}</option>
          <option value="submitted">{t("submitted")}</option>
          <option value="approved">{t("tejApproved")}</option>
          <option value="rejected">{t("tejRejected")}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : certificates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t("tejNoCertificates")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">{t("tejReference")}</th>
                    <th className="text-left px-4 py-3 font-medium">{t("tejDeclarant")}</th>
                    <th className="text-left px-4 py-3 font-medium">{t("tejDeclarationType")}</th>
                    <th className="text-right px-4 py-3 font-medium">{t("tejGrossAmount")}</th>
                    <th className="text-right px-4 py-3 font-medium">{t("tejWithholding")}</th>
                    <th className="text-center px-4 py-3 font-medium">{t("status")}</th>
                    <th className="text-left px-4 py-3 font-medium">{t("date")}</th>
                    <th className="text-right px-4 py-3 font-medium">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((cert) => (
                    <tr key={cert.certificate_id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{cert.reference || cert.certificate_id}</td>
                      <td className="px-4 py-3">{cert.declarant?.name || "—"}</td>
                      <td className="px-4 py-3 text-xs">{cert.declaration_type}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {(cert.totals?.total_gross || 0).toLocaleString(undefined, { minimumFractionDigits: 3 })} TND
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {(cert.totals?.total_withholding || 0).toLocaleString(undefined, { minimumFractionDigits: 3 })} TND
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cert.status] || ""}`}>
                          {cert.status === "draft" ? t("tejDraft") : cert.status === "submitted" ? t("submitted") : cert.status === "approved" ? t("tejApproved") : t("tejRejected")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {cert.created_at ? new Date(cert.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onView(cert)} title={t("tejViewXml")}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => handleDownloadPdf(cert)}
                            disabled={actionLoading === cert.certificate_id}
                            title={t("tejExportPdf")}
                          >
                            {actionLoading === cert.certificate_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          </Button>
                          {cert.status === "draft" && (
                            <>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-blue-600"
                                onClick={() => handleSubmit(cert.certificate_id)}
                                disabled={actionLoading === cert.certificate_id}
                                title={t("tejSubmitToTEJ")}
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                onClick={() => handleDelete(cert.certificate_id)}
                                disabled={actionLoading === cert.certificate_id}
                                title={t("delete")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} {t("results")}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>{t("page")} {page} {t("of")} {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
