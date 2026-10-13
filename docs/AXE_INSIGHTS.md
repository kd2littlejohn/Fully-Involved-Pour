# AXE Insights: architecture

Status: Batch 1 (engine) is built and tested. Batches 2–4 are not started.

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

## Planned: Batches 2–4

- **Batch 2 (events and cache).** A build step bundles the engine into `functions/generated/axeInsightsEngine.js` (committed; CI fails if it's stale). The server reads the caller's own `users/{uid}` (uid from auth only) plus their blind results, runs `reconcileInsights` in a transaction that refuses to overwrite a newer `generation` or `sourceRevision`, and writes `users/{uid}/axeInsights/current` only when `changed`. Firestore rule: owner may read; nobody may write (Admin SDK only).
- **Batch 3 (AXE explanations).** Lazily, when the selected insight has no explanation for its fingerprint: a minimal payload (category, facts, sample size, confidence, bottle names, allowed actions) goes to the model, which must return JSON. The server rejects any number that isn't a fact or bottle that isn't in the evidence, then caches the result per fingerprint. Otherwise it uses the deterministic copy. Uses the existing rate limiter.
- **Batch 4 (Home).** A compact AXE Insight card replaces "Your Palate", with an expanded view (facts, window, confidence wording, bottles) and "Ask AXE" passing the verified facts into the existing sheet.

## Decisions needed before Batch 2

1. **How events reach the server.**
   - Recommended: a callable (`syncAxeInsights`) fired from the existing save path in `useUserData` (debounced, so one tasting save is one call) and from Blind Room reveal, plus Home's reconciliation check. The client sends no statistics; the server recomputes from stored data. It deploys with the existing workflow.
   - Alternative: a Firestore `onDocumentWritten` trigger. It catches every write automatically, but 2nd-gen Firestore triggers need Eventarc enabled and extra IAM roles that the deploy service account doesn't have, which means console setup steps.
2. **Firestore rules aren't deployed by any workflow.** With the callable design, Home can read the insight through the callable, so no rules deploy is required: client writes are already denied by default. Adding rules deployment to the workflow is possible but would be a new production change.
3. **Home order.** The requested order (greeting, Tonight's Pick, Quick Actions, Continue Your Journey, Maybe Tonight, Your Bar Snapshot, AXE Insight) has no place for the current **Open Bottles** and **Friends' Recent Pours** sections, and Home has no **Quick Actions** row today.
