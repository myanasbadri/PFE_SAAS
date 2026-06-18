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
import { ApiError, forgotPassword, resetPassword } from '@/lib/api';
import { useGoogleLogin } from '@react-oauth/google';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

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

/* ── Country dial codes with flag emojis ─────────────────────── */
const COUNTRIES = [
  { code: "+216", flag: "\u{1F1F9}\u{1F1F3}", name: "Tunisia" },
  { code: "+213", flag: "\u{1F1E9}\u{1F1FF}", name: "Algeria" },
  { code: "+212", flag: "\u{1F1F2}\u{1F1E6}", name: "Morocco" },
  { code: "+218", flag: "\u{1F1F1}\u{1F1FE}", name: "Libya" },
  { code: "+20",  flag: "\u{1F1EA}\u{1F1EC}", name: "Egypt" },
  { code: "+966", flag: "\u{1F1F8}\u{1F1E6}", name: "Saudi Arabia" },
  { code: "+971", flag: "\u{1F1E6}\u{1F1EA}", name: "UAE" },
  { code: "+974", flag: "\u{1F1F6}\u{1F1E6}", name: "Qatar" },
  { code: "+973", flag: "\u{1F1E7}\u{1F1ED}", name: "Bahrain" },
  { code: "+968", flag: "\u{1F1F4}\u{1F1F2}", name: "Oman" },
  { code: "+965", flag: "\u{1F1F0}\u{1F1FC}", name: "Kuwait" },
  { code: "+962", flag: "\u{1F1EF}\u{1F1F4}", name: "Jordan" },
  { code: "+961", flag: "\u{1F1F1}\u{1F1E7}", name: "Lebanon" },
  { code: "+964", flag: "\u{1F1EE}\u{1F1F6}", name: "Iraq" },
  { code: "+963", flag: "\u{1F1F8}\u{1F1FE}", name: "Syria" },
  { code: "+970", flag: "\u{1F1F5}\u{1F1F8}", name: "Palestine" },
  { code: "+249", flag: "\u{1F1F8}\u{1F1E9}", name: "Sudan" },
  { code: "+33",  flag: "\u{1F1EB}\u{1F1F7}", name: "France" },
  { code: "+49",  flag: "\u{1F1E9}\u{1F1EA}", name: "Germany" },
  { code: "+44",  flag: "\u{1F1EC}\u{1F1E7}", name: "United Kingdom" },
  { code: "+39",  flag: "\u{1F1EE}\u{1F1F9}", name: "Italy" },
  { code: "+34",  flag: "\u{1F1EA}\u{1F1F8}", name: "Spain" },
  { code: "+31",  flag: "\u{1F1F3}\u{1F1F1}", name: "Netherlands" },
  { code: "+32",  flag: "\u{1F1E7}\u{1F1EA}", name: "Belgium" },
  { code: "+41",  flag: "\u{1F1E8}\u{1F1ED}", name: "Switzerland" },
  { code: "+46",  flag: "\u{1F1F8}\u{1F1EA}", name: "Sweden" },
  { code: "+47",  flag: "\u{1F1F3}\u{1F1F4}", name: "Norway" },
  { code: "+45",  flag: "\u{1F1E9}\u{1F1F0}", name: "Denmark" },
  { code: "+48",  flag: "\u{1F1F5}\u{1F1F1}", name: "Poland" },
  { code: "+351", flag: "\u{1F1F5}\u{1F1F9}", name: "Portugal" },
  { code: "+30",  flag: "\u{1F1EC}\u{1F1F7}", name: "Greece" },
  { code: "+90",  flag: "\u{1F1F9}\u{1F1F7}", name: "Turkey" },
  { code: "+1",   flag: "\u{1F1FA}\u{1F1F8}", name: "United States" },
  { code: "+1",   flag: "\u{1F1E8}\u{1F1E6}", name: "Canada" },
  { code: "+52",  flag: "\u{1F1F2}\u{1F1FD}", name: "Mexico" },
  { code: "+55",  flag: "\u{1F1E7}\u{1F1F7}", name: "Brazil" },
  { code: "+54",  flag: "\u{1F1E6}\u{1F1F7}", name: "Argentina" },
  { code: "+86",  flag: "\u{1F1E8}\u{1F1F3}", name: "China" },
  { code: "+81",  flag: "\u{1F1EF}\u{1F1F5}", name: "Japan" },
  { code: "+82",  flag: "\u{1F1F0}\u{1F1F7}", name: "South Korea" },
  { code: "+91",  flag: "\u{1F1EE}\u{1F1F3}", name: "India" },
  { code: "+92",  flag: "\u{1F1F5}\u{1F1F0}", name: "Pakistan" },
  { code: "+62",  flag: "\u{1F1EE}\u{1F1E9}", name: "Indonesia" },
  { code: "+60",  flag: "\u{1F1F2}\u{1F1FE}", name: "Malaysia" },
  { code: "+65",  flag: "\u{1F1F8}\u{1F1EC}", name: "Singapore" },
  { code: "+66",  flag: "\u{1F1F9}\u{1F1ED}", name: "Thailand" },
  { code: "+84",  flag: "\u{1F1FB}\u{1F1F3}", name: "Vietnam" },
  { code: "+234", flag: "\u{1F1F3}\u{1F1EC}", name: "Nigeria" },
  { code: "+27",  flag: "\u{1F1FF}\u{1F1E6}", name: "South Africa" },
  { code: "+254", flag: "\u{1F1F0}\u{1F1EA}", name: "Kenya" },
  { code: "+61",  flag: "\u{1F1E6}\u{1F1FA}", name: "Australia" },
  { code: "+64",  flag: "\u{1F1F3}\u{1F1FF}", name: "New Zealand" },
  { code: "+7",   flag: "\u{1F1F7}\u{1F1FA}", name: "Russia" },
  { code: "+380", flag: "\u{1F1FA}\u{1F1E6}", name: "Ukraine" },
] as const;

const TOTAL_STEPS = 5;

export const Authentication = ({ onAuthenticated }: AuthenticationProps) => {
  const { language, setLanguage, t } = useLanguage();
  const { login, googleLogin, register } = useAuth();
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
  const [countryCode, setCountryCode] = useState('+216');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');

  // Forgot Password State
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'code'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

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
        setError(t('regConnectionError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotOpen = () => {
    setForgotEmail(signInEmail);
    setResetCode('');
    setNewPassword('');
    setForgotError('');
    setForgotSuccess('');
    setForgotStep('email');
    setForgotOpen(true);
  };

  const handleSendResetCode = async () => {
    setForgotError('');
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await forgotPassword(forgotEmail.trim());
      setForgotStep('code');
      setForgotSuccess(t('regResetCodeSent'));
    } catch (err) {
      if (err instanceof ApiError) setForgotError(err.message);
      else setForgotError(t('regConnectionError'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setForgotError('');
    setForgotSuccess('');
    if (!resetCode.trim() || !newPassword.trim()) return;
    if (newPassword.length < 6) {
      setForgotError(t('regPasswordTooShort'));
      return;
    }
    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail.trim(), resetCode.trim(), newPassword);
      setForgotSuccess(t('regResetSuccess'));
      setTimeout(() => setForgotOpen(false), 2000);
    } catch (err) {
      if (err instanceof ApiError) setForgotError(err.message);
      else setForgotError(t('regConnectionError'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleSuccess = async (accessToken: string) => {
    setError('');
    setIsLoading(true);
    try {
      await googleLogin(accessToken);
      setTimeout(() => onAuthenticated(), 100);
    } catch (err) {
      console.error('Google login error:', err);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      handleGoogleSuccess(tokenResponse.access_token);
    },
    onError: () => {
      setError(t('regConnectionError'));
    },
    flow: 'implicit',
  });

  const handleSignUp = async () => {
    setError('');
    if (signUpPassword !== signUpConfirmPassword) {
      setError(t('regPasswordsMismatch'));
      return;
    }
    if (signUpPassword.length < 6) {
      setError(t('regPasswordTooShort'));
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
        phone: phone ? `${countryCode} ${phone}` : '',
        address,
      });
      onAuthenticated();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('regConnectionError'));
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
        setError(t('regPasswordsMismatch'));
        return;
      }
      if (signUpPassword.length < 6) {
        setError(t('regPasswordTooShort'));
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
    setCountryCode('+216');
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
    { text: 'Claude AI Assistant' },
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
          <div className="flex gap-2">
            <Select value={`${countryCode}|${COUNTRIES.find(c => c.code === countryCode)?.name || ''}`} onValueChange={(val) => setCountryCode(val.split('|')[0])}>
              <SelectTrigger className="w-[130px] shrink-0 bg-input-background border-border focus:border-accent focus-visible:ring-accent h-12">
                <SelectValue>
                  {(() => {
                    const c = COUNTRIES.find(c => c.code === countryCode);
                    return c ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-base leading-none">{c.flag}</span>
                        <span className="text-sm font-mono">{c.code}</span>
                      </span>
                    ) : countryCode;
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {COUNTRIES.map((c, i) => (
                  <SelectItem key={`${c.code}-${c.name}-${i}`} value={`${c.code}|${c.name}`}>
                    <span className="flex items-center gap-2">
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="text-sm truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground font-mono ml-auto">{c.code}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="XX XXX XXX"
                className="pl-10 bg-input-background border-border focus:border-accent focus-visible:ring-accent h-12"
              />
            </div>
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
          <Label>{t('regFullName')}</Label>
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
          <Label>{t('regEmail')}</Label>
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
          <Label>{t('regPassword')}</Label>
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
          <Label>{t('regConfirmPassword')}</Label>
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
                <span className="text-sm font-medium">
                  {(() => { const c = COUNTRIES.find(c => c.code === countryCode); return c ? `${c.flag} ` : ''; })()}{countryCode} {phone}
                </span>
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
            <span className="text-sm text-muted-foreground">{t('name')}</span>
            <span className="text-sm font-medium">{signUpName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t('email')}</span>
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
            {t('regAgreeToTerms')}{' '}
            <a href="#" className="text-accent hover:underline font-medium">{t('regTermsOfService')}</a>
            {' '}{t('regAnd')}{' '}
            <a href="#" className="text-accent hover:underline font-medium">{t('regPrivacyPolicy')}</a>
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
              Powered by Claude AI Model
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
                      {t('regCreateAccount')}
                      <span className="text-sm font-normal text-muted-foreground">{stepLabel}</span>
                    </CardTitle>
                    <CardDescription>
                      {t('regJoinSmartInvoice')}
                    </CardDescription>
                  </>
                ) : (
                  <>
                    <CardTitle className="text-2xl text-card-foreground">
                      {activeTab === 'signin' ? t('regWelcomeBack') : t('regCreateAccount')}
                    </CardTitle>
                    <CardDescription>
                      {activeTab === 'signin'
                        ? t('regSignInDesc')
                        : t('regJoinSmartInvoice')}
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
                  {t('regSignIn')}
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {t('regSignUp')}
                </TabsTrigger>
              </TabsList>

              {/* Sign In Form */}
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-card-foreground">{t('regEmail')}</Label>
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
                      <Label htmlFor="signin-password" className="text-card-foreground">{t('regPassword')}</Label>
                      <button
                        type="button"
                        onClick={handleForgotOpen}
                        className="text-xs text-accent hover:underline font-medium"
                      >
                        {t('regForgotPassword')}
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
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
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
                        {t('regSignIn')}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-4 text-muted-foreground font-medium">{t('regOrContinueWith')}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    type="button"
                    disabled={isLoading}
                    onClick={() => triggerGoogleLogin()}
                    className="w-full border-border h-12 hover:bg-secondary"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        {t('regContinueWithGoogle')}
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Sign Up — Multi-step Wizard */}
              <TabsContent value="signup">
                <div className="space-y-6">
                  {/* Render current step */}
                  {wizardSteps[wizardStep]()}

                  {/* Error */}
                  {error && activeTab === 'signup' && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
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

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('regResetPassword')}</DialogTitle>
            <DialogDescription>
              {forgotStep === 'email' ? t('regResetPasswordDesc') : t('regEnterResetCode')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {forgotStep === 'email' ? (
              <>
                <div className="space-y-2">
                  <Label>{t('regEmail')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-10 h-12"
                      onKeyDown={(e) => e.key === 'Enter' && handleSendResetCode()}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSendResetCode}
                  disabled={forgotLoading || !forgotEmail.trim()}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11"
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('regSendResetCode')}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t('regResetCode')}</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="pl-10 h-12 text-center tracking-[0.5em] font-mono text-lg"
                      maxLength={6}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('regNewPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10 h-12"
                      onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleResetPassword}
                  disabled={forgotLoading || !resetCode.trim() || !newPassword.trim()}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11"
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('regResetMyPassword')}
                </Button>
              </>
            )}

            {forgotError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                {forgotError}
              </div>
            )}
            {forgotSuccess && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm">
                {forgotSuccess}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
