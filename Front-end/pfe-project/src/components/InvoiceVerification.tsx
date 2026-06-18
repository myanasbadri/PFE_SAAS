"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./ui/resizable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  Check,
  X,
  Loader2,
  Building2,
  User,
  CreditCard,
  StickyNote,
  Package,
  CalendarDays,
  Hash,
  Receipt,
  Clock,
  AlertTriangle,
  Trash2,
  Eye,
  Pencil,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  BrainCircuit,
  Keyboard,
  Undo2,
  FileText,
  Image,
  File,
} from "lucide-react";
import { CURRENCIES } from "@/lib/currencies";
import { useLanguage } from "../contexts/LanguageContext";
import { type Invoice } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

type ExtractionData = Invoice["data"];

interface LineItem {
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  total?: number | null;
}

interface InvoiceVerificationProps {
  file: File | null;
  data: ExtractionData;
  editableData: ExtractionData;
  invoiceId: string | null;
  isSaving: boolean;
  onFieldChange: (path: string, value: string | number | null) => void;
  onLineItemChange: (index: number, field: keyof LineItem, value: string) => void;
  onLineItemRemove: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

// ── Field definitions for structured display ─────────────────────────────────

interface FieldDef {
  key: string;
  path: string;
  labelKey: string;
  icon: React.ElementType;
  section: string;
  getValue: (d: ExtractionData) => string | number | null | undefined;
  confidenceKey?: string;
}

const FIELD_DEFS: FieldDef[] = [
  { key: "vendor_name", path: "vendor_name", labelKey: "vendorName", icon: Building2, section: "vendor", getValue: (d) => d.vendor_name, confidenceKey: "vendor_name" },
  { key: "invoice_no", path: "invoice_no", labelKey: "invoiceNo", icon: Hash, section: "header", getValue: (d) => d.invoice_no, confidenceKey: "invoice_no" },
  { key: "date", path: "date", labelKey: "invoiceDateLabel", icon: CalendarDays, section: "header", getValue: (d) => d.date, confidenceKey: "date" },
  { key: "due_date", path: "due_date", labelKey: "dueDate", icon: Clock, section: "header", getValue: (d) => d.due_date, confidenceKey: "due_date" },
  { key: "currency", path: "totals.currency", labelKey: "currency", icon: Receipt, section: "totals", getValue: (d) => d.totals?.currency, confidenceKey: "currency" },
  { key: "bill_to_name", path: "bill_to.name", labelKey: "billTo", icon: User, section: "bill_to", getValue: (d) => d.bill_to?.name, confidenceKey: "bill_to" },
  { key: "bill_to_email", path: "bill_to.email", labelKey: "email", icon: User, section: "bill_to", getValue: (d) => d.bill_to?.email },
  { key: "bill_to_address", path: "bill_to.address", labelKey: "address", icon: User, section: "bill_to", getValue: (d) => d.bill_to?.address },
  { key: "grand_total", path: "totals.grand_total", labelKey: "grandTotal", icon: Receipt, section: "totals", getValue: (d) => d.totals?.grand_total, confidenceKey: "grand_total" },
  { key: "subtotal", path: "totals.subtotal", labelKey: "subtotal", icon: Receipt, section: "totals", getValue: (d) => d.totals?.subtotal },
  { key: "tax", path: "totals.tax", labelKey: "tax", icon: Receipt, section: "totals", getValue: (d) => d.totals?.tax },
  { key: "discount", path: "totals.discount", labelKey: "discount", icon: Receipt, section: "totals", getValue: (d) => d.totals?.discount },
  { key: "payment_method", path: "payment_method", labelKey: "paymentMethod", icon: CreditCard, section: "other", getValue: (d) => d.payment_method, confidenceKey: "payment_method" },
  { key: "notes", path: "notes", labelKey: "notes", icon: StickyNote, section: "other", getValue: (d) => d.notes, confidenceKey: "notes" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getConfidenceColor(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getConfidenceBg(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function getConfidenceBorder(score: number) {
  if (score >= 80) return "border-emerald-300 dark:border-emerald-700";
  if (score >= 50) return "border-yellow-300 dark:border-yellow-700";
  return "border-red-300 dark:border-red-700";
}

function getConfidenceRingClass(score: number) {
  if (score >= 80) return "ring-emerald-400/50";
  if (score >= 50) return "ring-yellow-400/50";
  return "ring-red-400/50";
}

function ConfidenceBadge({ score }: { score: number | undefined }) {
  if (score === undefined || score === null || score === 0) return null;
  const color =
    score >= 80
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : score >= 50
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${color}`}>
      {score}%
    </span>
  );
}

function getValueAtPath(data: ExtractionData, path: string): unknown {
  const keys = path.split(".");
  let obj: unknown = data;
  for (const key of keys) {
    if (obj === null || obj === undefined || typeof obj !== "object") return undefined;
    obj = (obj as Record<string, unknown>)[key];
  }
  return obj;
}

function displayValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

// ── Document Viewer ─────────────────────────────────────────────────────────

function DocumentViewer({ file }: { file: File | null }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isImage = file ? /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(file.name) : false;
  const isPdf = file ? /\.pdf$/i.test(file.name) : false;

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, [file]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(Math.max(0.25, z + delta), 5));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  if (!file || !objectUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm">No document to preview</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-1">
          {isImage ? <Image className="h-4 w-4 text-muted-foreground" /> : <File className="h-4 w-4 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground truncate max-w-[180px]">{file.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(z + 0.25, 5))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In (+)</TooltipContent>
          </Tooltip>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out (-)</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRotation((r) => (r + 90) % 360)}>
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rotate (R)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetView}>
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to View (F)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Document Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-muted/10 relative cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={isImage ? handleMouseDown : undefined}
        onMouseMove={isImage ? handleMouseMove : undefined}
        onMouseUp={isImage ? handleMouseUp : undefined}
        onMouseLeave={isImage ? handleMouseUp : undefined}
      >
        {isPdf ? (
          <iframe
            src={`${objectUrl}#toolbar=1&navpanes=0`}
            className="w-full h-full border-0"
            title="Invoice PDF"
          />
        ) : isImage ? (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <img
              src={objectUrl}
              alt="Invoice"
              draggable={false}
              className="max-w-none select-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transition: isPanning ? "none" : "transform 0.2s ease",
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm">Preview not available for this file type</p>
            <p className="text-xs">{file.name}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function InvoiceVerification({
  file,
  data,
  editableData,
  invoiceId,
  isSaving,
  onFieldChange,
  onLineItemChange,
  onLineItemRemove,
  onSave,
  onCancel,
}: InvoiceVerificationProps) {
  const { t } = useLanguage();
  const [activeScreen, setActiveScreen] = useState<"verify" | "edit">("verify");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const editFormRef = useRef<HTMLDivElement>(null);

  // Original data snapshot for comparison
  const originalData = data;
  const fc = editableData?.field_confidence;
  const confidence = editableData?.validation?.confidence ?? 0;
  const isValid = editableData?.validation?.is_valid ?? false;
  const needsReview = editableData?.validation?.needs_human_review ?? false;
  const warnings = editableData?.validation?.warnings ?? [];

  // ── Count changes ──────────────────────────────────────────────────────

  const changeCount = useMemo(() => {
    let count = 0;
    for (const field of FIELD_DEFS) {
      const original = displayValue(field.getValue(originalData));
      const edited = displayValue(field.getValue(editableData));
      if (original !== edited) count++;
    }
    // Check line items changes
    const origItems = originalData.line_items ?? [];
    const editItems = editableData.line_items ?? [];
    if (origItems.length !== editItems.length) count++;
    return count;
  }, [originalData, editableData]);

  // ── Field coverage ─────────────────────────────────────────────────────

  const filledFields = useMemo(() => {
    let filled = 0;
    for (const field of FIELD_DEFS) {
      const val = field.getValue(editableData);
      if (val !== null && val !== undefined && val !== "") filled++;
    }
    return filled;
  }, [editableData]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Ctrl+S / Cmd+S → Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (invoiceId && !isSaving) onSave();
        return;
      }

      // Escape → Cancel (unfocus first if in input, else cancel)
      if (e.key === "Escape") {
        if (isInput) {
          (e.target as HTMLElement).blur();
          return;
        }
        e.preventDefault();
        onCancel();
        return;
      }

      // Only handle these when not in an input
      if (isInput) return;

      // 1 → Screen 1
      if (e.key === "1") {
        e.preventDefault();
        setActiveScreen("verify");
        return;
      }
      // 2 → Screen 2
      if (e.key === "2") {
        e.preventDefault();
        setActiveScreen("edit");
        return;
      }
      // ? → Toggle shortcuts help
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((s) => !s);
        return;
      }
      // + / = → Zoom in (handled by document viewer)
      // - → Zoom out (handled by document viewer)
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [invoiceId, isSaving, onSave, onCancel]);

  // ── Navigate to field in edit screen ───────────────────────────────────

  const goToField = useCallback((fieldKey: string) => {
    setActiveScreen("edit");
    setFocusedField(fieldKey);
    // Scroll into view after render
    setTimeout(() => {
      const el = document.getElementById(`field-${fieldKey}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const input = el.querySelector("input, select");
        if (input) (input as HTMLElement).focus();
      }
    }, 100);
  }, []);

  // ── Check if a field was modified ──────────────────────────────────────

  const isModified = useCallback((path: string) => {
    const orig = getValueAtPath(originalData, path);
    const edit = getValueAtPath(editableData, path);
    return displayValue(orig) !== displayValue(edit);
  }, [originalData, editableData]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px] border rounded-xl overflow-hidden bg-card">
      {/* ── Top Toolbar ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isValid ? (
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-yellow-500" />
            )}
            <h2 className="font-semibold text-foreground">
              {t("verifyInvoice") || "Verify Invoice"}
            </h2>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Screen Tabs */}
          <Tabs value={activeScreen} onValueChange={(v) => setActiveScreen(v as "verify" | "edit")}>
            <TabsList className="h-8">
              <TabsTrigger value="verify" className="text-xs gap-1.5 px-3">
                <Eye className="h-3.5 w-3.5" />
                {t("verifyScreen") || "1. Verify"}
              </TabsTrigger>
              <TabsTrigger value="edit" className="text-xs gap-1.5 px-3">
                <Pencil className="h-3.5 w-3.5" />
                {t("editScreen") || "2. Edit & Save"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badges */}
          <div className="hidden sm:flex items-center gap-2 mr-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`text-xs gap-1 ${getConfidenceColor(confidence)}`}>
                  <BrainCircuit className="h-3 w-3" />
                  {confidence}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{t("aiConfidence") || "AI Confidence"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs gap-1">
                  {filledFields}/{FIELD_DEFS.length} {t("fields") || "fields"}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{t("fieldsExtracted") || "Fields extracted"}</TooltipContent>
            </Tooltip>
            {changeCount > 0 && (
              <Badge variant="outline" className="text-xs gap-1 text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700">
                {changeCount} {t("changes") || "changes"}
              </Badge>
            )}
          </div>

          {/* Shortcuts help */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowShortcuts((s) => !s)}>
                <Keyboard className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("keyboardShortcuts") || "Shortcuts (?)"}</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5" />

          <Button variant="outline" size="sm" onClick={onCancel} className="gap-1.5 text-xs">
            <X className="h-3.5 w-3.5" />
            {t("cancel") || "Cancel"}
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={!invoiceId || isSaving}
            className="bg-[#10B981] hover:bg-[#10B981]/90 text-white gap-1.5 text-xs"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {isSaving ? (t("saving") || "Saving...") : (t("saveInvoice") || "Save Invoice")}
          </Button>
        </div>
      </div>

      {/* ── Keyboard Shortcuts Overlay ─────────────────────────────────── */}
      {showShortcuts && (
        <div className="px-4 py-2 bg-muted/40 border-b flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">Ctrl+S</kbd> {t("save") || "Save"}</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">Esc</kbd> {t("cancel") || "Cancel"}</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">1</kbd> {t("verifyScreen") || "Verify Screen"}</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">2</kbd> {t("editScreen") || "Edit Screen"}</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">?</kbd> {t("toggleShortcuts") || "Toggle shortcuts"}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => setShowShortcuts(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* ── Warnings banner ────────────────────────────────────────────── */}
      {needsReview && (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-700/40 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            {t("needsHumanReview") || "This invoice needs human review. Some fields may be missing or inaccurate."}
          </p>
        </div>
      )}

      {/* ── Main Split View ────────────────────────────────────────────── */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* Left: Document Viewer */}
        <ResizablePanel defaultSize={45} minSize={25} maxSize={70}>
          <DocumentViewer file={file} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Verify / Edit screens */}
        <ResizablePanel defaultSize={55} minSize={30} maxSize={75}>
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            {activeScreen === "verify" ? (
              /* ── SCREEN 1: Verify ──────────────────────────────────── */
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-4">
                  {/* Confidence overview */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border">
                    <div className="flex items-center gap-2">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${confidence >= 80 ? "bg-emerald-100 dark:bg-emerald-900/30" : confidence >= 50 ? "bg-yellow-100 dark:bg-yellow-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                        <BrainCircuit className={`h-5 w-5 ${getConfidenceColor(confidence)}`} />
                      </div>
                      <div>
                        <p className={`text-lg font-bold ${getConfidenceColor(confidence)}`}>{confidence}%</p>
                        <p className="text-[10px] text-muted-foreground">{t("aiConfidence") || "AI Confidence"}</p>
                      </div>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="flex-1 grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{filledFields}</p>
                        <p className="text-[10px] text-muted-foreground">{t("fieldsDetected") || "Detected"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{editableData.line_items?.length ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground">{t("lineItems") || "Line Items"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{warnings.length}</p>
                        <p className="text-[10px] text-muted-foreground">{t("warnings") || "Warnings"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Warnings */}
                  {warnings.length > 0 && (
                    <div className="space-y-1.5">
                      {warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/40 rounded-lg">
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-orange-700 dark:text-orange-300">{w}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Section: Header & Vendor */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {t("invoiceDetails") || "Invoice Details"}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {FIELD_DEFS.filter((f) => f.section === "header" || f.section === "vendor").map((field) => {
                        const score = field.confidenceKey ? (fc as Record<string, number> | undefined)?.[field.confidenceKey] : undefined;
                        const val = field.getValue(editableData);
                        const hasValue = val !== null && val !== undefined && val !== "";
                        return (
                          <button
                            key={field.key}
                            onClick={() => goToField(field.key)}
                            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm hover:ring-2 ${
                              score !== undefined ? getConfidenceRingClass(score) : "ring-muted-foreground/20"
                            } ${
                              score !== undefined ? getConfidenceBorder(score) : "border-border"
                            } ${focusedField === field.key ? "ring-2 ring-blue-400 border-blue-400" : ""}`}
                          >
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                              hasValue
                                ? score !== undefined && score >= 80 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-muted"
                                : "bg-red-50 dark:bg-red-900/20"
                            }`}>
                              <field.icon className={`h-4 w-4 ${hasValue ? "text-foreground" : "text-red-400"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">{t(field.labelKey) || field.labelKey}</span>
                                {score !== undefined && <ConfidenceBadge score={score} />}
                              </div>
                              <p className={`text-sm font-medium truncate mt-0.5 ${hasValue ? "text-foreground" : "text-muted-foreground/50 italic"}`}>
                                {hasValue ? String(val) : t("notDetected") || "Not detected"}
                              </p>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 mt-2.5 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section: Bill To */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {t("billTo") || "Bill To"}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {FIELD_DEFS.filter((f) => f.section === "bill_to").map((field) => {
                        const score = field.confidenceKey ? (fc as Record<string, number> | undefined)?.[field.confidenceKey] : undefined;
                        const val = field.getValue(editableData);
                        const hasValue = val !== null && val !== undefined && val !== "";
                        return (
                          <button
                            key={field.key}
                            onClick={() => goToField(field.key)}
                            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm hover:ring-2 ${
                              score !== undefined ? getConfidenceRingClass(score) : "ring-muted-foreground/20"
                            } ${
                              score !== undefined ? getConfidenceBorder(score) : "border-border"
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${hasValue ? "bg-muted" : "bg-red-50 dark:bg-red-900/20"}`}>
                              <field.icon className={`h-4 w-4 ${hasValue ? "text-foreground" : "text-red-400"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">{t(field.labelKey) || field.labelKey}</span>
                                {score !== undefined && <ConfidenceBadge score={score} />}
                              </div>
                              <p className={`text-sm font-medium truncate mt-0.5 ${hasValue ? "text-foreground" : "text-muted-foreground/50 italic"}`}>
                                {hasValue ? String(val) : t("notDetected") || "Not detected"}
                              </p>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 mt-2.5 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section: Line Items Preview */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {t("lineItems") || "Line Items"} ({editableData.line_items?.length ?? 0})
                    </h3>
                    {editableData.line_items && editableData.line_items.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-xs">{t("description") || "Description"}</TableHead>
                              <TableHead className="text-xs w-[60px] text-right">{t("qty") || "Qty"}</TableHead>
                              <TableHead className="text-xs w-[80px] text-right">{t("unitPrice") || "Price"}</TableHead>
                              <TableHead className="text-xs w-[80px] text-right">{t("totals") || "Total"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {editableData.line_items.map((item, idx) => (
                              <TableRow key={idx} className="hover:bg-muted/20 cursor-pointer" onClick={() => { setActiveScreen("edit"); }}>
                                <TableCell className="text-xs py-2">{item.description || "—"}</TableCell>
                                <TableCell className="text-xs py-2 text-right">{item.quantity ?? "—"}</TableCell>
                                <TableCell className="text-xs py-2 text-right">{item.unit_price ?? "—"}</TableCell>
                                <TableCell className="text-xs py-2 text-right font-medium">{item.total ?? "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-4 text-center text-xs text-muted-foreground">
                        {t("noLineItems") || "No line items extracted"}
                      </div>
                    )}
                  </div>

                  {/* Section: Totals */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {t("totals") || "Totals"}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {FIELD_DEFS.filter((f) => f.section === "totals").map((field) => {
                        const score = field.confidenceKey ? (fc as Record<string, number> | undefined)?.[field.confidenceKey] : undefined;
                        const val = field.getValue(editableData);
                        const hasValue = val !== null && val !== undefined && val !== "";
                        const isGrandTotal = field.key === "grand_total";
                        return (
                          <button
                            key={field.key}
                            onClick={() => goToField(field.key)}
                            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm hover:ring-2 ${
                              isGrandTotal ? "sm:col-span-2 bg-muted/20" : ""
                            } ${
                              score !== undefined ? `${getConfidenceRingClass(score)} ${getConfidenceBorder(score)}` : "ring-muted-foreground/20 border-border"
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                              hasValue ? isGrandTotal ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-muted" : "bg-red-50 dark:bg-red-900/20"
                            }`}>
                              <field.icon className={`h-4 w-4 ${isGrandTotal && hasValue ? "text-emerald-600 dark:text-emerald-400" : hasValue ? "text-foreground" : "text-red-400"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">{t(field.labelKey) || field.labelKey}</span>
                                {score !== undefined && <ConfidenceBadge score={score} />}
                              </div>
                              <p className={`text-sm mt-0.5 truncate ${isGrandTotal ? "font-bold" : "font-medium"} ${hasValue ? "text-foreground" : "text-muted-foreground/50 italic"}`}>
                                {hasValue ? String(val) : t("notDetected") || "Not detected"}
                              </p>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 mt-2.5 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section: Other */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {t("paymentMethod") || "Payment"} & {t("notes") || "Notes"}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {FIELD_DEFS.filter((f) => f.section === "other").map((field) => {
                        const score = field.confidenceKey ? (fc as Record<string, number> | undefined)?.[field.confidenceKey] : undefined;
                        const val = field.getValue(editableData);
                        const hasValue = val !== null && val !== undefined && val !== "";
                        return (
                          <button
                            key={field.key}
                            onClick={() => goToField(field.key)}
                            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm hover:ring-2 ${
                              score !== undefined ? `${getConfidenceRingClass(score)} ${getConfidenceBorder(score)}` : "ring-muted-foreground/20 border-border"
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${hasValue ? "bg-muted" : "bg-red-50 dark:bg-red-900/20"}`}>
                              <field.icon className={`h-4 w-4 ${hasValue ? "text-foreground" : "text-red-400"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">{t(field.labelKey) || field.labelKey}</span>
                                {score !== undefined && <ConfidenceBadge score={score} />}
                              </div>
                              <p className={`text-sm font-medium truncate mt-0.5 ${hasValue ? "text-foreground" : "text-muted-foreground/50 italic"}`}>
                                {hasValue ? String(val) : t("notDetected") || "Not detected"}
                              </p>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 mt-2.5 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick action: Go to edit */}
                  <div className="pt-2">
                    <Button
                      onClick={() => setActiveScreen("edit")}
                      className="w-full bg-[#10B981] hover:bg-[#10B981]/90 text-white gap-2"
                    >
                      <Pencil className="h-4 w-4" />
                      {t("editFields") || "Edit & Correct Fields"}
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              /* ── SCREEN 2: Edit & Save ─────────────────────────────── */
              <ScrollArea className="flex-1 min-h-0">
                <div ref={editFormRef} className="p-4 space-y-5">
                  {/* Comparison legend */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      {t("originalAI") || "Original (AI)"}
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      {t("modified") || "Modified"}
                    </span>
                  </div>

                  {/* ── Invoice Header ────────────────────────────────── */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Hash className="h-4 w-4 text-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">{t("invoiceDetails") || "Invoice Details"}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Invoice No */}
                      <div id="field-invoice_no" className={`space-y-1.5 p-2.5 rounded-lg border transition-colors ${isModified("invoice_no") ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10" : "border-transparent"}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            {t("invoiceNo") || "Invoice Number"}
                            <ConfidenceBadge score={fc?.invoice_no} />
                          </Label>
                          {isModified("invoice_no") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        {isModified("invoice_no") && (
                          <p className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.invoice_no)}</p>
                        )}
                        <Input
                          value={editableData.invoice_no || ""}
                          onChange={(e) => onFieldChange("invoice_no", e.target.value)}
                          placeholder="e.g. INV-001"
                          className="h-9 text-sm"
                        />
                      </div>

                      {/* Currency */}
                      <div id="field-currency" className={`space-y-1.5 p-2.5 rounded-lg border transition-colors ${isModified("totals.currency") ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10" : "border-transparent"}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            {t("currency") || "Currency"}
                            <ConfidenceBadge score={fc?.currency} />
                          </Label>
                          {isModified("totals.currency") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        {isModified("totals.currency") && (
                          <p className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.totals?.currency)}</p>
                        )}
                        <Select value={editableData.totals?.currency || ""} onValueChange={(v) => onFieldChange("totals.currency", v)}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {CURRENCIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Date */}
                      <div id="field-date" className={`space-y-1.5 p-2.5 rounded-lg border transition-colors ${isModified("date") ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10" : "border-transparent"}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {t("invoiceDateLabel") || "Invoice Date"}
                            <ConfidenceBadge score={fc?.date} />
                          </Label>
                          {isModified("date") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        {isModified("date") && (
                          <p className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.date)}</p>
                        )}
                        <Input type="date" value={editableData.date || ""} onChange={(e) => onFieldChange("date", e.target.value)} className="h-9 text-sm" />
                      </div>

                      {/* Due Date */}
                      <div id="field-due_date" className={`space-y-1.5 p-2.5 rounded-lg border transition-colors ${isModified("due_date") ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10" : "border-transparent"}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {t("dueDate") || "Due Date"}
                            <ConfidenceBadge score={fc?.due_date} />
                          </Label>
                          {isModified("due_date") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        {isModified("due_date") && (
                          <p className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.due_date)}</p>
                        )}
                        <Input type="date" value={editableData.due_date || ""} onChange={(e) => onFieldChange("due_date", e.target.value)} className="h-9 text-sm" />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* ── Vendor ────────────────────────────────────────── */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-4 w-4 text-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">{t("vendorFrom") || "Vendor"}</h3>
                    </div>
                    <div id="field-vendor_name" className={`space-y-1.5 p-2.5 rounded-lg border transition-colors ${isModified("vendor_name") ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10" : "border-transparent"}`}>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          {t("vendorName") || "Vendor Name"}
                          <ConfidenceBadge score={fc?.vendor_name} />
                        </Label>
                        {isModified("vendor_name") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                      </div>
                      {isModified("vendor_name") && (
                        <p className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.vendor_name)}</p>
                      )}
                      <Input value={editableData.vendor_name || ""} onChange={(e) => onFieldChange("vendor_name", e.target.value)} placeholder="Company name" className="h-9 text-sm" />
                    </div>
                  </section>

                  <Separator />

                  {/* ── Bill To ───────────────────────────────────────── */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">{t("billTo") || "Bill To"}</h3>
                      <ConfidenceBadge score={fc?.bill_to} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div id="field-bill_to_name" className={`space-y-1.5 p-2.5 rounded-lg border transition-colors ${isModified("bill_to.name") ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10" : "border-transparent"}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">{t("name") || "Name"}</Label>
                          {isModified("bill_to.name") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        {isModified("bill_to.name") && (
                          <p className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.bill_to?.name)}</p>
                        )}
                        <Input value={editableData.bill_to?.name || ""} onChange={(e) => onFieldChange("bill_to.name", e.target.value)} placeholder="Customer name" className="h-9 text-sm" />
                      </div>
                      <div id="field-bill_to_email" className={`space-y-1.5 p-2.5 rounded-lg border transition-colors ${isModified("bill_to.email") ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10" : "border-transparent"}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">{t("email") || "Email"}</Label>
                          {isModified("bill_to.email") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        {isModified("bill_to.email") && (
                          <p className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.bill_to?.email)}</p>
                        )}
                        <Input value={editableData.bill_to?.email || ""} onChange={(e) => onFieldChange("bill_to.email", e.target.value)} placeholder="email@example.com" className="h-9 text-sm" />
                      </div>
                      <div id="field-bill_to_address" className={`sm:col-span-2 space-y-1.5 p-2.5 rounded-lg border transition-colors ${isModified("bill_to.address") ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10" : "border-transparent"}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">{t("address") || "Address"}</Label>
                          {isModified("bill_to.address") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        {isModified("bill_to.address") && (
                          <p className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.bill_to?.address)}</p>
                        )}
                        <Input value={editableData.bill_to?.address || ""} onChange={(e) => onFieldChange("bill_to.address", e.target.value)} placeholder="Full address" className="h-9 text-sm" />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* ── Line Items ────────────────────────────────────── */}
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">{t("lineItems") || "Line Items"}</h3>
                        <ConfidenceBadge score={fc?.line_items} />
                        {editableData.line_items && editableData.line_items.length > 0 && (
                          <Badge variant="secondary" className="text-xs">{editableData.line_items.length} item{editableData.line_items.length !== 1 ? "s" : ""}</Badge>
                        )}
                      </div>
                    </div>
                    {editableData.line_items && editableData.line_items.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-xs font-medium">{t("description") || "Description"}</TableHead>
                              <TableHead className="text-xs font-medium w-[80px] text-right">{t("qty") || "Qty"}</TableHead>
                              <TableHead className="text-xs font-medium w-[100px] text-right">{t("unitPrice") || "Unit Price"}</TableHead>
                              <TableHead className="text-xs font-medium w-[100px] text-right">{t("totals") || "Total"}</TableHead>
                              <TableHead className="w-[40px]" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {editableData.line_items.map((item, idx) => (
                              <TableRow key={idx} className="group">
                                <TableCell className="py-1.5">
                                  <Input value={item.description || ""} onChange={(e) => onLineItemChange(idx, "description", e.target.value)} className="h-8 text-xs border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded" />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input value={item.quantity ?? ""} onChange={(e) => onLineItemChange(idx, "quantity", e.target.value)} className="h-8 text-xs text-right border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded" />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input value={item.unit_price ?? ""} onChange={(e) => onLineItemChange(idx, "unit_price", e.target.value)} className="h-8 text-xs text-right border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded" />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input value={item.total ?? ""} onChange={(e) => onLineItemChange(idx, "total", e.target.value)} className="h-8 text-xs text-right border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded font-medium" />
                                </TableCell>
                                <TableCell className="py-1.5 px-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onLineItemRemove(idx)}>
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
                        {t("noLineItems") || "No line items extracted"}
                      </div>
                    )}
                  </section>

                  <Separator />

                  {/* ── Totals ────────────────────────────────────────── */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Receipt className="h-4 w-4 text-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">{t("totals") || "Totals"}</h3>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-4 space-y-3">
                      {/* Subtotal */}
                      <div id="field-subtotal" className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">{t("subtotal") || "Subtotal"}</Label>
                          {isModified("totals.subtotal") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          {isModified("totals.subtotal") && (
                            <span className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.totals?.subtotal)}</span>
                          )}
                          <Input value={editableData.totals?.subtotal ?? ""} onChange={(e) => onFieldChange("totals.subtotal", e.target.value === "" ? null : Number(e.target.value))} className="h-8 w-36 text-sm text-right" placeholder="0.00" />
                        </div>
                      </div>
                      {/* Tax */}
                      <div id="field-tax" className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">{t("tax") || "Tax"}</Label>
                          {isModified("totals.tax") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          {isModified("totals.tax") && (
                            <span className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.totals?.tax)}</span>
                          )}
                          <Input value={editableData.totals?.tax ?? ""} onChange={(e) => onFieldChange("totals.tax", e.target.value === "" ? null : Number(e.target.value))} className="h-8 w-36 text-sm text-right" placeholder="0.00" />
                        </div>
                      </div>
                      {/* Discount */}
                      <div id="field-discount" className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">{t("discount") || "Discount"}</Label>
                          {isModified("totals.discount") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          {isModified("totals.discount") && (
                            <span className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.totals?.discount)}</span>
                          )}
                          <Input value={editableData.totals?.discount ?? ""} onChange={(e) => onFieldChange("totals.discount", e.target.value === "" ? null : Number(e.target.value))} className="h-8 w-36 text-sm text-right" placeholder="0.00" />
                        </div>
                      </div>
                      <Separator />
                      {/* Grand Total */}
                      <div id="field-grand_total" className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-semibold text-foreground">{t("grandTotal") || "Grand Total"}</Label>
                          <ConfidenceBadge score={fc?.grand_total} />
                          {isModified("totals.grand_total") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          {isModified("totals.grand_total") && (
                            <span className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.totals?.grand_total)}</span>
                          )}
                          <Input value={editableData.totals?.grand_total ?? ""} onChange={(e) => onFieldChange("totals.grand_total", e.target.value === "" ? null : Number(e.target.value))} className="h-9 w-36 text-sm text-right font-bold border-emerald-300 focus:border-emerald-500" placeholder="0.00" />
                        </div>
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* ── Payment & Notes ───────────────────────────────── */}
                  <section>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div id="field-payment_method" className={`space-y-1.5 p-2.5 rounded-lg border transition-colors ${isModified("payment_method") ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10" : "border-transparent"}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            {t("paymentMethod") || "Payment Method"}
                            <ConfidenceBadge score={fc?.payment_method} />
                          </Label>
                          {isModified("payment_method") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        {isModified("payment_method") && (
                          <p className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.payment_method)}</p>
                        )}
                        <Input value={editableData.payment_method || ""} onChange={(e) => onFieldChange("payment_method", e.target.value)} placeholder="e.g. Bank Transfer" className="h-9 text-sm" />
                      </div>
                      <div id="field-notes" className={`space-y-1.5 p-2.5 rounded-lg border transition-colors ${isModified("notes") ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10" : "border-transparent"}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <StickyNote className="h-3 w-3" />
                            {t("notes") || "Notes"}
                            <ConfidenceBadge score={fc?.notes} />
                          </Label>
                          {isModified("notes") && <Badge variant="outline" className="text-[9px] py-0 h-4 text-blue-600 border-blue-300">{t("modified") || "Modified"}</Badge>}
                        </div>
                        {isModified("notes") && (
                          <p className="text-[10px] text-muted-foreground line-through">{displayValue(originalData.notes)}</p>
                        )}
                        <Input value={editableData.notes || ""} onChange={(e) => onFieldChange("notes", e.target.value)} placeholder="Any additional notes" className="h-9 text-sm" />
                      </div>
                    </div>
                  </section>

                  <div className="h-4" />
                </div>
              </ScrollArea>
            )}

            {/* ── Bottom Save Bar ──────────────────────────────────────── */}
            <div className="px-4 py-3 border-t bg-card flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {invoiceId ? (
                  <>
                    <span>{t("changesLocalUntilSave") || "Changes are local until saved"}</span>
                    {changeCount > 0 && (
                      <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">
                        {changeCount} {t("changes") || "changes"}
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-yellow-600">{t("noInvoiceIdSaved") || "Invoice not created yet"}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onCancel} className="text-xs">
                  {t("cancel") || "Cancel"}
                </Button>
                <Button
                  size="sm"
                  onClick={onSave}
                  disabled={!invoiceId || isSaving}
                  className="bg-[#10B981] hover:bg-[#10B981]/90 text-white gap-1.5 text-xs"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {isSaving ? (t("saving") || "Saving...") : (t("saveInvoice") || "Save Invoice")}
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
