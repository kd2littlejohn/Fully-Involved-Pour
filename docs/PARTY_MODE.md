# Blind Room Party Mode

A hosted blind tasting for a whole room. It extends the Blind Room and leaves the existing Solo and Friends blinds, and their `blindRooms` collections, unchanged.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/blind/party` | anyone | Party hub: Create, Join, Resume, Past Parties |
| `/party/new`, `/party/:id/setup` | host | Create / edit wizard |
| `/p/:code` | guests | Welcome, nickname join, recovery-code rejoin (QR and invite links point here) |
| `/party/:id` | guests | Live round, scoring, results |
| `/party/:id/host` | host | Live dashboard and round controls |
| `/party/:id/ballots` | host | Paper Ballot Entry |
| `/party/:id/print` | host | Printable scorecards |
| `/party/:id/recap` | host + guests | Party Recap (after completion) |
| `/party/:id/display?t=…` | TV | Read-only presentation session |

Party routes outside the hub run full screen with no bottom nav.

## Architecture

**All writes go through one callable, `partyAction`** (`functions/party/service.js`). Clients, hosts included, can only *read* party data, and only what their role allows (`firestore.rules`). The callable:

- authenticates the caller and checks their role; host actions refuse anonymous identities,
- validates every input (`functions/party/validation.js`),
- runs read-modify-writes in Firestore transactions, so concurrent ballots and conflicting host actions serialize safely,
- rate-limits per identity and, for preview/join/recover, per IP as well,
- writes an audit event for every privileged change.

Rankings come from a pure engine (`functions/party/scoring.js`). It runs at reveal and at completion, never on the client.

### Data

| Path | Contents | Read access |
| --- | --- | --- |
| `parties/{id}` | event details, settings, rounds (names snapshotted), counts, join code | host, joined guests, active displays |
| `parties/{id}/guests/{uid}` | nickname, participant key, revoked flag | host, that guest |
| `parties/{id}/ballots/{categoryId}__{participantKey}` | one ballot per participant per round | its owner only (guest, or host for paper) |
| `parties/{id}/results/{categoryId}` | published results, written at reveal | host, guests, displays |
| `parties/{id}/results/recap` | Party Recap, written at completion | host, guests, displays |
| `parties/{id}/audit/*` | privileged change log | host |
| `parties/{id}/displays/{uid}` | read-only TV sessions with an expiry | host, that display |
| `partySecrets/{id}` | **the bottle ↔ letter mapping**, display token hash | host only, forever |
| `partyCodes/*`, `partyGuestKeys/*`, `partyClaims/*` | join codes, recovery-code hashes, claim tokens | server only |
| `users/{uid}/partyCategories/*`, `users/{uid}/partyTemplates/*` | saved custom categories and setups | owner |

Guests never get read access to `partySecrets`. They learn bottle identities only from a results document, and a results document exists only after the host reveals that round.

Not even the host can read a guest's digital ballot (scores or private notes). The host sees who voted, and results are computed on the server.

### Guests

- Guests sign in with **Firebase Anonymous Auth** the first time they join. The session persists in the browser across refreshes.
- `useAuth()` hides anonymous identities, so the rest of the app treats a guest as signed out and never creates `users/{uid}` for them.
- Ballot ownership is the identity (uid), never the nickname or join code.
- A recovery code is shown once at join and stored only as a hash. It moves the guest, and ownership of their ballots, to a new device's identity. Each use issues a new code.
- **Keep my results:** `linkWithPopup` upgrades the anonymous guest in place, keeping the same uid. If the Google account already exists, the anonymous session first mints a single-use claim token (only it can), then the signed-in account redeems it.

### Scoring rules

- **Ranking metric:** each participant's explicit overall enjoyment (0–10), which Quick and Detailed both collect. Detailed sub-scores never affect rankings.
- **Equal weight:** digital and paper ballots count the same. Excluded ballots don't count.
- **Missing scores:** a sample with no ratings has no average and is never counted as 0. Every average shows how many ratings it uses.
- **Ties:** averages are compared at two decimals, and equal averages share a rank (1, 1, 3).
- **People's Choice:** comes only from explicit favorite votes.
- **Best Value:** only when every rated sample in the round has a price.
- **Biggest Surprise:** only when predictions are on, at least 3 were made, and the room's predicted winner wasn't the champion.

### Round state machine (enforced on the server)

`draft ⇄ ready → voting_open ⇄ voting_closed → revealed`

`draft` can also go straight to `voting_open`.

- **Locking:** the first time a round opens for voting, its bottles and letters lock for good, so reopening keeps every submission valid.
- **No auto-reveal:** closing voting never reveals anything.
- **Limits:** 24 rounds per party, 2–12 bottles per round, and up to 150 guests (or the host's capacity).

## Release checklist

1. **Firebase Console → Authentication → Sign-in method → enable Anonymous.** Guests can't join without it.
2. Deploy the security rules and indexes. The new `guests.uid` collection-group index backs "parties I attended".

   ```sh
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

3. Deploy functions. The release workflow now includes `partyAction` in its required functions, and `askSommelier` gains the `party-insight` mode.
4. Deploy the website (the normal release workflow).

Existing collections and stored data are not modified.

## Testing

```sh
cd web && npx tsc -b && npx oxlint && npx vitest run && npm run build
npm run test:functions   # repo root: party service, scoring, AXE against the emulator
npm run test:rules       # repo root: party read boundaries
```

**Local end-to-end run against emulators:**

1. Start the emulators:

   ```sh
   firebase emulators:start --only auth,firestore,functions
   ```

   The functions emulator needs `functions/.secret.local` containing `ANTHROPIC_API_KEY=<anything>`. That file is git-ignored.

2. In `web/`, start the dev server against the emulators:

   ```sh
   VITE_MOCK_AUTH=false VITE_FIREBASE_EMULATORS=true npx vite
   ```
