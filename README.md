# Sleeper Draft Night

A six-team, broadcast-style fantasy football draft room powered by Sleeper, browser-native media capture, LiveKit, Apple MusicKit, Supabase, and Vercel.

## What is included

- A pre-draft stadium countdown that automatically hands off to the live show 90 minutes before start
- A true 3-left / 3-right camera layout around a central live draft stage
- Near-live Sleeper draft polling with cached bootstrap recovery
- Full-screen pick lock and player reveals, helmet-shaped team identities, and reaction cameras
- A clean family-and-friends spectator screen with the same live overlays and event audio
- Commissioner scenes, a separate 90-second show clock, customizable overlays, ticker controls, panic/holding mode, and synchronized mock draft controls
- Owner-authenticated team studios with native camera preview, working frame controls, logos, background images, persistent customization, and responsive mobile layouts
- A per-team Draft Desk with a ranked pre-draft queue, an automatic mobile on-clock popup, and a direct handoff to the official Sleeper draft room
- An owner-customized teams view and searchable 500-entry player pool, including all 32 defenses
- Edge-to-edge headline and automatic pick-feed tickers that remain in their own viewport rows
- An opt-in background score, independent music/SFX levels, automatic fanfare and pick cues, and a shared Apple Music/Spotify request queue

## Routes

- `/` — pre-show countdown, then live broadcast 90 minutes before the draft
- `/broadcast` — live broadcast at any time
- `/board` — ranked player board
- `/teams` — team headquarters, roster construction, owners, and private portal links
- `/team?team=1` — authenticated Team 1 studio (use 1–6)
- `/picker?team=1` — authenticated Team 1 ranked queue and commissioner pick request (use 1–6)
- `/watch` — clean family-and-friends spectator view
- `/control` — authenticated commissioner controls

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local` and fill in the public Supabase key, LiveKit credentials, and Apple MusicKit signing credentials.
3. Run `npm install`.
4. Run `npm run dev` for the UI, or `vercel dev` when testing the serverless API routes locally.

Useful checks:

```sh
npm test
npm run build
npm audit --omit=dev
```

## Security model

Public clients can read only the visual fields from `team_profiles`; `password_hash` has no anonymous or authenticated column grant. Owners first authenticate with a Supabase email magic link and then use the commissioner-issued team code once to claim their roster. Every profile update, Draft Desk action, and LiveKit publisher token is checked against that permanent user-to-roster membership. Public viewers receive subscribe-only LiveKit tokens. Commissioner actions require Supabase Auth plus membership in `commissioners`. LiveKit secrets and the Apple Music private key remain server-side in Vercel environment variables.

Apple Music playback requires a MusicKit media identifier and key from an Apple Developer account in addition to the listener's Apple Music subscription. LiveKit requires a Cloud project or self-hosted deployment. Without those server credentials, camera preview still works locally and the music panel falls back to existing Spotify links, but no shared relay or Apple Music playback is started.

Database changes are tracked in `supabase/migrations`.
