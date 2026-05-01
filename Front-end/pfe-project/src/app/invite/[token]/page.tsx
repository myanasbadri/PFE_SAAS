"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { acceptInvitation } from "@/lib/api";

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, setOrgs, setCurrentOrgId, orgs } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [orgName, setOrgName] = useState("");

  const token = params.token as string;

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Not logged in — redirect to auth with invite token
      router.push(`/auth?invite=${token}`);
      return;
    }

    // Accept the invitation
    acceptInvitation(token)
      .then((res) => {
        setStatus("success");
        setOrgName(res.org?.name || "the organization");
        setMessage("Invitation accepted successfully!");

        // Add org to list and switch to it
        if (res.org) {
          setOrgs([...orgs, res.org]);
          setCurrentOrgId(res.org.id);
        }
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err?.message || "Invalid or expired invitation");
      });
  }, [authLoading, user, token]);

  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Accepting invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "success" ? (
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
          ) : (
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          )}
          <CardTitle>
            {status === "success" ? "Welcome!" : "Invitation Error"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{message}</p>
          {status === "success" && (
            <p className="text-sm">
              You are now a member of <strong>{orgName}</strong>.
            </p>
          )}
          <Button onClick={() => router.push("/dashboard")} className="w-full">
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
