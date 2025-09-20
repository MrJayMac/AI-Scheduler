# AI Scheduler (Local Setup)

Turn natural‑language tasks into scheduled Google Calendar events on your local machine.
- With OpenAI enabled, explicit times like "tomorrow 3pm" are parsed.
- Without OpenAI, a weighted scheduler picks the best slot based on your Preferences.

## Prerequisites
- Node.js 18+ and npm 9+
- Supabase project (for auth and storing OAuth tokens)
- Google Cloud project with Google Calendar API enabled
- Optional: OpenAI API key (improves explicit time parsing)

## 1) Clone and install
```bash
# clone the repo
git clone https://github.com/yourname/AI-Scheduler.git
cd AI-Scheduler/project

# install deps
npm install
```

## 2) Environment variables (project/.env.local)
Create `project/.env.local` with:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google OAuth (from Google Cloud Console)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
# Local redirect URI
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback

# Optional: OpenAI (enables parsing explicit times)
OPENAI_API_KEY=sk-...
```

## 3) Supabase setup (once)
Run this SQL in Supabase to store OAuth tokens and enforce row‑level security:
```sql
create table if not exists public.oauth_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token text,
  refresh_token text,
  expires_at bigint,
  google_user_id text,
  google_email text,
  primary key (user_id, provider)
);

alter table public.oauth_tokens enable row level security;

create policy "own tokens" on public.oauth_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## 4) Google Cloud setup (once)
1. Enable "Google Calendar API" (APIs & Services → Library).
2. OAuth consent screen: External, add your Google account as Test user.
3. Create OAuth Client (Web application):
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/google/callback`
4. Copy Client ID and Secret into `.env.local`.

## 5) Run locally
```bash
# from the project/ directory
npm run dev
# open in browser
http://localhost:3000
```

## 6) Use the app
- Sign in (Supabase Auth) if prompted.
- Click "Connect Google Calendar" and finish OAuth.
- Open the burger menu → Preferences: set timezone, work hours, buffer, default duration, morning/weekend prefs, and suggest‑time toggle.
- Type a task (e.g., "clean the house").
  - With OpenAI, explicit times like "tomorrow 3pm" are used.
  - Otherwise, the weighted scheduler picks the best free slot.
- Events are created in Google Calendar and shown in the in‑app calendar.
- Use the "Recompute" button to reshuffle AI‑scheduled events.
- Click an event to delete it from Google Calendar.

## 7) Toggle OpenAI on/off
- Use OpenAI: set `OPENAI_API_KEY` in `.env.local`, then restart `npm run dev`.
- No OpenAI: remove/unset `OPENAI_API_KEY`, then restart; scheduling still works via the weighted scheduler.

## 8) Troubleshooting
- OAuth/Unauthorized: ensure you’re signed in and that your email is a Test user on the OAuth consent screen.
- Invalid redirect URI: must exactly match `http://localhost:3000/api/google/callback` and `.env.local`.
- 403 Google Calendar: ensure the API is enabled and reconnect Google.
- Wrong timezone: set it in Preferences; events are created with that zone.
- Calendar not updating: change view (Day/Week) or wait up to 60s cache; use Recompute to force updates.
