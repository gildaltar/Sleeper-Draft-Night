# Draft Night 4.0 Design QA

**Source visual truth**

- `C:\Users\ezraj\AppData\Local\Temp\codex-clipboard-1925a1bc-e927-4d3f-a123-99563fb37987.png`
- Source pixels: 1672 × 941.
- Target state: desktop live sports broadcast, Pick Is In player reveal, dark stadium package, team rails, compact tickers, helmet identity, music/SFX controls.

**Rendered implementation evidence**

- `design/qa-reveal-final-16x9.png` — browser-rendered pick reveal.
- `design/qa-comparison-final.png` — source and implementation stacked at the same 1280 × 720 normalized size.
- `design/qa-focus-final.png` — central Pick Is In region normalized to equal 1200 × 600 regions.
- `design/qa-countdown.png` — browser-rendered pre-show countdown.
- `design/qa-spectator.png` — browser-rendered spectator experience.
- `design/qa-watch-mobile-final.png` — browser-rendered phone spectator view.
- Desktop viewport: 1280 × 720 CSS px, device scale factor 1. Source was downsampled from 1672 × 941 to 1280 × 720 for the full comparison.
- Mobile viewport: 390 × 844 CSS px, device scale factor 1. The document scroll width remained within the viewport.
- State: development-only automatic reveal preview using live league/team profile data and the first ranked live player; production does not expose the preview switch.

## Full-view comparison

The final implementation preserves the source's core hierarchy: compact broadcast navigation and sound controls, full-screen event takeover, helmet above the on-clock banner, oversized Pick Is In typography, player cutout on the left, player identity in the middle, team identity on the right, dark stadium atmosphere, team-color frame, and persistent bottom headline ticker. Team colors and names are intentionally dynamic rather than copying the NFL team shown in the visual reference.

The surrounding presenter rails are present in the normal broadcast render. The source uses staged presenter photos; the implementation shows the real Zoom participants when they join, and a polished waiting state beforehand. That is a runtime-content difference rather than a layout substitution.

## Focused-region comparison

`design/qa-focus-final.png` compares the central reveal regions directly. It confirms the display-type hierarchy, left/center/right subject placement, stadium depth, team helmet treatment, readable position/team line, and angular framed banner. The source's player is a bespoke full-body promotional cutout while the implementation uses each Sleeper player's available live headshot; the crop remains sharp and intentionally constrained at the browser target size.

## Required fidelity surfaces

- **Fonts and typography:** Barlow Condensed supplies the heavy, narrow sports-display face and Inter handles small controls. Weight, italic emphasis, uppercase hierarchy, tracking, and line height match the source's broadcast language without copying its exact proprietary display face.
- **Spacing and layout rhythm:** The final 16:9 reveal keeps the subject regions inside the safe frame, avoids overlap at 1280 × 720, retains the compact ticker/header/footer stack, and holds the mobile spectator layout without horizontal overflow.
- **Colors and visual tokens:** Midnight navy/graphite, electric lime, cyan, team accents, cool white, low-opacity stadium light, and hard broadcast borders map closely to the reference. Reveal accents deliberately inherit the selecting fantasy team's colors.
- **Image quality and asset fidelity:** A real generated transparent 3D helmet asset and a generated stadium/light-show background replace generic placeholders. The first helmet export had a baked checkerboard; the final `helmet-frame-v2.png` has genuine transparent alpha. No custom SVG, emoji, or CSS-drawn substitute is used for either asset.
- **Copy and content:** Source-specific NFL names, headlines, and brands were replaced with the user's league name, owner team name, live pick number, real player data, and explicit local-clock/Sleeper handoff language.

## Comparison history

1. **Iteration 1 — blocked**
   - P1: the helmet export contained an opaque checkerboard/white rectangle.
   - P1: the player reveal used a right-heavy composition with a large empty center, unlike the reference's player-left/name-center/team-right composition.
   - P2: a Zoom client cleanup call produced a console exception when routes changed.
   - Fixes: regenerated the helmet with true alpha; rebuilt the reveal composition and added the stadium asset; corrected Zoom client destruction to receive the active client.
2. **Iteration 2 — blocked**
   - P1: percentage positioning looked acceptable in a tall capture but overlapped the Pick Is In banner at the real 16:9 viewport.
   - Fixes: normalized QA to a fresh 1280 × 720 browser tab and changed the reveal to stable vertical centering with bounded player/team regions.
3. **Iteration 3 — passed**
   - `design/qa-reveal-final-16x9.png` shows no banner/subject overlap, clipped controls, or hidden persistent rows.
   - `design/qa-watch-mobile-final.png` shows the spectator headline, 90-second clock, helmet identity, on-clock team, up-next team, and draft feed without horizontal overflow.

## Primary interactions tested

- Draft Desk search/filter rendering and adding the first player to a persisted ranked queue.
- Audio manager opens and exposes separate background-music and event-SFX levels plus playlist input.
- Countdown, live broadcast, spectator, team, board, and picker route rendering.
- Broadcast-to-spectator route transition and Zoom cleanup.
- Phone spectator layout at 390 × 844.
- Console checked after the cleanup fix: no application errors. A non-blocking Zoom third-party duplicate PubSub warning may still appear when the SDK initializes in development.

## Residual P3 polish

- Live Sleeper headshots vary in crop because they are source data rather than art-directed promotional cutouts.
- Empty camera tiles become live presenter video only after owners join the configured Zoom Video SDK room.

final result: passed
