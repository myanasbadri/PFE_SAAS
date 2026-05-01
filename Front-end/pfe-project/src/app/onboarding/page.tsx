"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Users, CreditCard, Upload, ArrowRight,
  ArrowLeft, Check, Loader2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { createOrg, sendInvitation, switchOrg } from "@/lib/api";
import { toast } from "sonner";

const STEPS = [
  { key: "org", icon: Building2, title: "Create Workspace" },
  { key: "team", icon: Users, title: "Invite Team" },
  { key: "plan", icon: CreditCard, title: "Choose Plan" },
  { key: "done", icon: Check, title: "All Set!" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, orgs, setOrgs, setCurrentOrgId, updateToken } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Org
  const [orgName, setOrgName] = useState("");
  const [createdOrgId, setCreatedOrgId] = useState("");

  // Step 2: Invites
  const [inviteEmails, setInviteEmails] = useState(["", "", ""]);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) return;
    setLoading(true);
    try {
      const res = await createOrg({ name: orgName.trim() });
      setCreatedOrgId(res.org.id);
      setOrgs([...orgs, res.org]);
      setCurrentOrgId(res.org.id);

      // Switch to new org to get proper token
      const switchRes = await switchOrg(res.org.id);
      updateToken(switchRes.token);

      setStep(1);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteTeam = async () => {
    const emails = inviteEmails.filter((e) => e.trim());
    if (emails.length === 0) {
      setStep(2);
      return;
    }

    setLoading(true);
    let sent = 0;
    for (const email of emails) {
      try {
        await sendInvitation(createdOrgId, { email: email.trim(), role: "member" });
        sent++;
      } catch {
        // Skip failed invites
      }
    }
    if (sent > 0) toast.success(`${sent} invitation(s) sent`);
    setStep(2);
    setLoading(false);
  };

  const handleFinish = () => {
    router.push("/dashboard");
  };

  // If user already has orgs, skip to dashboard
  if (orgs.length > 0 && step === 0 && !createdOrgId) {
    // They already have an org, but chose to come here — let them create another
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${i <= step
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground"
                  }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 mx-1 ${i < step ? "bg-emerald-500" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="pt-8 pb-6 px-8">
            {/* Step 0: Create Organization */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
                  <h2 className="text-2xl font-bold">Name your workspace</h2>
                  <p className="text-muted-foreground mt-1">
                    This is where your team will manage invoices together
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
                    autoFocus
                  />
                </div>
                <Button
                  onClick={handleCreateOrg}
                  disabled={loading || !orgName.trim()}
                  className="w-full gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Continue
                </Button>
              </div>
            )}

            {/* Step 1: Invite Team */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
                  <h2 className="text-2xl font-bold">Invite your team</h2>
                  <p className="text-muted-foreground mt-1">
                    Add colleagues by email (you can skip this)
                  </p>
                </div>
                <div className="space-y-3">
                  {inviteEmails.map((email, i) => (
                    <Input
                      key={i}
                      type="email"
                      value={email}
                      onChange={(e) => {
                        const updated = [...inviteEmails];
                        updated[i] = e.target.value;
                        setInviteEmails(updated);
                      }}
                      placeholder={`teammate${i + 1}@company.com`}
                    />
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                    Skip
                  </Button>
                  <Button
                    onClick={handleInviteTeam}
                    disabled={loading}
                    className="flex-1 gap-2"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Send Invites
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Choose Plan */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
                  <h2 className="text-2xl font-bold">Choose your plan</h2>
                  <p className="text-muted-foreground mt-1">
                    Start free, upgrade anytime
                  </p>
                </div>
                <div className="space-y-3">
                  <Card
                    className="cursor-pointer hover:border-emerald-500 transition-colors border-emerald-500"
                    onClick={() => setStep(3)}
                  >
                    <CardContent className="flex items-center justify-between py-4">
                      <div>
                        <p className="font-semibold">Free Plan</p>
                        <p className="text-sm text-muted-foreground">50 invoices/mo, 3 members</p>
                      </div>
                      <Badge>$0</Badge>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:border-emerald-500 transition-colors">
                    <CardContent className="flex items-center justify-between py-4">
                      <div>
                        <p className="font-semibold">Pro Plan</p>
                        <p className="text-sm text-muted-foreground">500 invoices/mo, 15 members, AI</p>
                      </div>
                      <Badge variant="secondary">$29/mo</Badge>
                    </CardContent>
                  </Card>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  You can upgrade from Settings at any time
                </p>
                <Button onClick={() => setStep(3)} className="w-full gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Continue with Free
                </Button>
              </div>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <div className="space-y-6 text-center">
                <div>
                  <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-bold">You're all set!</h2>
                  <p className="text-muted-foreground mt-1">
                    Your workspace is ready. Start by uploading your first invoice.
                  </p>
                </div>
                <Button onClick={handleFinish} size="lg" className="w-full gap-2">
                  <Sparkles className="h-4 w-4" />
                  Go to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
