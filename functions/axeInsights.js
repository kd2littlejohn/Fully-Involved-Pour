// AXE Insights: server-side event processing and the per-user insight
// cache. The engine itself (generated/axeInsightsEngine.js) is the web
// app's tested TypeScript, bundled; this file only loads authoritative
// data, runs it, and persists the result.
//
// Trust model:
//   - The uid comes from request.auth only. The client sends a reason and,
//     optionally, its local calendar date. It never sends statistics.
//   - Every number is recalculated here from users/{uid} and the user's
//     own locked Blind Room answers.
//   - users/{uid}/axeInsights/current is written only by this code (Admin
//     SDK). Clients have no write access (firestore.rules, and subcollections
//     are default-deny anyway) and read it through the callable.
//
// Consistency:
//   - Recalculation reads the user document and the cache inside one
//     Firestore transaction and writes only when the engine reports a
//     meaningful change, so duplicate or concurrent events are safe: a
//     transaction that raced another retries against the newer data.
//   - The stored sourceRevision (the user doc's update time) never moves
//     backwards: a request computed from older data can't overwrite a
//     result computed from newer data.
//   - A failed or missed event needs no replay: the next request of any
//     kind recalculates from the stored data.

const { reconcileInsights, AXE_INSIGHTS_SCHEMA_VERSION } = require("./generated/axeInsightsEngine");

const BLIND_ROOM_LIMIT = 10;
// Blind results are re-read on a blind-reveal event, or when the cached
// copy is older than this (recovery for a missed reveal event).
const BLIND_REFRESH_MS = 24 * 60 * 60 * 1000;
const REASONS = ["data-changed", "blind-reveal", "home", "request-new", "recover"];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function insightRef(db, uid) {
  return db.doc(`users/${uid}/axeInsights/current`);
}

function utcDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// The client's local calendar date makes "today" match the user's day.
// Accepted only within a day of UTC (every real timezone is), otherwise
// the server's UTC date is used. Not a statistic; only affects freshness.
function resolveToday(hint, now) {
  if (typeof hint !== "string" || !DATE_ONLY.test(hint)) return utcDate(now);
  const diff = Math.abs(Date.parse(`${hint}T00:00:00Z`) - Date.parse(`${utcDate(now)}T00:00:00Z`));
  return Number.isFinite(diff) && diff <= 24 * 60 * 60 * 1000 ? hint : utcDate(now);
}

function sanitizeRequest(data) {
  const raw = data && typeof data === "object" ? data : {};
  const reason = REASONS.includes(raw.reason) ? raw.reason : "data-changed";
  return { reason, requestNew: reason === "request-new", today: raw.today };
}

// Fixed-width so plain string comparison orders revisions correctly.
function revisionOf(userSnap) {
  const ms = userSnap.exists && userSnap.updateTime ? userSnap.updateTime.toMillis() : 0;
  return String(ms).padStart(15, "0");
}

// The user's own blind tastings, as the engine expects them: only rooms
// that are revealed/completed (the secrets are readable by rules then
// too), only this user's own LOCKED score and ranking.
async function loadBlindTastings(db, uid) {
  const memberships = await db.collectionGroup("participants").where("uid", "==", uid).get();
  const rooms = [];
  for (const membership of memberships.docs) {
    const roomRef = membership.ref.parent.parent;
    if (!roomRef) continue;
    const roomSnap = await roomRef.get();
    const room = roomSnap.data();
    if (!room || (room.state !== "revealed" && room.state !== "completed")) continue;
    rooms.push({ id: roomRef.id, room });
  }
  rooms.sort((a, b) => (b.room.revealedAt || b.room.completedAt || 0) - (a.room.revealedAt || a.room.completedAt || 0));

  const results = [];
  for (const { id, room } of rooms.slice(0, BLIND_ROOM_LIMIT)) {
    const [secretsSnap, responsesSnap, rankingSnap] = await Promise.all([
      db.doc(`blindRoomSecrets/${id}`).get(),
      db.collection(`blindRooms/${id}/participants/${uid}/responses`).get(),
      db.doc(`blindRooms/${id}/participants/${uid}/ranking/final`).get(),
    ]);
    const secrets = secretsSnap.data();
    if (!secrets || !Array.isArray(secrets.pours)) continue;
    const scores = new Map();
    for (const r of responsesSnap.docs) {
      const resp = r.data();
      if (resp && resp.status === "locked" && typeof resp.fipScore === "number") scores.set(resp.pourLabel, resp.fipScore);
    }
    const ranking = rankingSnap.data();
    const order = ranking && ranking.status === "locked" && Array.isArray(ranking.order) ? ranking.order : [];
    const when = room.revealedAt || room.completedAt;
    results.push({
      roomId: id,
      roomName: typeof room.name === "string" ? room.name.slice(0, 80) : undefined,
      date: typeof when === "number" ? utcDate(when) : undefined,
      pours: secrets.pours
        .filter((p) => p && typeof p.label === "string" && typeof p.bottleId === "string")
        .map((p) => ({
          label: p.label,
          bottleId: p.bottleId,
          bottleName: String(p.bottleName || "a bottle").slice(0, 80),
          blindScore: scores.get(p.label),
          blindRank: order.includes(p.label) ? order.indexOf(p.label) + 1 : undefined,
        })),
    });
  }
  return results;
}

// Firestore rejects `undefined` values; the engine uses them for absent
// optional fields. A JSON round trip drops them.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

// What the client gets: the selected insight and enough to tell fresh
// from stale. History and other categories' candidates stay server-side.
function publicView(doc) {
  const state = doc && doc.state;
  if (!state) return { status: "empty", generation: 0, selected: null };
  return {
    status: state.selected ? "ready" : "empty",
    schemaVersion: state.schemaVersion,
    generation: state.generation,
    sourceRevision: state.sourceRevision,
    calculatedAt: state.calculatedAt,
    inputFingerprints: state.inputFingerprints,
    selected: state.selected ? state.selected.candidate : null,
  };
}

async function readAxeInsights(db, uid) {
  const snap = await insightRef(db, uid).get();
  return publicView(snap.exists ? snap.data() : null);
}

async function syncAxeInsights(db, uid, data, now = Date.now()) {
  const { reason, requestNew, today: todayHint } = sanitizeRequest(data);
  const today = resolveToday(todayHint, now);
  const ref = insightRef(db, uid);
  const userRef = db.doc(`users/${uid}`);

  // Blind data spans many documents, so it's read before the transaction;
  // it's the user's own, already-revealed history and only changes on a
  // reveal, which arrives as its own event.
  const before = await ref.get();
  const cachedBlind = before.exists ? before.data().blind : undefined;
  const refreshBlind =
    reason === "blind-reveal" || !cachedBlind || typeof cachedBlind.fetchedAt !== "number" || now - cachedBlind.fetchedAt > BLIND_REFRESH_MS;
  const blindTastings = refreshBlind ? await loadBlindTastings(db, uid) : cachedBlind.tastings || [];

  return db.runTransaction(async (tx) => {
    const [userSnap, cacheSnap] = await Promise.all([tx.get(userRef), tx.get(ref)]);
    const stored = cacheSnap.exists ? cacheSnap.data() : null;
    const previous = stored && stored.state && stored.state.schemaVersion === AXE_INSIGHTS_SCHEMA_VERSION ? stored.state : null;
    const sourceRevision = revisionOf(userSnap);

    // Never let older source data replace a newer result.
    if (previous && previous.sourceRevision > sourceRevision) {
      return { ...publicView(stored), changed: false, stale: true };
    }

    const userDoc = userSnap.exists ? userSnap.data() : {};
    const input = {
      bottles: Array.isArray(userDoc.bottles) ? userDoc.bottles : [],
      pours: Array.isArray(userDoc.pours) ? userDoc.pours : [],
      blindTastings,
      today,
    };
    const result = reconcileInsights(previous, input, { now, sourceRevision, requestNew });

    if (result.changed || refreshBlind) {
      const nextDoc = plain({
        state: result.changed ? result.state : previous,
        blind: refreshBlind ? { fetchedAt: now, tastings: blindTastings } : cachedBlind,
        updatedAt: now,
      });
      tx.set(ref, nextDoc);
      return { ...publicView(nextDoc), changed: result.changed, recalculated: result.recalculated };
    }
    return { ...publicView(stored), changed: false, recalculated: result.recalculated };
  });
}

module.exports = { syncAxeInsights, readAxeInsights, loadBlindTastings, resolveToday, sanitizeRequest, publicView, BLIND_REFRESH_MS };
