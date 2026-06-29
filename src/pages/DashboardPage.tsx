import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, Phone, Clock, TrendingUp, ArrowRight, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { VoiceSession, VoiceCall } from '../types/database';

interface Stats {
  totalSessions: number;
  totalCalls: number;
  totalMinutes: number;
  activeToday: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalSessions: 0, totalCalls: 0, totalMinutes: 0, activeToday: 0 });
  const [recentSessions, setRecentSessions] = useState<VoiceSession[]>([]);
  const [recentCalls, setRecentCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const [sessionsRes, callsRes] = await Promise.all([
        supabase
          .from('voice_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(10),
        supabase
          .from('voice_calls')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const sessions = (sessionsRes.data ?? []) as VoiceSession[];
      const calls = (callsRes.data ?? []) as VoiceCall[];

      const totalMinutes = Math.round(
        sessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) / 60
      );

      const today = new Date().toISOString().split('T')[0];
      const activeToday = sessions.filter((s) => s.started_at.startsWith(today)).length;

      setStats({
        totalSessions: sessions.length,
        totalCalls: calls.length,
        totalMinutes,
        activeToday,
      });
      setRecentSessions(sessions);
      setRecentCalls(calls);
      setLoading(false);
    };

    load();
  }, [user]);

  const statCards = [
    { label: 'Voice Sessions', value: stats.totalSessions, icon: Mic, color: 'cyan' },
    { label: 'Phone Calls', value: stats.totalCalls, icon: Phone, color: 'indigo' },
    { label: 'Total Minutes', value: stats.totalMinutes, icon: Clock, color: 'emerald' },
    { label: 'Sessions Today', value: stats.activeToday, icon: TrendingUp, color: 'amber' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-slate-400 text-sm">
          Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}. Your voice intelligence at a glance.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className={`w-9 h-9 rounded-xl bg-${color}-500/10 flex items-center justify-center mb-3`}>
              <Icon size={18} className={`text-${color}-400`} />
            </div>
            <p className="text-2xl font-bold text-white">{loading ? '—' : value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Activity size={18} className="text-cyan-400" />
              Recent Sessions
            </h2>
            <Link to="/app/analytics" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : recentSessions.length === 0 ? (
            <div className="text-center py-8">
              <Mic size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-4">No sessions yet. Start your first conversation.</p>
              <Link
                to="/app/workspace"
                className="inline-flex items-center gap-2 text-sm bg-cyan-500/10 text-cyan-300 px-4 py-2 rounded-xl border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
              >
                <Mic size={14} />
                Open Workspace
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSessions.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-white/5">
                  <div>
                    <p className="text-sm text-white font-medium capitalize">{s.model_engine} session</p>
                    <p className="text-xs text-slate-500">{new Date(s.started_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                  }`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Phone size={18} className="text-indigo-400" />
              Recent Calls
            </h2>
            <Link to="/app/calls" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Call center <ArrowRight size={12} />
            </Link>
          </div>
          {recentCalls.length === 0 ? (
            <div className="text-center py-8">
              <Phone size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No outbound calls yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCalls.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-white/5">
                  <div>
                    <p className="text-sm text-white font-mono">{c.phone_number}</p>
                    <p className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</p>
                  </div>
                  <span className="text-xs text-slate-400 capitalize">{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-white mb-1">Ready to launch a session?</h3>
          <p className="text-sm text-slate-400">Configure your agent and start a live voice conversation.</p>
        </div>
        <Link
          to="/app/workspace"
          className="shrink-0 flex items-center gap-2 bg-white text-slate-950 font-medium px-5 py-2.5 rounded-xl hover:bg-slate-100 transition-colors text-sm"
        >
          <Mic size={16} />
          Launch Workspace
        </Link>
      </div>
    </div>
  );
}
