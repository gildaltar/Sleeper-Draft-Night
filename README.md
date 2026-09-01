# Sleeper Draft Night

A six-team, broadcast-style fantasy football draft room powered by Sleeper, Zoom Video SDK, Supabase, and Vercel.

## What is included

- A pre-draft stadium countdown that automatically hands off to the live show 90 minutes before start
- A true 3-left / 3-right camera layout around a central live draft stage
- Near-live Sleeper draft polling with cached bootstrap recovery
- Full-screen pick lock and player reveals, helmet-shaped team identities, and reaction cameras
- A clean family-and-friends spectator screen with the same live overlays and event audio
- Commissioner scenes, a separate 90-second show clock, customizable overlays, ticker controls, panic/holding mode, and synchronized mock draft controls
- Individual password-protected team portals with camera preview, border controls, logos, background images, and broadcast container customization
- A per-team Draft Desk with a ranked pre-draft queue, an automatic mobile on-clock popup, and a direct handoff to the official Sleeper draft room
- An owner-customized teams view and searchable 500-entry player pool, including all 32 defenses
- Edge-to-edge headline and automatic pick-feed tickers that remain in their own viewport rows
- An opt-in background score, independent music/SFX levels, automatic fanfare and pick cues, and a shared Apple Music/Spotify request queue

## Routes

- `/` — pre-show countdown, then live broadcast 90 minutes before the draft
- `/broadcast` — live broadcast at any time
- `/board` — ranked player board
- `/teams` — team headquarters, roster construction, owners, and private portal links
- `/team?team=1` — password-protected Team 1 portal (use 1–6)
- `/picker?team=1` — Team 1 ranked queue and Sleeper handoff (use 1–6)
- `/watch` — clean family-and-friends spectator view
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

Public clients can read only the visual fields from `team_profiles`; `password_hash` has no anonymous or authenticated column grant. Team passwords are bcrypt-hashed and verified by the rate-limited `team-access` Edge Function, including a second server-side check before an owner camera token is minted. Commissioner actions require Supabase Auth plus membership in `commissioners`. Zoom SDK secrets remain server-side in Vercel environment variables.

Database changes are tracked in `supabase/migrations`.
