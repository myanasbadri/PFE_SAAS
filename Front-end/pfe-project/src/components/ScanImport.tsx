"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import jsQR from "jsqr";
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
  X,
  ImageIcon,
  Zap,
  Focus,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  lookupInvoiceByCode,
  importInvoiceByCode,
  ApiError,
  type Invoice,
} from "@/lib/api";
import { toast } from "sonner";

// ── Helpers ────────────────────────────────────────────────────────────────

function tryParseShareCode(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.share_code) return parsed.share_code;
  } catch {
    /* not JSON */
  }
  const match = raw.match(/INV-[A-Z0-9]{6,}/);
  if (match) return match[0];
  return null;
}

/**
 * Try to decode a QR from the given image element at a specific max size.
 * Applies grayscale + contrast boost for better detection on photos.
 */
function tryDecodeAtSize(
  img: HTMLImageElement,
  maxSize: number
): string | null {
  let { width, height } = img;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  // Draw & extract
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  // Convert to grayscale + boost contrast for better QR detection on photos
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    // Grayscale using luminance weights
    let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Boost contrast: push values toward 0 or 255
    gray = gray < 128 ? gray * 0.7 : 255 - (255 - gray) * 0.7;
    d[i] = d[i + 1] = d[i + 2] = gray;
  }

  const code = jsQR(imageData.data, width, height, {
    inversionAttempts: "attemptBoth",
  });
  return code ? code.data : null;
}

/**
 * Decode a QR code from an image file using jsQR.
 * Tries multiple resolutions for reliability: 1024 → 1600 → original (max 2400).
 * Applies grayscale + contrast preprocessing on each pass.
 */
function decodeQRFromFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        // Multi-pass: try increasing resolutions
        const sizes = [1024, 1600, 2400];
        for (const size of sizes) {
          // Skip sizes bigger than the actual image
          if (size > Math.max(img.width, img.height) * 1.1 && size !== sizes[0]) continue;
          const result = tryDecodeAtSize(img, size);
          if (result) { resolve(result); return; }
        }
        // Also try raw (no grayscale) at 1024 in case preprocessing hurts
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        const s = Math.min(1, 1024 / Math.max(w, h));
        w = Math.round(w * s);
        h = Math.round(h * s);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const raw = ctx.getImageData(0, 0, w, h);
          const code = jsQR(raw.data, w, h, { inversionAttempts: "attemptBoth" });
          if (code) { resolve(code.data); return; }
        }
        resolve(null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/** Check if getUserMedia is available (secure context) */
function canUseLiveCamera(): boolean {
  if (typeof window === "undefined") return false;
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// ── Component ──────────────────────────────────────────────────────────────

export const ScanImport = () => {
  const { t } = useLanguage();

  // Scanner state
  const [scannerMode, setScannerMode] = useState<
    "idle" | "live" | "processing" | "detected"
  >("idle");
  const [supportsLive, setSupportsLive] = useState(false);

  // Data state
  const [manualCode, setManualCode] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const [importedId, setImportedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [detectedCode, setDetectedCode] = useState("");

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const foundRef = useRef(false); // prevents double-fire

  // ── Check if live camera is available on mount ───────────────────────
  useEffect(() => {
    setSupportsLive(canUseLiveCamera());
  }, []);

  // ── Stop camera helper ───────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Live camera scan loop ────────────────────────────────────────────
  const scanFrame = useCallback(() => {
    if (foundRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(scanFrame); return; }

    ctx.drawImage(video, 0, 0, w, h);

    try {
      const imageData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
      if (code) {
        const parsed = tryParseShareCode(code.data);
        if (parsed) {
          foundRef.current = true;
          // Haptic feedback
          if (navigator.vibrate) navigator.vibrate(100);
          setDetectedCode(parsed);
          setScannerMode("detected");
          // Brief pause to show green overlay, then lookup
          setTimeout(() => {
            stopCamera();
            handleLookup(parsed);
          }, 600);
          return;
        }
      }
    } catch {
      /* decode error, keep scanning */
    }

    rafRef.current = requestAnimationFrame(scanFrame);
  }, [stopCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start live camera ────────────────────────────────────────────────
  const startLiveCamera = useCallback(async () => {
    setError("");
    setPreviewInvoice(null);
    setShareCode(null);
    setImported(false);
    setDetectedCode("");
    foundRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setScannerMode("live");
          rafRef.current = requestAnimationFrame(scanFrame);
        };
      }
    } catch {
      // getUserMedia failed (HTTP on mobile, permission denied, etc.)
      // Fall back to file capture
      setSupportsLive(false);
      fileInputRef.current?.click();
    }
  }, [scanFrame]);

  // ── File capture fallback ────────────────────────────────────────────
  const openFileCapture = () => {
    setError("");
    setPreviewInvoice(null);
    setShareCode(null);
    setImported(false);
    fileInputRef.current?.click();
  };

  const handleFileCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (!file) return;

      setScannerMode("processing");
      setError("");

      try {
        const rawData = await decodeQRFromFile(file);
        if (!rawData) {
          setError(t("noQrFound"));
          setScannerMode("idle");
          return;
        }
        const code = tryParseShareCode(rawData);
        if (!code) {
          setError(t("invalidQrCode"));
          setScannerMode("idle");
          return;
        }
        setScannerMode("idle");
        handleLookup(code);
      } catch {
        setError(t("imageProcessFailed"));
        setScannerMode("idle");
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const closeCamera = () => {
    stopCamera();
    foundRef.current = false;
    setScannerMode("idle");
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
    setScannerMode("idle");

    try {
      const res = await lookupInvoiceByCode(lookupCode);
      setPreviewInvoice(res.invoice);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(t("lookupFailed"));
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
        setError(err.message);
        toast.error(err.message);
      } else {
        setError(t("importFailed"));
        toast.error(t("importFailed"));
      }
    } finally {
      setImportLoading(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────
  const handleReset = () => {
    stopCamera();
    foundRef.current = false;
    setManualCode("");
    setPreviewInvoice(null);
    setShareCode(null);
    setImported(false);
    setImportedId(null);
    setError("");
    setDetectedCode("");
    setLookupLoading(false);
    setImportLoading(false);
    setScannerMode("idle");
  };

  // ── Render helpers ───────────────────────────────────────────────────
  const data = previewInvoice?.data;
  const totals = data?.totals;
  const billTo = data?.bill_to;
  const lineItems = data?.line_items || [];
  const currency = totals?.currency || "TND";
  const isLive = scannerMode === "live" || scannerMode === "detected";

  return (
    <div className="space-y-6">
      {/* Hidden file input fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileCapture}
      />

      {/* ── Inline CSS for scanner animations ──────────────────────── */}
      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 10%; }
          50% { top: 85%; }
        }
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes fadeInScale {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .scan-line {
          animation: scanLine 2.5s ease-in-out infinite;
        }
        .pulse-ring {
          animation: pulseRing 1s ease-out infinite;
        }
        .fade-in-scale {
          animation: fadeInScale 0.3s ease-out forwards;
        }
      `}</style>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("scanImport")}
          </h1>
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
          <Card className="bg-card overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground text-lg">
                  {t("scanQrCode")}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  {isLive && (
                    <span className="relative flex h-2.5 w-2.5 mr-1">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75 pulse-ring" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                    </span>
                  )}
                  <ScanLine className="h-4 w-4 text-[#10B981]" />
                  <span className="text-xs font-medium text-[#10B981]">
                    {isLive ? "LIVE" : "QR"}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {/* ── Live Camera View ──────────────────────────────── */}
              {isLive ? (
                <div className="space-y-3 fade-in-scale">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] shadow-lg">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Darkened overlay with transparent center */}
                    <div className="absolute inset-0">
                      {/* Top */}
                      <div className="absolute top-0 left-0 right-0 h-[20%] bg-black/40" />
                      {/* Bottom */}
                      <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-black/40" />
                      {/* Left */}
                      <div className="absolute top-[20%] left-0 w-[15%] h-[60%] bg-black/40" />
                      {/* Right */}
                      <div className="absolute top-[20%] right-0 w-[15%] h-[60%] bg-black/40" />
                    </div>

                    {/* Viewfinder frame */}
                    <div className="absolute top-[20%] left-[15%] right-[15%] bottom-[20%]">
                      {/* Corner markers */}
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-[#10B981] rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-[#10B981] rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-[#10B981] rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-[#10B981] rounded-br-lg" />

                      {/* Animated scan line */}
                      {scannerMode === "live" && (
                        <div
                          className="scan-line absolute left-2 right-2 h-[2px] shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                          style={{
                            background:
                              "linear-gradient(90deg, transparent 0%, #10B981 20%, #10B981 80%, transparent 100%)",
                          }}
                        />
                      )}

                      {/* Detected overlay */}
                      {scannerMode === "detected" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#10B981]/20 rounded-lg fade-in-scale">
                          <div className="bg-[#10B981] rounded-full p-3 shadow-lg shadow-[#10B981]/30">
                            <CheckCircle2 className="h-8 w-8 text-white" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status bar bottom */}
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                      <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full">
                        {scannerMode === "detected" ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                            <span className="text-xs text-[#10B981] font-medium">
                              {t("qrDetected")}
                            </span>
                          </>
                        ) : (
                          <>
                            <Focus className="h-3.5 w-3.5 text-white/80" />
                            <span className="text-xs text-white/80">
                              {t("pointCameraAtQr")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Camera controls */}
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      onClick={closeCamera}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      {t("close")}
                    </Button>
                  </div>
                </div>
              ) : (
                /* ── Idle / Processing State ─────────────────────── */
                <div className="space-y-4">
                  {/* Main scan action */}
                  <div
                    onClick={
                      !lookupLoading && !previewInvoice && scannerMode === "idle"
                        ? supportsLive
                          ? startLiveCamera
                          : openFileCapture
                        : undefined
                    }
                    className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center min-h-[220px] transition-all duration-300 ${
                      previewInvoice || lookupLoading || scannerMode === "processing"
                        ? "border-border cursor-default opacity-50"
                        : "border-border hover:border-[#10B981]/50 hover:bg-[#10B981]/[0.03] cursor-pointer group"
                    }`}
                  >
                    {scannerMode === "processing" ? (
                      <div className="flex flex-col items-center fade-in-scale">
                        <div className="relative">
                          <div className="h-16 w-16 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mb-3">
                            <Loader2 className="h-8 w-8 text-[#10B981] animate-spin" />
                          </div>
                        </div>
                        <p className="font-medium text-sm text-foreground">
                          {t("analyzingImage")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("detectingQr")}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="relative mb-4">
                          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center transition-all duration-300 group-hover:bg-[#10B981]/10 group-hover:scale-110">
                            <Camera className="h-8 w-8 text-muted-foreground transition-colors group-hover:text-[#10B981]" />
                          </div>
                          {supportsLive && (
                            <div className="absolute -top-1 -right-1 bg-[#10B981] rounded-full p-0.5">
                              <Zap className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        <p className="font-semibold text-sm text-foreground">
                          {supportsLive
                            ? t("tapToOpenScanner")
                            : t("tapToTakePhoto")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 text-center max-w-[200px]">
                          {supportsLive
                            ? t("realtimeQrDesc")
                            : t("takePhotoQrDesc")}
                        </p>
                        {supportsLive && (
                          <Badge
                            variant="secondary"
                            className="mt-3 text-[10px] gap-1 bg-[#10B981]/10 text-[#10B981] border-0"
                          >
                            <Zap className="h-3 w-3" />
                            {t("autoDetect")}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>

                  {/* Upload from gallery (only when camera is not live) */}
                  {!previewInvoice && scannerMode === "idle" && (
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          // Open file picker without capture (gallery)
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*";
                          input.onchange = (ev) => {
                            const f = (ev.target as HTMLInputElement).files?.[0];
                            if (!f) return;
                            setScannerMode("processing");
                            setError("");
                            decodeQRFromFile(f).then((raw) => {
                              if (!raw) {
                                setError(t("noQrFound"));
                                setScannerMode("idle");
                                return;
                              }
                              const code = tryParseShareCode(raw);
                              if (!code) {
                                setError(t("invalidQrCode"));
                                setScannerMode("idle");
                                return;
                              }
                              setScannerMode("idle");
                              handleLookup(code);
                            });
                          };
                          input.click();
                        }}
                        className="text-xs text-muted-foreground hover:text-[#10B981] transition-colors flex items-center gap-1.5"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        {t("uploadFromGallery")}
                      </button>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="relative">
                    <Separator />
                    <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                      {t("orEnterCode")}
                    </span>
                  </div>

                  {/* Manual code entry */}
                  <div className="flex gap-2">
                    <Input
                      value={manualCode}
                      onChange={(e) =>
                        setManualCode(e.target.value.toUpperCase())
                      }
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
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg fade-in-scale">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import Status Card */}
          {previewInvoice && (
            <Card className="bg-card fade-in-scale">
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
                      {t("invoiceAddedToDashboard")}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        onClick={handleReset}
                        className="gap-2"
                      >
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
                          {data?.vendor_name || t("unknownVendor")}
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
                      {importLoading
                        ? t("importingInvoice")
                        : t("addToDashboard")}
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
                  {t("lookingUpInvoice")}
                </p>
              </CardContent>
            </Card>
          ) : previewInvoice && data ? (
            <Card className="bg-card fade-in-scale">
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
                      {t("imported")}
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-500/10 text-blue-600 border-0 gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {t("preview")}
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
                        {t("invoiceDetails")}
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {t("invoiceNumber")}
                        </p>
                        <p className="text-sm font-medium">
                          {data.invoice_no || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {t("currency")}
                        </p>
                        <p className="text-sm font-medium">{currency}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> {t("invoiceDateLabel")}
                        </p>
                        <p className="text-sm font-medium">
                          {data.date || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {t("dueDate")}
                        </p>
                        <p className="text-sm font-medium">
                          {data.due_date || "N/A"}
                        </p>
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Vendor */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-4 w-4 text-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">
                        {t("vendor")}
                      </h3>
                    </div>
                    <p className="text-sm">{data.vendor_name || "N/A"}</p>
                  </section>

                  <Separator />

                  {/* Bill To */}
                  {billTo &&
                    (billTo.name || billTo.address || billTo.email) && (
                      <>
                        <section>
                          <div className="flex items-center gap-2 mb-3">
                            <User className="h-4 w-4 text-foreground" />
                            <h3 className="text-sm font-semibold text-foreground">
                              {t("billTo")}
                            </h3>
                          </div>
                          <div className="space-y-1 text-sm">
                            {billTo.name && (
                              <p className="font-medium">{billTo.name}</p>
                            )}
                            {billTo.address && (
                              <p className="text-muted-foreground">
                                {billTo.address}
                              </p>
                            )}
                            {billTo.email && (
                              <p className="text-muted-foreground">
                                {billTo.email}
                              </p>
                            )}
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
                        {t("lineItems")}
                      </h3>
                      {lineItems.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {lineItems.length} {t("lineItems")}
                        </Badge>
                      )}
                    </div>

                    {lineItems.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-xs font-medium">
                                {t("description")}
                              </TableHead>
                              <TableHead className="text-xs font-medium w-[70px] text-right">
                                {t("qty")}
                              </TableHead>
                              <TableHead className="text-xs font-medium w-[90px] text-right">
                                {t("unitPrice")}
                              </TableHead>
                              <TableHead className="text-xs font-medium w-[90px] text-right">
                                {t("total")}
                              </TableHead>
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
                                  {item.unit_price != null
                                    ? Number(item.unit_price).toFixed(2)
                                    : "-"}
                                </TableCell>
                                <TableCell className="text-xs py-2 text-right font-medium">
                                  {item.total != null
                                    ? Number(item.total).toFixed(2)
                                    : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("noLineItems")}
                      </p>
                    )}
                  </section>

                  <Separator />

                  {/* Totals */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Receipt className="h-4 w-4 text-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">
                        {t("totals")}
                      </h3>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("subtotal")}</span>
                        <span>
                          {totals?.subtotal != null
                            ? `${Number(totals.subtotal).toFixed(2)} ${currency}`
                            : "-"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("tax")}</span>
                        <span>
                          {totals?.tax != null
                            ? `${Number(totals.tax).toFixed(2)} ${currency}`
                            : "-"}
                        </span>
                      </div>
                      {totals?.discount != null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t("discount")}
                          </span>
                          <span>
                            -{Number(totals.discount).toFixed(2)} {currency}
                          </span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-sm font-bold">
                        <span>{t("grandTotal")}</span>
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
                              <CreditCard className="h-3 w-3" /> {t("paymentMethod")}
                            </p>
                            <p className="text-sm">{data.payment_method}</p>
                          </div>
                        )}
                        {data.notes && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <StickyNote className="h-3 w-3" /> {t("notes")}
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
                      {importLoading
                        ? t("importingInvoice")
                        : t("addToDashboard")}
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
