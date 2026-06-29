import { Link } from 'react-router-dom';
import { Phone, ArrowRight } from 'lucide-react';

export default function CallsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Call Center</h1>
        <p className="text-slate-400 text-sm">Outbound calling powered by Twilio voice streaming.</p>
      </div>

      <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-5">
          <Phone size={28} className="text-indigo-400" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Phone dialer lives in Workspace</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
          Configure Twilio credentials, dial outbound numbers, and let LISA handle live conversations on the phone line.
        </p>
        <Link
          to="/app/workspace"
          className="inline-flex items-center gap-2 bg-indigo-500/15 text-indigo-300 px-5 py-2.5 rounded-xl border border-indigo-500/20 hover:bg-indigo-500/25 transition-colors text-sm font-medium"
        >
          Open Workspace
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="mt-6 p-5 rounded-2xl bg-slate-900/40 border border-white/5">
        <h3 className="text-sm font-semibold text-white mb-3">Setup checklist</h3>
        <ul className="space-y-2 text-sm text-slate-400">
          <li>1. Add Twilio Account SID, Auth Token, and outbound number in Settings</li>
          <li>2. Set your Gemini API key in server environment (.env.local)</li>
          <li>3. Open Workspace → Meet tab → enable Twilio mode</li>
          <li>4. Dial a number and LISA connects via real-time audio stream</li>
        </ul>
      </div>
    </div>
  );
}
