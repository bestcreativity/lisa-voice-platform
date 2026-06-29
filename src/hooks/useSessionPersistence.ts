import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

/**
 * Listens for session lifecycle events dispatched by VoiceAgent
 * and persists completed sessions to Supabase.
 */
export function useSessionPersistence() {
  const { user } = useAuth();
  const sessionStartRef = useRef<Date | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;

    const onStart = async (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      sessionStartRef.current = new Date();

      const { data } = await supabase.from('voice_sessions').insert({
        user_id: user.id,
        status: 'active',
        model_engine: detail.modelEngine ?? 'gemini',
        duration_seconds: 0,
        transcript: [],
        metadata: { agentRole: detail.agentRole, recruiterName: detail.recruiterName },
      }).select('id').single();

      sessionIdRef.current = data?.id ?? null;
    };

    const onEnd = async (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const duration = sessionStartRef.current
        ? Math.round((Date.now() - sessionStartRef.current.getTime()) / 1000)
        : 0;

      if (sessionIdRef.current) {
        await supabase.from('voice_sessions').update({
          status: 'completed',
          duration_seconds: duration,
          transcript: detail.transcript ?? [],
          ended_at: new Date().toISOString(),
        }).eq('id', sessionIdRef.current);
      }

      sessionStartRef.current = null;
      sessionIdRef.current = null;
    };

    const onCall = async (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      await supabase.from('voice_calls').insert({
        user_id: user.id,
        session_id: sessionIdRef.current,
        phone_number: detail.phoneNumber ?? '',
        call_sid: detail.callSid ?? null,
        status: detail.status ?? 'initiated',
        provider: detail.provider ?? 'twilio',
      });
    };

    window.addEventListener('lisa:session-start', onStart);
    window.addEventListener('lisa:session-end', onEnd);
    window.addEventListener('lisa:call-started', onCall);

    return () => {
      window.removeEventListener('lisa:session-start', onStart);
      window.removeEventListener('lisa:session-end', onEnd);
      window.removeEventListener('lisa:call-started', onCall);
    };
  }, [user]);
}

export function dispatchSessionStart(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('lisa:session-start', { detail }));
}

export function dispatchSessionEnd(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('lisa:session-end', { detail }));
}

export function dispatchCallStarted(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('lisa:call-started', { detail }));
}
