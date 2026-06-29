-- LISA Voice Intelligence Platform schema
-- Apply via Supabase MCP (apply_migration) or: supabase db push

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  company_name text,
  job_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.voice_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Lisa Nichols',
  role text NOT NULL DEFAULT 'Executive Recruiter',
  bio text,
  voice text NOT NULL DEFAULT 'Kore',
  avatar_url text,
  client_info text,
  prior_conversation text,
  custom_role text,
  model_engine text NOT NULL DEFAULT 'gemini' CHECK (model_engine IN ('gemini', 'elevenlabs')),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_agents_user_id_idx ON public.voice_agents(user_id);

CREATE TABLE IF NOT EXISTS public.voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.voice_agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),
  model_engine text NOT NULL DEFAULT 'gemini',
  duration_seconds integer NOT NULL DEFAULT 0,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS voice_sessions_user_id_idx ON public.voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS voice_sessions_started_at_idx ON public.voice_sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS public.voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.voice_sessions(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  provider text NOT NULL DEFAULT 'twilio',
  call_sid text,
  status text NOT NULL DEFAULT 'initiated',
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS voice_calls_user_id_idx ON public.voice_calls(user_id);

CREATE TABLE IF NOT EXISTS public.voice_user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  twilio_account_sid text,
  twilio_phone_number text,
  zoom_meet_url text,
  google_meet_url text,
  selected_mic_id text,
  selected_speaker_id text,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY voice_agents_select ON public.voice_agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY voice_agents_insert ON public.voice_agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY voice_agents_update ON public.voice_agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY voice_agents_delete ON public.voice_agents FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY voice_sessions_select ON public.voice_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY voice_sessions_insert ON public.voice_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY voice_sessions_update ON public.voice_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY voice_calls_select ON public.voice_calls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY voice_calls_insert ON public.voice_calls FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY voice_calls_update ON public.voice_calls FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY voice_user_settings_select ON public.voice_user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY voice_user_settings_insert ON public.voice_user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY voice_user_settings_update ON public.voice_user_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS voice_agents_updated_at ON public.voice_agents;
CREATE TRIGGER voice_agents_updated_at BEFORE UPDATE ON public.voice_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS voice_user_settings_updated_at ON public.voice_user_settings;
CREATE TRIGGER voice_user_settings_updated_at BEFORE UPDATE ON public.voice_user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
