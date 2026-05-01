"use client";

import { useState } from "react";
import { Check, X, Zap, Building2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Link from "next/link";

const plans = [
  {
    key: "free",
    name: "Free",
    icon: Zap,
    description: "Perfect for getting started",
    monthly: 0,
    yearly: 0,
    features: [
      { name: "50 invoices/month", included: true },
      { name: "3 team members", included: true },
      { name: "20 AI queries/month", included: true },
      { name: "100 MB storage", included: true },
      { name: "Basic extraction", included: true },
      { name: "PDF export", included: true },
      { name: "Batch extraction", included: false },
      { name: "AI Advisor", included: false },
      { name: "Excel export", included: false },
      { name: "Custom branding", included: false },
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    key: "pro",
    name: "Pro",
    icon: Rocket,
    description: "For growing businesses",
    monthly: 29,
    yearly: 290,
    features: [
      { name: "500 invoices/month", included: true },
      { name: "15 team members", included: true },
      { name: "200 AI queries/month", included: true },
      { name: "5 GB storage", included: true },
      { name: "Basic extraction", included: true },
      { name: "PDF & Excel export", included: true },
      { name: "Batch extraction", included: true },
      { name: "AI Advisor", included: true },
      { name: "Email notifications", included: true },
      { name: "Custom branding", included: true },
    ],
    cta: "Start Pro Trial",
    popular: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    icon: Building2,
    description: "For large organizations",
    monthly: 99,
    yearly: 990,
    features: [
      { name: "Unlimited invoices", included: true },
      { name: "Unlimited members", included: true },
      { name: "Unlimited AI queries", included: true },
      { name: "Unlimited storage", included: true },
      { name: "All features included", included: true },
      { name: "Priority support", included: true },
      { name: "Custom integrations", included: true },
      { name: "Dedicated account manager", included: true },
      { name: "SLA guarantee", included: true },
      { name: "On-premise option", included: true },
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">SmartInvoice</Link>
          <div className="flex items-center gap-4">
            <Link href="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Choose the plan that fits your business
          </p>
          <div className="flex items-center justify-center gap-3">
            <Label className="text-sm">Monthly</Label>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <Label className="text-sm">
              Annual <Badge variant="secondary" className="ml-1">Save 17%</Badge>
            </Label>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const price = annual ? plan.yearly : plan.monthly;
            const period = annual ? "/year" : "/month";

            return (
              <Card
                key={plan.key}
                className={`relative ${plan.popular ? "border-emerald-500 shadow-lg scale-105" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-emerald-500 text-white">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-3">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">
                      ${price}
                    </span>
                    {price > 0 && (
                      <span className="text-muted-foreground">{period}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature.name} className="flex items-center gap-2 text-sm">
                        {feature.included ? (
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={feature.included ? "" : "text-muted-foreground/50"}>
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/auth">
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
