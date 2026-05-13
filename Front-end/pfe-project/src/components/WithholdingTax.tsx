"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Plus, Trash2, Upload, Download, Eye, EyeOff, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Calculator, FileSpreadsheet,
  Copy, ChevronDown, ChevronUp, Info, BarChart3, List,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { useLanguage } from "../contexts/LanguageContext";
import {
  tejGetRates, tejGenerate, tejCalculate, tejBatchCSV, tejExportPDF, tejValidate,
  tejSaveCertificate,
  type TEJRateInfo, type TEJDeclarationData, type TEJBeneficiary, type TEJOperation,
  type TEJGenerateResult, type TEJBatchResult, type TEJAddress, type TEJCertificate,
} from "@/lib/api";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const CertificateList = dynamic(() => import("./CertificateList"), { ssr: false });
const CertificateViewer = dynamic(() => import("./CertificateViewer"), { ssr: false });
const WithholdingDashboard = dynamic(() => import("./WithholdingDashboard"), { ssr: false });

// ── Helper Types ──────────────────────────────────────────────────────────

interface BeneficiaryFormState extends TEJBeneficiary {
  _key: string;
}

interface OperationFormState extends TEJOperation {
  _key: string;
}

const DECLARATION_TYPES = [
  { value: "MENSUELLE", en: "Monthly", fr: "Mensuelle", ar: "شهرية" },
  { value: "TRIMESTRIELLE", en: "Quarterly", fr: "Trimestrielle", ar: "ربع سنوية" },
  { value: "ANNUELLE", en: "Annual", fr: "Annuelle", ar: "سنوية" },
  { value: "COMPLEMENTAIRE", en: "Supplementary", fr: "Complémentaire", ar: "تكميلية" },
] as const;

const BENEFICIARY_TYPES = [
  { value: "PERSONNE_PHYSIQUE", en: "Individual", fr: "Personne physique", ar: "شخص طبيعي" },
  { value: "PERSONNE_MORALE", en: "Company", fr: "Personne morale", ar: "شخص معنوي" },
  { value: "NON_RESIDENT", en: "Non-Resident", fr: "Non-résident", ar: "غير مقيم" },
] as const;

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const QUARTERS = [1, 2, 3, 4];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyAddress(): TEJAddress {
  return { street: "", postal_code: "", city: "", governorate: "" };
}

function emptyOperation(): OperationFormState {
  return {
    _key: uid(),
    withholding_type: "fees",
    date: new Date().toISOString().slice(0, 10),
    gross_amount: 0,
    rate: null,
    rate_category: "",
    currency: "TND",
    invoice_ref: "",
    description: "",
  };
}

function emptyBeneficiary(): BeneficiaryFormState {
  return {
    _key: uid(),
    id: "",
    name: "",
    type: "PERSONNE_PHYSIQUE",
    address: emptyAddress(),
    operations: [emptyOperation()],
  };
}

// ── Main Component ────────────────────────────────────────────────────────

export default function WithholdingTax() {
  const { t, language } = useLanguage();

  // Rates loaded from backend
  const [rates, setRates] = useState<Record<string, TEJRateInfo>>({});
  const [currencies, setCurrencies] = useState<string[]>(["TND", "EUR", "USD"]);
  const [loadingRates, setLoadingRates] = useState(true);

  // Form state
  const [declarationType, setDeclarationType] = useState<TEJDeclarationData["declaration_type"]>("MENSUELLE");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | undefined>(new Date().getMonth() + 1);
  const [quarter, setQuarter] = useState<number | undefined>(undefined);
  const [filingDate, setFilingDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");

  // Declarant
  const [decTaxId, setDecTaxId] = useState("");
  const [decName, setDecName] = useState("");
  const [decAddress, setDecAddress] = useState<TEJAddress>(emptyAddress());
  const [decActivity, setDecActivity] = useState("");

  // Beneficiaries
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryFormState[]>([emptyBeneficiary()]);

  // Results
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<TEJGenerateResult | null>(null);
  const [showXml, setShowXml] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Batch CSV
  const [batchMode, setBatchMode] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [batchResult, setBatchResult] = useState<TEJBatchResult | null>(null);

  // Expanded sections
  const [expandedBens, setExpandedBens] = useState<Set<string>>(new Set());

  // Tab & viewer state
  const [activeTab, setActiveTab] = useState("dashboard");
  const [viewerCert, setViewerCert] = useState<TEJCertificate | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load rates on mount
  useEffect(() => {
    tejGetRates()
      .then((res) => {
        setRates(res.rates);
        setCurrencies(res.currencies);
      })
      .catch(() => toast.error("Failed to load withholding rates"))
      .finally(() => setLoadingRates(false));
  }, []);

  // ── Helpers ────────────────────────────────────���────────────────────────

  const toggleBenExpanded = (key: string) => {
    setExpandedBens((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getRateCategories = (whType: string): string[] => {
    const info = rates[whType];
    return info ? Object.keys(info.rates) : [];
  };

  const labelForLang = (item: { en: string; fr: string; ar: string }) => {
    if (language === "fr") return item.fr;
    if (language === "ar") return item.ar;
    return item.en;
  };

  // ── Beneficiary CRUD ────────────────────────────────────────────────────

  const addBeneficiary = () => {
    const ben = emptyBeneficiary();
    setBeneficiaries((prev) => [...prev, ben]);
    setExpandedBens((prev) => new Set(prev).add(ben._key));
  };

  const removeBeneficiary = (key: string) => {
    setBeneficiaries((prev) => prev.filter((b) => b._key !== key));
  };

  const updateBen = (key: string, patch: Partial<BeneficiaryFormState>) => {
    setBeneficiaries((prev) => prev.map((b) => (b._key === key ? { ...b, ...patch } : b)));
  };

  const addOperation = (benKey: string) => {
    setBeneficiaries((prev) =>
      prev.map((b) =>
        b._key === benKey ? { ...b, operations: [...b.operations, emptyOperation()] } : b
      )
    );
  };

  const removeOperation = (benKey: string, opKey: string) => {
    setBeneficiaries((prev) =>
      prev.map((b) =>
        b._key === benKey
          ? { ...b, operations: b.operations.filter((o) => (o as OperationFormState)._key !== opKey) }
          : b
      )
    );
  };

  const updateOp = (benKey: string, opKey: string, patch: Partial<OperationFormState>) => {
    setBeneficiaries((prev) =>
      prev.map((b) =>
        b._key === benKey
          ? {
              ...b,
              operations: b.operations.map((o) =>
                (o as OperationFormState)._key === opKey ? { ...o, ...patch } : o
              ),
            }
          : b
      )
    );
  };

  // ── Auto-calculate on type change ──────────────────────────────────────

  const handleCalcRate = useCallback(
    async (benKey: string, opKey: string, op: OperationFormState) => {
      if (!op.withholding_type || !op.rate_category || !op.gross_amount) return;
      try {
        const res = await tejCalculate(op.withholding_type, op.gross_amount, op.rate_category);
        updateOp(benKey, opKey, { rate: res.calculation.rate });
      } catch {
        // silent — user can still enter rate manually
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Build declaration data ─────────────────────────���───────────────────

  const buildDeclarationData = (): TEJDeclarationData => {
    const period: TEJDeclarationData["period"] = { year };
    if (declarationType === "MENSUELLE" && month) period.month = month;
    if (declarationType === "TRIMESTRIELLE" && quarter) period.quarter = quarter;

    return {
      declaration_type: declarationType,
      period,
      filing_date: filingDate,
      reference: reference || `TEJ-${Date.now().toString(36).toUpperCase()}`,
      declarant: {
        tax_id: decTaxId,
        name: decName,
        address: decAddress,
        activity: decActivity || undefined,
      },
      beneficiaries: beneficiaries.map((b) => ({
        id: b.id,
        name: b.name,
        type: b.type,
        address: b.address,
        operations: b.operations.map((o) => ({
          withholding_type: o.withholding_type,
          date: o.date,
          gross_amount: o.gross_amount,
          rate: o.rate,
          rate_category: o.rate_category,
          currency: o.currency,
          invoice_ref: o.invoice_ref || undefined,
          description: o.description || undefined,
        })),
      })),
    };
  };

  // ── Generate ────────────────────────────────────���──────────────────────

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const data = buildDeclarationData();
      // Save to MongoDB (generates XML + persists)
      const saveRes = await tejSaveCertificate(data);
      if (saveRes.success && saveRes.certificate) {
        const cert = saveRes.certificate;
        setResult({
          success: true,
          xml: cert.xml_content,
          validation: cert.validation,
          metadata: cert.metadata,
          errors: [],
        });
        toast.success(t("tejGenerateSuccess"));
        setShowXml(true);
        setRefreshKey((k) => k + 1);
      } else {
        toast.error(t("tejGenerateFailed"));
      }
    } catch (err: unknown) {
      // Show detailed validation errors from backend
      if (err && typeof err === "object" && "data" in err) {
        const apiErr = err as { data: { errors?: string[]; error?: string } };
        const errors = apiErr.data?.errors;
        if (errors && errors.length > 0) {
          errors.forEach((e: string | { message?: string }) => {
            const msg = typeof e === "string" ? e : e.message || "Validation error";
            toast.error(msg);
          });
        } else {
          toast.error(apiErr.data?.error || (err instanceof Error ? err.message : "Generation failed"));
        }
      } else {
        const msg = err instanceof Error ? err.message : "Generation failed";
        toast.error(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  // ── Batch CSV ────��─────────────────────────────��───────────────────────

  const handleBatchGenerate = async () => {
    if (!csvFile) return;
    setGenerating(true);
    setBatchResult(null);
    try {
      const period: TEJDeclarationData["period"] = { year };
      if (declarationType === "MENSUELLE" && month) period.month = month;
      if (declarationType === "TRIMESTRIELLE" && quarter) period.quarter = quarter;

      const declarantData = {
        declaration_type: declarationType,
        period,
        filing_date: filingDate,
        reference: reference || `TEJ-BATCH-${Date.now().toString(36).toUpperCase()}`,
        declarant: {
          tax_id: decTaxId,
          name: decName,
          address: decAddress,
          activity: decActivity || undefined,
        },
      };

      const res = await tejBatchCSV(csvFile, declarantData as TEJDeclarationData);
      setBatchResult(res);
      if (res.success) {
        setResult(res);
        toast.success(`${t("tejBatchSuccess")}: ${res.rows_processed} ${t("tejRowsProcessed")}`);
        setShowXml(true);
      } else {
        toast.error(t("tejGenerateFailed"));
      }
    } catch (err: unknown) {
      if (err && typeof err === "object" && "data" in err) {
        const apiErr = err as { data: { errors?: string[]; error?: string } };
        const errors = apiErr.data?.errors;
        if (errors && errors.length > 0) {
          errors.forEach((e: string | { message?: string }) => {
            const msg = typeof e === "string" ? e : e.message || "Validation error";
            toast.error(msg);
          });
        } else {
          toast.error(apiErr.data?.error || "Batch generation failed");
        }
      } else {
        const msg = err instanceof Error ? err.message : "Batch generation failed";
        toast.error(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  // ── PDF Export ────��────────────────────────────────────────────────────

  const handleExportPdf = async () => {
    if (!result?.xml) return;
    setExportingPdf(true);
    try {
      const data = buildDeclarationData();
      const blob = await tejExportPDF(data, result.xml);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificat_retenue_${data.reference}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("tejPdfExported"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "PDF export failed";
      toast.error(msg);
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Copy XML ��────────────────────────────��─────────────────────────────

  const handleCopyXml = () => {
    if (result?.xml) {
      navigator.clipboard.writeText(result.xml);
      toast.success(t("tejXmlCopied"));
    }
  };

  // ── Download XML ───────────────────────────────────────────────────────

  const handleDownloadXml = () => {
    if (!result?.xml) return;
    const blob = new Blob([result.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `declaration_retenue_${reference || "TEJ"}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────────────

  if (loadingRates) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleViewCert = (cert: TEJCertificate) => {
    setViewerCert(cert);
    setViewerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("tejTitle")}</h1>
          <p className="text-muted-foreground mt-1">{t("tejSubtitle")}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            {t("dashboard")}
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("tejCreateTab")}
          </TabsTrigger>
          <TabsTrigger value="certificates" className="gap-2">
            <List className="h-4 w-4" />
            {t("tejCertificatesTab")}
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard">
          <WithholdingDashboard onViewCert={handleViewCert} refreshKey={refreshKey} />
        </TabsContent>

        {/* Create Tab */}
        <TabsContent value="create">
          <div className="flex justify-end mb-4">
            <Button
              variant={batchMode ? "default" : "outline"}
              size="sm"
              onClick={() => setBatchMode(!batchMode)}
            >
              <FileSpreadsheet className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("tejBatchCSV")}
            </Button>
          </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT: Form (2 cols on xl) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Declaration Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("tejDeclarationInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-medium mb-1">{t("tejDeclarationType")}</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={declarationType}
                    onChange={(e) => setDeclarationType(e.target.value as TEJDeclarationData["declaration_type"])}
                  >
                    {DECLARATION_TYPES.map((dt) => (
                      <option key={dt.value} value={dt.value}>{labelForLang(dt)}</option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div>
                  <label className="block text-sm font-medium mb-1">{t("tejYear")}</label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    min={2020}
                    max={2030}
                  />
                </div>

                {/* Month or Quarter */}
                {declarationType === "MENSUELLE" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("tejMonth")}</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={month ?? ""}
                      onChange={(e) => setMonth(Number(e.target.value) || undefined)}
                    >
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}
                {declarationType === "TRIMESTRIELLE" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("tejQuarter")}</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={quarter ?? ""}
                      onChange={(e) => setQuarter(Number(e.target.value) || undefined)}
                    >
                      {QUARTERS.map((q) => (
                        <option key={q} value={q}>Q{q}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Filing date */}
                <div>
                  <label className="block text-sm font-medium mb-1">{t("tejFilingDate")}</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filingDate}
                    onChange={(e) => setFilingDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-sm font-medium mb-1">{t("tejReference")}</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={t("tejReferencePlaceholder")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Declarant */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("tejDeclarant")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("tejTaxId")}</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    value={decTaxId}
                    onChange={(e) => setDecTaxId(e.target.value)}
                    placeholder="1234567A/P/M/000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("tejCompanyName")}</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={decName}
                    onChange={(e) => setDecName(e.target.value)}
                    placeholder={t("tejCompanyNamePlaceholder")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("tejStreet")}</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={decAddress.street}
                    onChange={(e) => setDecAddress({ ...decAddress, street: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("tejPostalCode")}</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={decAddress.postal_code}
                    onChange={(e) => setDecAddress({ ...decAddress, postal_code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("tejCity")}</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={decAddress.city}
                    onChange={(e) => setDecAddress({ ...decAddress, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("tejGovernorate")}</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={decAddress.governorate || ""}
                    onChange={(e) => setDecAddress({ ...decAddress, governorate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t("tejActivity")}</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={decActivity}
                  onChange={(e) => setDecActivity(e.target.value)}
                  placeholder={t("tejActivityPlaceholder")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Batch CSV Mode */}
          {batchMode ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("tejBatchUpload")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">{t("tejCSVDropHint")}</p>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    id="csv-upload"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="csv-upload">
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                        {t("tejSelectCSV")}
                      </span>
                    </Button>
                  </label>
                  {csvFile && (
                    <p className="mt-2 text-sm text-foreground font-medium">{csvFile.name}</p>
                  )}
                </div>

                <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground text-sm">{t("tejCSVFormat")}</p>
                  <p className="font-mono">
                    beneficiary_id, beneficiary_name, beneficiary_type, withholding_type,
                    rate_category, date, gross_amount, currency, invoice_ref, description
                  </p>
                </div>

                <Button
                  onClick={handleBatchGenerate}
                  disabled={generating || !csvFile}
                  className="w-full"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
                  {t("tejGenerateBatch")}
                </Button>

                {batchResult && (
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-4">
                      <Badge variant="outline">{batchResult.rows_processed} {t("tejRowsProcessed")}</Badge>
                      {batchResult.rows_skipped > 0 && (
                        <Badge variant="destructive">{batchResult.rows_skipped} {t("tejRowsSkipped")}</Badge>
                      )}
                    </div>
                    {batchResult.row_errors.length > 0 && (
                      <div className="bg-destructive/10 rounded-lg p-3 space-y-1">
                        {batchResult.row_errors.map((re, i) => (
                          <p key={i} className="text-destructive text-xs">
                            {t("tejRow")} {re.row}: {re.error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Manual Beneficiaries */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t("tejBeneficiaries")}</h2>
                <Button variant="outline" size="sm" onClick={addBeneficiary}>
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("tejAddBeneficiary")}
                </Button>
              </div>

              {beneficiaries.map((ben, benIdx) => (
                <Card key={ben._key}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <button
                        className="flex items-center gap-2 text-left flex-1"
                        onClick={() => toggleBenExpanded(ben._key)}
                      >
                        {expandedBens.has(ben._key) ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                        <CardTitle className="text-sm">
                          {t("tejBeneficiary")} #{benIdx + 1}
                          {ben.name && ` — ${ben.name}`}
                        </CardTitle>
                      </button>
                      {beneficiaries.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeBeneficiary(ben._key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  {expandedBens.has(ben._key) && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">{t("tejBenId")}</label>
                          <input
                            type="text"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                            value={ben.id}
                            onChange={(e) => updateBen(ben._key, { id: e.target.value })}
                            placeholder="1234567A/P/M/000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">{t("name")}</label>
                          <input
                            type="text"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={ben.name}
                            onChange={(e) => updateBen(ben._key, { name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">{t("tejBenType")}</label>
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={ben.type}
                            onChange={(e) =>
                              updateBen(ben._key, { type: e.target.value as TEJBeneficiary["type"] })
                            }
                          >
                            {BENEFICIARY_TYPES.map((bt) => (
                              <option key={bt.value} value={bt.value}>{labelForLang(bt)}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <Separator />

                      {/* Operations */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{t("tejOperations")}</p>
                          <Button variant="ghost" size="sm" onClick={() => addOperation(ben._key)}>
                            <Plus className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                            {t("tejAddOperation")}
                          </Button>
                        </div>

                        {ben.operations.map((op, opIdx) => {
                          const opState = op as OperationFormState;
                          const cats = getRateCategories(opState.withholding_type);
                          return (
                            <div key={opState._key} className="border border-border rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground">
                                  {t("tejOperation")} #{opIdx + 1}
                                </p>
                                {ben.operations.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => removeOperation(ben._key, opState._key)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                {/* Withholding type */}
                                <div className="col-span-2 sm:col-span-1">
                                  <label className="block text-xs font-medium mb-1">{t("tejWithholdingType")}</label>
                                  <select
                                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                    value={opState.withholding_type}
                                    onChange={(e) => {
                                      updateOp(ben._key, opState._key, {
                                        withholding_type: e.target.value,
                                        rate_category: "",
                                        rate: null,
                                      });
                                    }}
                                  >
                                    {Object.entries(rates).map(([key, info]) => (
                                      <option key={key} value={key}>{info.code} - {info.description.slice(0, 30)}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Rate category */}
                                <div>
                                  <label className="block text-xs font-medium mb-1">{t("tejRateCategory")}</label>
                                  <select
                                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                    value={opState.rate_category}
                                    onChange={(e) => {
                                      updateOp(ben._key, opState._key, { rate_category: e.target.value });
                                      handleCalcRate(ben._key, opState._key, {
                                        ...opState,
                                        rate_category: e.target.value,
                                      });
                                    }}
                                  >
                                    <option value="">--</option>
                                    {cats.map((c) => (
                                      <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Date */}
                                <div>
                                  <label className="block text-xs font-medium mb-1">{t("date")}</label>
                                  <input
                                    type="date"
                                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                    value={opState.date}
                                    onChange={(e) => updateOp(ben._key, opState._key, { date: e.target.value })}
                                  />
                                </div>

                                {/* Gross amount */}
                                <div>
                                  <label className="block text-xs font-medium mb-1">{t("tejGrossAmount")}</label>
                                  <input
                                    type="number"
                                    step="0.001"
                                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                    value={opState.gross_amount || ""}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      updateOp(ben._key, opState._key, { gross_amount: val });
                                    }}
                                    onBlur={() => handleCalcRate(ben._key, opState._key, opState)}
                                  />
                                </div>

                                {/* Rate (auto or manual) */}
                                <div>
                                  <label className="block text-xs font-medium mb-1 flex items-center gap-1">
                                    {t("tejRate")}
                                    {opState.rate !== null && (
                                      <Calculator className="h-3 w-3 text-emerald-500" />
                                    )}
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                    value={opState.rate !== null && opState.rate !== undefined ? (opState.rate * 100).toFixed(1) : ""}
                                    onChange={(e) => {
                                      const pct = parseFloat(e.target.value);
                                      updateOp(ben._key, opState._key, {
                                        rate: isNaN(pct) ? null : pct / 100,
                                      });
                                    }}
                                    placeholder="%"
                                  />
                                </div>

                                {/* Currency */}
                                <div>
                                  <label className="block text-xs font-medium mb-1">{t("currency")}</label>
                                  <select
                                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                    value={opState.currency}
                                    onChange={(e) => updateOp(ben._key, opState._key, { currency: e.target.value })}
                                  >
                                    {currencies.map((c) => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Optional fields */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium mb-1">{t("tejInvoiceRef")}</label>
                                  <input
                                    type="text"
                                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                    value={opState.invoice_ref || ""}
                                    onChange={(e) => updateOp(ben._key, opState._key, { invoice_ref: e.target.value })}
                                    placeholder="INV-001"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">{t("description")}</label>
                                  <input
                                    type="text"
                                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                    value={opState.description || ""}
                                    onChange={(e) => updateOp(ben._key, opState._key, { description: e.target.value })}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Generate Button */}
          {!batchMode && (
            <Button onClick={handleGenerate} disabled={generating} className="w-full" size="lg">
              {generating ? (
                <Loader2 className="h-5 w-5 animate-spin ltr:mr-2 rtl:ml-2" />
              ) : (
                <FileText className="h-5 w-5 ltr:mr-2 rtl:ml-2" />
              )}
              {t("tejGenerate")}
            </Button>
          )}
        </div>

        {/* RIGHT: Results Panel (1 col on xl) */}
        <div className="space-y-4">
          {/* Validation Result */}
          {result && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {result.validation?.valid ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  {t("tejValidation")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant={result.success ? "default" : "destructive"}>
                  {result.success ? t("tejValid") : t("tejInvalid")}
                </Badge>

                {result.validation?.errors?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">{t("errors")}</p>
                    {result.validation.errors.map((err, i) => (
                      <div key={i} className="flex gap-2 text-xs p-2 bg-destructive/10 rounded">
                        <XCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                        <span>{typeof err === "string" ? err : err.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {result.validation?.warnings?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-600">{t("warnings")}</p>
                    {result.validation.warnings.map((w, i) => (
                      <div key={i} className="flex gap-2 text-xs p-2 bg-amber-500/10 rounded">
                        <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                        <span>{w.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          {result?.metadata && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  {t("tejMetadata")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("tejSchemaVersion")}</dt>
                    <dd className="font-mono text-xs">{result.metadata.schema_version}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("tejGeneratedAt")}</dt>
                    <dd className="text-xs">{new Date(result.metadata.generated_at).toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("tejChecksum")}</dt>
                    <dd className="font-mono text-xs truncate max-w-[160px]">{result.metadata.checksum}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {result?.xml && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("actions")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setShowXml(!showXml)}>
                  {showXml ? <EyeOff className="h-4 w-4 ltr:mr-2 rtl:ml-2" /> : <Eye className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
                  {showXml ? t("tejHideXml") : t("tejViewXml")}
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleCopyXml}>
                  <Copy className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("tejCopyXml")}
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleDownloadXml}>
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("tejDownloadXml")}
                </Button>
                <Separator />
                <Button
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                >
                  {exportingPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
                  ) : (
                    <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  )}
                  {t("tejExportPdf")}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Rates Reference */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                {t("tejRatesReference")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(rates).map(([key, info]) => (
                  <div key={key} className="text-xs">
                    <p className="font-medium">{info.code} — {info.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(info.rates).map(([cat, rate]) => (
                        <Badge key={cat} variant="outline" className="text-[10px] font-mono">
                          {cat.replace(/_/g, " ")}: {(rate * 100).toFixed(1)}%
                        </Badge>
                      ))}
                    </div>
                    {info.threshold > 0 && (
                      <p className="text-muted-foreground mt-0.5">
                        {t("tejThreshold")}: {info.threshold.toLocaleString()} TND
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* XML Preview */}
      {showXml && result?.xml && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("tejXmlPreview")}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowXml(false)}>
                <EyeOff className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-xs font-mono max-h-[500px] overflow-y-auto whitespace-pre">
              {result.xml}
            </pre>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        {/* Certificates Tab */}
        <TabsContent value="certificates">
          <CertificateList onView={handleViewCert} refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>

      {/* Certificate Viewer Modal */}
      <CertificateViewer
        certificate={viewerCert}
        open={viewerOpen}
        onClose={() => { setViewerOpen(false); setViewerCert(null); }}
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}