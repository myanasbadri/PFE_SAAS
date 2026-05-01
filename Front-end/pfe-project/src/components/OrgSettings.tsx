"use client";

import { useState, useEffect } from "react";
import {
  Settings, Building2, CreditCard, AlertTriangle,
  Loader2, Save, ExternalLink, Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getOrgDetails, updateOrg, getBilling, createCheckoutSession, createPortalSession,
  type BillingInfo,
} from "@/lib/api";
import { toast } from "sonner";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pro: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  enterprise: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 10 : limit === 0 ? 100 : Math.min(100, (used / limit) * 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used} / {unlimited ? "∞" : limit}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function OrgSettings() {
  const { currentOrgId, orgs } = useAuth();
  const { t } = useLanguage();
  const currentOrg = orgs.find((o) => o.id === currentOrgId);
  const isOwnerOrAdmin = currentOrg?.role === "owner" || currentOrg?.role === "admin";

  const [orgName, setOrgName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [primaryColor, setPrimaryColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    getOrgDetails(currentOrgId)
      .then((res) => {
        setOrgName(res.org.name);
        setCurrency(res.org.settings?.default_currency || "USD");
        setTimezone(res.org.settings?.timezone || "UTC");
        setPrimaryColor(res.org.branding?.primary_color || "");
      })
      .catch(() => toast.error("Failed to load organization details"))
      .finally(() => setLoading(false));
  }, [currentOrgId]);

  const loadBilling = async () => {
    if (!currentOrgId) return;
    setBillingLoading(true);
    try {
      const res = await getBilling(currentOrgId);
      setBilling(res.billing);
    } catch {
      toast.error("Failed to load billing info");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentOrgId) return;
    setSaving(true);
    try {
      await updateOrg(currentOrgId, {
        name: orgName,
        settings: { default_currency: currency, timezone },
        branding: { primary_color: primaryColor || undefined },
      });
      toast.success(t("saved") || "Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = async (plan: string) => {
    if (!currentOrgId) return;
    try {
      const res = await createCheckoutSession(currentOrgId, plan);
      window.location.href = res.checkout_url;
    } catch (err: any) {
      toast.error(err?.message || "Failed to start checkout");
    }
  };

  const handleManageBilling = async () => {
    if (!currentOrgId) return;
    try {
      const res = await createPortalSession(currentOrgId);
      window.location.href = res.portal_url;
    } catch (err: any) {
      toast.error(err?.message || "Failed to open billing portal");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("orgSettings") || "Settings"}</h1>
        <p className="text-muted-foreground">
          {t("orgSettingsDesc") || "Manage your organization settings"}
        </p>
      </div>

      <Tabs defaultValue="general" onValueChange={(v) => v === "billing" && loadBilling()}>
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="h-4 w-4" />
            {t("general") || "General"}
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="h-4 w-4" />
            {t("branding") || "Branding"}
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            {t("billing") || "Billing"}
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("general") || "General"}</CardTitle>
              <CardDescription>{t("orgGeneralDesc") || "Basic organization settings"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("orgName") || "Organization Name"}</Label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={!isOwnerOrAdmin}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("defaultCurrency") || "Default Currency"}</Label>
                  <Select value={currency} onValueChange={setCurrency} disabled={!isOwnerOrAdmin}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="MAD">MAD (د.م.)</SelectItem>
                      <SelectItem value="TND">TND (د.ت)</SelectItem>
                      <SelectItem value="DZD">DZD (د.ج)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("timezone") || "Timezone"}</Label>
                  <Select value={timezone} onValueChange={setTimezone} disabled={!isOwnerOrAdmin}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                      <SelectItem value="America/New_York">America/New York</SelectItem>
                      <SelectItem value="Africa/Casablanca">Africa/Casablanca</SelectItem>
                      <SelectItem value="Africa/Tunis">Africa/Tunis</SelectItem>
                      <SelectItem value="Africa/Algiers">Africa/Algiers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {isOwnerOrAdmin && (
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t("saveChanges")}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          {currentOrg?.role === "owner" && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  {t("dangerZone") || "Danger Zone"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("deleteOrgWarning") || "Deactivating the organization will remove access for all members."}
                </p>
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                  {t("deactivateOrg") || "Deactivate Organization"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("branding") || "Branding"}</CardTitle>
              <CardDescription>{t("brandingDesc") || "Customize your organization appearance"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("primaryColor") || "Primary Color"}</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor || "#10B981"}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                    disabled={!isOwnerOrAdmin}
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#10B981"
                    className="w-32"
                    disabled={!isOwnerOrAdmin}
                  />
                </div>
              </div>
              {isOwnerOrAdmin && (
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t("saveChanges")}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4 mt-4">
          {billingLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : billing ? (
            <>
              {/* Current Plan */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {t("currentPlan") || "Current Plan"}
                      <Badge className={PLAN_COLORS[billing.plan]}>
                        {PLAN_LABELS[billing.plan] || billing.plan}
                      </Badge>
                    </CardTitle>
                    {billing.stripe_customer_id && (
                      <Button variant="outline" size="sm" onClick={handleManageBilling} className="gap-2">
                        <ExternalLink className="h-4 w-4" />
                        {t("manageBilling") || "Manage Billing"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <UsageBar
                    used={billing.usage.invoices.used}
                    limit={billing.usage.invoices.limit}
                    label={t("invoicesThisMonth") || "Invoices this month"}
                  />
                  <UsageBar
                    used={billing.usage.members.used}
                    limit={billing.usage.members.limit}
                    label={t("teamMembers") || "Team members"}
                  />
                  <UsageBar
                    used={billing.usage.ai_queries.used}
                    limit={billing.usage.ai_queries.limit}
                    label={t("aiQueries") || "AI queries this month"}
                  />
                  <UsageBar
                    used={billing.usage.storage_mb.used}
                    limit={billing.usage.storage_mb.limit}
                    label={t("storage") || "Storage (MB)"}
                  />
                </CardContent>
              </Card>

              {/* Plan Cards */}
              {billing.plan === "free" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border-emerald-200 dark:border-emerald-800">
                    <CardHeader>
                      <CardTitle>Pro</CardTitle>
                      <CardDescription>$29/mo</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm space-y-1 mb-4 text-muted-foreground">
                        <li>500 invoices/month</li>
                        <li>15 team members</li>
                        <li>200 AI queries/month</li>
                        <li>5 GB storage</li>
                        <li>Batch extraction & AI Advisor</li>
                      </ul>
                      <Button onClick={() => handleUpgrade("pro")} className="w-full">
                        {t("upgradeToPro") || "Upgrade to Pro"}
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-purple-200 dark:border-purple-800">
                    <CardHeader>
                      <CardTitle>Enterprise</CardTitle>
                      <CardDescription>$99/mo</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm space-y-1 mb-4 text-muted-foreground">
                        <li>Unlimited invoices</li>
                        <li>Unlimited members</li>
                        <li>Unlimited AI queries</li>
                        <li>Unlimited storage</li>
                        <li>All features</li>
                      </ul>
                      <Button onClick={() => handleUpgrade("enterprise")} variant="outline" className="w-full">
                        {t("upgradeToEnterprise") || "Upgrade to Enterprise"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {t("billingUnavailable") || "Billing information unavailable"}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Org Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deactivateOrg") || "Deactivate Organization"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deactivateOrgConfirm") || "This will deactivate the organization and remove access for all members. This can be reversed by contacting support."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground">
              {t("deactivate") || "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
