// Who runs a party: the host and their co-hosts.
//
// parties/{partyId}/admins/{uid} = { uid, role: "host" | "cohost", name, addedAt }
//
// One protected record per admin, written only by the server. Readable by
// that admin and by the party's other admins (see firestore.rules); never
// by guests or TV displays. firestore.rules decide "is this caller an
// admin?" by whether their own record exists, and the server does the same
// through readParty.
//
// Older parties kept these identities on the party document itself
// (hostUid, coHostUids, coHosts keyed by uid), which every guest and
// display can read. migrateLegacyAdmins moves them into admin records and
// deletes them from the party document. It runs automatically, and is
// idempotent, the first time any party action touches an older party.
const { FieldValue } = require("firebase-admin/firestore");

const LEGACY_FIELDS = ["hostUid", "coHostUids", "coHosts"];

function adminRef(db, partyId, uid) {
  return db.doc(`parties/${partyId}/admins/${uid}`);
}

function adminsQuery(db, partyId) {
  return db.collection(`parties/${partyId}/admins`);
}

function hostRecord(uid, name, addedAt) {
  return { uid, role: "host", name: name || "Your host", addedAt };
}

function coHostRecord(uid, name, addedAt) {
  return { uid, role: "cohost", name: name || "Co-host", addedAt };
}

function hasLegacyAdmins(data) {
  return LEGACY_FIELDS.some((field) => data && data[field] !== undefined);
}

// The party as the server reasons about it: the stored document plus
// hostUid / coHostUids / coHosts filled in from the admin records. These
// in-memory fields are never written back to the party document.
function withAdmins(data, records) {
  if (!records.length && hasLegacyAdmins(data)) return data; // not yet migrated
  const party = { ...data };
  for (const field of LEGACY_FIELDS) delete party[field];
  party.coHostUids = [];
  party.coHosts = {};
  for (const record of records) {
    if (record.role === "host") party.hostUid = record.uid;
    else if (record.role === "cohost") {
      party.coHostUids.push(record.uid);
      party.coHosts[record.uid] = { name: record.name, addedAt: record.addedAt };
    }
  }
  return party;
}

async function migrateLegacyAdmins(db, partyId) {
  const ref = db.doc(`parties/${partyId}`);
  const first = await ref.get();
  if (!first.exists || !hasLegacyAdmins(first.data())) return false;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || !hasLegacyAdmins(snap.data())) return false;
    const data = snap.data();
    const existing = await tx.get(adminsQuery(db, partyId));
    const have = new Set(existing.docs.map((d) => d.id));
    if (data.hostUid && !have.has(data.hostUid)) {
      tx.set(adminRef(db, partyId, data.hostUid), hostRecord(data.hostUid, data.hostName, data.createdAt || 0));
    }
    for (const uid of Array.isArray(data.coHostUids) ? data.coHostUids : []) {
      if (have.has(uid) || uid === data.hostUid) continue;
      const info = (data.coHosts && data.coHosts[uid]) || {};
      tx.set(adminRef(db, partyId, uid), coHostRecord(uid, info.name, info.addedAt || 0));
    }
    const strip = {};
    for (const field of LEGACY_FIELDS) strip[field] = FieldValue.delete();
    tx.update(ref, strip);
    return true;
  });
}

module.exports = {
  LEGACY_FIELDS,
  adminRef,
  adminsQuery,
  coHostRecord,
  hasLegacyAdmins,
  hostRecord,
  migrateLegacyAdmins,
  withAdmins,
};
