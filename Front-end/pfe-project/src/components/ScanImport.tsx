"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  ScanLine,
  Camera,
  X,
  SwitchCamera,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Download,
  Building2,
  User,
  CalendarDays,
  Hash,
  Receipt,
  Package,
  CreditCard,
  StickyNote,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  lookupInvoiceByCode,
  importInvoiceByCode,
  ApiError,
  type Invoice,
} from "@/lib/api";
import { toast } from "sonner";

// ── QR Code decoder ────────────────────────────────────────────────────────

function tryParseShareCode(raw: string): string | null {
  // The QR payload is JSON with a "share_code" field
  try {
    const parsed = JSON.parse(raw);
    if (parsed.share_code) return parsed.share_code;
  } catch {
    // Not JSON — maybe it's a plain share code like INV-XXXXXXXX
  }
  // Check if it's a direct share code
  const match = raw.match(/INV-[A-Z0-9]{6,}/);
  if (match) return match[0];
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────

export const ScanImport = () => {
  const { t } = useLanguage();

  // State
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [manualCode, setManualCode] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const [importedId, setImportedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Camera ───────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      toast.error(t("cameraAccessDenied"));
      setCameraActive(false);
    }
  }, [facingMode, t]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // QR scanning loop using BarcodeDetector API (modern browsers)
  useEffect(() => {
    if (!cameraActive || !videoRef.current) return;

    const video = videoRef.current;

    // Use BarcodeDetector if available, otherwise fall back to manual frame reading
    const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

    if (hasBarcodeDetector) {
      // @ts-expect-error BarcodeDetector is not yet in all TS libs
      const detector = new BarcodeDetector({ formats: ["qr_code"] });

      scanIntervalRef.current = setInterval(async () => {
        if (video.readyState < 2) return;
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            const code = tryParseShareCode(raw);
            if (code) {
              stopCamera();
              setCameraActive(false);
              handleLookup(code);
            }
          }
        } catch {
          // detection failed, will retry
        }
      }, 300);
    } else {
      // Fallback: capture frames to canvas and try to parse any visible text
      // For production, you'd use a library like jsQR. Here we provide the
      // canvas for the user to manually capture.
      scanIntervalRef.current = setInterval(() => {
        if (video.readyState < 2 || !canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        // Without a dedicated QR library, we rely on BarcodeDetector or manual entry
      }, 500);
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [cameraActive, stopCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCamera = () => {
    setError("");
    setPreviewInvoice(null);
    setShareCode(null);
    setImported(false);
    setCameraActive(true);
    setTimeout(() => startCamera(), 100);
  };

  const closeCamera = () => {
    stopCamera();
    setCameraActive(false);
  };

  const toggleFacing = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    if (cameraActive) {
      stopCamera();
      setTimeout(() => startCamera(), 100);
    }
  };

  // ── Lookup ───────────────────────────────────────────────────────────

  const handleLookup = async (code?: string) => {
    const lookupCode = code || manualCode.trim();
    if (!lookupCode) return;

    setLookupLoading(true);
    setError("");
    setPreviewInvoice(null);
    setImported(false);
    setShareCode(lookupCode);

    try {
      const res = await lookupInvoiceByCode(lookupCode);
      setPreviewInvoice(res.invoice);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to look up invoice");
      }
    } finally {
      setLookupLoading(false);
    }
  };

  // ── Import ───────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!shareCode) return;
    setImportLoading(true);
    setError("");

    try {
      const res = await importInvoiceByCode(shareCode);
      setImported(true);
      setImportedId(res.invoice_id);
      toast.success(t("invoiceImported"));
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError(err.message);
        } else {
          setError(err.message);
        }
        toast.error(err.message);
      } else {
        setError("Failed to import invoice");
        toast.error("Failed to import invoice");
      }
    } finally {
      setImportLoading(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────

  const handleReset = () => {
    stopCamera();
    setCameraActive(false);
    setManualCode("");
    setPreviewInvoice(null);
    setShareCode(null);
    setImported(false);
    setImportedId(null);
    setError("");
    setLookupLoading(false);
    setImportLoading(false);
  };

  // ── Render ───────────────────────────────────────────────────────────

  const data = previewInvoice?.data;
  const totals = data?.totals;
  const billTo = data?.bill_to;
  const lineItems = data?.line_items || [];
  const currency = totals?.currency || "TND";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("scanImport")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("scanImportDesc")}
          </p>
        </div>
        {(previewInvoice || error) && (
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            {t("scanAnother")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ── LEFT: Scanner ──────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-6">
          {/* Camera / Scanner Card */}
          <Card className="bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground text-lg">
                  {t("scanQrCode")}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <ScanLine className="h-4 w-4 text-[#10B981]" />
                  <span className="text-xs font-medium text-[#10B981]">QR</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {cameraActive ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    {/* Scan overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-2 border-[#10B981] rounded-2xl opacity-60" />
                    </div>
                    <div className="absolute bottom-3 left-0 right-0 text-center">
                      <span className="text-xs text-white bg-black/50 px-3 py-1 rounded-full">
                        {t("scanningQr")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" size="icon" onClick={toggleFacing}>
                      <SwitchCamera className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={closeCamera} className="gap-2">
                      <X className="h-4 w-4" />
                      {t("close") || "Close"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    onClick={!lookupLoading && !previewInvoice ? openCamera : undefined}
                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center min-h-[200px] transition-all duration-200 ${
                      previewInvoice || lookupLoading
                        ? "border-border cursor-default opacity-50"
                        : "border-border hover:border-[#10B981]/50 hover:bg-[#10B981]/[0.02] cursor-pointer"
                    }`}
                  >
                    <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                      <Camera className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-sm">{t("scanQrCode")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("scanningQr")}
                    </p>
                  </div>

                  {/* Manual code entry */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 text-center">
                      {t("orEnterCode")}
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                        placeholder="INV-XXXXXXXX"
                        className="h-10 font-mono text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleLookup();
                        }}
                        disabled={lookupLoading}
                      />
                      <Button
                        onClick={() => handleLookup()}
                        disabled={!manualCode.trim() || lookupLoading}
                        className="bg-[#10B981] hover:bg-[#10B981]/90 text-white gap-2 shrink-0"
                      >
                        {lookupLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        {t("search")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import Status Card */}
          {previewInvoice && (
            <Card className="bg-card">
              <CardContent className="pt-5">
                {imported ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="h-14 w-14 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                      <CheckCircle2 className="h-7 w-7 text-[#10B981]" />
                    </div>
                    <p className="text-sm font-medium text-[#10B981]">
                      {t("invoiceImported")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Invoice added to your dashboard
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" onClick={handleReset} className="gap-2">
                        <ScanLine className="h-4 w-4" />
                        {t("scanAnother")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center shrink-0">
                        <Receipt className="h-5 w-5 text-[#10B981]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {data?.vendor_name || "Unknown Vendor"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {data?.invoice_no || "N/A"} &middot; {shareCode}
                        </p>
                      </div>
                      <Badge className="bg-[#10B981]/10 text-[#10B981] border-0 text-xs shrink-0">
                        {totals?.grand_total != null
                          ? `${Number(totals.grand_total).toFixed(2)} ${currency}`
                          : "N/A"}
                      </Badge>
                    </div>

                    <Button
                      onClick={handleImport}
                      disabled={importLoading}
                      className="w-full bg-[#10B981] hover:bg-[#10B981]/90 text-white gap-2"
                    >
                      {importLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {importLoading ? t("importingInvoice") : t("addToDashboard")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── RIGHT: Invoice Preview ─────────────────────────────────── */}
        <div className="xl:col-span-3">
          {!previewInvoice && !lookupLoading ? (
            <Card className="bg-card h-full">
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[500px] text-center">
                <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <ScanLine className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("invoicePreview")}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {t("scanImportDesc")}
                </p>
              </CardContent>
            </Card>
          ) : lookupLoading ? (
            <Card className="bg-card h-full">
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[500px]">
                <Loader2 className="h-12 w-12 text-[#10B981] animate-spin mb-4" />
                <p className="text-sm font-medium text-muted-foreground">
                  Looking up invoice...
                </p>
              </CardContent>
            </Card>
          ) : previewInvoice && data ? (
            <Card className="bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-foreground">
                      {t("invoicePreview")}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {shareCode}
                    </p>
                  </div>
                  {imported ? (
                    <Badge className="bg-[#10B981]/10 text-[#10B981] border-0 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Imported
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-500/10 text-blue-600 border-0 gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Preview
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-6">
                  {/* Invoice Header */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Hash className="h-4 w-4 text-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Invoice Details
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Invoice Number</p>
                        <p className="text-sm font-medium">{data.invoice_no || "N/A"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Currency</p>
                        <p className="text-sm font-medium">{currency}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> Invoice Date
                        </p>
                        <p className="text-sm font-medium">{data.date || "N/A"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Due Date</p>
                        <p className="text-sm font-medium">{data.due_date || "N/A"}</p>
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Vendor */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-4 w-4 text-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Vendor</h3>
                    </div>
                    <p className="text-sm">{data.vendor_name || "N/A"}</p>
                  </section>

                  <Separator />

                  {/* Bill To */}
                  {billTo && (billTo.name || billTo.address || billTo.email) && (
                    <>
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <User className="h-4 w-4 text-foreground" />
                          <h3 className="text-sm font-semibold text-foreground">Bill To</h3>
                        </div>
                        <div className="space-y-1 text-sm">
                          {billTo.name && <p className="font-medium">{billTo.name}</p>}
                          {billTo.address && <p className="text-muted-foreground">{billTo.address}</p>}
                          {billTo.email && <p className="text-muted-foreground">{billTo.email}</p>}
                        </div>
                      </section>
                      <Separator />
                    </>
                  )}

                  {/* Line Items */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="h-4 w-4 text-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Line Items
                      </h3>
                      {lineItems.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>

                    {lineItems.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-xs font-medium">Description</TableHead>
                              <TableHead className="text-xs font-medium w-[70px] text-right">Qty</TableHead>
                              <TableHead className="text-xs font-medium w-[90px] text-right">Price</TableHead>
                              <TableHead className="text-xs font-medium w-[90px] text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs py-2">
                                  {item.description || "-"}
                                </TableCell>
                                <TableCell className="text-xs py-2 text-right">
                                  {item.quantity ?? "-"}
                                </TableCell>
                                <TableCell className="text-xs py-2 text-right">
                                  {item.unit_price != null ? Number(item.unit_price).toFixed(2) : "-"}
                                </TableCell>
                                <TableCell className="text-xs py-2 text-right font-medium">
                                  {item.total != null ? Number(item.total).toFixed(2) : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No line items</p>
                    )}
                  </section>

                  <Separator />

                  {/* Totals */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Receipt className="h-4 w-4 text-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Totals</h3>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{totals?.subtotal != null ? `${Number(totals.subtotal).toFixed(2)} ${currency}` : "-"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span>{totals?.tax != null ? `${Number(totals.tax).toFixed(2)} ${currency}` : "-"}</span>
                      </div>
                      {totals?.discount != null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Discount</span>
                          <span>-{Number(totals.discount).toFixed(2)} {currency}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-sm font-bold">
                        <span>Grand Total</span>
                        <span className="text-[#10B981]">
                          {totals?.grand_total != null
                            ? `${Number(totals.grand_total).toFixed(2)} ${currency}`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* Payment & Notes */}
                  {(data.payment_method || data.notes) && (
                    <>
                      <Separator />
                      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {data.payment_method && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <CreditCard className="h-3 w-3" /> Payment Method
                            </p>
                            <p className="text-sm">{data.payment_method}</p>
                          </div>
                        )}
                        {data.notes && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <StickyNote className="h-3 w-3" /> Notes
                            </p>
                            <p className="text-sm">{data.notes}</p>
                          </div>
                        )}
                      </section>
                    </>
                  )}
                </div>

                {/* Import Action */}
                {!imported && (
                  <div className="pt-4 mt-6 border-t">
                    <Button
                      onClick={handleImport}
                      disabled={importLoading}
                      className="w-full bg-[#10B981] hover:bg-[#10B981]/90 text-white gap-2 h-11"
                    >
                      {importLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {importLoading ? t("importingInvoice") : t("addToDashboard")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
};
