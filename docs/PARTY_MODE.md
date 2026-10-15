# Blind Room Party Mode

A hosted blind tasting for a whole room. It extends the Blind Room and leaves the existing Solo and Friends blinds, and their `blindRooms` collections, unchanged.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/blind/party` | anyone | Party hub: Create, Join, Resume, Past Parties |
| `/party/new`, `/party/:id/setup` | host | Create / edit wizard |
| `/p/:code` | guests | Welcome, nickname join, recovery-code rejoin (QR and invite links point here) |
| `/party/:id` | guests | Live round, scoring, results |
| `/party/:id/host` | host, co-hosts | Live dashboard: Manage Party, plus My Tasting when the host is tasting too |
| `/party/:id/cohost?t=…` | invited co-host | Accept a one-time co-host invitation (FIP account required) |
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
| `parties/{id}/guests/{uid}` | nickname, participant key, revoked flag; the host's own record has `isHost: true` | host, that guest |
| `parties/{id}/ballots/{categoryId}__{participantKey}` | one ballot per participant per round | its owner only (guest, or host for paper) |
| `parties/{id}/results/{categoryId}` | published results, written at reveal | host, guests, displays |
| `parties/{id}/results/recap` | Party Recap, written at completion | host, guests, displays |
| `parties/{id}/audit/*` | privileged change log | host |
| `parties/{id}/displays/{uid}` | read-only TV sessions with an expiry | host, that display |
| `partySecrets/{id}` | **the bottle ↔ letter mapping**, display token hash | no client, host included: admins use the `getBottleKey` callable |
| `partyCoHostInvites/*` | single-use co-host invite hashes | server only |
| `partyCodes/*`, `partyGuestKeys/*`, `partyClaims/*` | join codes, recovery-code hashes, claim tokens | server only |
| `users/{uid}/partyCategories/*`, `users/{uid}/partyTemplates/*` | saved custom categories and setups | owner |

Guests never get read access to `partySecrets`. They learn bottle identities only from a results document, and a results document exists only after the host reveals that round.

Not even the host can read a guest's digital ballot (scores or private notes). The host sees who voted, and results are computed on the server.

### Formats

`parties/{id}.format` is `"blind"` (the default, and every party created before formats existed) or `"regular"`.

- **Blind:** samples are letters, and bottles stay in `partySecrets` until the host reveals a round.
- **Regular:** everyone sees the bottles while they score. Each round on the party doc carries `bottles: { [label]: { name, distillery?, type?, age?, proof?, imageUrl? } }`, never the host's price or My Bar id. There's no reveal step: the host closes voting with `voting_open → revealed`, which publishes results in one transaction. Blind parties can't skip `voting_closed`.
- The format can change only until a round first opens for voting. Switching rewrites or strips each round's `bottles` to match.

### The host tasting too

"I'm tasting too" is on by default (`createParty` with `hostTasting: false` turns it off).

- The host gets one guest record (`guests/{hostUid}`, `isHost: true`, participant key `h_…`) and scores through the same `saveBallot` as everyone else. That means one ballot per round, the same scale and deadlines, edits only while voting is open, and equal weight in results. They aren't counted in `counts.guests`.
- `setHostTasting { enabled }` turns it off or on later. Off revokes the record and excludes the host's ballots in rounds not yet revealed (`excludedReason: "Host stopped tasting"`); on restores exactly those. All host controls keep working either way.
- To prevent double counting, the host can't `joinParty` their own party, can't be removed with `removeGuest`, and can't enter a paper ballot under their own name while tasting.
- On the dashboard, **My Tasting** is the guest scoring view (`MyTastingView`). It has no admin controls and no bottle mapping. Bottles appear only through revealed results, as for any guest.
- **Blind integrity:** the host still sets up the flight and can open the mapping on Manage Party, so a host's blind ballot is only as blind as their setup. The setup screen says so and suggests someone else pours.

### Bottle key, co-hosts and blind integrity

**Admins** are the host and up to 3 **co-hosts / pour assistants**: other FIP accounts the host invites with a single-use link (`createCoHostInvite` → `/party/:id/cohost?t=…` → `acceptCoHost`, valid 2 days; `removeCoHost`).

- **What co-hosts can do:** everything that runs the event: setup, bottles, rounds, reveals, paper ballots, invites, displays, completing the party, and the bottle key.
- **What co-hosts can't do:** delete the party, change host tasting, manage co-hosts, join as a guest, or read anyone's ballot. Someone already tasting as a guest can't become a co-host.
- **Rules:** co-hosts read the party, roster, results, audit and displays (`isPartyAdmin`).

**The bottle key** is served only by `getBottleKey { confirm: true, purpose }`.

- The client never subscribes to `partySecrets`.
- Every view while any round is unrevealed writes an audit event: `bottle-key-viewed`, with actor, role, purpose, the hidden rounds and any flagged rounds.
- On the dashboard, every view sits behind a confirmation. The key lives only in memory, and **Hide key** drops it. The Bottle key card lists every pre-reveal view.
- In **Edit setup**, details, rounds and scoring can be edited without the key. The Bottles and Letters steps ask to open it (`purpose: "setup"`). Regular tastings load bottles directly.

**Blind integrity.** `party.hostKeyViews[categoryId]` records when the host first knew a round's bottles in a blind party:

- **Setting up the bottles:** `setSamples` by the host.
- **Opening the key:** viewing it while that round is unrevealed and their ballot for it isn't finished.

It's recorded whether or not the host is tasting yet. The host's ballots in those rounds, and any host ballot saved after that point, carry `unblinded: true`.

These ballots are **never excluded**:

- Results count them like every other ballot and report `unblindedBallots`, shown to everyone as a short note.
- A ballot finished before the key was opened stays blind until it's edited.
- Co-host views never flag anything.

To taste fully blind, the host leaves the bottles empty and has a co-host set them up and pour.

### Saving to My Tastings

Once a round's bottles are known (a revealed blind round, or a regular round's results), a signed-in taster can save their own scores from that round. This includes the participating host.

- Saved tastings go to `users/{uid}.tastings` as `SavedTasting` records, one per scored sample.
- Ids are `party:{partyId}:{categoryId}:{label}`, so saving again updates instead of duplicating.
- Each record keeps:
  - the bottle snapshot (no price)
  - event and round
  - the original tasting date
  - overall and sub-scores
  - notes and descriptors
  - favorite
  - blind or regular origin and the reveal time
  - a not-fully-blind mark
- The bottle is linked to a My Bar bottle with the same name if there is one. Nothing is added to My Bar and inventory never changes.
- My Tastings appear in the Journal.
- Your Palate counts them through the existing Bottle and Pour shapes, in memory only:
  - sub-scores map onto the FIP rubric maximums
  - the overall rating is kept as given
  - unowned bottles get stand-in records
- Anonymous guests use **Keep my results** to link an account first.

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

**Blind integrity, co-hosts and Save to My Tastings release:** deploy in this order.

1. Functions (`partyAction`).
2. The website.
3. Firestore rules (`firebase deploy --only firestore:rules`). They close `partySecrets` to every client and give co-hosts admin reads.

The new website never reads `partySecrets` directly, so it works under the old rules. Co-host dashboards need the new rules.


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
