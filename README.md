# Sleeper Draft Night

A six-team, broadcast-style fantasy football draft room powered by Sleeper, Zoom Video SDK, Supabase, and Vercel.

## What is included

- A true 3-left / 3-right camera layout around a central live draft stage
- Near-live Sleeper draft polling with cached bootstrap recovery
- Commissioner scenes, panic/holding mode, and synchronized mock draft controls
- Individual password-protected team portals with camera preview and container customization
- An owner-customized teams view and searchable 500-entry player pool, including all 32 defenses
- Edge-to-edge top and bottom tickers that remain in their own viewport rows
- Opt-in event cues only—no continuous background music

## Routes

- `/` — live broadcast
- `/board` — ranked player board
- `/teams` — all team containers and private portal links
- `/team?team=1` — password-protected Team 1 portal (use 1–6)
- `/spectator` — spectator camera client
- `/control` — authenticated commissioner controls

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local` and fill in the public Supabase key and Zoom Video SDK credentials.
3. Run `npm install`.
4. Run `npm run dev` for the UI, or `vercel dev` when testing the serverless API routes locally.

Useful checks:

```sh
npm test
npm run build
npm audit --omit=dev
```

## Security model

Public clients can read only the visual fields from `team_profiles`; `password_hash` has no anonymous or authenticated column grant. Team passwords are bcrypt-hashed and verified by the rate-limited `team-access` Edge Function. Commissioner actions require Supabase Auth plus membership in `commissioners`. Zoom SDK secrets remain server-side in Vercel environment variables.

Database changes are tracked in `supabase/migrations`.
