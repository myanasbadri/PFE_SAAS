"use client";

import { Authentication } from "@/components/Authentication";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Suspense, useEffect } from "react";
import { Loader2 } from "lucide-react";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, orgs } = useAuth();

  const inviteToken = searchParams.get("invite");

  // If already logged in, redirect appropriately
  useEffect(() => {
    if (!loading && user) {
      if (inviteToken) {
        router.push(`/invite/${inviteToken}`);
      } else {
        router.push("/dashboard");
      }
    }
  }, [loading, user, router, inviteToken]);

  const handleAuthenticated = () => {
    if (inviteToken) {
      router.push(`/invite/${inviteToken}`);
    } else if (orgs.length === 0) {
      router.push("/onboarding");
    } else {
      router.push("/dashboard");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <Authentication onAuthenticated={handleAuthenticated} />;
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
