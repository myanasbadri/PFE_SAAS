"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  FileText, Mail, Lock, User, ArrowRight, ArrowLeft, Check, Globe, Loader2,
  ShoppingCart, Briefcase, Factory, GraduationCap, Hammer,
  UserCircle, Building2, Phone, MapPin, Hash,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';

interface AuthenticationProps {
  onAuthenticated: () => void;
}

/* ── Activity type options (Step 1) ──────────────────────────── */
const ACTIVITY_TYPES = [
  { value: "commercial",          labelKey: "regCommercial",          descKey: "regCommercialDesc",          Icon: ShoppingCart },
  { value: "service",             labelKey: "regService",             descKey: "regServiceDesc",             Icon: Briefcase },
  { value: "industrial",          labelKey: "regIndustrial",          descKey: "regIndustrialDesc",          Icon: Factory },
  { value: "liberal_profession",  labelKey: "regLiberalProfession",   descKey: "regLiberalProfessionDesc",   Icon: GraduationCap },
  { value: "artisanal",           labelKey: "regArtisanal",           descKey: "regArtisanalDesc",           Icon: Hammer },
] as const;

/* ── Person type options (Step 2) ────────────────────────────── */
const PERSON_TYPES = [
  { value: "physical", labelKey: "regPhysical", descKey: "regPhysicalDesc", Icon: UserCircle },
  { value: "moral",    labelKey: "regMoral",    descKey: "regMoralDesc",    Icon: Building2 },
] as const;

const TOTAL_STEPS = 5;

export const Authentication = ({ onAuthenticated }: AuthenticationProps) => {
  const { language, setLanguage, t } = useLanguage();
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sign In State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign Up Wizard State
  const [wizardStep, setWizardStep] = useState(0); // 0-4 = steps 1-5
  const [activityType, setActivityType] = useState('');
  const [personType, setPersonType] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(signInEmail, signInPassword);
      onAuthenticated();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to connect to server. Make sure the backend is running.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError('');
    if (signUpPassword !== signUpConfirmPassword) {
      setError('Passwords do not match!');
      return;
    }
    if (signUpPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setIsLoading(true);
    try {
      await register({
        name: signUpName,
        email: signUpEmail,
        password: signUpPassword,
        role: 'client',
        activity_type: activityType,
        person_type: personType,
        company_name: companyName,
        tax_id: taxId,
        phone,
        address,
      });
      onAuthenticated();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to connect to server. Make sure the backend is running.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = (): boolean => {
    switch (wizardStep) {
      case 0: return !!activityType;
      case 1: return !!personType;
      case 2: return true; // business info is optional
      case 3: return !!(signUpName && signUpEmail && signUpPassword && signUpConfirmPassword);
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    setError('');
    if (wizardStep === 3) {
      if (signUpPassword !== signUpConfirmPassword) {
        setError('Passwords do not match!');
        return;
      }
      if (signUpPassword.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }
    if (wizardStep < TOTAL_STEPS - 1) {
      setWizardStep(wizardStep + 1);
    }
  };

  const handlePrev = () => {
    setError('');
    if (wizardStep > 0) {
      setWizardStep(wizardStep - 1);
    }
  };

  const handleCancelWizard = () => {
    setWizardStep(0);
    setActivityType('');
    setPersonType('');
    setCompanyName('');
    setTaxId('');
    setPhone('');
    setAddress('');
    setSignUpName('');
    setSignUpEmail('');
    setSignUpPassword('');
    setSignUpConfirmPassword('');
    setError('');
    setActiveTab('signin');
  };

  const stepLabel = t('regStepOf')
    .replace('{step}', String(wizardStep + 1))
    .replace('{total}', String(TOTAL_STEPS));

  // Helper to get readable label from value
  const getActivityLabel = () => {
    const found = ACTIVITY_TYPES.find(a => a.value === activityType);
    return found ? t(found.labelKey) : '—';
  };
  const getPersonLabel = () => {
    const found = PERSON_TYPES.find(p => p.value === personType);
    return found ? t(found.labelKey) : '—';
  };

  const features = [
    { text: 'AI-Powered Invoice Extraction' },
    { text: 'Real-time Financial Analytics' },
    { text: 'LLaMA 2 AI Assistant' },
    { text: 'Multi-language Support' },
  ];

  /* ────────────────── Wizard Steps ────────────────── */

  const renderStep0 = () => (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold">{t('regStep1Title')}</h3>
        <p className="text-sm text-muted-foreground">{t('regStep1Subtitle')}</p>
      </div>
      <div className="grid gap-3">
        {ACTIVITY_TYPES.map(({ value, labelKey, descKey, Icon }) => (
          <div
            key={value}
            onClick={() => setActivityType(value)}
            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
              ${activityType === value
                ? 'border-accent bg-accent/5 shadow-sm'
                : 'border-border hover:border-accent/50 hover:bg-muted/50'
              }`}
          >
            <div className={`h-11 w-11 rounded-lg flex items-center justify-center flex-shrink-0
              ${activityType === value
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground'
              }`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{t(labelKey)}</p>
              <p className="text-xs text-muted-foreground">{t(descKey)}</p>
            </div>
            {activityType === value && (
              <Check className="h-5 w-5 text-accent flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold">{t('regStep2Title')}</h3>
        <p className="text-sm text-muted-foreground">{t('regStep2Subtitle')}</p>
      </div>
      <div className="grid gap-3">
        {PERSON_TYPES.map(({ value, labelKey, descKey, Icon }) => (
          <div
            key={value}
            onClick={() => setPersonType(value)}
            className={`flex items-center gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all
              ${personType === value
                ? 'border-accent bg-accent/5 shadow-sm'
                : 'border-border hover:border-accent/50 hover:bg-muted/50'
              }`}
          >
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0
              ${personType === value
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground'
              }`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{t(labelKey)}</p>
              <p className="text-sm text-muted-foreground">{t(descKey)}</p>
            </div>
            {personType === value && (
              <Check className="h-5 w-5 text-accent flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold">{t('regStep3Title')}</h3>
        <p className="text-sm text-muted-foreground">{t('regStep3Subtitle')}</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('regCompanyName')}</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t('regCompanyName')}
              className="pl-10 bg-input-background border-border focus:border-accent focus-visible:ring-accent h-12"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('regTaxId')}</Label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="0000000/X/X/X/000"
              className="pl-10 bg-input-background border-border focus:border-accent focus-visible:ring-accent h-12"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('regPhone')}</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+216 XX XXX XXX"
              className="pl-10 bg-input-background border-border focus:border-accent focus-visible:ring-accent h-12"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('regAddress')}</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('regAddress')}
              className="pl-10 bg-input-background border-border focus:border-accent focus-visible:ring-accent h-12"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold">{t('regStep4Title')}</h3>
        <p className="text-sm text-muted-foreground">{t('regStep4Subtitle')}</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={signUpName}
              onChange={(e) => setSignUpName(e.target.value)}
              placeholder="John Doe"
              className="pl-10 bg-input-background border-border focus:border-accent focus-visible:ring-accent h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              value={signUpEmail}
              onChange={(e) => setSignUpEmail(e.target.value)}
              placeholder="you@example.com"
              className="pl-10 bg-input-background border-border focus:border-accent focus-visible:ring-accent h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              value={signUpPassword}
              onChange={(e) => setSignUpPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10 bg-input-background border-border focus:border-accent focus-visible:ring-accent h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              value={signUpConfirmPassword}
              onChange={(e) => setSignUpConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10 bg-input-background border-border focus:border-accent focus-visible:ring-accent h-12"
              required
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold">{t('regStep5Title')}</h3>
        <p className="text-sm text-muted-foreground">{t('regStep5Subtitle')}</p>
      </div>
      <div className="space-y-4">
        {/* Activity & Person Type */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t('regActivityType')}</span>
            <span className="text-sm font-medium">{getActivityLabel()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t('regPersonType')}</span>
            <span className="text-sm font-medium">{getPersonLabel()}</span>
          </div>
        </div>

        {/* Business Info */}
        {(companyName || taxId || phone || address) && (
          <div className="rounded-lg border border-border p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('regBusinessInfo')}</p>
            {companyName && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('regCompanyName')}</span>
                <span className="text-sm font-medium">{companyName}</span>
              </div>
            )}
            {taxId && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('regTaxId')}</span>
                <span className="text-sm font-medium font-mono">{taxId}</span>
              </div>
            )}
            {phone && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('regPhone')}</span>
                <span className="text-sm font-medium">{phone}</span>
              </div>
            )}
            {address && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('regAddress')}</span>
                <span className="text-sm font-medium">{address}</span>
              </div>
            )}
          </div>
        )}

        {/* Account Info */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('regAccountInfo')}</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{signUpName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{signUpEmail}</span>
          </div>
        </div>

        <div className="flex items-start gap-3 py-1">
          <input
            type="checkbox"
            id="terms"
            className="mt-0.5 h-4 w-4 text-accent focus:ring-accent border-border rounded"
            required
          />
          <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight">
            I agree to the{' '}
            <a href="#" className="text-accent hover:underline font-medium">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-accent hover:underline font-medium">Privacy Policy</a>
          </label>
        </div>
      </div>
    </div>
  );

  const wizardSteps = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/95 to-primary/90 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left Side - Branding */}
        <div className="text-white space-y-8 lg:pr-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center shadow-lg">
                <FileText className="h-10 w-10 text-accent-foreground" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">SmartInvoice AI</h1>
                <p className="text-white/70">Intelligent Invoice Management</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Transform Your Financial Workflow</h2>
            <p className="text-white/80 text-lg leading-relaxed">
              Experience the future of invoice management with AI-powered extraction,
              real-time analytics, and intelligent financial insights.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                  <Check className="h-4 w-4 text-accent-foreground" />
                </div>
                <span className="text-white/90">{feature.text}</span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Badge className="bg-accent/20 text-accent hover:bg-accent/30 border-0 text-sm px-4 py-2">
              Powered by LLaMA 2 AI Model
            </Badge>
          </div>
        </div>

        {/* Right Side - Auth Forms */}
        <Card className="bg-card shadow-2xl border-border">
          <CardHeader className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                {activeTab === 'signup' && wizardStep > 0 ? (
                  <>
                    <CardTitle className="text-xl text-card-foreground flex items-center gap-3">
                      Create Account
                      <span className="text-sm font-normal text-muted-foreground">{stepLabel}</span>
                    </CardTitle>
                    <CardDescription>
                      Join SmartInvoice AI today
                    </CardDescription>
                  </>
                ) : (
                  <>
                    <CardTitle className="text-2xl text-card-foreground">
                      {activeTab === 'signin' ? 'Welcome Back' : 'Create Account'}
                    </CardTitle>
                    <CardDescription>
                      {activeTab === 'signin'
                        ? 'Sign in to access your dashboard'
                        : 'Join SmartInvoice AI today'}
                    </CardDescription>
                  </>
                )}
              </div>

              {/* Language Selector */}
              <Select value={language} onValueChange={(val) => setLanguage(val as 'en' | 'fr' | 'ar')}>
                <SelectTrigger className="w-32 bg-input-background">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">EN</SelectItem>
                  <SelectItem value="fr">FR</SelectItem>
                  <SelectItem value="ar">AR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Step Progress Indicator — only visible during sign-up wizard */}
            {activeTab === 'signup' && (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300
                      ${i <= wizardStep ? 'bg-accent w-8' : 'bg-muted w-6'}`}
                  />
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent className="pb-8">
            <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val as 'signin' | 'signup'); setError(''); setWizardStep(0); }} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted">
                <TabsTrigger value="signin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {/* Sign In Form */}
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-card-foreground">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="you@example.com"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        className="pl-10 bg-input-background border-border focus:border-accent focus-visible:ring-accent h-12"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="signin-password" className="text-card-foreground">Password</Label>
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        className="pl-10 bg-input-background border-border focus:border-accent focus-visible:ring-accent h-12"
                        required
                      />
                    </div>
                  </div>

                  {error && activeTab === 'signin' && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-12 text-base font-semibold mt-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-4 text-muted-foreground font-medium">OR CONTINUE WITH</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      type="button"
                      className="border-border h-12 hover:bg-secondary"
                    >
                      <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Google
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      className="border-border h-12 hover:bg-secondary"
                    >
                      <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                      </svg>
                      GitHub
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* Sign Up — Multi-step Wizard */}
              <TabsContent value="signup">
                <div className="space-y-6">
                  {/* Render current step */}
                  {wizardSteps[wizardStep]()}

                  {/* Error */}
                  {error && activeTab === 'signup' && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    {wizardStep === 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelWizard}
                        className="flex-1 h-11"
                      >
                        {t('regCancel')}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handlePrev}
                        className="flex-1 h-11 gap-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        {t('regPrevious')}
                      </Button>
                    )}

                    {wizardStep < TOTAL_STEPS - 1 ? (
                      <Button
                        type="button"
                        onClick={handleNext}
                        disabled={!canProceed()}
                        className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground h-11 gap-2"
                      >
                        {t('regNext')}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleSignUp}
                        disabled={isLoading}
                        className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground h-11 gap-2"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            {t('regCreateAccount')}
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
