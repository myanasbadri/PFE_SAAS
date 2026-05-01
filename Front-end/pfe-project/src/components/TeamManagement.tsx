"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, UserPlus, Mail, Shield, ShieldCheck, Crown,
  Trash2, Loader2, Search, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getOrgMembers, updateMemberRole, removeMember,
  sendInvitation, getInvitations, revokeInvitation,
  type OrgMember, type Invitation,
} from "@/lib/api";
import { toast } from "sonner";

const ROLE_ICONS: Record<string, React.ElementType> = {
  owner: Crown,
  admin: ShieldCheck,
  member: Shield,
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  member: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export default function TeamManagement() {
  const { user, currentOrgId, orgs } = useAuth();
  const { t } = useLanguage();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);

  const currentOrg = orgs.find((o) => o.id === currentOrgId);
  const myRole = currentOrg?.role || "member";
  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        getOrgMembers(currentOrgId),
        canManage ? getInvitations(currentOrgId).catch(() => ({ invitations: [] })) : Promise.resolve({ invitations: [] as Invitation[] }),
      ]);
      setMembers(membersRes.members);
      setInvitations(invitesRes.invitations);
    } catch {
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, canManage]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentOrgId) return;
    setSending(true);
    try {
      await sendInvitation(currentOrgId, { email: inviteEmail.trim(), role: inviteRole });
      toast.success(`${t("invitationSent") || "Invitation sent to"} ${inviteEmail}`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send invitation");
    } finally {
      setSending(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "admin" | "member") => {
    if (!currentOrgId) return;
    try {
      await updateMemberRole(currentOrgId, userId, newRole);
      toast.success(t("roleUpdated") || "Role updated");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update role");
    }
  };

  const handleRemove = async () => {
    if (!removeTarget || !currentOrgId) return;
    try {
      await removeMember(currentOrgId, removeTarget.user_id);
      toast.success(t("memberRemoved") || "Member removed");
      setRemoveTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove member");
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget || !currentOrgId) return;
    try {
      await revokeInvitation(currentOrgId, revokeTarget.id);
      toast.success(t("invitationRevoked") || "Invitation revoked");
      setRevokeTarget(null);
      loadData();
    } catch {
      toast.error("Failed to revoke invitation");
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("teamManagement") || "Team"}</h1>
          <p className="text-muted-foreground">
            {t("teamManagementDesc") || "Manage your organization members and invitations"}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {t("inviteMember") || "Invite Member"}
          </Button>
        )}
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("members") || "Members"} ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                {canManage && <TableHead className="text-right">{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const RoleIcon = ROLE_ICONS[member.role] || Shield;
                const isMe = member.user_id === user?.id;
                return (
                  <TableRow key={member.user_id}>
                    <TableCell className="font-medium">
                      {member.name} {isMe && <span className="text-muted-foreground text-xs">({t("you") || "you"})</span>}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      {isOwner && member.role !== "owner" && !isMe ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) => handleRoleChange(member.user_id, v as "admin" | "member")}
                        >
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className={ROLE_COLORS[member.role]}>
                          <RoleIcon className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                          {member.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.is_active ? "default" : "secondary"}>
                        {member.is_active ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {!isMe && member.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setRemoveTarget(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {canManage && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t("pendingInvitations") || "Pending Invitations"} ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{inv.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setRevokeTarget(inv)}
                      >
                        {t("revoke") || "Revoke"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {t("inviteMember") || "Invite Member"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("email")}</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("role")}</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleInvite} disabled={sending || !inviteEmail.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Mail className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
              {t("sendInvitation") || "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirm */}
      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeMember") || "Remove Member"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeMemberConfirm") || "Are you sure you want to remove"}{" "}
              <strong>{removeTarget?.name}</strong> ({removeTarget?.email})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground">
              {t("remove") || "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Invitation Confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeInvitation") || "Revoke Invitation"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("revokeInvitationConfirm") || "Revoke the invitation sent to"}{" "}
              <strong>{revokeTarget?.email}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground">
              {t("revoke") || "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
