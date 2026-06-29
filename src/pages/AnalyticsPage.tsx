import { useEffect, useState } from 'react';
import { BarChart3, Clock, Mic } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { VoiceSession } from '../types/database';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<VoiceSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) {
      setLoading(false);
      return;
    }

    supabase
      .from('voice_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setSessions((data ?? []) as VoiceSession[]);
        setLoading(false);
      });
  }, [user]);

  const totalMinutes = Math.round(sessions.reduce((s, x) => s + x.duration_seconds, 0) / 60);
  const byEngine = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.model_engine] = (acc[s.model_engine] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Analytics</h1>
        <p className="text-slate-400 text-sm">Session history and usage metrics.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5">
          <Mic size={18} className="text-cyan-400 mb-3" />
          <p className="text-2xl font-bold text-white">{sessions.length}</p>
          <p className="text-xs text-slate-500">Total sessions</p>
        </div>
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5">
          <Clock size={18} className="text-emerald-400 mb-3" />
          <p className="text-2xl font-bold text-white">{totalMinutes}</p>
          <p className="text-xs text-slate-500">Minutes logged</p>
        </div>
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5">
          <BarChart3 size={18} className="text-indigo-400 mb-3" />
          <p className="text-2xl font-bold text-white">{Object.keys(byEngine).length}</p>
          <p className="text-xs text-slate-500">Engines used</p>
        </div>
      </div>

      {Object.keys(byEngine).length > 0 && (
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
          <h2 className="font-semibold text-white mb-4">Sessions by engine</h2>
          <div className="space-y-3">
            {Object.entries(byEngine).map(([engine, count]) => {
              const n = Number(count);
              return (
              <div key={engine} className="flex items-center gap-4">
                <span className="text-sm text-slate-400 w-24 capitalize">{engine}</span>
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full"
                    style={{ width: `${sessions.length ? (n / sessions.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm text-white font-medium w-8 text-right">{n}</span>
              </div>
            );})}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h2 className="font-semibold text-white">Session log</h2>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading...</p>
        ) : sessions.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No session data yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {sessions.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
                <div>
                  <p className="text-sm text-white capitalize">{s.model_engine} · {s.status}</p>
                  <p className="text-xs text-slate-500">{new Date(s.started_at).toLocaleString()}</p>
                </div>
                <p className="text-xs text-slate-400 font-mono">{Math.round(s.duration_seconds / 60)}m</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
