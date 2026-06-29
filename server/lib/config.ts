import { diagLog } from './logger.js';

export function getApiKey(): string | null {
  if (process.env.GEMINI_API_KEY?.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  return null;
}

export function requireApiKey(): string {
  const key = getApiKey();
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return key;
}

export function getTwilioConfig(overrides?: {
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
}) {
  return {
    sid: overrides?.twilioAccountSid?.trim() || process.env.TWILIO_ACCOUNT_SID || '',
    token: overrides?.twilioAuthToken?.trim() || process.env.TWILIO_AUTH_TOKEN || '',
    from: overrides?.twilioPhoneNumber?.trim() || process.env.TWILIO_PHONE_NUMBER || '',
  };
}

/** Public HTTPS base URL Twilio can reach (required for outbound calls). */
export function getPublicAppUrl(req?: {
  secure?: boolean;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  // Auto-detect common hosting platform URLs
  if (process.env.RENDER_EXTERNAL_URL?.trim()) {
    return process.env.RENDER_EXTERNAL_URL.trim().replace(/\/$/, '');
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN?.trim()) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN.trim()}`;
  }
  if (process.env.FLY_APP_NAME?.trim()) {
    return `https://${process.env.FLY_APP_NAME.trim()}.fly.dev`;
  }

  if (req) {
    const protocol =
      req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string);
    return `${protocol}://${host}`;
  }
  return 'http://localhost:3000';
}

export function isLocalhostUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return true;
  }
}

export function toTwilioStreamUrl(appUrl: string): string {
  const { host } = new URL(appUrl);
  return `wss://${host}/api/twilio-stream`;
}

export function maskSecret(value: string | undefined): string {
  if (!value) return '(not set)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function logStartupConfig() {
  const appUrl = getPublicAppUrl();
  diagLog('Startup config', {
    nodeEnv: process.env.NODE_ENV,
    hasGeminiKey: !!getApiKey(),
    hasTwilio: !!process.env.TWILIO_ACCOUNT_SID,
    appUrl: isLocalhostUrl(appUrl) ? 'localhost (Twilio calls need APP_URL)' : appUrl,
  });
}
