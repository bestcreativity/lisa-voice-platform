# LISA — Voice Intelligence Platform

Production-grade AI voice agent platform for recruiting, sales, and outbound calling.

## Features

- **Real-time voice AI** — Gemini Live API with sub-second latency
- **Outbound calling** — Twilio phone integration with live audio streaming
- **Multi-agent roles** — Recruiter, developer, designer, automation expert, custom roles
- **Premium voices** — Gemini native voices or ElevenLabs TTS
- **User accounts** — Supabase auth with session history and analytics
- **Dashboard** — Track sessions, calls, and usage metrics

## Quick Start

```bash
npm install
cp .env.example .env.local
# Add GEMINI_API_KEY and Supabase credentials to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `VITE_SUPABASE_URL` | For auth | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | For auth | Supabase anon key |
| `TWILIO_ACCOUNT_SID` | For calls | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | For calls | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | For calls | Outbound caller ID |
| `ELEVENLABS_API_KEY` | Optional | ElevenLabs TTS (Model B) |

## Scripts

- `npm run dev` — Start dev server (Express + Vite)
- `npm run build` — Production build
- `npm start` — Run production server
- `npm run lint` — TypeScript check

## Architecture

```
src/
  pages/          Landing, Auth, Dashboard, Workspace, Analytics
  components/     VoiceAgent workspace, AppShell layout
  context/        Auth provider (Supabase)
  hooks/          Session persistence to database
  lib/            Supabase client, audio processor
server/
  lib/            Prompts, config, logger (shared modules)
server.ts         Express + WebSocket proxy + Twilio
```

## Deployment (recommended for Twilio calling)

Twilio **cannot** reach `localhost`. Deploy to get a public HTTPS URL for phone calls.

### Render (easiest)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New → Blueprint** → connect repo
3. Set environment variables in the dashboard:
   - `GEMINI_API_KEY`
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   - `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`
   - `APP_URL` = your Render URL (e.g. `https://lisa-voice-platform.onrender.com`)
4. Deploy — build runs `npm run build`, start runs `npm start`

`RENDER_EXTERNAL_URL` is set automatically; you can leave `APP_URL` blank on Render if using their default domain.

### Railway / Fly.io

Same env vars. Set `APP_URL` to your public HTTPS domain, or Railway sets `RAILWAY_PUBLIC_DOMAIN` automatically.

### Build locally

```bash
npm run build
NODE_ENV=production npm start
```

### Required env vars (production)

| Variable | Required |
|----------|----------|
| `GEMINI_API_KEY` | Yes |
| `VITE_SUPABASE_URL` | For auth |
| `VITE_SUPABASE_ANON_KEY` | For auth |
| `TWILIO_*` | For phone calls |
| `APP_URL` | Public HTTPS URL (auto on Render/Railway) |
| `NODE_ENV` | `production` |
| `PORT` | Set by host (default 3000) |

