import { useEffect, useState } from 'react';
import { Save, Key, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export default function SettingsPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioPhone, setTwilioPhone] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    supabase.from('profiles').select('full_name, company_name').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name ?? '');
          setCompany(data.company_name ?? '');
        }
      });

    const sid = localStorage.getItem('lisa_twilio_account_sid');
    const phone = localStorage.getItem('lisa_twilio_phone_number');
    if (sid) setTwilioSid(sid);
    if (phone) setTwilioPhone(phone);
  }, [user]);

  const handleSave = async () => {
    localStorage.setItem('lisa_twilio_account_sid', twilioSid);
    localStorage.setItem('lisa_twilio_phone_number', twilioPhone);

    if (user && isSupabaseConfigured) {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: fullName || null,
        company_name: company || null,
      });
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-slate-400 text-sm">Account and integration configuration.</p>
      </div>

      <section className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Save size={18} className="text-cyan-400" />
          Profile
        </h2>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-slate-900/80 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/40"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Company</label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full bg-slate-900/80 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/40"
          />
        </div>
      </section>

      <section className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Key size={18} className="text-amber-400" />
          API Keys
        </h2>
        <p className="text-sm text-slate-400">
          Gemini API key is configured server-side in <code className="text-cyan-300 bg-black/30 px-1 rounded">.env.local</code> as <code className="text-cyan-300 bg-black/30 px-1 rounded">GEMINI_API_KEY</code>. ElevenLabs keys can be set in the Voice Workspace settings panel.
        </p>
      </section>

      <section className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Phone size={18} className="text-indigo-400" />
          Twilio (defaults)
        </h2>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Account SID</label>
          <input
            value={twilioSid}
            onChange={(e) => setTwilioSid(e.target.value)}
            placeholder="AC..."
            className="w-full bg-slate-900/80 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-indigo-500/40"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Outbound phone number</label>
          <input
            value={twilioPhone}
            onChange={(e) => setTwilioPhone(e.target.value)}
            placeholder="+1..."
            className="w-full bg-slate-900/80 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-indigo-500/40"
          />
        </div>
        <p className="text-xs text-slate-500">Auth token should be set in server .env as TWILIO_AUTH_TOKEN for security.</p>
      </section>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-medium px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
      >
        <Save size={16} />
        {saved ? 'Saved!' : 'Save settings'}
      </button>
    </div>
  );
}
