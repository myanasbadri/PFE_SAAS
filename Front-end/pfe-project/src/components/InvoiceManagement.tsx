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
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Download,
  FileText,
  FileSpreadsheet,
  Plus,
  Loader2,
  Building2,
  User,
  Hash,
  CalendarDays,
  Clock,
  CreditCard,
  StickyNote,
  Package,
  Receipt,
  Trash2,
  X,
  ChevronDown,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  XCircle,
  Pencil,
  History,
  AlertTriangle,
  MoreHorizontal,
  CheckCircle2,
  XCircle as XCircleIcon,
  ClockIcon,
  Eye,
  DollarSign,
  Ban,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import jsPDF from "jspdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import {
  getInvoices,
  getInvoiceFilters,
  getInvoiceById,
  createInvoice as apiCreateInvoice,
  updateInvoice as apiUpdateInvoice,
  deleteInvoice as apiDeleteInvoice,
  getInvoiceHistory,
  exportAllInvoicesExcel,
  exportInvoiceExcel,
  ApiError,
  type Invoice,
  type InvoiceSearchParams,
  type InvoiceHistoryEntry,
} from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

// ── Types ───────────────────────────────────────────────────────────────────

type InvoiceStatus = "completed" | "processing" | "failed" | "reviewed" | "paid" | "unpaid" | "pending";

type ComplianceStatus = "compliant" | "non_compliant" | "pending_review";

interface DisplayInvoice {
  _key: string;
  id: string;
  supplier: string;
  amount: string;
  amountRaw: number;
  currency: string;
  date: string;
  status: InvoiceStatus;
  complianceStatus?: ComplianceStatus;
  sourceFormat?: string;
}

interface LineItemForm {
  description: string;
  quantity: string;
  unit_price: string;
  total: string;
}

const emptyLineItem = (): LineItemForm => ({
  description: "",
  quantity: "",
  unit_price: "",
  total: "",
});

interface InvoiceForm {
  vendor_name: string;
  invoice_no: string;
  date: string;
  due_date: string;
  currency: string;
  bill_to_name: string;
  bill_to_email: string;
  bill_to_address: string;
  line_items: LineItemForm[];
  subtotal: string;
  tax: string;
  discount: string;
  grand_total: string;
  payment_method: string;
  notes: string;
}

const emptyForm = (): InvoiceForm => ({
  vendor_name: "",
  invoice_no: "",
  date: "",
  due_date: "",
  currency: "USD",
  bill_to_name: "",
  bill_to_email: "",
  bill_to_address: "",
  line_items: [emptyLineItem()],
  subtotal: "",
  tax: "",
  discount: "",
  grand_total: "",
  payment_method: "",
  notes: "",
});

// ── Component ───────────────────────────────────────────────────────────────

export const InvoiceManagement = () => {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<DisplayInvoice[]>([]);
  const [rawInvoices, setRawInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [form, setForm] = useState<InvoiceForm>(emptyForm());

  // ── Edit State ───────────────────────────────────────────────────────
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editForm, setEditForm] = useState<InvoiceForm>(emptyForm());

  // ── Delete State ───────���─────────────────────────────────��───────────
  const [deleteTarget, setDeleteTarget] = useState<DisplayInvoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── History State ────────────────────────────────────────────────────
  const [historyInvoice, setHistoryInvoice] = useState<DisplayInvoice | null>(null);
  const [historyEntries, setHistoryEntries] = useState<InvoiceHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Search & Filter State ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // ── Pagination ────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // ── Filter Options (fetched from backend) ─────────────────────────────
  const [vendorOptions, setVendorOptions] = useState<string[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);

  // ── Debounce search input ─────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Load filter options on mount ──────────────────────────────────────
  useEffect(() => {
    getInvoiceFilters()
      .then((res) => {
        setVendorOptions(res.vendors);
        setCurrencyOptions(res.currencies);
        setStatusOptions(res.statuses);
      })
      .catch(() => {});
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: InvoiceSearchParams = {
        page: currentPage,
        limit: pageSize,
        sort_by: sortBy,
        order: sortOrder,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterStatus) params.status = filterStatus;
      if (filterVendor) params.vendor = filterVendor;
      if (filterCurrency) params.currency = filterCurrency;
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;
      if (filterAmountMin) params.amount_min = filterAmountMin;
      if (filterAmountMax) params.amount_max = filterAmountMax;

      const res = await getInvoices(params);
      setRawInvoices(res.invoices);
      setTotalPages(res.pages);
      setTotalCount(res.total);

      const mapped: DisplayInvoice[] = res.invoices.map((inv) => {
        const grandTotal = inv.data?.totals?.grand_total;
        const currency = inv.data?.totals?.currency || "USD";
        return {
          _key: inv.id,
          id: inv.data?.invoice_no || inv.id.slice(0, 8),
          supplier:
            inv.data?.vendor_name || inv.original_filename || "Unknown",
          amount:
            grandTotal != null
              ? `${Number(grandTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${currency}`
              : "N/A",
          amountRaw: grandTotal != null ? Number(grandTotal) : 0,
          currency,
          date: inv.data?.date || inv.created_at?.slice(0, 10) || "",
          status: inv.status as DisplayInvoice["status"],
          complianceStatus: inv.compliance_status as ComplianceStatus | undefined,
          sourceFormat: inv.source_format,
        };
      });
      setInvoices(mapped);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    sortBy,
    sortOrder,
    debouncedSearch,
    filterStatus,
    filterVendor,
    filterCurrency,
    filterDateFrom,
    filterDateTo,
    filterAmountMin,
    filterAmountMax,
  ]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // ── Active filter count ───────────────────────────────────────────────
  const activeFilterCount = [
    filterStatus,
    filterVendor,
    filterCurrency,
    filterDateFrom,
    filterDateTo,
    filterAmountMin,
    filterAmountMax,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setFilterStatus("");
    setFilterVendor("");
    setFilterCurrency("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterAmountMin("");
    setFilterAmountMax("");
    setSortBy("created_at");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  // ── Sort toggle ───────────────────────────────────────────────────────
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field)
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-[#10B981]" />
    ) : (
      <ArrowDown className="h-3 w-3 text-[#10B981]" />
    );
  };

  // ── PDF export (professional layout) ───────────────────────────────────

  const exportToPDF = (invoice: DisplayInvoice) => {
    const raw = rawInvoices.find((r) => r.id === invoice._key);
    const data = raw?.data || {};
    const totals = data.totals || {};
    const billTo = data.bill_to || {};
    const lineItems = data.line_items || [];
    const currency = totals.currency || "USD";

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 0;

    doc.setFillColor(10, 37, 64);
    doc.rect(0, 0, pageW, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("SmartInvoice AI", 16, 24);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("AI-Powered Invoice Management", pageW - 16, 24, {
      align: "right",
    });

    y = 54;
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 16, y);

    doc.setFontSize(9);
    const statusText = (raw?.status || invoice.status).toUpperCase();
    const statusW = doc.getTextWidth(statusText) + 10;
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(pageW - 16 - statusW, y - 8, statusW, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(statusText, pageW - 16 - statusW / 2, y - 1, { align: "center" });

    y = 68;
    doc.setTextColor(10, 37, 64);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Invoice Details", 16, y);
    doc.text("Bill To", 120, y);

    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);

    const leftDetails = [
      ["Invoice #:", data.invoice_no || "N/A"],
      ["Date:", data.date || "N/A"],
      ["Due Date:", data.due_date || "N/A"],
      ["Vendor:", data.vendor_name || "N/A"],
      ["Payment:", data.payment_method || "N/A"],
    ];
    leftDetails.forEach(([label, val]) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 16, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(val), 50, y);
      y += 6;
    });

    let yRight = 74;
    const rightDetails = [
      billTo.name || "N/A",
      billTo.address || "",
      billTo.email || "",
    ];
    rightDetails.forEach((line) => {
      if (line) {
        doc.text(String(line), 120, yRight);
        yRight += 6;
      }
    });

    y = Math.max(y, yRight) + 6;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(16, y, pageW - 16, y);
    y += 8;

    const colX = [16, 100, 126, 154, 180];
    const colLabels = ["Description", "Qty", "Unit Price", "Total"];

    doc.setFillColor(10, 37, 64);
    doc.rect(14, y - 5, pageW - 28, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(colLabels[0], colX[0], y);
    doc.text(colLabels[1], colX[1], y, { align: "right" });
    doc.text(colLabels[2], colX[2] + 20, y, { align: "right" });
    doc.text(colLabels[3], colX[3] + 20, y, { align: "right" });
    y += 8;

    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    lineItems.forEach((item, i) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      const isEven = i % 2 === 0;
      if (isEven) {
        doc.setFillColor(248, 249, 250);
        doc.rect(14, y - 4, pageW - 28, 8, "F");
      }
      const desc = String(item.description || "");
      doc.text(
        desc.length > 50 ? desc.slice(0, 50) + "..." : desc,
        colX[0],
        y,
      );
      doc.text(
        item.quantity != null ? String(item.quantity) : "-",
        colX[1],
        y,
        { align: "right" },
      );
      doc.text(
        item.unit_price != null ? Number(item.unit_price).toFixed(2) : "-",
        colX[2] + 20,
        y,
        { align: "right" },
      );
      doc.text(
        item.total != null ? Number(item.total).toFixed(2) : "-",
        colX[3] + 20,
        y,
        { align: "right" },
      );
      y += 8;
    });

    if (lineItems.length === 0) {
      doc.setTextColor(160, 160, 160);
      doc.text("No line items", 16, y);
      y += 8;
    }

    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.line(130, y, pageW - 16, y);
    y += 8;

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    const totalsRows = [
      ["Subtotal:", totals.subtotal],
      ["Tax:", totals.tax],
      ["Discount:", totals.discount],
    ];
    totalsRows.forEach(([label, val]) => {
      doc.setFont("helvetica", "normal");
      doc.text(String(label), 140, y);
      doc.text(
        val != null ? `${Number(val).toFixed(2)} ${currency}` : "-",
        pageW - 16,
        y,
        { align: "right" },
      );
      y += 7;
    });

    y += 2;
    doc.setFillColor(16, 185, 129);
    doc.rect(128, y - 5, pageW - 128 - 14, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("GRAND TOTAL:", 140, y + 2);
    const gtText =
      totals.grand_total != null
        ? `${Number(totals.grand_total).toFixed(2)} ${currency}`
        : "N/A";
    doc.text(gtText, pageW - 16, y + 2, { align: "right" });

    if (data.notes) {
      y += 18;
      doc.setTextColor(10, 37, 64);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", 16, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const noteLines = doc.splitTextToSize(String(data.notes), pageW - 32);
      doc.text(noteLines, 16, y);
    }

    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(10, 37, 64);
    doc.rect(0, pageH - 18, pageW, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Generated by SmartInvoice AI", pageW / 2, pageH - 8, {
      align: "center",
    });

    doc.save(`invoice_${invoice.id}.pdf`);
    toast.success(`Invoice ${invoice.id} exported as PDF`);
  };

  // ── Excel export ──────────────────────────────────────────────────────

  const exportToExcel = async (invoice: DisplayInvoice) => {
    try {
      await exportInvoiceExcel(invoice._key);
      toast.success(`Invoice ${invoice.id} exported as Excel`);
    } catch {
      toast.error("Failed to export Excel.");
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      await exportAllInvoicesExcel();
      toast.success("All invoices exported as Excel");
    } catch {
      toast.error("Failed to export.");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Form helpers ──────────────────────────────────────────────────────

  const updateField = (field: keyof InvoiceForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLineItem = (
    idx: number,
    field: keyof LineItemForm,
    value: string,
  ) => {
    setForm((prev) => {
      const items = [...prev.line_items];
      items[idx] = { ...items[idx], [field]: value };

      if (field === "quantity" || field === "unit_price") {
        const qty = parseFloat(
          field === "quantity" ? value : items[idx].quantity,
        );
        const price = parseFloat(
          field === "unit_price" ? value : items[idx].unit_price,
        );
        if (!isNaN(qty) && !isNaN(price)) {
          items[idx].total = (qty * price).toFixed(2);
        }
      }

      const subtotal = items.reduce((sum, it) => {
        const v = parseFloat(it.total);
        return sum + (isNaN(v) ? 0 : v);
      }, 0);
      const tax = parseFloat(prev.tax) || 0;
      const discount = parseFloat(prev.discount) || 0;

      return {
        ...prev,
        line_items: items,
        subtotal: subtotal > 0 ? subtotal.toFixed(2) : "",
        grand_total:
          subtotal > 0 ? (subtotal + tax - discount).toFixed(2) : "",
      };
    });
  };

  const addLineItem = () => {
    setForm((prev) => ({
      ...prev,
      line_items: [...prev.line_items, emptyLineItem()],
    }));
  };

  const removeLineItem = (idx: number) => {
    setForm((prev) => {
      const items = prev.line_items.filter((_, i) => i !== idx);
      if (items.length === 0) items.push(emptyLineItem());

      const subtotal = items.reduce((sum, it) => {
        const v = parseFloat(it.total);
        return sum + (isNaN(v) ? 0 : v);
      }, 0);
      const tax = parseFloat(prev.tax) || 0;
      const discount = parseFloat(prev.discount) || 0;

      return {
        ...prev,
        line_items: items,
        subtotal: subtotal > 0 ? subtotal.toFixed(2) : "",
        grand_total:
          subtotal > 0 ? (subtotal + tax - discount).toFixed(2) : "",
      };
    });
  };

  const updateTotalsField = (field: "tax" | "discount", value: string) => {
    setForm((prev) => {
      const subtotal = parseFloat(prev.subtotal) || 0;
      const tax = parseFloat(field === "tax" ? value : prev.tax) || 0;
      const discount =
        parseFloat(field === "discount" ? value : prev.discount) || 0;
      return {
        ...prev,
        [field]: value,
        grand_total:
          subtotal > 0 ? (subtotal + tax - discount).toFixed(2) : "",
      };
    });
  };

  // ── Create invoice ────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.vendor_name.trim() && !form.invoice_no.trim()) {
      toast.error("Enter at least a vendor name or invoice number");
      return;
    }

    setIsSaving(true);
    try {
      const toNum = (v: string) => {
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      };

      await apiCreateInvoice({
        vendor_name: form.vendor_name || undefined,
        invoice_no: form.invoice_no || undefined,
        date: form.date || undefined,
        due_date: form.due_date || undefined,
        bill_to: {
          name: form.bill_to_name || undefined,
          address: form.bill_to_address || undefined,
          email: form.bill_to_email || undefined,
        },
        line_items: form.line_items
          .filter((it) => it.description.trim())
          .map((it) => ({
            description: it.description,
            quantity: toNum(it.quantity),
            unit_price: toNum(it.unit_price),
            total: toNum(it.total),
          })),
        totals: {
          subtotal: toNum(form.subtotal),
          tax: toNum(form.tax),
          discount: toNum(form.discount),
          grand_total: toNum(form.grand_total),
          currency: form.currency || undefined,
        },
        payment_method: form.payment_method || undefined,
        notes: form.notes || undefined,
      });

      toast.success("Invoice created successfully!");
      setForm(emptyForm());
      setIsDialogOpen(false);
      fetchInvoices();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to create invoice.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ── Open Edit Dialog ──────────────────────────────────────────────────

  const openEditDialog = async (invoice: DisplayInvoice) => {
    try {
      const res = await getInvoiceById(invoice._key);
      const inv = res.invoice;
      const d = inv.data || {};
      const t = d.totals || {};
      const b = d.bill_to || {};

      setEditingInvoiceId(invoice._key);
      setEditForm({
        vendor_name: d.vendor_name || "",
        invoice_no: d.invoice_no || "",
        date: d.date || "",
        due_date: d.due_date || "",
        currency: t.currency || "USD",
        bill_to_name: b.name || "",
        bill_to_email: b.email || "",
        bill_to_address: b.address || "",
        line_items:
          d.line_items && d.line_items.length > 0
            ? d.line_items.map((li) => ({
                description: li.description || "",
                quantity: li.quantity != null ? String(li.quantity) : "",
                unit_price: li.unit_price != null ? String(li.unit_price) : "",
                total: li.total != null ? String(li.total) : "",
              }))
            : [emptyLineItem()],
        subtotal: t.subtotal != null ? String(t.subtotal) : "",
        tax: t.tax != null ? String(t.tax) : "",
        discount: t.discount != null ? String(t.discount) : "",
        grand_total: t.grand_total != null ? String(t.grand_total) : "",
        payment_method: d.payment_method || "",
        notes: d.notes || "",
      });
      setIsEditDialogOpen(true);
    } catch {
      toast.error("Failed to load invoice details");
    }
  };

  // ── Save Edit ──────────────────────────────────────────────────────────

  const handleEditSave = async () => {
    if (!editingInvoiceId) return;
    setIsEditSaving(true);
    try {
      const toNum = (v: string) => {
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      };

      await apiUpdateInvoice(editingInvoiceId, {
        data: {
          vendor_name: editForm.vendor_name || null,
          invoice_no: editForm.invoice_no || null,
          date: editForm.date || null,
          due_date: editForm.due_date || null,
          bill_to: {
            name: editForm.bill_to_name || null,
            address: editForm.bill_to_address || null,
            email: editForm.bill_to_email || null,
          },
          line_items: editForm.line_items
            .filter((it) => it.description.trim())
            .map((it) => ({
              description: it.description,
              quantity: toNum(it.quantity),
              unit_price: toNum(it.unit_price),
              total: toNum(it.total),
            })),
          totals: {
            subtotal: toNum(editForm.subtotal),
            tax: toNum(editForm.tax),
            discount: toNum(editForm.discount),
            grand_total: toNum(editForm.grand_total),
            currency: editForm.currency || null,
          },
          payment_method: editForm.payment_method || null,
          notes: editForm.notes || null,
        },
      });

      toast.success("Invoice updated successfully!");
      setIsEditDialogOpen(false);
      setEditingInvoiceId(null);
      fetchInvoices();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to update invoice.");
    } finally {
      setIsEditSaving(false);
    }
  };

  // ── Edit form helpers (mirror create form helpers) ─────────────────────

  const updateEditField = (field: keyof InvoiceForm, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateEditLineItem = (idx: number, field: keyof LineItemForm, value: string) => {
    setEditForm((prev) => {
      const items = [...prev.line_items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === "quantity" || field === "unit_price") {
        const qty = parseFloat(field === "quantity" ? value : items[idx].quantity);
        const price = parseFloat(field === "unit_price" ? value : items[idx].unit_price);
        if (!isNaN(qty) && !isNaN(price)) items[idx].total = (qty * price).toFixed(2);
      }
      const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.total) || 0), 0);
      const tax = parseFloat(prev.tax) || 0;
      const discount = parseFloat(prev.discount) || 0;
      return {
        ...prev,
        line_items: items,
        subtotal: subtotal > 0 ? subtotal.toFixed(2) : "",
        grand_total: subtotal > 0 ? (subtotal + tax - discount).toFixed(2) : "",
      };
    });
  };

  const addEditLineItem = () => {
    setEditForm((prev) => ({ ...prev, line_items: [...prev.line_items, emptyLineItem()] }));
  };

  const removeEditLineItem = (idx: number) => {
    setEditForm((prev) => {
      const items = prev.line_items.filter((_, i) => i !== idx);
      if (items.length === 0) items.push(emptyLineItem());
      const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.total) || 0), 0);
      const tax = parseFloat(prev.tax) || 0;
      const discount = parseFloat(prev.discount) || 0;
      return {
        ...prev,
        line_items: items,
        subtotal: subtotal > 0 ? subtotal.toFixed(2) : "",
        grand_total: subtotal > 0 ? (subtotal + tax - discount).toFixed(2) : "",
      };
    });
  };

  const updateEditTotalsField = (field: "tax" | "discount", value: string) => {
    setEditForm((prev) => {
      const subtotal = parseFloat(prev.subtotal) || 0;
      const tax = parseFloat(field === "tax" ? value : prev.tax) || 0;
      const discount = parseFloat(field === "discount" ? value : prev.discount) || 0;
      return { ...prev, [field]: value, grand_total: subtotal > 0 ? (subtotal + tax - discount).toFixed(2) : "" };
    });
  };

  // ── Delete ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiDeleteInvoice(deleteTarget._key);
      toast.success(`Invoice ${deleteTarget.id} deleted`);
      setDeleteTarget(null);
      fetchInvoices();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to delete invoice.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Status Change ─────────────────────────────────────────────────────

  const handleStatusChange = async (invoiceKey: string, newStatus: string) => {
    try {
      await apiUpdateInvoice(invoiceKey, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      fetchInvoices();
    } catch {
      toast.error("Failed to update status");
    }
  };

  // ── History ───────────────────────────────────────────────────────────

  const openHistory = async (invoice: DisplayInvoice) => {
    setHistoryInvoice(invoice);
    setHistoryLoading(true);
    try {
      const res = await getInvoiceHistory(invoice._key);
      setHistoryEntries(res.history);
    } catch {
      toast.error("Failed to load history");
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "upload": return "Created / Uploaded";
      case "update_invoice": return "Updated";
      case "view_invoice": return "Viewed";
      case "delete_invoice": return "Deleted";
      case "export": return "Exported";
      default: return action.replace(/_/g, " ");
    }
  };

  // ── Status color ──────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "reviewed":
        return "bg-[#10B981] hover:bg-[#10B981]/90 text-white";
      case "paid":
        return "bg-blue-600 hover:bg-blue-600/90 text-white";
      case "processing":
        return "bg-yellow-500 hover:bg-yellow-500/90 text-white";
      case "pending":
        return "bg-orange-500 hover:bg-orange-500/90 text-white";
      case "unpaid":
        return "bg-red-600 hover:bg-red-600/90 text-white";
      case "failed":
        return "bg-red-500 hover:bg-red-500/90 text-white";
      default:
        return "bg-gray-500 hover:bg-gray-500/90 text-white";
    }
  };

  const ALL_STATUSES: InvoiceStatus[] = ["pending", "unpaid", "paid", "processing", "completed", "reviewed", "failed"];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid": return <DollarSign className="h-3 w-3" />;
      case "unpaid": return <Ban className="h-3 w-3" />;
      case "pending": return <ClockIcon className="h-3 w-3" />;
      case "completed": return <CheckCircle2 className="h-3 w-3" />;
      case "reviewed": return <Eye className="h-3 w-3" />;
      case "processing": return <Loader2 className="h-3 w-3 animate-spin" />;
      case "failed": return <XCircleIcon className="h-3 w-3" />;
      default: return null;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            {t("invoiceManagement")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and export your invoices with AI-powered tools
          </p>
        </div>

        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <Button
              variant="outline"
              onClick={handleExportAll}
              disabled={isExporting}
              className="gap-2 border-[#0A2540] text-foreground hover:bg-[#0A2540]/5"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              {t("exportAllExcel")}
            </Button>
          )}

          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setForm(emptyForm());
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-[#10B981] hover:bg-[#10B981]/90 text-white gap-2">
                <Plus className="h-4 w-4" />
                {t("createInvoice")}
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 gap-0">
              <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#0A2540] to-[#10B981] flex items-center justify-center">
                    <Receipt className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg text-foreground">
                      {t("createInvoice")}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Fill in the details to create a new invoice manually
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[calc(90vh-180px)]">
                <div className="px-6 py-5 space-y-6">
                  {/* Invoice Details */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Hash className="h-4 w-4 text-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Invoice Details
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Invoice Number
                        </Label>
                        <Input
                          value={form.invoice_no}
                          onChange={(e) =>
                            updateField("invoice_no", e.target.value)
                          }
                          placeholder="e.g. INV-001"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Currency
                        </Label>
                        <Input
                          value={form.currency}
                          onChange={(e) =>
                            updateField("currency", e.target.value)
                          }
                          placeholder="USD"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          Invoice Date
                        </Label>
                        <Input
                          type="date"
                          value={form.date}
                          onChange={(e) => updateField("date", e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Due Date
                        </Label>
                        <Input
                          type="date"
                          value={form.due_date}
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
                      <Label className="text-xs text-muted-foreground">
                        Vendor / Supplier Name
                      </Label>
                      <Input
                        value={form.vendor_name}
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
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Name
                        </Label>
                        <Input
                          value={form.bill_to_name}
                          onChange={(e) =>
                            updateField("bill_to_name", e.target.value)
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
                          value={form.bill_to_email}
                          onChange={(e) =>
                            updateField("bill_to_email", e.target.value)
                          }
                          placeholder="customer@example.com"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Address
                        </Label>
                        <Input
                          value={form.bill_to_address}
                          onChange={(e) =>
                            updateField("bill_to_address", e.target.value)
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
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addLineItem}
                        className="h-7 text-xs gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add Item
                      </Button>
                    </div>

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
                            <TableHead className="w-[36px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {form.line_items.map((item, idx) => (
                            <TableRow key={idx} className="group">
                              <TableCell className="py-1.5">
                                <Input
                                  value={item.description}
                                  onChange={(e) =>
                                    updateLineItem(
                                      idx,
                                      "description",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Item description"
                                  className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded"
                                />
                              </TableCell>
                              <TableCell className="py-1.5">
                                <Input
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateLineItem(
                                      idx,
                                      "quantity",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="0"
                                  className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded"
                                />
                              </TableCell>
                              <TableCell className="py-1.5">
                                <Input
                                  value={item.unit_price}
                                  onChange={(e) =>
                                    updateLineItem(
                                      idx,
                                      "unit_price",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="0.00"
                                  className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded"
                                />
                              </TableCell>
                              <TableCell className="py-1.5">
                                <Input
                                  value={item.total}
                                  onChange={(e) =>
                                    updateLineItem(idx, "total", e.target.value)
                                  }
                                  placeholder="0.00"
                                  className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded font-medium"
                                />
                              </TableCell>
                              <TableCell className="py-1.5 px-1">
                                <Button
                                  type="button"
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
                          value={form.subtotal}
                          onChange={(e) =>
                            updateField("subtotal", e.target.value)
                          }
                          placeholder="0.00"
                          className="h-8 w-36 text-sm text-right"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Tax
                        </Label>
                        <Input
                          value={form.tax}
                          onChange={(e) =>
                            updateTotalsField("tax", e.target.value)
                          }
                          placeholder="0.00"
                          className="h-8 w-36 text-sm text-right"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Discount
                        </Label>
                        <Input
                          value={form.discount}
                          onChange={(e) =>
                            updateTotalsField("discount", e.target.value)
                          }
                          placeholder="0.00"
                          className="h-8 w-36 text-sm text-right"
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-foreground">
                          Grand Total
                        </Label>
                        <Input
                          value={form.grand_total}
                          onChange={(e) =>
                            updateField("grand_total", e.target.value)
                          }
                          placeholder="0.00"
                          className="h-9 w-36 text-sm text-right font-bold border-[#10B981]/30 focus:border-[#10B981]"
                        />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Payment & Notes */}
                  <section>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          Payment Method
                        </Label>
                        <Input
                          value={form.payment_method}
                          onChange={(e) =>
                            updateField("payment_method", e.target.value)
                          }
                          placeholder="e.g. Bank Transfer, Credit Card"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <StickyNote className="h-3 w-3" />
                          Notes
                        </Label>
                        <Textarea
                          value={form.notes}
                          onChange={(e) => updateField("notes", e.target.value)}
                          placeholder="Any additional notes or terms"
                          className="text-sm min-h-9 resize-none"
                          rows={1}
                        />
                      </div>
                    </div>
                  </section>
                </div>
              </ScrollArea>

              <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
                  className="text-muted-foreground gap-1.5"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isSaving}
                  className="bg-[#10B981] hover:bg-[#10B981]/90 text-white gap-2 min-w-[140px]"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {isSaving ? "Creating..." : t("createInvoice")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Search & Filters Card ────────────────────────────────────────── */}
      <Card className="bg-card">
        <CardContent className="p-4">
          {/* Search bar row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoices by vendor, invoice number, notes..."
                className="pl-9 h-10 bg-muted/50 border-border focus-visible:ring-[#10B981]/30 focus-visible:border-[#10B981]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>

            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className={`gap-2 h-10 ${showFilters ? "bg-[#0A2540] hover:bg-[#0A2540]/90 text-white" : ""}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge className="bg-[#10B981] text-white h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            {(activeFilterCount > 0 || debouncedSearch) && (
              <Button
                variant="ghost"
                onClick={clearAllFilters}
                className="gap-1.5 text-muted-foreground hover:text-red-500 h-10 text-sm"
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </Button>
            )}
          </div>

          {/* Filter panel (collapsible) */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">
                    Status
                  </Label>
                  <Select
                    value={filterStatus}
                    onValueChange={(v) => {
                      setFilterStatus(v === "all" ? "" : v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Vendor */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">
                    Vendor
                  </Label>
                  <Select
                    value={filterVendor}
                    onValueChange={(v) => {
                      setFilterVendor(v === "all" ? "" : v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="All vendors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All vendors</SelectItem>
                      {vendorOptions.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Currency */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">
                    Currency
                  </Label>
                  <Select
                    value={filterCurrency}
                    onValueChange={(v) => {
                      setFilterCurrency(v === "all" ? "" : v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="All currencies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All currencies</SelectItem>
                      {currencyOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">
                    Sort by
                  </Label>
                  <Select
                    value={sortBy}
                    onValueChange={(v) => {
                      setSortBy(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Date added</SelectItem>
                      <SelectItem value="date">Invoice date</SelectItem>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">
                    Date from
                  </Label>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => {
                      setFilterDateFrom(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Date To */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">
                    Date to
                  </Label>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => {
                      setFilterDateTo(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Amount Min */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">
                    Min amount
                  </Label>
                  <Input
                    type="number"
                    value={filterAmountMin}
                    onChange={(e) => {
                      setFilterAmountMin(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="0"
                    className="h-9 text-sm"
                  />
                </div>

                {/* Amount Max */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">
                    Max amount
                  </Label>
                  <Input
                    type="number"
                    value={filterAmountMax}
                    onChange={(e) => {
                      setFilterAmountMax(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="999999"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Active filters summary */}
          {(debouncedSearch || activeFilterCount > 0) && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {totalCount} result{totalCount !== 1 ? "s" : ""}
              </span>
              {debouncedSearch && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
                  onClick={() => setSearchQuery("")}
                >
                  Search: &quot;{debouncedSearch}&quot;
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterStatus && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
                  onClick={() => setFilterStatus("")}
                >
                  Status: {filterStatus}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterVendor && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
                  onClick={() => setFilterVendor("")}
                >
                  Vendor: {filterVendor}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterCurrency && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
                  onClick={() => setFilterCurrency("")}
                >
                  Currency: {filterCurrency}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterDateFrom && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
                  onClick={() => setFilterDateFrom("")}
                >
                  From: {filterDateFrom}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterDateTo && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
                  onClick={() => setFilterDateTo("")}
                >
                  To: {filterDateTo}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterAmountMin && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
                  onClick={() => setFilterAmountMin("")}
                >
                  Min: ${filterAmountMin}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterAmountMax && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
                  onClick={() => setFilterAmountMax("")}
                >
                  Max: ${filterAmountMax}
                  <X className="h-3 w-3" />
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Invoice Table ────────────────────────────────────────────────── */}
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">
              {t("allInvoices")}
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {totalCount} invoice{totalCount !== 1 ? "s" : ""}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              {debouncedSearch || activeFilterCount > 0 ? (
                <div>
                  <p className="font-medium">No invoices match your filters</p>
                  <p className="text-sm mt-1">
                    Try adjusting your search or filters
                  </p>
                  <Button
                    variant="outline"
                    onClick={clearAllFilters}
                    className="mt-4 gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <p>
                  No invoices yet. Upload a file in AI Extraction or create one
                  manually.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          onClick={() => handleSort("created_at")}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          {t("invoiceNumber")}
                          <SortIcon field="created_at" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort("vendor")}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          {t("supplier")}
                          <SortIcon field="vendor" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort("amount")}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          {t("amount")}
                          <SortIcon field="amount" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort("date")}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          {t("date")}
                          <SortIcon field="date" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort("status")}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          {t("status")}
                          <SortIcon field="status" />
                        </button>
                      </TableHead>
                      <TableHead>
                        {t("compliance") || "Compliance"}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow
                        key={invoice._key}
                        className="hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-foreground" />
                            <span className="font-medium">{invoice.id}</span>
                          </div>
                        </TableCell>
                        <TableCell>{invoice.supplier}</TableCell>
                        <TableCell className="font-semibold">
                          {invoice.amount}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {invoice.date}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center gap-1.5 cursor-pointer">
                                <Badge className={`${getStatusColor(invoice.status)} gap-1`}>
                                  {getStatusIcon(invoice.status)}
                                  {invoice.status}
                                </Badge>
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[140px]">
                              {ALL_STATUSES.map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  onClick={() => handleStatusChange(invoice._key, s)}
                                  className={`gap-2 cursor-pointer ${invoice.status === s ? "bg-muted" : ""}`}
                                >
                                  {getStatusIcon(s)}
                                  <span className="capitalize">{s}</span>
                                  {invoice.status === s && <CheckCircle2 className="h-3 w-3 ml-auto text-[#10B981]" />}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          {invoice.complianceStatus === "compliant" ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              {t("compliant") || "Compliant"}
                            </Badge>
                          ) : invoice.complianceStatus === "non_compliant" ? (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              {t("nonCompliant") || "Non-compliant"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <ShieldQuestion className="h-3 w-3" />
                              {t("pendingReview") || "Pending"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                              onClick={() => openEditDialog(invoice)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => openHistory(invoice)}
                              title="History"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => exportToPDF(invoice)}
                                  className="gap-2 cursor-pointer"
                                >
                                  <FileText className="h-4 w-4 text-red-500" />
                                  {t("exportPDF")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => exportToExcel(invoice)}
                                  className="gap-2 cursor-pointer"
                                >
                                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                  {t("exportExcel")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget(invoice)}
                                  className="gap-2 cursor-pointer text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* ── Pagination ────────────────────────────────────────── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({totalCount} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() =>
                        setCurrentPage((p) => Math.max(1, p - 1))
                      }
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    {/* Page number buttons */}
                    <div className="hidden sm:flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={page}
                            variant={
                              currentPage === page ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={`w-9 h-9 p-0 ${currentPage === page ? "bg-[#0A2540] hover:bg-[#0A2540]/90" : ""}`}
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="gap-1"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {/* ── Delete Confirmation Dialog ───────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Invoice
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.id}</span>
              {deleteTarget?.supplier ? ` from ${deleteTarget.supplier}` : ""}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── History Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!historyInvoice} onOpenChange={(open) => { if (!open) setHistoryInvoice(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#0A2540] to-[#10B981] flex items-center justify-center">
                <History className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg text-foreground">Invoice History</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {historyInvoice?.id} &mdash; {historyInvoice?.supplier}
                </p>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(80vh-120px)]">
            <div className="px-6 py-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : historyEntries.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-12">No history available</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4">
                    {historyEntries.map((entry) => (
                      <div key={entry.id} className="flex gap-3 relative">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center z-10 flex-shrink-0">
                          {entry.action === "upload" && <Plus className="h-3.5 w-3.5 text-[#10B981]" />}
                          {entry.action === "update_invoice" && <Pencil className="h-3.5 w-3.5 text-blue-500" />}
                          {entry.action === "view_invoice" && <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                          {entry.action === "delete_invoice" && <Trash2 className="h-3.5 w-3.5 text-red-500" />}
                          {entry.action === "export" && <Download className="h-3.5 w-3.5 text-purple-500" />}
                          {!["upload", "update_invoice", "view_invoice", "delete_invoice", "export"].includes(entry.action) && (
                            <History className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <p className="text-sm font-medium text-foreground">{getActionLabel(entry.action)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            by {entry.user_name} &mdash; {new Date(entry.timestamp).toLocaleString()}
                          </p>
                          {entry.ip_address && (
                            <p className="text-xs text-muted-foreground/60 mt-0.5">IP: {entry.ip_address}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Edit Invoice Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) { setEditingInvoiceId(null); setEditForm(emptyForm()); }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-[#10B981] flex items-center justify-center">
                <Pencil className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg text-foreground">Edit Invoice</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update the invoice details below
                </p>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-180px)]">
            <div className="px-6 py-5 space-y-6">
              {/* Invoice Details */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Hash className="h-4 w-4 text-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Invoice Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Invoice Number</Label>
                    <Input value={editForm.invoice_no} onChange={(e) => updateEditField("invoice_no", e.target.value)} placeholder="e.g. INV-001" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Currency</Label>
                    <Input value={editForm.currency} onChange={(e) => updateEditField("currency", e.target.value)} placeholder="USD" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Invoice Date
                    </Label>
                    <Input type="date" value={editForm.date} onChange={(e) => updateEditField("date", e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Due Date
                    </Label>
                    <Input type="date" value={editForm.due_date} onChange={(e) => updateEditField("due_date", e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </section>

              <Separator />

              {/* Vendor */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Vendor (From)</h3>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Vendor / Supplier Name</Label>
                  <Input value={editForm.vendor_name} onChange={(e) => updateEditField("vendor_name", e.target.value)} placeholder="Company name" className="h-9 text-sm" />
                </div>
              </section>

              <Separator />

              {/* Bill To */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Bill To (Customer)</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input value={editForm.bill_to_name} onChange={(e) => updateEditField("bill_to_name", e.target.value)} placeholder="Customer name" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input value={editForm.bill_to_email} onChange={(e) => updateEditField("bill_to_email", e.target.value)} placeholder="customer@example.com" className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <Input value={editForm.bill_to_address} onChange={(e) => updateEditField("bill_to_address", e.target.value)} placeholder="Full address" className="h-9 text-sm" />
                  </div>
                </div>
              </section>

              <Separator />

              {/* Line Items */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Line Items</h3>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addEditLineItem} className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" /> Add Item
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-medium">Description</TableHead>
                        <TableHead className="text-xs font-medium w-[80px] text-right">Qty</TableHead>
                        <TableHead className="text-xs font-medium w-[100px] text-right">Unit Price</TableHead>
                        <TableHead className="text-xs font-medium w-[100px] text-right">Total</TableHead>
                        <TableHead className="w-[36px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editForm.line_items.map((item, idx) => (
                        <TableRow key={idx} className="group">
                          <TableCell className="py-1.5">
                            <Input value={item.description} onChange={(e) => updateEditLineItem(idx, "description", e.target.value)} placeholder="Item description" className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded" />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Input value={item.quantity} onChange={(e) => updateEditLineItem(idx, "quantity", e.target.value)} placeholder="0" className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded" />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Input value={item.unit_price} onChange={(e) => updateEditLineItem(idx, "unit_price", e.target.value)} placeholder="0.00" className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded" />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Input value={item.total} onChange={(e) => updateEditLineItem(idx, "total", e.target.value)} placeholder="0.00" className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-0 focus-visible:bg-muted/30 focus-visible:px-2 rounded font-medium" />
                          </TableCell>
                          <TableCell className="py-1.5 px-1">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeEditLineItem(idx)}>
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <Separator />

              {/* Totals */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="h-4 w-4 text-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Totals</h3>
                </div>
                <div className="bg-muted/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Subtotal</Label>
                    <Input value={editForm.subtotal} onChange={(e) => updateEditField("subtotal", e.target.value)} placeholder="0.00" className="h-8 w-36 text-sm text-right" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Tax</Label>
                    <Input value={editForm.tax} onChange={(e) => updateEditTotalsField("tax", e.target.value)} placeholder="0.00" className="h-8 w-36 text-sm text-right" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Discount</Label>
                    <Input value={editForm.discount} onChange={(e) => updateEditTotalsField("discount", e.target.value)} placeholder="0.00" className="h-8 w-36 text-sm text-right" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-foreground">Grand Total</Label>
                    <Input value={editForm.grand_total} onChange={(e) => updateEditField("grand_total", e.target.value)} placeholder="0.00" className="h-9 w-36 text-sm text-right font-bold border-[#10B981]/30 focus:border-[#10B981]" />
                  </div>
                </div>
              </section>

              <Separator />

              {/* Payment & Notes */}
              <section>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Payment Method
                    </Label>
                    <Input value={editForm.payment_method} onChange={(e) => updateEditField("payment_method", e.target.value)} placeholder="e.g. Bank Transfer, Credit Card" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <StickyNote className="h-3 w-3" /> Notes
                    </Label>
                    <Textarea value={editForm.notes} onChange={(e) => updateEditField("notes", e.target.value)} placeholder="Any additional notes or terms" className="text-sm min-h-9 resize-none" rows={1} />
                  </div>
                </div>
              </section>
            </div>
          </ScrollArea>

          <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="text-muted-foreground gap-1.5">
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={isEditSaving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 min-w-[140px]">
              {isEditSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {isEditSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
