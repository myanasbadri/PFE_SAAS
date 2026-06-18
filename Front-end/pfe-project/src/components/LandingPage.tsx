"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  FileText, 
  Zap, 
  BarChart3, 
  MessageSquare, 
  Globe, 
  Shield, 
  Check, 
  ArrowRight,
  Upload,
  Sparkles,
  TrendingUp,
  Clock,
  Users,
  Star,
  Lock,
  Award,
  CheckCircle,
  ChevronRight,
  Brain,
  Target,
  Percent,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface LandingPageProps {
  onGetStarted: () => void;
}

const mockChartData = [
  { month: 'Jan', value: 4500 },
  { month: 'Feb', value: 5200 },
  { month: 'Mar', value: 4800 },
  { month: 'Apr', value: 6100 },
  { month: 'May', value: 7200 },
  { month: 'Jun', value: 8500 },
];

const features = [
  {
    icon: Sparkles,
    title: 'AI-Powered Extraction',
    description: 'Extract invoice data instantly using advanced OCR and Claude AI. No manual data entry required.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: BarChart3,
    title: 'Smart Analytics Dashboard',
    description: 'Visualize your financial data with real-time analytics, trends, and AI-generated insights.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: FileText,
    title: 'Invoice Management',
    description: 'Create, manage, and export invoices with professional templates and PDF generation.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: MessageSquare,
    title: 'AI Financial Assistant',
    description: 'Get instant answers to financial questions with your 24/7 AI-powered assistant.',
    color: 'from-orange-500 to-red-500',
  },
  {
    icon: Globe,
    title: 'Multi-Language Support',
    description: 'Work seamlessly in English, French, and Arabic with full language support.',
    color: 'from-indigo-500 to-blue-500',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Bank-level encryption and compliance with international data protection standards.',
    color: 'from-gray-600 to-gray-800',
  },
];

const steps = [
  {
    icon: Upload,
    title: 'Upload Your Invoice',
    description: 'Simply drag and drop your invoice PDF or image file into the platform.',
  },
  {
    icon: Brain,
    title: 'AI Extracts Data',
    description: 'Our Claude AI instantly extracts and structures all invoice information.',
  },
  {
    icon: CheckCircle,
    title: 'Review & Manage',
    description: 'Review extracted data, get insights, and manage your finances effortlessly.',
  },
];

const benefits = [
  { icon: Clock, title: 'Save 10+ Hours Weekly', description: 'Automate manual data entry and invoice processing' },
  { icon: Target, title: 'Reduce Errors by 95%', description: 'AI-powered accuracy eliminates human mistakes' },
  { icon: TrendingUp, title: 'Better Financial Decisions', description: 'Real-time insights and predictive analytics' },
  { icon: Percent, title: 'Lower Operating Costs', description: 'Cut processing costs by up to 70%' },
];

const pricing = [
  {
    name: 'Starter',
    price: '$29',
    period: '/month',
    description: 'Perfect for freelancers and small businesses',
    features: ['Up to 100 invoices/month', 'AI extraction & OCR', 'Basic analytics', 'Email support', '2 team members'],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Professional',
    price: '$99',
    period: '/month',
    description: 'For growing teams and businesses',
    features: ['Up to 1,000 invoices/month', 'Advanced AI features', 'Full analytics dashboard', 'Priority support', '10 team members', 'API access'],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations with custom needs',
    features: ['Unlimited invoices', 'Dedicated AI model', 'Custom integrations', '24/7 phone support', 'Unlimited team members', 'SLA guarantee'],
    cta: 'Contact Sales',
    popular: false,
  },
];

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'CFO, TechStart Inc',
    company: 'TechStart',
    content: 'SmartInvoice AI has transformed our accounting workflow. We\'ve cut invoice processing time by 80% and our team loves it.',
    rating: 5,
    avatar: 'SJ',
  },
  {
    name: 'Michael Chen',
    role: 'Finance Director',
    company: 'Global Ventures',
    content: 'The AI accuracy is remarkable. It catches errors we used to miss and the insights have helped us make better financial decisions.',
    rating: 5,
    avatar: 'MC',
  },
  {
    name: 'Emma Williams',
    role: 'Small Business Owner',
    company: 'Creative Studio',
    content: 'As a small business, this tool has been a game-changer. I can focus on my work instead of drowning in paperwork.',
    rating: 5,
    avatar: 'EW',
  },
];

const compliance = [
  { icon: Shield, title: 'SOC 2 Type II Certified', description: 'Industry-leading security standards' },
  { icon: Lock, title: 'GDPR Compliant', description: 'Full European data protection compliance' },
  { icon: Award, title: 'ISO 27001 Certified', description: 'International security management' },
  { icon: CheckCircle, title: 'Bank-Level Encryption', description: 'AES-256 encryption for all data' },
];

export const LandingPage = ({ onGetStarted }: LandingPageProps) => {
  return (
    <div className="min-h-screen bg-card">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-card/80 backdrop-blur-lg border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#0A2540] to-[#10B981] flex items-center justify-center">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">SmartInvoice AI</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-foreground transition">Features</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-foreground transition">How it Works</a>
              <a href="#pricing" className="text-gray-600 hover:text-foreground transition">Pricing</a>
              <a href="#security" className="text-gray-600 hover:text-foreground transition">Security</a>
              <Button variant="ghost" onClick={onGetStarted}>Sign In</Button>
              <Button className="bg-gradient-to-r from-[#0A2540] to-[#10B981] text-white hover:opacity-90" onClick={onGetStarted}>
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0A2540] via-[#0A2540]/95 to-[#10B981]/20 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge className="bg-card/10 text-white border-white/20 hover:bg-card/20">
                <Sparkles className="h-3 w-3 mr-1" />
                Powered by Claude AI
              </Badge>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight">
                Smart Invoice Management with{' '}
                <span className="bg-gradient-to-r from-[#10B981] to-cyan-400 bg-clip-text text-transparent">
                  AI Power
                </span>
              </h1>
              
              <p className="text-xl text-white/80 leading-relaxed">
                Extract invoice data instantly, analyze expenses with AI, and make better financial decisions. 
                Stop wasting time on manual data entry.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  className="bg-[#10B981] hover:bg-[#10B981]/90 text-white text-lg px-8 py-6"
                  onClick={onGetStarted}
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  className="bg-transparent border border-white/20 text-white hover:bg-white/10 hover:text-white text-lg px-8 py-6"
                >
                  Request Demo
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>

              <div className="flex items-center gap-8 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-[#10B981]" />
                  <span className="text-white/70">No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-[#10B981]" />
                  <span className="text-white/70">14-day free trial</span>
                </div>
              </div>
            </div>

            {/* Hero Dashboard Preview */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-[#10B981] to-cyan-400 rounded-3xl blur-2xl opacity-20"></div>
              <Card className="relative border-0 shadow-2xl bg-card/10 backdrop-blur-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Financial Overview</CardTitle>
                    <Badge className="bg-[#10B981]/20 text-[#10B981] border-0">Live</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mockChartData}>
                        <defs>
                          <linearGradient id="heroGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" />
                        <YAxis stroke="rgba(255,255,255,0.5)" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(10, 37, 64, 0.9)', 
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#10B981" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#heroGradient)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-card/5 rounded-lg p-3 backdrop-blur-sm">
                      <p className="text-xs text-white/60">Revenue</p>
                      <p className="text-lg font-bold text-white">$8.5K</p>
                    </div>
                    <div className="bg-card/5 rounded-lg p-3 backdrop-blur-sm">
                      <p className="text-xs text-white/60">Growth</p>
                      <p className="text-lg font-bold text-[#10B981]">+18%</p>
                    </div>
                    <div className="bg-card/5 rounded-lg p-3 backdrop-blur-sm">
                      <p className="text-xs text-white/60">Invoices</p>
                      <p className="text-lg font-bold text-white">142</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="mb-4 bg-[#0A2540]/10 text-foreground border-0">Features</Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Everything You Need to Manage Invoices
            </h2>
            <p className="text-xl text-gray-600">
              Powerful AI tools designed to save time and improve accuracy
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-card border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
                <CardHeader>
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-foreground">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-card">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="mb-4 bg-[#10B981]/10 text-[#10B981] border-0">Simple Process</Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              How SmartInvoice AI Works
            </h2>
            <p className="text-xl text-gray-600">
              Get started in minutes with our simple three-step process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-[#10B981] to-transparent"></div>
                )}
                <div className="relative bg-card border-2 border-gray-100 rounded-2xl p-8 hover:border-[#10B981]/30 transition-all hover:shadow-lg">
                  <div className="absolute -top-4 -left-4 h-12 w-12 rounded-full bg-gradient-to-br from-[#0A2540] to-[#10B981] flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    {index + 1}
                  </div>
                  <div className="mb-4 mt-4">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#10B981]/20 to-[#10B981]/5 flex items-center justify-center">
                      <step.icon className="h-8 w-8 text-[#10B981]" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0A2540] to-[#0A2540]/90 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="mb-4 bg-card/10 text-white border-white/20">Business Impact</Badge>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">
              Transform Your Business Operations
            </h2>
            <p className="text-xl text-white/80">
              Join thousands of businesses saving time and reducing costs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-card/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-card/10 transition-all">
                <benefit.icon className="h-10 w-10 text-[#10B981] mb-4" />
                <h3 className="text-2xl font-bold mb-2">{benefit.title}</h3>
                <p className="text-white/70">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="mb-4 bg-[#0A2540]/10 text-foreground border-0">Pricing</Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              Choose the plan that fits your business needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricing.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative bg-card border-2 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 ${
                  plan.popular 
                    ? 'border-[#10B981] bg-gradient-to-br from-white to-[#10B981]/5' 
                    : 'border-gray-200 bg-card'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[#10B981] text-white border-0 px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl text-foreground mb-2">{plan.name}</CardTitle>
                  <CardDescription className="text-gray-600">{plan.description}</CardDescription>
                  <div className="mt-6">
                    <span className="text-5xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-gray-600">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full mt-6 ${
                      plan.popular 
                        ? 'bg-[#10B981] hover:bg-[#10B981]/90 text-white' 
                        : 'bg-[#0A2540] hover:bg-[#0A2540]/90 text-white'
                    }`}
                    size="lg"
                    onClick={onGetStarted}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="mb-4 bg-[#10B981]/10 text-[#10B981] border-0">Testimonials</Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Loved by Finance Teams Worldwide
            </h2>
            <p className="text-xl text-gray-600">
              See what our customers have to say about SmartInvoice AI
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-card border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 leading-relaxed italic">
                    "{testimonial.content}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#0A2540] to-[#10B981] flex items-center justify-center text-white font-bold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.name}</p>
                      <p className="text-sm text-gray-600">{testimonial.role}</p>
                      <p className="text-xs text-gray-500">{testimonial.company}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Security & Compliance */}
      <section id="security" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="mb-4 bg-[#0A2540]/10 text-foreground border-0">Security & Compliance</Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Enterprise-Grade Security You Can Trust
            </h2>
            <p className="text-xl text-gray-600">
              Your data is protected with industry-leading security standards
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {compliance.map((item, index) => (
              <Card key={index} className="bg-card border-2 border-gray-200 hover:border-[#10B981]/50 transition-all hover:shadow-lg">
                <CardContent className="pt-6 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#0A2540]/10 to-[#10B981]/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="h-8 w-8 text-foreground" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#0A2540] to-[#10B981] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Ready to Transform Your Invoice Management?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join thousands of businesses already saving time and money with SmartInvoice AI
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-card text-foreground hover:bg-gray-100 text-lg px-8 py-6"
              onClick={onGetStarted}
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white/20 text-white hover:bg-white/10 hover:text-white text-lg px-8 py-6"
            >
              Schedule Demo
            </Button>
          </div>
          <p className="mt-6 text-white/70">No credit card required • 14-day free trial • Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A2540] text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#10B981] to-cyan-400 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold">SmartInvoice AI</span>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">
                AI-powered invoice management for modern businesses. Save time, reduce errors, and make better decisions.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#features" className="hover:text-[#10B981] transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-[#10B981] transition">Pricing</a></li>
                <li><a href="#" className="hover:text-[#10B981] transition">API</a></li>
                <li><a href="#" className="hover:text-[#10B981] transition">Integrations</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#" className="hover:text-[#10B981] transition">About Us</a></li>
                <li><a href="#" className="hover:text-[#10B981] transition">Blog</a></li>
                <li><a href="#" className="hover:text-[#10B981] transition">Careers</a></li>
                <li><a href="#" className="hover:text-[#10B981] transition">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#" className="hover:text-[#10B981] transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-[#10B981] transition">Terms of Service</a></li>
                <li><a href="#security" className="hover:text-[#10B981] transition">Security</a></li>
                <li><a href="#" className="hover:text-[#10B981] transition">GDPR</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-white/60">
              © 2026 SmartInvoice AI. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-white/60 hover:text-[#10B981] transition">
                <Users className="h-5 w-5" />
              </a>
              <a href="#" className="text-white/60 hover:text-[#10B981] transition">
                <MessageSquare className="h-5 w-5" />
              </a>
              <a href="#" className="text-white/60 hover:text-[#10B981] transition">
                <Globe className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};