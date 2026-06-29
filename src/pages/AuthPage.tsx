import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Mail, Lock, User, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const isSignup = searchParams.get('mode') === 'signup';
  const [mode, setMode] = useState<'signin' | 'signup'>(isSignup ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, isConfigured } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!isConfigured) {
      navigate('/app');
      return;
    }

    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, fullName);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    navigate('/app');
  };

  const handleGuest = () => {
    sessionStorage.setItem('lisa_guest', 'true');
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mb-8 transition-colors">
          <ArrowLeft size={14} />
          Back to home
        </Link>

        <div className="bg-[#0d1119] border border-white/5 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center">
              <Sparkles className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {mode === 'signin' ? 'Welcome back' : 'Create account'}
              </h1>
              <p className="text-sm text-slate-500">LISA Voice Intelligence</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1.5 block">Full name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full bg-slate-900/80 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400 font-medium mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-slate-900/80 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/80 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-sm text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
            >
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-white/5">
            <button
              onClick={handleGuest}
              className="w-full py-2 rounded-xl border border-white/5 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Continue as guest (local only)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
