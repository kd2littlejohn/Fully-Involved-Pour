# AXE release checklist (v0.5.0)

Branch: `claude/ecstatic-mayer-9126ud`. Firebase project: `fully-involved-pour`.

**Order matters: Cloud Function first, website second.** The new web client
relies on the updated `askSommelier`. Against the old function, AXE would
treat every collection as empty. Older (cached PWA) clients work fine
against the new function.

Nothing here changes Firestore rules, indexes, or stored data.

## 0. Pre-flight (local, no production changes)

```sh
git fetch origin && git checkout claude/ecstatic-mayer-9126ud && git pull
git status --short                       # expect: empty
(cd web && npm ci && npx tsc -b && npx oxlint && npx vitest run && npm run build)
(cd functions && npm ci)
npm run test:functions                   # Firestore emulator; expect all passing
npm run test:rules                       # Firestore emulator; expect all passing
firebase login                           # an account with deploy rights on the project
firebase use fully-involved-pour
firebase functions:secrets:get ANTHROPIC_API_KEY   # confirms the secret exists (metadata only; never use secrets:access)
```

## 1. Deploy the Cloud Function (only askSommelier)

```sh
firebase deploy --only functions:askSommelier --project fully-involved-pour
```

Deploying only `askSommelier` keeps the blast radius minimal. The other
functions' only change is their error message text ("AXE is unavailable
right now."), which ships with the next full functions deploy.

Verify:
- The deploy output ends with `✔ functions[askSommelier(...)] Successful update operation`.
- The production website (still the old client) keeps working. The old
  client doesn't open AXE, and the new function accepts its payload anyway.

## 2. Real AI smoke test (new client → production backend, before website release)

Run the new build locally against production Firebase (`web/src/data/firebase.ts`
points at the production project; `localhost` is an authorized auth domain by default):

```sh
cd web && npm run build && npx vite preview --port 4173
```

In a browser at `http://localhost:4173`, sign in with a test account that has
a few bottles and pours, then check each of these:

1. Open a bottle, tap **Ask AXE**, and choose "Tell me about this bottle." The
   reply should name that bottle and only cite data that is actually in the
   account.
2. Go to Profile and ask "What does my palate say about me?" The reply should
   match the Your Palate screen. With fewer than 2 bottles rated 8+, it must
   not claim a flavor preference.
3. Close AXE and reopen it. The conversation should still be there.
4. One request per question. Check the browser network tab: `askSommelier`
   fires only on send, never on navigation.

Check the server side:

```sh
firebase functions:log --only askSommelier --project fully-involved-pour
```

Expect no `Anthropic API error` entries. A model or API error shows up in the
app as "AXE couldn't respond just now" and in the log with the status code.

Keep usage small: a handful of questions (each is one model call, max 500
output tokens; the existing per-user limit is 60/hour).

## 3. Release the website

The website deploys automatically on push to `main`
(`.github/workflows/deploy.yml`).

1. Open a PR from `claude/ecstatic-mayer-9126ud` to `main`, then review and approve it.
2. Merge it, then watch the **Deploy to Firebase Hosting** workflow until it's green.
3. On https://fullyinvolvedpour.com:
   - Accept the "update available" banner, or hard-refresh, to load the new service worker.
   - Check that the compass logo, top nav, and bottom nav look exactly as before.
   - Check that the **Ask AXE** button shows above the bottom nav on mobile and in the corner on desktop.
   - Repeat smoke test step 1 once in production.

## Rollback

Roll back in reverse order: website first, then the function.

```sh
# Website: revert the merge on main (the workflow redeploys automatically)
git checkout main && git pull && git revert -m 1 <merge-commit> && git push

# Function: redeploy the pre-AXE askSommelier from a clean worktree
git worktree add /tmp/fip-rollback a0f0b36
cd /tmp/fip-rollback/functions && npm ci && cd ..
firebase deploy --only functions:askSommelier --project fully-involved-pour
```

Rolling the function back while the new website is live puts AXE into the
"empty collection" state described at the top, which is why the website goes
first.

## Housekeeping

- `claude/vibrant-newton-ouassk` does not need merging. Every change it makes
  (the rules fixture, the completeBatch wait, parseLocalDate in TastingsPage
  and TastingDetailModal) is already on this branch. Close it unmerged. If it
  reaches `main` first, resolve the three test-file conflicts by keeping this
  branch's version.
- `claude/palate-tracker-accuracy` is already merged into this branch (`7686601`).
