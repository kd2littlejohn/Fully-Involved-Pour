// "Who's Tasting": the party's public participant roster.
//
// parties/{partyId}/roster/{rosterId} is a server-written projection of the
// private guest records, readable by every member of that party (host,
// co-hosts and joined guests; see firestore.rules). It carries only what
// the shared list shows:
//   id        safe identifier: a guest's participant key, "host", or a
//             one-way hash for a co-host. Never a Firebase uid.
//   name      the display name they chose
//   role      "host" | "cohost" | "guest"
//   tasting   whether they're scoring (counted in "N tasting")
//   joinedAt
//   progress  { [categoryId]: "tasting" | "submitted" } from their own
//             saved ballots. The state, never a score.
// The private guests/{uid} records stay admin- and self-only.
const v = require("./validation");

const HOST_ROSTER_ID = "host";

function rosterRef(db, partyId, rosterId) {
  return db.doc(`parties/${partyId}/roster/${rosterId}`);
}

// One-way, party-scoped: two parties never share a co-host's id, and the id
// can't be turned back into a uid.
function coHostRosterId(partyId, uid) {
  return `c_${v.sha256(`${partyId}:${uid}`).slice(0, 20)}`;
}

function guestRosterId(guest) {
  return guest.isHost ? HOST_ROSTER_ID : guest.participantKey;
}

function rosterEntry({ id, name, role, tasting, joinedAt, progress }) {
  return { id, name: name || (role === "host" ? "Your host" : "Guest"), role, tasting, joinedAt, progress: progress || {} };
}

function hostEntry(party, tasting, joinedAt, progress) {
  return rosterEntry({ id: HOST_ROSTER_ID, name: party.hostName, role: "host", tasting, joinedAt, progress });
}

function guestEntry(guest, progress) {
  return rosterEntry({ id: guest.participantKey, name: guest.nickname, role: "guest", tasting: true, joinedAt: guest.joinedAt, progress });
}

function coHostEntry(partyId, uid, coHost) {
  return rosterEntry({ id: coHostRosterId(partyId, uid), name: coHost?.name || "Co-host", role: "cohost", tasting: false, joinedAt: coHost?.addedAt || 0 });
}

function progressStatus(ballot, category) {
  const complete = category.sampleLabels.length > 0 && category.sampleLabels.every((label) => ballot.scores && ballot.scores[label]);
  return complete ? "submitted" : "tasting";
}

// Rebuilds a party's whole roster from the private records. Used for
// parties created before the roster existed, and safe to run any time:
// it writes exactly the current membership and removes stale entries.
async function rebuildRoster(db, party) {
  const [guestsSnap, ballotsSnap, existing] = await Promise.all([
    db.collection(`parties/${party.id}/guests`).get(),
    db.collection(`parties/${party.id}/ballots`).where("source", "==", "digital").get(),
    db.collection(`parties/${party.id}/roster`).get(),
  ]);
  const categories = new Map((party.categories || []).map((c) => [c.id, c]));
  const progressByKey = new Map();
  for (const doc of ballotsSnap.docs) {
    const ballot = doc.data();
    const category = categories.get(ballot.categoryId);
    if (!category || ballot.excluded) continue;
    const progress = progressByKey.get(ballot.participantKey) || {};
    progress[ballot.categoryId] = progressStatus(ballot, category);
    progressByKey.set(ballot.participantKey, progress);
  }
  const entries = new Map();
  let hostGuest = null;
  for (const doc of guestsSnap.docs) {
    const guest = doc.data();
    if (guest.isHost) {
      hostGuest = guest;
      continue;
    }
    if (guest.revoked) continue;
    entries.set(guest.participantKey, guestEntry(guest, progressByKey.get(guest.participantKey)));
  }
  const hostTasting = Boolean(hostGuest && !hostGuest.revoked);
  entries.set(HOST_ROSTER_ID, hostEntry(party, hostTasting, hostGuest?.joinedAt || party.createdAt || 0, hostGuest ? progressByKey.get(hostGuest.participantKey) : {}));
  for (const uid of party.coHostUids || []) {
    const entry = coHostEntry(party.id, uid, party.coHosts?.[uid]);
    entries.set(entry.id, entry);
  }
  const batch = db.batch();
  for (const doc of existing.docs) if (!entries.has(doc.id)) batch.delete(doc.ref);
  for (const [id, entry] of entries) batch.set(rosterRef(db, party.id, id), entry);
  await batch.commit();
  return entries.size;
}

module.exports = {
  HOST_ROSTER_ID,
  coHostEntry,
  coHostRosterId,
  guestEntry,
  guestRosterId,
  hostEntry,
  progressStatus,
  rebuildRoster,
  rosterRef,
};
