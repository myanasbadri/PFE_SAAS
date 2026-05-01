"use client";

import { useState } from "react";
import { ChevronsUpDown, Plus, Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { switchOrg, createOrg, type Org } from "@/lib/api";
import { toast } from "sonner";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pro: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  enterprise: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

export default function OrgSwitcher() {
  const { orgs, currentOrgId, setOrgs, setCurrentOrgId, updateToken } = useAuth();
  const { t } = useLanguage();
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  const currentOrg = orgs.find((o) => o.id === currentOrgId) || orgs[0];

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrgId) return;
    try {
      const res = await switchOrg(orgId);
      updateToken(res.token);
      setCurrentOrgId(orgId);
      toast.success(t("switchedToOrg") || `Switched to ${res.org.name}`);
      window.location.reload();
    } catch {
      toast.error(t("switchOrgFailed") || "Failed to switch organization");
    }
  };

  const handleCreate = async () => {
    if (!newOrgName.trim()) return;
    setCreating(true);
    try {
      const res = await createOrg({ name: newOrgName.trim() });
      setOrgs([...orgs, res.org]);
      await handleSwitch(res.org.id);
      setCreateOpen(false);
      setNewOrgName("");
    } catch {
      toast.error(t("createOrgFailed") || "Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  if (!currentOrg) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-3 py-2 h-auto text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-bold">
                  {currentOrg.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-medium truncate">{currentOrg.name}</p>
                <Badge
                  variant="secondary"
                  className={cn("text-[10px] px-1.5 py-0 h-4", PLAN_COLORS[currentOrg.plan])}
                >
                  {currentOrg.plan.toUpperCase()}
                </Badge>
              </div>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {orgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              className="cursor-pointer gap-2"
            >
              <div className="h-6 w-6 rounded bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">
                  {org.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{org.name}</p>
              </div>
              <Badge
                variant="secondary"
                className={cn("text-[10px] px-1.5 py-0 h-4", PLAN_COLORS[org.plan])}
              >
                {org.plan}
              </Badge>
              {org.id === currentOrgId && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setCreateOpen(true)}
            className="cursor-pointer gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("createOrganization") || "Create Organization"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t("createOrganization") || "Create Organization"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("orgName") || "Organization Name"}</Label>
              <Input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder={t("orgNamePlaceholder") || "e.g. Acme Corp"}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newOrgName.trim()}>
              {creating ? t("creating") : t("createOrganization") || "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
