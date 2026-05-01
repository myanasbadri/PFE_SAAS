"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { UserManagement } from "@/components/UserManagement";

export default function UsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [loading, user, router]);

  if (loading || user?.role !== "admin") return null;

  return <UserManagement />;
}
