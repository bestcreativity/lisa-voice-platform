import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight, Mic, Phone, Zap, Shield, BarChart3, Sparkles, CheckCircle2
} from 'lucide-react';

const features = [
  {
    icon: Mic,
    title: 'Real-Time Voice AI',
    description: 'Sub-second latency conversations powered by Gemini Live with natural interruption handling.',
  },
  {
    icon: Phone,
    title: 'Outbound Calling',
    description: 'Place real phone calls via Twilio. Your AI agent speaks directly to prospects on any line.',
  },
  {
    icon: Zap,
    title: 'Multi-Agent Roles',
    description: 'Recruiter, sales, developer, designer — switch personas instantly with tailored scripts.',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Encrypted sessions, secure API proxying, and per-user data isolation with Supabase.',
  },
  {
    icon: BarChart3,
    title: 'Session Analytics',
    description: 'Track every conversation, call duration, and conversion metrics in one dashboard.',
  },
  {
    icon: Sparkles,
    title: 'Premium Voice Models',
    description: 'Gemini native voices or ElevenLabs ultra-realistic synthesis — your choice per campaign.',
  },
];

const plans = [
  {
    name: 'Starter',
    price: '$49',
    period: '/mo',
    features: ['1 voice agent', '500 min/mo', 'Web sessions', 'Email support'],
  },
  {
    name: 'Pro',
    price: '$199',
    period: '/mo',
    featured: true,
    features: ['5 voice agents', '5,000 min/mo', 'Twilio calling', 'Analytics dashboard', 'Priority support'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: ['Unlimited agents', 'Custom volume', 'SSO & SLA', 'Dedicated infra', 'White-label'],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07090f] text-slate-200 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px]" />
      </div>

      <nav className="relative z-10 max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center">
            <Sparkles className="text-white" size={16} />
          </div>
          <span className="font-bold text-lg tracking-tight">LISA</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5">
            Sign in
          </Link>
          <Link
            to="/auth?mode=signup"
            className="text-sm font-medium bg-gradient-to-r from-cyan-500 to-indigo-500 text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </div>
      </nav>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            AI Voice Platform for Revenue Teams
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
            Your AI voice agent
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              that closes deals
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            LISA runs live voice conversations — screening candidates, pitching services, and booking meetings — with human-level fluency over web or phone.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/auth?mode=signup"
              className="group flex items-center gap-2 bg-white text-slate-950 font-semibold px-6 py-3 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Start free trial
              <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/app/workspace"
              className="flex items-center gap-2 border border-white/10 text-slate-300 font-medium px-6 py-3 rounded-xl hover:bg-white/5 transition-colors"
            >
              <Mic size={18} />
              Try live demo
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-slate-500">
            {['Gemini Live API', 'Twilio Voice', 'ElevenLabs TTS', 'Supabase Auth'].map((tag) => (
              <span key={tag} className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500" />
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Built for scale</h2>
          <p className="text-slate-400 max-w-xl mx-auto">Everything you need to deploy production-grade AI voice agents.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-cyan-500/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                <Icon size={20} className="text-cyan-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="pricing" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Simple pricing</h2>
          <p className="text-slate-400">Start small, scale to enterprise.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`p-6 rounded-2xl border flex flex-col ${
                plan.featured
                  ? 'bg-gradient-to-b from-cyan-500/10 to-indigo-500/5 border-cyan-500/30 scale-105'
                  : 'bg-white/[0.02] border-white/5'
              }`}
            >
              {plan.featured && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 mb-3">Most popular</span>
              )}
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <div className="mt-2 mb-6">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-slate-500 text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth?mode=signup"
                className={`text-center py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  plan.featured
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white hover:opacity-90'
                    : 'border border-white/10 text-slate-300 hover:bg-white/5'
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-10 text-center text-sm text-slate-500">
        <p>© {new Date().getFullYear()} LISA Voice Intelligence. All rights reserved.</p>
      </footer>
    </div>
  );
}
