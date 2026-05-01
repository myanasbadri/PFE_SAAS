"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Upload,
  FileText,
  Check,
  AlertCircle,
  Loader2,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Image,
  File,
  Sparkles,
  ScanSearch,
  BrainCircuit,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  User,
  CreditCard,
  StickyNote,
  Package,
  CalendarDays,
  Hash,
  Receipt,
  AlertTriangle,
  Trash2,
  FileArchive,
  Files,
  Camera,
  X,
  SwitchCamera,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useLanguage } from "../contexts/LanguageContext";
import {
  extractFile,
  extractBatchFiles,
  getTaskStatus,
  updateInvoice,
  ApiError,
  type Invoice,
  type BatchFileResult,
} from "@/lib/api";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────────────────────

type ExtractionData = Invoice["data"];

interface LineItem {
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  total?: number | null;
}

type ProcessingStep =
  | "idle"
  | "uploading"
  | "ocr"
  | "ai"
  | "validating"
  | "done"
  | "error";

const STEPS: { key: ProcessingStep; label: string; icon: React.ElementType }[] =
  [
    { key: "uploading", label: "Uploading File", icon: Upload },
    { key: "ocr", label: "OCR Processing", icon: ScanSearch },
    { key: "ai", label: "AI Extraction", icon: BrainCircuit },
    { key: "validating", label: "Validation", icon: ShieldCheck },
  ];

// Batch queue item
interface BatchItem {
  id: string;
  file: { name: string; size: number };
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  invoiceId?: string;
  extractedData?: ExtractionData;
  error?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  if (name.endsWith(".pdf")) return File;
  if (name.endsWith(".zip")) return FileArchive;
  if (/\.(png|jpg|jpeg|webp)$/i.test(name)) return Image;
  return FileText;
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 80) return "text-[#10B981]";
  if (confidence >= 50) return "text-yellow-500";
  return "text-red-500";
}

function getConfidenceBg(confidence: number) {
  if (confidence >= 80) return "bg-[#10B981]";
  if (confidence >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function getConfidenceLabel(confidence: number) {
  if (confidence >= 90) return "Excellent";
  if (confidence >= 80) return "High";
  if (confidence >= 60) return "Medium";
  if (confidence >= 40) return "Low";
  return "Very Low";
}

function FieldConfidenceBadge({ score }: { score: number | undefined }) {
  if (score === undefined || score === null) return null;
  if (score === 0) return null;
  const color =
    score >= 80
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : score >= 50
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0 text-[10px] font-semibold rounded-full ${color}`}
    >
      {score}%
    </span>
  );
}

let batchIdCounter = 0;

// ── Component ───────────────────────────────────────────────────────────────

export const AIExtraction = () => {
  const { t } = useLanguage();

  // Mode: "single" or "batch"
  const [mode, setMode] = useState<"single" | "batch">("single");

  // ── Single-file state ──────────────────────────────────────────────────
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState<ProcessingStep>("idle");
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState("");
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [data, setData] = useState<ExtractionData | null>(null);
  const [editableData, setEditableData] = useState<ExtractionData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Batch state ────────────────────────────────────────────────────────
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [selectedBatchItem, setSelectedBatchItem] = useState<string | null>(
    null,
  );

  // ── Camera state ────────────────────────────────────────────────────
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      toast.error(t("cameraAccessDenied") || "Camera access denied. Please allow camera permissions.");
      setCameraOpen(false);
    }
  }, [facingMode, t]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ── Simulate step progress (single mode) ──────────────────────────────

  const animateSteps = useCallback(async () => {
    const delays: [ProcessingStep, number, number][] = [
      ["uploading", 15, 400],
      ["ocr", 45, 600],
      ["ai", 75, 800],
      ["validating", 90, 400],
    ];
    for (const [step, pct, delay] of delays) {
      setCurrentStep(step);
      setProgressPercent(pct);
      await new Promise((r) => setTimeout(r, delay));
    }
  }, []);

  // ── Handle file drop ──────────────────────────────────────────────────

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      // Determine mode based on file count or ZIP presence
      const hasZip = acceptedFiles.some((f) =>
        f.name.toLowerCase().endsWith(".zip"),
      );
      const isMultiple = acceptedFiles.length > 1 || hasZip;

      if (isMultiple) {
        // ── BATCH MODE ──
        setMode("batch");
        setSelectedBatchItem(null);

        // Reset single-file state
        setUploadedFile(null);
        setCurrentStep("idle");
        setData(null);
        setEditableData(null);
        setError("");

        // Build queue
        const items: BatchItem[] = acceptedFiles.map((f) => ({
          id: `batch-${++batchIdCounter}`,
          file: f,
          status: "queued" as const,
          progress: 0,
        }));
        setBatchQueue(items);
        setBatchProcessing(true);

        // Mark all as processing
        setBatchQueue((prev) =>
          prev.map((it) => ({ ...it, status: "processing", progress: 20 })),
        );

        try {
          const res = await extractBatchFiles(acceptedFiles);

          // Map results back to queue items
          setBatchQueue((prev) => {
            const updated = [...prev];
            // For ZIP files, the backend expands them so results may not match 1:1
            // Map results by index for regular files, or fill in order
            const resultsCopy = [...res.results];

            // If we sent a ZIP, results are the expanded files
            if (hasZip && prev.length === 1) {
              // Replace the single ZIP item with expanded results
              return resultsCopy.map((r) => ({
                id: `batch-${++batchIdCounter}`,
                file: { name: r.filename, size: 0 },
                status: r.status === "completed" ? "completed" : "failed",
                progress: 100,
                invoiceId: r.invoice_id,
                extractedData: r.extracted_data,
                error: r.error,
              }));
            }

            for (let i = 0; i < updated.length; i++) {
              const r = resultsCopy[i];
              if (r) {
                updated[i] = {
                  ...updated[i],
                  status: r.status === "completed" ? "completed" : "failed",
                  progress: 100,
                  invoiceId: r.invoice_id,
                  extractedData: r.extracted_data,
                  error: r.error,
                };
              } else {
                updated[i] = { ...updated[i], status: "failed", progress: 100, error: "No result from server" };
              }
            }
            return updated;
          });

          const successCount = res.results.filter(
            (r) => r.status === "completed",
          ).length;
          toast.success(
            `Batch complete: ${successCount}/${res.total} files processed`,
          );
        } catch (err) {
          setBatchQueue((prev) =>
            prev.map((it) => ({
              ...it,
              status: "failed",
              progress: 100,
              error:
                err instanceof ApiError
                  ? err.message
                  : "Batch processing failed",
            })),
          );
          toast.error("Batch processing failed");
        } finally {
          setBatchProcessing(false);
        }
      } else {
        // ── SINGLE MODE ──
        setMode("single");
        setBatchQueue([]);
        setSelectedBatchItem(null);

        const file = acceptedFiles[0];
        setUploadedFile(file);
        setData(null);
        setEditableData(null);
        setError("");
        setCurrentStep("uploading");
        setProgressPercent(5);

        const stepsPromise = animateSteps();

        try {
          const res = await extractFile(file);
          await stepsPromise;

          let extractedData: ExtractionData | undefined;
          let resultInvoiceId: string | undefined;

          if (res.mode === "sync") {
            extractedData = res.extracted_data;
            resultInvoiceId = res.invoice_id;
          } else {
            setCurrentStep("ai");
            setProgressPercent(60);

            const maxAttempts = 60;
            for (let i = 0; i < maxAttempts; i++) {
              await new Promise((r) => setTimeout(r, 2000));
              const taskRes = await getTaskStatus(res.task_id);

              if (taskRes.state === "SUCCESS" && taskRes.result) {
                extractedData = taskRes.result.extracted_data;
                resultInvoiceId = taskRes.result.invoice_id;
                break;
              }
              if (taskRes.state === "FAILURE") {
                throw new Error(
                  taskRes.status || "Processing failed on server",
                );
              }
              setProgressPercent(Math.min(60 + i * 0.5, 88));
            }

            if (!extractedData) {
              throw new Error("Processing timed out. Please try again.");
            }
          }

          setCurrentStep("done");
          setProgressPercent(100);
          setInvoiceId(resultInvoiceId || null);
          setData(extractedData || {});
          setEditableData(structuredClone(extractedData || {}));
          toast.success("Invoice data extracted successfully!");
        } catch (err) {
          setCurrentStep("error");
          setProgressPercent(0);
          if (err instanceof ApiError) {
            setError(err.message);
          } else if (err instanceof Error) {
            setError(err.message);
          } else {
            setError(
              "Failed to process file. Make sure the backend is running.",
            );
          }
          toast.error("Extraction failed");
        }
      }
    },
    [animateSteps],
  );

  // ── Camera handlers (depend on onDrop) ─────────────────────────────

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob: Blob | null) => {
        if (!blob) return;
        const captured = new globalThis.File([blob], `invoice-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        stopCamera();
        setCameraOpen(false);
        onDrop([captured]);
      },
      "image/jpeg",
      0.92,
    );
  }, [stopCamera, onDrop]);

  const handleMobileCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onDrop([files[0]]);
      }
      e.target.value = "";
    },
    [onDrop],
  );

  const toggleFacingMode = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    if (cameraOpen) {
      stopCamera();
      setTimeout(() => startCamera(), 100);
    }
  }, [cameraOpen, stopCamera, startCamera]);

  const handleCameraClick = () => {
    if (isMobile) {
      mobileInputRef.current?.click();
    } else {
      setCameraOpen(true);
      setTimeout(() => startCamera(), 100);
    }
  };

  const handleCameraDialogClose = (open: boolean) => {
    if (!open) {
      stopCamera();
      setCameraOpen(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────

  const handleReset = () => {
    setUploadedFile(null);
    setCurrentStep("idle");
    setProgressPercent(0);
    setError("");
    setInvoiceId(null);
    setData(null);
    setEditableData(null);
    setMode("single");
    setBatchQueue([]);
    setBatchProcessing(false);
    setSelectedBatchItem(null);
  };

  // ── Save handler ──────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!invoiceId || !editableData) return;
    setIsSaving(true);
    try {
      await updateInvoice(invoiceId, {
        data: editableData,
        status: "reviewed",
      });
      setData(structuredClone(editableData));
      toast.success("Invoice saved successfully!");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to save. Make sure the backend is running.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ── Select a batch item to view its details ───────────────────────────

  const selectBatchItem = (item: BatchItem) => {
    if (item.status !== "completed" || !item.extractedData) return;
    setSelectedBatchItem(item.id);
    setInvoiceId(item.invoiceId || null);
    setData(item.extractedData);
    setEditableData(structuredClone(item.extractedData));
  };

  // ── Editable field helpers ────────────────────────────────────────────

  const updateField = (path: string, value: string | number | null) => {
    if (!editableData) return;
    const clone = structuredClone(editableData);
    const keys = path.split(".");
    let obj: Record<string, unknown> = clone as Record<string, unknown>;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]] || typeof obj[keys[i]] !== "object") {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]] as Record<string, unknown>;
    }
    obj[keys[keys.length - 1]] = value;
    setEditableData(clone);
  };

  const updateLineItem = (
    index: number,
    field: keyof LineItem,
    value: string,
  ) => {
    if (!editableData?.line_items) return;
    const clone = structuredClone(editableData);
    if (clone.line_items && clone.line_items[index]) {
      if (field === "description") {
        clone.line_items[index][field] = value;
      } else {
        clone.line_items[index][field] = value === "" ? null : Number(value);
      }
    }
    setEditableData(clone);
  };

  const removeLineItem = (index: number) => {
    if (!editableData?.line_items) return;
    const clone = structuredClone(editableData);
    clone.line_items!.splice(index, 1);
    setEditableData(clone);
  };

  // ── Dropzone ──────────────────────────────────────────────────────────

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
      "text/plain": [".txt"],
      "text/xml": [".xml"],
      "application/xml": [".xml"],
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
    },
    disabled:
      (mode === "single" &&
        currentStep !== "idle" &&
        currentStep !== "done" &&
        currentStep !== "error") ||
      batchProcessing,
    multiple: true,
  });

  // ── Derived values ────────────────────────────────────────────────────

  const confidence = data?.validation?.confidence ?? 0;
  const isValid = data?.validation?.is_valid ?? false;
  const needsReview = data?.validation?.needs_human_review ?? false;
  const warnings = data?.validation?.warnings ?? [];
  const fc = editableData?.field_confidence;
  const isProcessing =
    mode === "single" && !["idle", "done", "error"].includes(currentStep);
  const isDone = mode === "single" && currentStep === "done";

  // Batch stats
  const batchCompleted = batchQueue.filter(
    (b) => b.status === "completed",
  ).length;
  const batchFailed = batchQueue.filter((b) => b.status === "failed").length;
  const batchTotal = batchQueue.length;

  // For the detail panel in batch mode
  const showDetailPanel =
    (mode === "single" && (isDone || isProcessing || currentStep === "error")) ||
    (mode === "batch" && selectedBatchItem !== null);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("aiExtraction")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload invoices (single, multiple, or ZIP) and let AI extract all
            data
          </p>
        </div>
        {(isDone ||
          currentStep === "error" ||
          (mode === "batch" && !batchProcessing)) &&
          (uploadedFile || batchQueue.length > 0) && (
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              New Extraction
            </Button>
          )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ── LEFT COLUMN: Upload + Status ──────────────────────────────── */}
        <div className="xl:col-span-2 space-y-6">
          {/* Upload Zone */}
          <Card className="bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground text-lg">
                    {t("uploadInvoice")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, PNG, JPG, WEBP, TXT, XML, or ZIP
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#10B981]" />
                  <span className="text-xs font-medium text-[#10B981]">
                    AI-Powered
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center min-h-[200px] cursor-pointer transition-all duration-200 ${
                  isProcessing || batchProcessing
                    ? "border-[#10B981]/40 bg-[#10B981]/5 cursor-wait"
                    : isDragActive
                      ? "border-[#10B981] bg-[#10B981]/5 scale-[1.01]"
                      : "border-border hover:border-[#10B981]/50 hover:bg-[#10B981]/[0.02]"
                }`}
              >
                <input {...getInputProps()} />

                {isProcessing || batchProcessing ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-14 w-14 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                      <Loader2 className="h-7 w-7 text-[#10B981] animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-[#10B981]">
                      {batchProcessing
                        ? `Processing ${batchTotal} file(s)...`
                        : "Processing..."}
                    </p>
                  </div>
                ) : (isDone && uploadedFile) ||
                  (mode === "batch" && !batchProcessing && batchTotal > 0) ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-14 w-14 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                      <CheckCircle2 className="h-7 w-7 text-[#10B981]" />
                    </div>
                    <p className="text-sm font-medium text-[#10B981]">
                      Extraction Complete
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Drop new files to extract again
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center">
                      <Upload
                        className={`h-7 w-7 ${isDragActive ? "text-[#10B981]" : "text-muted-foreground"}`}
                      />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-sm">{t("dragDrop")}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        or click to browse - supports multiple files &amp; ZIP
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant="outline"
                        className="text-xs gap-1 text-muted-foreground"
                      >
                        <Files className="h-3 w-3" />
                        Multi-file
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs gap-1 text-muted-foreground"
                      >
                        <FileArchive className="h-3 w-3" />
                        ZIP support
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Capture Button */}
              {!isProcessing && !batchProcessing && (
                <div className="mt-4 flex items-center justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCameraClick}
                    className="gap-2"
                    disabled={isProcessing || batchProcessing}
                  >
                    <Camera className="h-4 w-4" />
                    {t("scanInvoice") || "Scan Invoice"}
                  </Button>
                </div>
              )}

              {/* Hidden mobile camera input */}
              <input
                ref={mobileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleMobileCapture}
              />

              {/* Error (single mode) */}
              {mode === "single" && error && (
                <div className="mt-4 flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── BATCH QUEUE ──────────────────────────────────────────────── */}
          {mode === "batch" && batchQueue.length > 0 && (
            <Card className="bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-foreground">
                    Batch Queue
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {batchProcessing && (
                      <Loader2 className="h-4 w-4 animate-spin text-[#10B981]" />
                    )}
                    <Badge variant="outline" className="text-xs">
                      {batchCompleted}/{batchTotal} done
                      {batchFailed > 0 && (
                        <span className="text-red-500 ml-1">
                          ({batchFailed} failed)
                        </span>
                      )}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Overall progress */}
                {batchProcessing && (
                  <Progress
                    value={
                      (batchQueue.filter(
                        (b) =>
                          b.status === "completed" || b.status === "failed",
                      ).length /
                        batchTotal) *
                      100
                    }
                    className="h-2 mb-4 [&>div]:bg-[#10B981]"
                  />
                )}

                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {batchQueue.map((item) => {
                      const Icon = getFileIcon(item.file.name);
                      const isSelected = selectedBatchItem === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => selectBatchItem(item)}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                            item.status === "completed"
                              ? "cursor-pointer hover:bg-muted/50"
                              : ""
                          } ${
                            isSelected
                              ? "border-[#10B981] bg-[#10B981]/5"
                              : "border-border"
                          }`}
                        >
                          {/* Icon */}
                          <div
                            className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                              item.status === "completed"
                                ? "bg-[#10B981]/10"
                                : item.status === "failed"
                                  ? "bg-red-50"
                                  : item.status === "processing"
                                    ? "bg-blue-50"
                                    : "bg-muted/50"
                            }`}
                          >
                            {item.status === "processing" ? (
                              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                            ) : item.status === "completed" ? (
                              <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                            ) : item.status === "failed" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.file.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.file.size > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {formatFileSize(item.file.size)}
                                </span>
                              )}
                              {item.status === "completed" &&
                                item.extractedData?.vendor_name && (
                                  <span className="text-xs text-muted-foreground truncate">
                                    {item.extractedData.vendor_name}
                                  </span>
                                )}
                              {item.status === "failed" && item.error && (
                                <span className="text-xs text-red-500 truncate">
                                  {item.error}
                                </span>
                              )}
                            </div>
                            {/* Per-file progress bar */}
                            {item.status === "processing" && (
                              <Progress
                                value={item.progress}
                                className="h-1 mt-2 [&>div]:bg-blue-500"
                              />
                            )}
                          </div>

                          {/* Status badge */}
                          <Badge
                            className={`text-xs shrink-0 ${
                              item.status === "completed"
                                ? "bg-[#10B981]/10 text-[#10B981] border-0"
                                : item.status === "failed"
                                  ? "bg-red-50 text-red-500 border-0"
                                  : item.status === "processing"
                                    ? "bg-blue-50 text-blue-500 border-0"
                                    : "bg-muted text-muted-foreground border-0"
                            }`}
                          >
                            {item.status === "completed"
                              ? "Done"
                              : item.status === "failed"
                                ? "Failed"
                                : item.status === "processing"
                                  ? "Processing"
                                  : "Queued"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {!batchProcessing && batchCompleted > 0 && !selectedBatchItem && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Click a completed file to view extracted data
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── SINGLE-MODE: File Info ──────────────────────────────────── */}
          {mode === "single" && uploadedFile && (
            <Card className="bg-card">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  {React.createElement(getFileIcon(uploadedFile.name), {
                    className: "h-10 w-10 text-foreground flex-shrink-0",
                  })}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {uploadedFile.name}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(uploadedFile.size)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {uploadedFile.name
                          .split(".")
                          .pop()
                          ?.toUpperCase() || "FILE"}
                      </span>
                    </div>
                  </div>
                  {isDone && (
                    <Badge className="bg-[#10B981]/10 text-[#10B981] border-0">
                      <Check className="h-3 w-3 mr-1" />
                      Done
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── SINGLE-MODE: Processing Steps ──────────────────────────── */}
          {mode === "single" && (isProcessing || isDone) && (
            <Card className="bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground">
                  Processing Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress
                  value={progressPercent}
                  className="h-2 [&>div]:bg-[#10B981]"
                />
                <div className="space-y-3">
                  {STEPS.map((step, idx) => {
                    const stepIdx = STEPS.findIndex(
                      (s) => s.key === currentStep,
                    );
                    const thisIdx = idx;
                    const isComplete = isDone || thisIdx < stepIdx;
                    const isActive = thisIdx === stepIdx && isProcessing;

                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                            isComplete
                              ? "bg-[#10B981]/10"
                              : isActive
                                ? "bg-[#10B981]/10"
                                : "bg-muted/50"
                          }`}
                        >
                          {isComplete ? (
                            <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                          ) : isActive ? (
                            <Loader2 className="h-4 w-4 text-[#10B981] animate-spin" />
                          ) : (
                            <step.icon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <span
                          className={`text-sm ${
                            isComplete
                              ? "text-[#10B981] font-medium"
                              : isActive
                                ? "text-foreground font-medium"
                                : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </span>
                        {isActive && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            In progress...
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Confidence & Validation */}
          {((mode === "single" && isDone) ||
            (mode === "batch" && selectedBatchItem)) &&
            data && (
              <Card className="bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-foreground">
                    Extraction Quality
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BrainCircuit
                        className={`h-5 w-5 ${getConfidenceColor(confidence)}`}
                      />
                      <span className="text-sm font-medium">
                        AI Confidence
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-2xl font-bold ${getConfidenceColor(confidence)}`}
                      >
                        {confidence}%
                      </span>
                      <Badge
                        className={`${getConfidenceBg(confidence)} text-white border-0 text-xs`}
                      >
                        {getConfidenceLabel(confidence)}
                      </Badge>
                    </div>
                  </div>

                  <Progress
                    value={confidence}
                    className={`h-2.5 [&>div]:${getConfidenceBg(confidence)}`}
                  />

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {isValid ? (
                        <>
                          <ShieldCheck className="h-4 w-4 text-[#10B981]" />
                          <span className="text-sm text-[#10B981] font-medium">
                            Valid Invoice
                          </span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-red-500 font-medium">
                            Validation Issues
                          </span>
                        </>
                      )}
                    </div>

                    {needsReview && (
                      <div className="flex items-start gap-2 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/40 rounded-lg">
                        <Eye className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-yellow-700 dark:text-yellow-300">
                          This invoice needs human review. Some fields may be
                          missing or inaccurate.
                        </p>
                      </div>
                    )}

                    {warnings.length > 0 && (
                      <div className="space-y-2">
                        {warnings.map((w, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 p-2.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/40 rounded-lg"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-orange-700 dark:text-orange-300">{w}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
        </div>

        {/* ── RIGHT COLUMN: Extracted Data ──────────────────────────────── */}
        <div className="xl:col-span-3">
          {/* Idle state */}
          {mode === "single" && currentStep === "idle" && batchQueue.length === 0 ? (
            <Card className="bg-card h-full">
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[500px] text-center">
                <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Receipt className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("extractedData")}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Upload invoice files to see extracted data here. Supports
                  single files, multiple files, and ZIP archives.
                </p>
                <div className="flex items-center gap-3 mt-6">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    PDF
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Image className="h-4 w-4" />
                    Images
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileArchive className="h-4 w-4" />
                    ZIP
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : isProcessing ? (
            <Card className="bg-card h-full">
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[500px]">
                <Loader2 className="h-12 w-12 text-[#10B981] animate-spin mb-4" />
                <p className="text-sm font-medium text-muted-foreground">
                  Extracting invoice data...
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  This may take a few moments
                </p>
              </CardContent>
            </Card>
          ) : mode === "single" && currentStep === "error" ? (
            <Card className="bg-card h-full">
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[500px] text-center">
                <div className="h-20 w-20 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                  <XCircle className="h-10 w-10 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Extraction Failed
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mb-4">
                  {error}
                </p>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : mode === "batch" && !selectedBatchItem ? (
            /* Batch mode - no item selected yet */
            <Card className="bg-card h-full">
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[500px] text-center">
                {batchProcessing ? (
                  <>
                    <Loader2 className="h-12 w-12 text-[#10B981] animate-spin mb-4" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Processing {batchTotal} file(s)...
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Results will appear in the batch queue
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-20 w-20 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mb-4">
                      <Files className="h-10 w-10 text-[#10B981]" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Batch Processing Complete
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {batchCompleted} of {batchTotal} files processed
                      successfully.
                      {batchCompleted > 0 &&
                        " Click a completed file in the queue to review its data."}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : editableData ? (
            /* Detail view for single or selected batch item */
            <Card className="bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-foreground">
                      {t("extractedData")}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Review and edit the extracted information before saving
                    </p>
                  </div>
                  {editableData.validation?.is_valid ? (
                    <Badge className="bg-[#10B981]/10 text-[#10B981] border-0 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Valid
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-500/10 text-yellow-600 border-0 gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Review
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="space-y-6 pr-4">
                    {/* Invoice Header */}
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <Hash className="h-4 w-4 text-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">
                          Invoice Details
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Invoice Number
                            <FieldConfidenceBadge score={fc?.invoice_no} />
                          </Label>
                          <Input
                            value={editableData.invoice_no || ""}
                            onChange={(e) =>
                              updateField("invoice_no", e.target.value)
                            }
                            placeholder="e.g. INV-001"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Currency
                            <FieldConfidenceBadge score={fc?.currency} />
                          </Label>
                          <Input
                            value={editableData.totals?.currency || ""}
                            onChange={(e) =>
                              updateField("totals.currency", e.target.value)
                            }
                            placeholder="e.g. USD"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            Invoice Date
                            <FieldConfidenceBadge score={fc?.date} />
                          </Label>
                          <Input
                            type="date"
                            value={editableData.date || ""}
                            onChange={(e) =>
                              updateField("date", e.target.value)
                            }
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Due Date
                            <FieldConfidenceBadge score={fc?.due_date} />
                          </Label>
                          <Input
                            type="date"
                            value={editableData.due_date || ""}
                            onChange={(e) =>
                              updateField("due_date", e.target.value)
                            }
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    </section>

                    <Separator />

                    {/* Vendor */}
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="h-4 w-4 text-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">
                          Vendor (From)
                        </h3>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          Vendor / Supplier Name
                          <FieldConfidenceBadge score={fc?.vendor_name} />
                        </Label>
                        <Input
                          value={editableData.vendor_name || ""}
                          onChange={(e) =>
                            updateField("vendor_name", e.target.value)
                          }
                          placeholder="Company name"
                          className="h-9 text-sm"
                        />
                      </div>
                    </section>

                    <Separator />

                    {/* Bill To */}
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <User className="h-4 w-4 text-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">
                          Bill To (Customer)
                        </h3>
                        <FieldConfidenceBadge score={fc?.bill_to} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Name
                          </Label>
                          <Input
                            value={editableData.bill_to?.name || ""}
                            onChange={(e) =>
                              updateField("bill_to.name", e.target.value)
                            }
                            placeholder="Customer name"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Email
                          </Label>
                          <Input
                            value={editableData.bill_to?.email || ""}
                            onChange={(e) =>
                              updateField("bill_to.email", e.target.value)
                            }
                            placeholder="customer@example.com"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Address
                          </Label>
                          <Input
                            value={editableData.bill_to?.address || ""}
                            onChange={(e) =>
                              updateField("bill_to.address", e.target.value)
                            }
                            placeholder="Full address"
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    </section>

                    <Separator />

                    {/* Line Items */}
                    <section>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-foreground" />
                          <h3 className="text-sm font-semibold text-foreground">
                            Line Items
                          </h3>
                          <FieldConfidenceBadge score={fc?.line_items} />
                          {editableData.line_items &&
                            editableData.line_items.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {editableData.line_items.length} item
                                {editableData.line_items.length !== 1
                                  ? "s"
                                  : ""}
                              </Badge>
                            )}
                        </div>
                      </div>

                      {editableData.line_items &&
                      editableData.line_items.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="text-xs font-medium">
                                  Description
                                </TableHead>
                                <TableHead className="text-xs font-medium w-[80px] text-right">
                                  Qty
                                </TableHead>
                                <TableHead className="text-xs font-medium w-[100px] text-right">
                                  Unit Price
                                </TableHead>
                                <TableHead className="text-xs font-medium w-[100px] text-right">
                                  Total
                                </TableHead>
                                <TableHead className="w-[40px]" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {editableData.line_items.map((item, idx) => (
                                <TableRow key={idx} className="group">
                                  <TableCell className="py-1.5">
                                    <Input
                                      value={item.description || ""}
                                      onChange={(e) =>
                                        updateLineItem(
                                          idx,
                                          "description",
                                          e.target.value,
                                        )
                                      }
                                      className="h-8 text-xs border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded"
                                    />
                                  </TableCell>
                                  <TableCell className="py-1.5">
                                    <Input
                                      value={item.quantity ?? ""}
                                      onChange={(e) =>
                                        updateLineItem(
                                          idx,
                                          "quantity",
                                          e.target.value,
                                        )
                                      }
                                      className="h-8 text-xs text-right border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded"
                                    />
                                  </TableCell>
                                  <TableCell className="py-1.5">
                                    <Input
                                      value={item.unit_price ?? ""}
                                      onChange={(e) =>
                                        updateLineItem(
                                          idx,
                                          "unit_price",
                                          e.target.value,
                                        )
                                      }
                                      className="h-8 text-xs text-right border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded"
                                    />
                                  </TableCell>
                                  <TableCell className="py-1.5">
                                    <Input
                                      value={item.total ?? ""}
                                      onChange={(e) =>
                                        updateLineItem(
                                          idx,
                                          "total",
                                          e.target.value,
                                        )
                                      }
                                      className="h-8 text-xs text-right border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded font-medium"
                                    />
                                  </TableCell>
                                  <TableCell className="py-1.5 px-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => removeLineItem(idx)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
                          No line items extracted
                        </div>
                      )}
                    </section>

                    <Separator />

                    {/* Totals */}
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <Receipt className="h-4 w-4 text-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">
                          Totals
                        </h3>
                      </div>
                      <div className="bg-muted/20 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">
                            Subtotal
                          </Label>
                          <Input
                            value={editableData.totals?.subtotal ?? ""}
                            onChange={(e) =>
                              updateField(
                                "totals.subtotal",
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                            className="h-8 w-36 text-sm text-right"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">
                            Tax
                          </Label>
                          <Input
                            value={editableData.totals?.tax ?? ""}
                            onChange={(e) =>
                              updateField(
                                "totals.tax",
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                            className="h-8 w-36 text-sm text-right"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">
                            Discount
                          </Label>
                          <Input
                            value={editableData.totals?.discount ?? ""}
                            onChange={(e) =>
                              updateField(
                                "totals.discount",
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                            className="h-8 w-36 text-sm text-right"
                            placeholder="0.00"
                          />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold text-foreground flex items-center gap-1">
                            Grand Total
                            <FieldConfidenceBadge score={fc?.grand_total} />
                          </Label>
                          <Input
                            value={editableData.totals?.grand_total ?? ""}
                            onChange={(e) =>
                              updateField(
                                "totals.grand_total",
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                            className="h-9 w-36 text-sm text-right font-bold border-[#10B981]/30 focus:border-[#10B981]"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </section>

                    <Separator />

                    {/* Payment & Notes */}
                    <section>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            Payment Method
                            <FieldConfidenceBadge score={fc?.payment_method} />
                          </Label>
                          <Input
                            value={editableData.payment_method || ""}
                            onChange={(e) =>
                              updateField("payment_method", e.target.value)
                            }
                            placeholder="e.g. Bank Transfer"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <StickyNote className="h-3 w-3" />
                            Notes
                            <FieldConfidenceBadge score={fc?.notes} />
                          </Label>
                          <Input
                            value={editableData.notes || ""}
                            onChange={(e) =>
                              updateField("notes", e.target.value)
                            }
                            placeholder="Any additional notes"
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    </section>

                    <div className="h-4" />
                  </div>
                </ScrollArea>

                {/* Save Action */}
                <div className="pt-4 mt-4 border-t flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {invoiceId
                      ? "All changes are local until you save"
                      : "No invoice ID -- data was already saved during extraction"}
                  </p>
                  <Button
                    onClick={handleSave}
                    disabled={!invoiceId || isSaving}
                    className="bg-[#10B981] hover:bg-[#10B981]/90 text-white gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {isSaving ? "Saving..." : t("saveInvoice")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Camera Dialog (Desktop) */}
      <Dialog open={cameraOpen} onOpenChange={handleCameraDialogClose}>
        <DialogContent className="sm:max-w-[640px] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {t("scanInvoice") || "Scan Invoice"}
            </DialogTitle>
          </DialogHeader>
          <div className="relative bg-black aspect-[4/3] w-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="p-4 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFacingMode}
              title={t("switchCamera") || "Switch Camera"}
            >
              <SwitchCamera className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              onClick={capturePhoto}
              className="bg-[#10B981] hover:bg-[#10B981]/90 text-white gap-2 rounded-full h-14 w-14"
            >
              <Camera className="h-6 w-6" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCameraDialogClose(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
