"use client";

import { useState } from "react";
import {
  Download, Copy, Eye, EyeOff, Send, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Info,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "./ui/dialog";
import { useLanguage } from "../contexts/LanguageContext";
import {
  tejSubmitCertificate, tejDownloadCertificatePDF,
  type TEJCertificate,
} from "@/lib/api";
import { toast } from "sonner";

interface CertificateViewerProps {
  certificate: TEJCertificate | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const STATUS_LABELS: Record<string, { en: string; fr: string; ar: string }> = {
  draft: { en: "Draft", fr: "Brouillon", ar: "مسودة" },
  submitted: { en: "Submitted", fr: "Soumis", ar: "تم الإرسال" },
  approved: { en: "Approved", fr: "Approuvé", ar: "معتمد" },
  rejected: { en: "Rejected", fr: "Rejeté", ar: "مرفوض" },
};

export default function CertificateViewer({ certificate, open, onClose, onRefresh }: CertificateViewerProps) {
  const { t, language } = useLanguage();
  const [showXml, setShowXml] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!certificate) return null;

  const cert = certificate;
  const statusLabel = STATUS_LABELS[cert.status]?.[language] || cert.status;

  const handleSubmit = async () => {
    if (!confirm(t("tejSubmitConfirm"))) return;
    setSubmitting(true);
    try {
      const res = await tejSubmitCertificate(cert.certificate_id);
      toast.success(`${t("tejSubmitSuccess")} — ${res.tej_reference}`);
      onRefresh();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
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
      setDownloading(false);
    }
  };

  const handleCopyXml = () => {
    if (cert.xml_content) {
      navigator.clipboard.writeText(cert.xml_content);
      toast.success(t("tejXmlCopied"));
    }
  };

  const formatAddr = (addr?: { street?: string; city?: string; postal_code?: string; governorate?: string }) => {
    if (!addr) return "—";
    return [addr.street, addr.postal_code, addr.city, addr.governorate].filter(Boolean).join(", ");
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {cert.reference || cert.certificate_id}
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              cert.status === "draft" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
              cert.status === "submitted" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
              cert.status === "approved" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
              "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            }`}>
              {statusLabel}
            </span>
          </DialogTitle>
          <DialogDescription>
            {cert.declaration_type} — {cert.period?.year}
            {cert.period?.month ? ` / ${t("tejMonth")} ${cert.period.month}` : ""}
            {cert.period?.quarter ? ` / Q${cert.period.quarter}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Declarant */}
          <div>
            <h4 className="text-sm font-semibold mb-2">{t("tejDeclarant")}</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">{t("tejTaxId")}:</span>{" "}
                <span className="font-mono">{cert.declarant?.tax_id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("name")}:</span>{" "}
                <span>{cert.declarant?.name}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">{t("address")}:</span>{" "}
                <span>{formatAddr(cert.declarant?.address)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Beneficiaries */}
          <div>
            <h4 className="text-sm font-semibold mb-2">
              {t("tejBeneficiaries")} ({cert.beneficiaries?.length || 0})
            </h4>
            <div className="space-y-3">
              {cert.beneficiaries?.map((ben, i) => (
                <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{ben.name}</span>
                    <Badge variant="outline" className="text-xs">{ben.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{ben.id}</p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1 pr-2">{t("date")}</th>
                          <th className="text-left py-1 pr-2">{t("tejWithholdingType")}</th>
                          <th className="text-right py-1 pr-2">{t("tejGrossAmount")}</th>
                          <th className="text-right py-1 pr-2">{t("tejRate")}</th>
                          <th className="text-right py-1">{t("tejWithholding")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ben.operations?.map((op, j) => {
                          const rate = op.rate ?? 0;
                          const wh = op.gross_amount * rate;
                          return (
                            <tr key={j} className="border-b border-border/50">
                              <td className="py-1 pr-2">{op.date}</td>
                              <td className="py-1 pr-2">{op.withholding_type}</td>
                              <td className="py-1 pr-2 text-right font-mono">{op.gross_amount.toLocaleString(undefined, { minimumFractionDigits: 3 })} {op.currency}</td>
                              <td className="py-1 pr-2 text-right">{(rate * 100).toFixed(1)}%</td>
                              <td className="py-1 text-right font-mono">{wh.toLocaleString(undefined, { minimumFractionDigits: 3 })} {op.currency}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Totals */}
          <div>
            <h4 className="text-sm font-semibold mb-2">{t("totals")}</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-muted-foreground text-xs">{t("tejTotalGross")}</p>
                <p className="font-bold font-mono">{(cert.totals?.total_gross || 0).toLocaleString(undefined, { minimumFractionDigits: 3 })}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-muted-foreground text-xs">{t("tejTotalWithholding")}</p>
                <p className="font-bold font-mono text-amber-600">{(cert.totals?.total_withholding || 0).toLocaleString(undefined, { minimumFractionDigits: 3 })}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-muted-foreground text-xs">{t("tejTotalNet")}</p>
                <p className="font-bold font-mono text-emerald-600">{(cert.totals?.total_net || 0).toLocaleString(undefined, { minimumFractionDigits: 3 })}</p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          {cert.metadata && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("tejMetadata")}
                </h4>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <div><span className="text-muted-foreground">{t("tejSchemaVersion")}:</span> {cert.metadata.schema_version}</div>
                  <div><span className="text-muted-foreground">{t("tejGeneratedAt")}:</span> {new Date(cert.metadata.generated_at).toLocaleString()}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">{t("tejChecksum")}:</span> <span className="font-mono">{cert.metadata.checksum}</span></div>
                </dl>
              </div>
            </>
          )}

          {/* TEJ Reference */}
          {cert.tej_reference && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm">
                <span className="font-medium">{t("tejTEJReference")}:</span>{" "}
                <span className="font-mono">{cert.tej_reference}</span>
              </p>
              {cert.submitted_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("submittedOn")} {new Date(cert.submitted_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Validation */}
          {cert.validation && (
            <div className="flex items-center gap-2 text-sm">
              {cert.validation.valid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span>{cert.validation.valid ? t("tejValid") : t("tejInvalid")}</span>
              {cert.validation.warnings?.length > 0 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <AlertTriangle className="h-3 w-3" /> {cert.validation.warnings.length} {t("warnings")}
                </Badge>
              )}
            </div>
          )}

          {/* XML Preview Toggle */}
          {cert.xml_content && (
            <div>
              <Button variant="outline" size="sm" onClick={() => setShowXml(!showXml)} className="gap-2">
                {showXml ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showXml ? t("tejHideXml") : t("tejViewXml")}
              </Button>
              {showXml && (
                <pre className="mt-2 bg-muted rounded-lg p-3 overflow-x-auto text-xs font-mono max-h-[300px] overflow-y-auto whitespace-pre">
                  {cert.xml_content}
                </pre>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {cert.xml_content && (
            <Button variant="outline" size="sm" onClick={handleCopyXml}>
              <Copy className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("tejCopyXml")}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
            {t("tejExportPdf")}
          </Button>
          {cert.status === "draft" && (
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Send className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
              {t("tejSubmitToTEJ")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
