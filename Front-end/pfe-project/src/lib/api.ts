const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Attach organization context
  if (typeof window !== "undefined") {
    const orgId = localStorage.getItem("currentOrgId");
    if (orgId) {
      headers["X-Org-Id"] = orgId;
    }
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(data.error || "Something went wrong", res.status, data);
  }

  return data as T;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "client";
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
  plan: "free" | "pro" | "enterprise";
  logo_url?: string | null;
  members_count?: number;
}

interface AuthResponse {
  success: boolean;
  token: string;
  user: AuthUser;
  message: string;
  orgs?: Org[];
  current_org_id?: string;
}

interface MeResponse {
  success: boolean;
  user: {
    user_id: string;
    email: string;
    role: "admin" | "client";
    org_id?: string;
    org_role?: string;
  };
  orgs?: Org[];
}

export async function login(email: string, password: string) {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: "admin" | "client";
  activity_type?: string;
  person_type?: string;
  company_name?: string;
  tax_id?: string;
  phone?: string;
  address?: string;
}

export async function register(data: RegisterData) {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMe() {
  return request<MeResponse>("/api/auth/me");
}

// ── Invoices ────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  user_id: string;
  filename: string;
  original_filename: string;
  status: string;
  created_at: string;
  updated_at?: string;
  tags: string[];
  share_code?: string;
  source_format?: string;
  compliance_status?: string;
  invoice_category?: string;
  ttn_unique_id?: string;
  ttn_submitted?: boolean;
  data: {
    vendor_name?: string | null;
    invoice_no?: string | null;
    date?: string | null;
    due_date?: string | null;
    line_items?: Array<{
      description?: string | null;
      quantity?: number | null;
      unit_price?: number | null;
      total?: number | null;
    }>;
    totals?: {
      subtotal?: number | null;
      tax?: number | null;
      discount?: number | null;
      grand_total?: number | null;
      currency?: string | null;
    };
    bill_to?: {
      name?: string | null;
      address?: string | null;
      email?: string | null;
    };
    payment_method?: string | null;
    notes?: string | null;
    logo?: string | null;
    signature?: string | null;
    field_confidence?: {
      vendor_name?: number;
      invoice_no?: number;
      date?: number;
      due_date?: number;
      line_items?: number;
      grand_total?: number;
      currency?: number;
      bill_to?: number;
      payment_method?: number;
      notes?: number;
    };
    validation?: {
      is_valid?: boolean;
      confidence?: number;
      needs_human_review?: boolean;
      warnings?: string[];
    };
  };
}

interface InvoicesResponse {
  success: boolean;
  count: number;
  total: number;
  page: number;
  limit: number;
  pages: number;
  invoices: Invoice[];
}

interface InvoiceResponse {
  success: boolean;
  invoice: Invoice;
}

export interface InvoiceSearchParams {
  search?: string;
  status?: string;
  vendor?: string;
  currency?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: string;
  amount_max?: string;
  sort_by?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export async function getInvoices(params?: InvoiceSearchParams) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== null) {
        searchParams.set(key, String(value));
      }
    });
  }
  const qs = searchParams.toString();
  return request<InvoicesResponse>(`/api/invoices${qs ? `?${qs}` : ""}`);
}

interface FiltersResponse {
  success: boolean;
  vendors: string[];
  currencies: string[];
  statuses: string[];
}

export async function getInvoiceFilters() {
  return request<FiltersResponse>("/api/invoices/filters");
}

export async function getInvoiceById(id: string) {
  return request<InvoiceResponse>(`/api/invoices/${id}`);
}

export async function updateInvoice(
  id: string,
  payload: { data?: Invoice["data"]; tags?: string[]; status?: string }
) {
  return request<{ success: boolean; message: string }>(`/api/invoices/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export interface CreateInvoicePayload {
  vendor_name?: string;
  invoice_no?: string;
  date?: string;
  due_date?: string;
  bill_to?: { name?: string; address?: string; email?: string };
  line_items?: Array<{
    description?: string;
    quantity?: number | null;
    unit_price?: number | null;
    total?: number | null;
  }>;
  totals?: {
    subtotal?: number | null;
    tax?: number | null;
    discount?: number | null;
    grand_total?: number | null;
    currency?: string;
  };
  payment_method?: string;
  notes?: string;
  tags?: string[];
  logo?: string;
  signature?: string;
}

export async function createInvoice(payload: CreateInvoicePayload) {
  return request<{ success: boolean; message: string; invoice_id: string; share_code: string }>(
    "/api/invoices",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteInvoice(id: string) {
  return request<{ success: boolean; message: string }>(`/api/invoices/${id}`, {
    method: "DELETE",
  });
}

export interface InvoiceHistoryEntry {
  id: string;
  action: string;
  timestamp: string;
  user_name: string;
  user_email: string;
  details: Record<string, unknown>;
  ip_address: string;
}

export async function getInvoiceHistory(id: string) {
  return request<{
    success: boolean;
    invoice_id: string;
    history: InvoiceHistoryEntry[];
  }>(`/api/invoices/${id}/history`);
}

// ── File Extraction ─────────────────────────────────────────────────────────

interface ExtractSyncResponse {
  success: boolean;
  message: string;
  mode: "sync";
  invoice_id: string;
  extracted_data: Invoice["data"];
}

interface ExtractAsyncResponse {
  success: boolean;
  message: string;
  mode: "async";
  task_id: string;
}

type ExtractResponse = ExtractSyncResponse | ExtractAsyncResponse;

export async function extractFile(file: File, lang: string = "auto") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("lang", lang);
  return request<ExtractResponse>("/api/extract-file", {
    method: "POST",
    body: formData,
  });
}

interface TaskStatusResponse {
  state: string;
  status?: string;
  result?: {
    invoice_id?: string;
    extracted_data?: Invoice["data"];
  };
}

export async function getTaskStatus(taskId: string) {
  return request<TaskStatusResponse>(`/api/tasks/${taskId}`);
}

// ── Batch Extraction ───────────────────────────────────────────────────────

export interface BatchFileResult {
  filename: string;
  status: "completed" | "failed" | "processing";
  invoice_id?: string;
  extracted_data?: Invoice["data"];
  error?: string;
}

interface BatchExtractResponse {
  success: boolean;
  message: string;
  total: number;
  results: BatchFileResult[];
}

export async function extractBatchFiles(files: File[]) {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  return request<BatchExtractResponse>("/api/extract-batch", {
    method: "POST",
    body: formData,
  });
}

// ── Stats ───────────────────────────────────────────────────────────────────

export interface MonthlySeries {
  month: string;
  amount: number;
  count: number;
}

export interface VendorBreakdown {
  name: string;
  total: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
}

interface StatsResponse {
  success: boolean;
  stats: {
    total_invoices: number;
    total_amount: number;
    needs_review: number;
    monthly_series: MonthlySeries[];
    vendor_breakdown: VendorBreakdown[];
    status_breakdown: StatusBreakdown[];
    currency_counts: Record<string, number>;
  };
}

export async function getStats() {
  return request<StatsResponse>("/api/stats");
}

// ── Activity / Audit Trail ──────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  action: string;
  timestamp: string;
  details: Record<string, unknown>;
  ip_address: string;
}

interface ActivityResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  pages: number;
  logs: ActivityLog[];
}

export async function getActivityLogs(params?: {
  page?: number;
  limit?: number;
  action?: string;
  from?: string;
  to?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.action) searchParams.set("action", params.action);
  if (params?.from) searchParams.set("from", params.from);
  if (params?.to) searchParams.set("to", params.to);
  const qs = searchParams.toString();
  return request<ActivityResponse>(`/api/activity${qs ? `?${qs}` : ""}`);
}

// ── Health ──────────────────────────────────────────────────────────────────

export async function healthCheck() {
  return request<{ success: boolean; message: string }>("/api/health");
}

// ── Export / Download ──────────────────────────────────────────────────────

async function downloadFile(endpoint: string, fallbackName: string) {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      (data as Record<string, string>).error || "Download failed",
      res.status,
      data,
    );
  }

  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename=(.+)/);
  const filename = match ? match[1] : fallbackName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportAllInvoicesExcel() {
  return downloadFile("/api/export/invoices/excel", "invoices_report.xlsx");
}

export async function exportInvoiceExcel(id: string) {
  return downloadFile(`/api/export/invoice/${id}/excel`, `invoice_${id}.xlsx`);
}

// ── AI Advisor ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AdvisorChatResponse {
  success: boolean;
  reply: string;
  model: string;
}

export async function advisorChat(message: string, history: ChatMessage[]) {
  return request<AdvisorChatResponse>("/api/advisor/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

// ── Notifications (MagicBell) ─────────────────────────────────────────────

export interface AppNotification {
  id: string;
  title: string;
  content: string;
  category: string;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
  seen_at: string | null;
}

interface NotificationsResponse {
  success: boolean;
  notifications: AppNotification[];
  total: number;
  total_pages: number;
  per_page: number;
  current_page: number;
  unseen_count: number;
  unread_count: number;
}

export async function getNotifications(page = 1) {
  return request<NotificationsResponse>(`/api/notifications?page=${page}`);
}

export async function markNotificationRead(id: string) {
  return request<{ success: boolean }>(`/api/notifications/${id}/read`, {
    method: "POST",
  });
}

export async function markAllNotificationsRead() {
  return request<{ success: boolean }>("/api/notifications/mark-all-read", {
    method: "POST",
  });
}

export async function sendTestNotification() {
  return request<{ success: boolean; message: string }>("/api/notifications/test", {
    method: "POST",
  });
}

// ── Admin User Management ─────────────────────────────────────────────────

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "client";
  is_active: boolean;
  created_at: string;
  last_login: string;
}

interface UsersResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  pages: number;
  users: SystemUser[];
}

export async function getUsers(params?: {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.role) searchParams.set("role", params.role);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return request<UsersResponse>(`/api/admin/users${qs ? `?${qs}` : ""}`);
}

export async function createUser(payload: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "client";
}) {
  return request<{ success: boolean; message: string; user_id: string }>(
    "/api/admin/users",
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function updateUser(
  id: string,
  payload: { name?: string; email?: string; role?: string; password?: string }
) {
  return request<{ success: boolean; message: string }>(
    `/api/admin/users/${id}`,
    { method: "PUT", body: JSON.stringify(payload) }
  );
}

export async function toggleUserStatus(id: string) {
  return request<{ success: boolean; message: string; is_active: boolean }>(
    `/api/admin/users/${id}/toggle-status`,
    { method: "PUT" }
  );
}

export async function deleteUser(id: string) {
  return request<{ success: boolean; message: string }>(
    `/api/admin/users/${id}`,
    { method: "DELETE" }
  );
}

// ── Organizations ────────────────────────────────────────────────────────────

export async function getOrgs() {
  return request<{ success: boolean; orgs: Org[] }>("/api/orgs");
}

export async function createOrg(payload: {
  name: string;
  currency?: string;
  timezone?: string;
}) {
  return request<{ success: boolean; org: Org }>("/api/orgs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getOrgDetails(orgId: string) {
  return request<{
    success: boolean;
    org: Org & {
      owner_id: string;
      branding: { logo_url: string | null; primary_color: string | null; invoice_template: string | null };
      settings: { default_currency: string; timezone: string };
      usage: Record<string, number>;
      created_at: string;
    };
  }>(`/api/orgs/${orgId}`);
}

export async function updateOrg(
  orgId: string,
  payload: {
    name?: string;
    settings?: { default_currency?: string; timezone?: string };
    branding?: { primary_color?: string; invoice_template?: string };
  }
) {
  return request<{ success: boolean; message: string }>(`/api/orgs/${orgId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function switchOrg(orgId: string) {
  return request<{ success: boolean; token: string; org: Org }>(
    `/api/orgs/${orgId}/switch`,
    { method: "POST" }
  );
}

// ── Team / Members ───────────────────────────────────────────────────────────

export interface OrgMember {
  user_id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  is_active: boolean;
}

export async function getOrgMembers(orgId: string) {
  return request<{ success: boolean; members: OrgMember[] }>(
    `/api/orgs/${orgId}/members`
  );
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: "admin" | "member"
) {
  return request<{ success: boolean; message: string }>(
    `/api/orgs/${orgId}/members/${userId}`,
    { method: "PUT", body: JSON.stringify({ role }) }
  );
}

export async function removeMember(orgId: string, userId: string) {
  return request<{ success: boolean; message: string }>(
    `/api/orgs/${orgId}/members/${userId}`,
    { method: "DELETE" }
  );
}

// ── Invitations ──────────────────────────────────────────────────────────────

export interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  created_at: string;
}

export async function sendInvitation(
  orgId: string,
  payload: { email: string; role: string }
) {
  return request<{ success: boolean; invitation: Invitation }>(
    `/api/orgs/${orgId}/invitations`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function getInvitations(orgId: string) {
  return request<{ success: boolean; invitations: Invitation[] }>(
    `/api/orgs/${orgId}/invitations`
  );
}

export async function revokeInvitation(orgId: string, inviteId: string) {
  return request<{ success: boolean; message: string }>(
    `/api/orgs/${orgId}/invitations/${inviteId}`,
    { method: "DELETE" }
  );
}

export async function acceptInvitation(inviteToken: string) {
  return request<{ success: boolean; org: Org }>(
    `/api/invitations/${inviteToken}/accept`,
    { method: "POST" }
  );
}

// ── Billing ──────────────────────────────────────────────────────────────────

export interface BillingInfo {
  plan: string;
  prices: { monthly: number; yearly: number };
  usage: {
    invoices: { used: number; limit: number };
    members: { used: number; limit: number };
    ai_queries: { used: number; limit: number };
    storage_mb: { used: number; limit: number };
  };
  features: string[];
  subscription: {
    status: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
  } | null;
  stripe_customer_id: string | null;
}

export async function getBilling(orgId: string) {
  return request<{ success: boolean; billing: BillingInfo }>(
    `/api/orgs/${orgId}/billing`
  );
}

export async function createCheckoutSession(orgId: string, plan: string) {
  return request<{ success: boolean; checkout_url: string }>(
    `/api/orgs/${orgId}/billing/checkout`,
    { method: "POST", body: JSON.stringify({ plan }) }
  );
}

export async function createPortalSession(orgId: string) {
  return request<{ success: boolean; portal_url: string }>(
    `/api/orgs/${orgId}/billing/portal`,
    { method: "POST" }
  );
}

export async function getPlans() {
  return request<{
    success: boolean;
    plans: Array<{
      key: string;
      limits: Record<string, unknown>;
      prices: { monthly: number; yearly: number };
    }>;
  }>("/api/plans");
}

// ── Tunisia 2026 E-Invoicing Compliance ─────────────────────────────────

export interface ComplianceIssue {
  field: string;
  message: string;
  severity: "critical" | "error" | "warning" | "info";
  code: string;
}

export interface ComplianceResult {
  is_compliant: boolean;
  compliance_score: number;
  compliance_status: string;
  errors: ComplianceIssue[];
  warnings: ComplianceIssue[];
  suggestions: string[];
  checks_passed: number;
  checks_total: number;
  validated_at: string;
}

export interface SignatureResult {
  has_signature: boolean;
  signature_valid: boolean | null;
  verification_method: string;
  algorithm: string | null;
  algorithm_strong: boolean;
  certificate: {
    subject: string;
    issuer: string;
    not_valid_before: string;
    not_valid_after: string;
    is_expired: boolean;
    key_type: string;
    key_bits: number;
  } | null;
  signature_timestamp: string | null;
  errors: ComplianceIssue[];
  warnings: ComplianceIssue[];
}

export interface ComplianceReport {
  invoice_id: string;
  source_format: string;
  invoice_category: string | null;
  compliance: ComplianceResult | null;
  compliance_status: string;
  signature: SignatureResult | null;
  ttn: {
    submitted: boolean;
    unique_id: string | null;
    submission_date: string | null;
    status: string | null;
  };
  seller_vat_id: string | null;
  buyer_vat_id: string | null;
}

export async function validateInvoiceCompliance(invoiceId: string) {
  return request<{ success: boolean; invoice_id: string; validation: ComplianceResult }>(
    `/api/invoices/${invoiceId}/validate`,
    { method: "POST" }
  );
}

export async function verifyInvoiceSignature(invoiceId: string) {
  return request<{ success: boolean; invoice_id: string; signature: SignatureResult }>(
    `/api/invoices/${invoiceId}/verify-signature`,
    { method: "POST" }
  );
}

export async function submitToTTN(invoiceId: string) {
  return request<{
    success: boolean;
    invoice_id: string;
    ttn_unique_id: string | null;
    status: string;
    message: string;
    errors: string[];
  }>(`/api/invoices/${invoiceId}/submit-ttn`, { method: "POST" });
}

export async function getComplianceReport(invoiceId: string) {
  return request<{ success: boolean; report: ComplianceReport }>(
    `/api/invoices/${invoiceId}/compliance-report`
  );
}

// ── Invoice QR Code ────────────────────────────────────────────────────

export async function getInvoiceQRCodeUrl(invoiceId: string): Promise<string> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (typeof window !== "undefined") {
    const orgId = localStorage.getItem("currentOrgId");
    if (orgId) headers["X-Org-Id"] = orgId;
  }
  const res = await fetch(`${API_BASE}/api/invoices/${invoiceId}/qrcode`, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new ApiError((errData as Record<string, string>).error || "QR code generation failed", res.status, errData);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function getInvoiceQRCodeData(invoiceId: string) {
  return request<{ success: boolean; qr_data: Record<string, unknown> }>(
    `/api/invoices/${invoiceId}/qrcode-data`
  );
}

// ── Invoice Share / Lookup ────────────────────────────────────────────

export async function getInvoiceShareInfo(invoiceId: string) {
  return request<{ success: boolean; invoice_id: string; share_code: string }>(
    `/api/invoices/${invoiceId}/share-info`
  );
}

export async function lookupInvoiceByCode(shareCode: string) {
  return request<{ success: boolean; invoice: Invoice }>(
    `/api/invoices/lookup/${encodeURIComponent(shareCode)}`
  );
}

// ── TEJ Withholding Tax Certificates ──────────────────��───────────────────

export interface TEJRateInfo {
  code: string;
  description: string;
  rates: Record<string, number>;
  threshold: number;
}

export interface TEJValidationError {
  line?: number;
  column?: number;
  message: string;
  level?: string;
  domain?: string;
  type?: string;
}

export interface TEJValidationReport {
  valid: boolean;
  errors: TEJValidationError[];
  warnings: TEJValidationError[];
  schema_version?: string;
}

export interface TEJMetadata {
  generated_at: string;
  generated_by: string;
  schema_version: string;
  checksum: string;
  qr_code_data: string;
  declaration_ref: string;
}

export interface TEJGenerateResult {
  success: boolean;
  xml: string | null;
  validation: TEJValidationReport;
  metadata: TEJMetadata | null;
  errors: (string | TEJValidationError)[];
}

export interface TEJBatchResult extends TEJGenerateResult {
  row_errors: { row: number; error: string }[];
  rows_processed: number;
  rows_skipped: number;
}

export interface TEJCalculation {
  rate: number;
  withholding_amount: number;
  net_amount: number;
  below_threshold: boolean;
  threshold?: number;
  code?: string;
}

export interface TEJAddress {
  street: string;
  postal_code: string;
  city: string;
  governorate?: string;
}

export interface TEJOperation {
  withholding_type: string;
  date: string;
  gross_amount: number;
  rate?: number | null;
  rate_category: string;
  currency: string;
  invoice_ref?: string;
  description?: string;
}

export interface TEJBeneficiary {
  id: string;
  name: string;
  type: "PERSONNE_PHYSIQUE" | "PERSONNE_MORALE" | "NON_RESIDENT";
  address?: TEJAddress;
  operations: TEJOperation[];
}

export interface TEJDeclarationData {
  declaration_type: "MENSUELLE" | "TRIMESTRIELLE" | "ANNUELLE" | "COMPLEMENTAIRE";
  period: { year: number; month?: number; quarter?: number };
  filing_date: string;
  reference: string;
  declarant: {
    tax_id: string;
    name: string;
    address: TEJAddress;
    activity?: string;
  };
  beneficiaries: TEJBeneficiary[];
}

export async function tejGetRates() {
  return request<{ success: boolean; rates: Record<string, TEJRateInfo>; currencies: string[] }>(
    "/api/tej/rates"
  );
}

export async function tejCalculate(withholdingType: string, grossAmount: number, rateCategory: string) {
  return request<{ success: boolean; calculation: TEJCalculation }>(
    "/api/tej/calculate",
    {
      method: "POST",
      body: JSON.stringify({
        withholding_type: withholdingType,
        gross_amount: grossAmount,
        rate_category: rateCategory,
      }),
    }
  );
}

export async function tejGenerate(data: TEJDeclarationData) {
  return request<TEJGenerateResult>("/api/tej/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function tejValidate(xml: string) {
  return request<{ success: boolean; validation: TEJValidationReport }>(
    "/api/tej/validate",
    { method: "POST", body: JSON.stringify({ xml }) }
  );
}

export async function tejBatchCSV(file: File, declarantData: Omit<TEJDeclarationData, "beneficiaries">) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("declarant_data", JSON.stringify(declarantData));
  return request<TEJBatchResult>("/api/tej/batch-csv", {
    method: "POST",
    body: formData,
  });
}

// ── TEJ Certificate CRUD ────────────────────────────────────────────────

export interface TEJCertificate {
  _id: string;
  certificate_id: string;
  user_id: string;
  org_id: string | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  declaration_type: string;
  period: { year: number; month?: number; quarter?: number };
  filing_date: string;
  reference: string;
  declarant: TEJDeclarationData["declarant"];
  beneficiaries: TEJBeneficiary[];
  xml_content: string;
  validation: TEJValidationReport;
  metadata: TEJMetadata | null;
  totals: {
    total_gross: number;
    total_withholding: number;
    total_net: number;
    operation_count: number;
    beneficiary_count: number;
  };
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  tej_reference: string | null;
}

export interface TEJCertificateListResponse {
  success: boolean;
  certificates: TEJCertificate[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface TEJDashboardStats {
  totals: {
    total_gross: number;
    total_withholding: number;
    total_net: number;
    count: number;
  };
  by_status: Record<string, number>;
  by_type: { type: string; count: number; amount: number }[];
  timeline: { date: string; count: number }[];
}

export async function tejListCertificates(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.per_page) query.set("per_page", String(params.per_page));
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();
  return request<TEJCertificateListResponse>(`/api/tej/certificates${qs ? `?${qs}` : ""}`);
}

export async function tejSaveCertificate(data: TEJDeclarationData) {
  return request<{ success: boolean; certificate: TEJCertificate }>("/api/tej/certificates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function tejGetCertificate(certId: string) {
  return request<{ success: boolean; certificate: TEJCertificate }>(`/api/tej/certificates/${certId}`);
}

export async function tejUpdateCertificate(certId: string, data: TEJDeclarationData) {
  return request<{ success: boolean; certificate: TEJCertificate }>(`/api/tej/certificates/${certId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function tejDeleteCertificate(certId: string) {
  return request<{ success: boolean; message: string }>(`/api/tej/certificates/${certId}`, {
    method: "DELETE",
  });
}

export async function tejSubmitCertificate(certId: string) {
  return request<{ success: boolean; status: string; tej_reference: string; submitted_at: string }>(
    `/api/tej/certificates/${certId}/submit`,
    { method: "POST" }
  );
}

export async function tejDownloadCertificatePDF(certId: string) {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (typeof window !== "undefined") {
    const orgId = localStorage.getItem("currentOrgId");
    if (orgId) headers["X-Org-Id"] = orgId;
  }
  const res = await fetch(`${API_BASE}/api/tej/certificates/${certId}/pdf`, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new ApiError((errData as Record<string, string>).error || "PDF download failed", res.status, errData);
  }
  return res.blob();
}

export async function tejGetDashboard() {
  return request<{ success: boolean; stats: TEJDashboardStats; recent: TEJCertificate[] }>("/api/tej/dashboard");
}

export async function tejExportPDF(declarationData: TEJDeclarationData, xml: string, includeSignature = true) {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  if (typeof window !== "undefined") {
    const orgId = localStorage.getItem("currentOrgId");
    if (orgId) headers["X-Org-Id"] = orgId;
  }

  const res = await fetch(`${API_BASE}/api/tej/export-pdf`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      declaration_data: declarationData,
      xml,
      include_signature: includeSignature,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new ApiError((errData as Record<string, string>).error || "PDF export failed", res.status, errData);
  }

  return res.blob();
}
