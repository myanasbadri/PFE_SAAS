"use client";

import { useState } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldQuestion, AlertTriangle,
  CheckCircle2, XCircle, Info, FileText, Send, Loader2, RefreshCw,
  QrCode, Download,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";
import { useLanguage } from "../contexts/LanguageContext";
import { QRCodeSVG } from "qrcode.react";
import {
  validateInvoiceCompliance,
  verifyInvoiceSignature,
  submitToTTN,
  getComplianceReport,
  getInvoiceShareInfo,
  type ComplianceReport,
  type ComplianceResult,
  type SignatureResult,
} from "@/lib/api";
import { toast } from "sonner";

interface CompliancePanelProps {
  invoiceId: string;
  sourceFormat?: string;
  onUpdate?: () => void;
}

export default function CompliancePanel({ invoiceId, sourceFormat, onUpdate }: CompliancePanelProps) {
  const { t } = useLanguage();
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qrShareCode, setQrShareCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await getComplianceReport(invoiceId);
      setReport(res.report);
    } catch {
      toast.error(t("complianceLoadFailed") || "Failed to load compliance report");
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await validateInvoiceCompliance(invoiceId);
      toast.success(
        res.validation.is_compliant
          ? (t("invoiceCompliant") || "Invoice is compliant")
          : (t("invoiceNonCompliant") || "Invoice has compliance issues")
      );
      await loadReport();
      onUpdate?.();
    } catch {
      toast.error(t("validationFailed") || "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  const handleVerifySignature = async () => {
    setVerifying(true);
    try {
      const res = await verifyInvoiceSignature(invoiceId);
      if (res.signature.has_signature) {
        toast.success(t("signatureVerified") || "Signature verified");
      } else {
        toast.warning(t("noSignatureFound") || "No digital signature found");
      }
      await loadReport();
    } catch (err: any) {
      toast.error(err?.message || "Signature verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleGenerateQR = async () => {
    setLoadingQr(true);
    try {
      const info = await getInvoiceShareInfo(invoiceId);
      setQrShareCode(info.share_code);
    } catch {
      toast.error(t("qrCodeFailed") || "Failed to generate QR code");
    } finally {
      setLoadingQr(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrShareCode) return;
    const svg = document.getElementById("compliance-qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new window.Image();
    img.onload = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 256, 256);
      ctx.drawImage(img, 0, 0, 256, 256);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `invoice_qr_${invoiceId}.png`;
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleSubmitTTN = async () => {
    setSubmitting(true);
    try {
      const res = await submitToTTN(invoiceId);
      if (res.success) {
        toast.success(`${t("ttnSubmitted") || "Submitted to TTN"}: ${res.ttn_unique_id}`);
        await loadReport();
        onUpdate?.();
      } else {
        toast.error(res.message || "TTN submission failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "TTN submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const compliance = report?.compliance;
  const signature = report?.signature;
  const ttn = report?.ttn;

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const progressColor = (score: number) => {
    if (score >= 80) return "[&>div]:bg-emerald-500";
    if (score >= 60) return "[&>div]:bg-yellow-500";
    return "[&>div]:bg-red-500";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            {t("tunisiaCompliance") || "Tunisia 2026 Compliance"}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={report ? loadReport : loadReport}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {report ? (t("refresh") || "Refresh") : (t("loadReport") || "Load Report")}
            </Button>
            <Button
              size="sm"
              onClick={handleValidate}
              disabled={validating}
              className="gap-1.5"
            >
              {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {t("runValidation") || "Validate"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!report && !loading && (
          <div className="text-center py-6 text-muted-foreground">
            <ShieldQuestion className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t("clickToLoadCompliance") || "Click 'Load Report' or 'Validate' to check compliance"}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {report && !loading && (
          <>
            {/* Compliance Score */}
            {compliance && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("complianceScore") || "Compliance Score"}</span>
                  <span className={`text-2xl font-bold ${scoreColor(compliance.compliance_score)}`}>
                    {compliance.compliance_score}%
                  </span>
                </div>
                <Progress value={compliance.compliance_score} className={`h-2 ${progressColor(compliance.compliance_score)}`} />
                <div className="flex items-center gap-2">
                  {compliance.is_compliant ? (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("compliant") || "Compliant"}
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 gap-1">
                      <XCircle className="h-3 w-3" />
                      {t("nonCompliant") || "Non-compliant"}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {compliance.checks_passed}/{compliance.checks_total} {t("checksPassed") || "checks passed"}
                  </span>
                </div>
              </div>
            )}

            {/* Errors */}
            {compliance && compliance.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-600 flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" />
                  {t("errors") || "Errors"} ({compliance.errors.length})
                </h4>
                <div className="space-y-1.5">
                  {compliance.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-red-50 dark:bg-red-900/10">
                      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">{err.field}:</span>{" "}
                        <span className="text-muted-foreground">{err.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {compliance && compliance.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-yellow-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  {t("warnings") || "Warnings"} ({compliance.warnings.length})
                </h4>
                <div className="space-y-1.5">
                  {compliance.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-yellow-50 dark:bg-yellow-900/10">
                      <Info className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">{w.field}:</span>{" "}
                        <span className="text-muted-foreground">{w.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {compliance && compliance.suggestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-blue-500" />
                  {t("suggestions") || "Suggestions"}
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {compliance.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 pl-1">
                      <span className="text-blue-400 mt-1.5">-</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* VAT IDs */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t("sellerVatId") || "Seller VAT ID"}</span>
                <p className="font-mono font-medium mt-0.5">{report.seller_vat_id || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("buyerVatId") || "Buyer VAT ID"}</span>
                <p className="font-mono font-medium mt-0.5">{report.buyer_vat_id || "-"}</p>
              </div>
            </div>

            {/* Invoice Info */}
            <div className="flex gap-3 text-xs">
              {report.source_format && (
                <Badge variant="secondary" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {report.source_format.toUpperCase()}
                </Badge>
              )}
              {report.invoice_category && (
                <Badge variant="secondary" className="capitalize">
                  {report.invoice_category}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Digital Signature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{t("digitalSignature") || "Digital Signature"}</h4>
                {sourceFormat === "xml" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleVerifySignature}
                    disabled={verifying}
                    className="gap-1.5 h-7 text-xs"
                  >
                    {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                    {t("verify") || "Verify"}
                  </Button>
                )}
              </div>
              {signature ? (
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    {signature.has_signature ? (
                      signature.signature_valid ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Valid
                        </Badge>
                      ) : signature.signature_valid === false ? (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 gap-1">
                          <XCircle className="h-3 w-3" />
                          Invalid
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <ShieldQuestion className="h-3 w-3" />
                          Structural Only
                        </Badge>
                      )
                    ) : (
                      <span className="text-muted-foreground">{t("noSignature") || "No signature"}</span>
                    )}
                  </div>
                  {signature.certificate && (
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <p>Signer: {signature.certificate.subject}</p>
                      <p>Expires: {signature.certificate.not_valid_after.slice(0, 10)}</p>
                      <p>Key: {signature.certificate.key_type} {signature.certificate.key_bits}-bit</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("notVerified") || "Not verified yet"}</p>
              )}
            </div>

            <Separator />

            {/* TTN Submission */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{t("ttnSubmission") || "TTN El Fatoora"}</h4>
                {!ttn?.submitted && (
                  <Button
                    size="sm"
                    onClick={handleSubmitTTN}
                    disabled={submitting || !compliance?.is_compliant}
                    className="gap-1.5 h-7 text-xs"
                    title={!compliance?.is_compliant ? (t("mustBeCompliant") || "Invoice must be compliant first") : ""}
                  >
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    {t("submitToTTN") || "Submit"}
                  </Button>
                )}
              </div>
              {ttn?.submitted ? (
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("submitted") || "Submitted"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    TTN ID: {ttn.unique_id}
                  </p>
                  {ttn.submission_date && (
                    <p className="text-xs text-muted-foreground">
                      {t("submittedOn") || "Submitted on"}: {ttn.submission_date.slice(0, 10)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("notSubmitted") || "Not submitted yet"}
                </p>
              )}
            </div>

            <Separator />

            {/* Invoice QR Code */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-blue-500" />
                  {t("invoiceQRCode") || "Tax QR Code"}
                </h4>
                <div className="flex gap-1.5">
                  {qrShareCode && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadQR}
                      className="gap-1.5 h-7 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      {t("download") || "Download"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={qrShareCode ? "outline" : "default"}
                    onClick={handleGenerateQR}
                    disabled={loadingQr}
                    className="gap-1.5 h-7 text-xs"
                  >
                    {loadingQr ? <Loader2 className="h-3 w-3 animate-spin" /> : <QrCode className="h-3 w-3" />}
                    {qrShareCode ? (t("regenerate") || "Regenerate") : (t("generate") || "Generate")}
                  </Button>
                </div>
              </div>
              {qrShareCode ? (
                <div className="flex flex-col items-center gap-2 p-3 bg-white rounded-lg border border-border">
                  <QRCodeSVG
                    id="compliance-qr-svg"
                    value={JSON.stringify({ share_code: qrShareCode })}
                    size={128}
                    level="M"
                    includeMargin={false}
                  />
                  <p className="text-[10px] text-muted-foreground text-center">
                    {qrShareCode}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("qrCodeNotGenerated") || "Generate a QR code with tax-relevant invoice data"}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
