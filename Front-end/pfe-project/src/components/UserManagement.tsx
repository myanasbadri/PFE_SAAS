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
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
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
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Power,
  Mail,
  Lock,
  User,
  Clock,
  Filter,
  X,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { toast } from "sonner";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  type SystemUser,
} from "@/lib/api";

function formatDate(iso: string): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export const UserManagement = () => {
  const { t } = useLanguage();

  // Data state
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"admin" | "client">("client");
  const [formLoading, setFormLoading] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toggle loading per user
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (roleFilter !== "all") params.role = roleFilter;
      if (statusFilter !== "all") params.status = statusFilter;

      const res = await getUsers(params as Parameters<typeof getUsers>[0]);
      setUsers(res.users);
      setTotalPages(res.pages);
      setTotal(res.total);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const hasActiveFilters =
    search || roleFilter !== "all" || statusFilter !== "all";

  // ── Add / Edit dialog ──────────────────────────────────────────────────

  const openAddDialog = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("client");
    setDialogOpen(true);
  };

  const openEditDialog = (u: SystemUser) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword("");
    setFormRole(u.role);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editingUser) {
        const payload: Record<string, string> = {};
        if (formName && formName !== editingUser.name) payload.name = formName;
        if (formEmail && formEmail !== editingUser.email) payload.email = formEmail;
        if (formRole !== editingUser.role) payload.role = formRole;
        if (formPassword) payload.password = formPassword;
        await updateUser(editingUser.id, payload);
        toast.success("User updated successfully");
      } else {
        if (!formName || !formEmail || !formPassword) {
          toast.error("All fields are required");
          setFormLoading(false);
          return;
        }
        await createUser({
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
        });
        toast.success("User created successfully");
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Operation failed";
      toast.error(message);
    } finally {
      setFormLoading(false);
    }
  };

  // ── Toggle status ──────────────────────────────────────────────────────

  const handleToggleStatus = async (u: SystemUser) => {
    setTogglingId(u.id);
    try {
      const res = await toggleUserStatus(u.id);
      toast.success(res.message);
      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Toggle failed";
      toast.error(message);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteUser(deleteTarget.id);
      toast.success("User deleted successfully");
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            {t("userManagement")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("userManagementDesc")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="text-sm border-[#0A2540]/20 text-foreground"
          >
            {total} {total === 1 ? t("user") : t("users")}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersVisible((v) => !v)}
            className={`gap-2 ${hasActiveFilters ? "border-[#10B981] text-[#10B981]" : ""}`}
          >
            <Filter className="h-4 w-4" />
            {t("filters")}
            {hasActiveFilters && (
              <span className="ml-1 h-2 w-2 rounded-full bg-[#10B981]" />
            )}
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-[#10B981] hover:bg-[#10B981]/90 text-white"
            onClick={openAddDialog}
          >
            <UserPlus className="h-4 w-4" />
            {t("addUser")}
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {filtersVisible && (
        <Card className="bg-card border-dashed">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">
                  {t("searchUsers")}
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("searchByNameEmail")}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("role")}
                </Label>
                <Select
                  value={roleFilter}
                  onValueChange={(v) => {
                    setRoleFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[150px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allRoles")}</SelectItem>
                    <SelectItem value="admin">{t("admin")}</SelectItem>
                    <SelectItem value="client">{t("client")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("status")}
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[150px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allStatuses")}</SelectItem>
                    <SelectItem value="active">{t("active")}</SelectItem>
                    <SelectItem value="inactive">{t("inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground gap-1.5 h-9"
                >
                  <X className="h-3.5 w-3.5" />
                  {t("clearAll")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("users")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">{t("noUsersFound")}</p>
              <p className="text-sm mt-1">
                {hasActiveFilters
                  ? t("tryAdjusting")
                  : t("noUsersYet")}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("user")}</TableHead>
                      <TableHead>{t("role")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("createdAt")}</TableHead>
                      <TableHead>{t("lastLogin")}</TableHead>
                      <TableHead className="text-right">
                        {t("actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} className="hover:bg-muted/50">
                        {/* User info */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-[#0A2540]/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{u.name}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Role */}
                        <TableCell>
                          {u.role === "admin" ? (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              {t("admin")}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 text-muted-foreground"
                            >
                              <Shield className="h-3 w-3" />
                              {t("client")}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {u.is_active ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                              {t("active")}
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                              {t("inactive")}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Created */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(u.created_at)}
                          </div>
                        </TableCell>

                        {/* Last login */}
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(u.last_login)}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title={t("editUser")}
                              onClick={() => openEditDialog(u)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title={
                                u.is_active
                                  ? t("deactivateUser")
                                  : t("activateUser")
                              }
                              disabled={togglingId === u.id}
                              onClick={() => handleToggleStatus(u)}
                            >
                              {togglingId === u.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Power
                                  className={`h-4 w-4 ${u.is_active ? "text-emerald-600" : "text-red-500"}`}
                                />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              title={t("deleteUser")}
                              onClick={() => setDeleteTarget(u)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    {t("page")} {page} {t("of")} {totalPages} ({total}{" "}
                    {t("total")})
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t("previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="gap-1"
                    >
                      {t("next")}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? t("editUser") : t("addUser")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="form-name">{t("name")}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="form-name"
                  placeholder={t("name")}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="pl-9"
                  required={!editingUser}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-email">{t("email")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="form-email"
                  type="email"
                  placeholder="user@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="pl-9"
                  required={!editingUser}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-password">
                {editingUser ? t("newPassword") : t("password")}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="form-password"
                  type="password"
                  placeholder={
                    editingUser ? t("leaveBlankPassword") : "********"
                  }
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="pl-9"
                  required={!editingUser}
                  minLength={6}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("role")}</Label>
              <Select
                value={formRole}
                onValueChange={(v) => setFormRole(v as "admin" | "client")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {t("client")}
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      {t("admin")}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={formLoading}
                className="bg-[#10B981] hover:bg-[#10B981]/90 text-white gap-2"
              >
                {formLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingUser ? t("saveChanges") : t("createUser")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteUserTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteUserConfirm")}{" "}
              <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email})?{" "}
              {t("deleteUserWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
