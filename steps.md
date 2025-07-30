# Milestones & Steps
## 0) Prep
Create accounts: Vercel, Supabase, Google Cloud (for OAuth), LLM provider.

Make an empty Git repo.

## 1) Scaffold the app
npx create-next-app → one frontend project (Next.js).

Push to GitHub; connect repo to Vercel (auto deploys).

## 2) Configure env
In Vercel & .env.local, add keys: SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID/SECRET, LLM_API_KEY.

## 3) Database
In Supabase, run the SQL to create: tasks, time_blocks, preferences, calendar_state, oauth_tokens.

Turn on RLS; add simple policy “user can only see their rows.”

## 4) Auth (Supabase)
Add Sign in / Sign out using Supabase Auth.

Show “Hello, {email}” after login.

## 5) Google Calendar connect
Add Connect Google button → OAuth (Testing mode, your account).

On callback, store tokens in oauth_tokens.

## 6) Pull calendar (read)
Call Google Calendar list events for this week; render a plain list.

Save/refresh using syncToken (incremental updates).

## 7) Task input
Add one text box: “Add task…”.

Call LLM to parse → save {title, duration_min, deadline, priority} to tasks.

## 8) Scheduler v1 (greedy)
Compute free windows (work hours minus calendar events).

Sort tasks by deadline soonest, then priority, then created_at.

Place each task into the first free slot that fits; create time_blocks rows.

## 9) Write back to Google
For each time_block, create/update a Google event; store google_event_id.

## 10) Calendar view (built‑in)
Add Week/Day view (React Big Calendar).

Show Google events + time_blocks together (different colors).

## 11) Reshuffle
Add Recompute button → rerun scheduler and update events.

Auto‑trigger recompute after: (a) adding/editing a task, (b) pulling calendar deltas.

## 12) Manual edits & locks
Enable drag/resize on time_blocks; when user edits, mark block locked=true.

Scheduler skips locked blocks unless no other option.

## 13) Dependencies (optional)
Add task_dependencies table.

Only schedule a task when its dependencies are done or earlier‑scheduled.

## 14) Preferences (quality‑of‑life)
Simple page to set workday start/end, buffers, focus windows.

Use these settings when computing free windows.

## 15) Polish & deploy
Hide buttons until connected; show clear status toasts.

Verify end‑to‑end on Vercel prod URL.

