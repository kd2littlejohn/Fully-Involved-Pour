# AXE Insights: architecture

Status: Batches 1–4 are built and tested (engine; events and cache; AXE explanations; Home dashboard). Not yet deployed.

## Phase 0: what already exists

| Need | Existing system | Reused how |
|---|---|---|
| Tasting history | `users/{uid}` is one document: `bottles[]`, `pours[]`, `memories[]`, … (`web/src/data/repositories/userDoc.ts`, written by `hooks/useUserData.tsx`) | The only source of truth. The engine reads it; it never stores copies of pours. |
| Palate calculations | `features/yourPalate/selectors.ts` (`getPalateEvolution`, `getProofEvolution`, `getCategoryAffinity`, `getProofAffinity`, `getTopRatedFlavorTags`), `palateInsights.ts` | Called directly by the engine, so AXE and Your Palate can't disagree. |
| Flavor taxonomy | `features/flavorTaxonomy/*`, `flavorRadar/flavorCategories.ts` (`pourFlavorLabels`) | Canonical labels, aliases, and families. Only per-pour chips and notes are used, never bottle catalog notes. |
| FIP scale | `features/fip/scoring.ts` (`FIP_MAX`), `fip/tiers.ts` | Component maximums; 8.0 "Working Fire" as the high-rated line. |
| Dates | `data/localDate.ts` (from the Bottle Journey fix): pour dates are local calendar days | Engine uses calendar-day math only (`daysBetween`, `formatCalendarDate`), never `new Date('YYYY-MM-DD')`. |
| Blind tastings | `blindRooms/{id}` + `participants/{uid}/responses`, `/ranking/final`, `blindRoomSecrets/{id}` (`data/repositories/blindRoom.ts`) | Engine takes a joined `BlindTastingResult[]` (the user's own locked answers + revealed bottles). |
| AXE backend | `functions/index.js` `askSommelier` (onCall, auth, `ANTHROPIC_API_KEY` secret), `functions/axeContext.js` (server-side context from the caller's own doc, prompt-injection-safe `clean()`), `functions/rateLimit.js` | Batch 3 reuses all three: insight payloads go through the same callable pattern, rate limiter, and sanitizer. |
| AXE client | `features/sommelier/*` (`SommelierProvider`, `AxeSheet`, `axeContext.ts`, `axePalate.ts`) | Batch 4: "Ask AXE" opens the existing sheet with the insight as context. |
| Home | `pages/Home/HomePage.tsx`; "Your Palate" section = `features/home/PalateInsightCard.tsx` + `getPalateInsight` | Batch 4 replaces that section with the AXE Insight card. |
| Rules | `firestore.rules`: `users/{uid}` owner-only; subcollections are default-deny | New cache lives in `users/{uid}/axeInsights/current`, server-written only. |
| Tests | vitest + jsdom (web), vitest + Firestore emulator (functions, rules) | Same frameworks. |
| Deploy | `deploy.yml` → `deploy-functions.yml` (WIF, approval gate, target `functions:askSommelier` by default) and Hosting | **No workflow deploys `firestore.rules`.** See decisions below. |

## The engine (Batch 1)

`web/src/features/axeInsights/engine/`: pure TypeScript, no React, Firebase, or browser APIs.

- `normalize.ts`: one cleaning pass. Deduplicates pours by id (a tasting counts once even if it appears in more than one place), drops invalid ratings and dates, orders by the tasting date the user chose (handles backdated and edited entries), timezone-proof calendar math.
- `categories/`: one module per category, each returning candidates with facts, evidence ids, window, sample size, confidence, actions, deterministic copy, and priority.
  - A Palate Evolution: rating shift, proof shift (described as exploring, never as preference), style preference, component shift.
  - B Flavor Discovery: flavors in 8.0+ pours, counted once per bottle.
  - C Collection Discovery: sealed, unpoured, in-stock bottles that match a rating-backed preference.
  - D Bottle Rediscovery: open bottles rated 8.0+ and not poured in 60+ days.
  - E Blind Room: blind preference contradicting the user's own sighted ratings by 0.5+.
  - F Milestones: first tasting, first blind, new flavor family, revisit with a 1.5+ point swing (only within 30 days).
- `affinity.ts`: a style or proof range only counts as a preference when it beats everything else by 0.5+ points (Your Palate's selectors pick a winner even on a tie).
- `config.ts`: every threshold in one place (3 = tentative, 6 = established, 3 per period for trends).
- `fingerprint.ts`: per-category input fingerprints over only the fields that category reads (a photo or price edit changes none), plus candidate fingerprints.
- `select.ts` `reconcileInsights(previous, input, {now, sourceRevision, requestNew})`: recalculates only invalidated categories, keeps the current insight unless a new, higher-priority one appears or its evidence disappears, applies a 21-day cooldown per insight and bottle, bumps `generation` only on a meaningful change, and returns `changed: false` (no write, no AI) otherwise.

The same code bundles to dependency-free CommonJS (verified: 54 KB, runs in plain Node), so Cloud Functions runs the identical engine.

## Batch 2: events, cache, consistency

**Flow.** A save that touches `pours` or `bottles` (`saveUserDoc`), a host's reveal, or a participant opening a reveal calls `requestAxeInsightsSync` (`web/src/data/repositories/axeInsights.ts`). Calls are coalesced per user for 2.5 s, and the strongest reason wins. The `syncAxeInsights` callable (`functions/index.js` → `functions/axeInsights.js`) then:

1. takes the uid from auth only; the payload is just `{reason, today}`, and `today` is accepted only within a day of UTC;
2. reads the user's blind results (only revealed rooms and their own locked ranking and score; up to 10 rooms) on a blind-reveal event or when the cached copy is over 24 h old;
3. in one transaction, reads `users/{uid}` and `users/{uid}/axeInsights/current`, refuses to replace a result whose `sourceRevision` (user doc update time) is newer, runs `reconcileInsights`, and writes only when something meaningful changed;
4. returns the selected insight plus `generation`, `sourceRevision`, `calculatedAt` and `inputFingerprints`.

**Server engine.** `npm run build:axe-engine` (in `web/`) bundles the engine into `functions/generated/axeInsightsEngine.js` (committed, reproducible). CI rebuilds it and fails if the committed copy is stale.

**Guarantees.**
- Duplicate events are a no-op (no new generation, no write).
- Concurrent events serialize through the transaction: exactly one applies a change.
- Stale requests can't overwrite newer results: the server has a monotonic `sourceRevision`, and the client cache only moves forward by `generation`.
- A failed request leaves a pending marker that is retried on the next app load. Any later request recalculates from stored data, so a missed event self-heals.
- Rate limit: 120/hour. Past it, the cached insight is returned without recalculating.

**Security.** `firestore.rules` denies every client read and write on `users/{uid}/axeInsights/*`, including the owner's. This matches the default for subcollections, so it is in force whether or not rules are deployed. Reads go through the callable.

**Palate consistency.** `PREFERENCE_MIN_MARGIN = 0.5` now lives in `yourPalate/selectors.ts`. `getProofAffinity` returns nothing without a 0.5-point lead over all other pours with a proof. `getCategoryAffinity` falls back to the plain "most poured" fact. Your Palate, Profile identity, palate profile and AXE all use it.

**Deploy.** The default functions target is now `functions:askSommelier,functions:syncAxeInsights`, with a liveness check (401 for unauthenticated calls) for the new function.

## Batch 3: AXE explanations and follow-ups

**Pre-work.**
- Blind Room dates follow FIP's local-calendar-day rule. The client sends its IANA timezone; the server stores each reveal's instant and converts it to that zone's calendar day per request. "Today" uses the same zone. Unknown or malformed zones fall back safely.
- The release path now always deploys `askSommelier` and `syncAxeInsights`, whatever `FUNCTIONS_DEPLOY_TARGET` is set to. A manual run deploys exactly what was asked. The website job waits for the backend job.
- If `syncAxeInsights` is unavailable, the client keeps the cached insight, backs off (1 min, 5 min, 30 min, 2 h, 6 h), keeps the event pending, and logs one warning per window.

**Explanations** reuse `askSommelier` with `{mode: "explain-insight"}`: the same endpoint, Anthropic configuration (`callClaude`), AXE persona, auth and rate limit. The new code is in `functions/axeInsightExplain.js`.
- The model sees only `buildExplanationPayload`: category, kind, confidence, sample size, period, verified facts, the insight's bottle names, allowed actions and the deterministic wording as a reference. Strings are stripped of `<>`.
- The output must be JSON (`headline`, `body`, optional `expanded`, `factKeys`, optional `actionId`). `validateExplanation`, in the shared engine, rejects:
  - any number that isn't exactly a fact value, and any number word or vague quantity that isn't backed by one;
  - percentages without a percent fact;
  - collection bottles that aren't part of the insight;
  - preference claims except for rating-backed kinds;
  - certainty words unless confidence is established;
  - unknown fact keys or actions;
  - claims of having changed data;
  - over-length text.
- On rejection, model error, budget or lease contention, the engine's deterministic copy is returned.
- Cache: `explanations[fingerprint]` with `EXPLANATION_VERSION` in the insight doc, so the same insight never regenerates. Up to 2 paid attempts per insight, a 60 s lease so concurrent requests make one call, a budget of 8 generations per user per day (`axeInsightExplain`), plus askSommelier's 60/hour limit.
- Client: `currentAxeExplanation` (synchronous: cached AI wording, else deterministic) and `explainAxeInsight` (at most once per insight per session; cached per fingerprint in localStorage).

**Follow-ups** use the existing chat. `askAboutInsight(insightId, prompt?)` on `SommelierProvider` sends only the id. `askSommelier` resolves it in the caller's own cache (`loadInsightForChat`) and adds an "AXE insight they're asking about" section with the verified facts, confidence, period and bottles. An unknown id or another user's id resolves to "no longer current". AXE still has no tools: it can't change records, and its persona forbids claiming it did.

## Batch 4: Home dashboard

**Order:** greeting, Tonight's Pick, Quick Actions, Continue Your Journey, Open Bottles, Maybe Tonight, Your Bar Snapshot, AXE Insight. Friends' Recent Pours left Home; the full feed is on Friends ("Recent Friend Activity").

- **Hero:** about 45% shorter on phones (`clamp(64px, 18.5vw, 168px)`), artwork uncropped at its own proportions, centered, edges faded. The greeting is compact (no "Home" eyebrow).
- **Tonight's Pick** (`WhatShouldIPourCard`):
  - portrait image, two-line name, distillery and proof, a short reason;
  - "Pour This" and "Another Pick", plus "Ask AXE why" and "Pick by mood" links;
  - the pick stays persisted per user (`useHomeRecommendation`). A "no explanation" answer is now remembered too, so returning to Home never asks the model again for the same pick.
- **Quick Actions:** Pour (the shared Pour hub), Ask AXE (the existing sheet), My Bar.
- **Continue Your Journey:** a compact row showing the last tasting date as a local calendar day, the rating, and Pour Again.
- **Open Bottles:** consistent card size, two-line names, local dates.
- **Maybe Tonight:** up to 3 alternatives, never repeating Tonight's Pick, with day counts in local calendar days.
- **Your Bar Snapshot:** "In Your Bar" = open + sealed (it used to count wishlist, incoming and finished bottles as "Total"), plus Open, Sealed, and "Low or Empty" (formerly "Needs Attention").
- **AXE Insight** (`features/axeInsights/AxeInsightCard.tsx`, `useAxeInsight.ts`):
  - renders from the local cache at once;
  - asks the server only when there's no cache, an event is pending, the cache is older than 12 h, or the client's own fingerprints for palate, flavor and collection differ from the cache's;
  - shows the deterministic wording until a validated AXE explanation exists (at most one request per insight);
  - labels "Updating…" while a refresh runs, or "From your tastings as of …" when behind and unable to refresh.
- **Expanded view** (`AxeInsightDetail`, the existing Modal, a bottom sheet on phones): the full explanation, verified facts, confidence wording, the period looked at, the tastings behind it (from evidence ids), related bottles, and actions.
- **Ask AXE** opens the existing sheet with the insight id and insight-specific suggestions.

## Production deployment requirements

- Merging deploys `askSommelier` and `syncAxeInsights` (approval: `production-functions`), then the website (approval: `production-website`).
- No Firestore rules deploy is required: the insights cache is server-only, and client access is already denied by default.
- After deploy, run a controlled live test on a real account: log or edit a pour, open Home, check the insight, its expanded facts, the AXE wording, and a follow-up question.

## Decisions (approved)

- Event processing: authenticated callable, triggered after successful saves; no Firestore trigger.
- The cache is server-owned and read through the callable; no rules deploy is required.
- Home (Batch 4): Tonight's Pick, a compact Quick Actions row, Continue Your Journey, simplified Open Bottles, Maybe Tonight (2–3), Your Bar Snapshot, one AXE Insight card. Friends' Recent Pours moves to Friends.
