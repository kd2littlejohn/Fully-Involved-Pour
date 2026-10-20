// Blind Room Party Mode — the trusted server side of every party write.
//
// Clients only ever READ party data (through firestore.rules, which allow
// no client writes to any party collection). Every change — creating a
// party, editing categories and bottles, guests joining, ballots, round
// state, reveals — goes through handlePartyAction, which:
//   - authenticates the caller and checks their role for this party
//     (host actions refuse anonymous identities outright),
//   - validates every input (validation.js),
//   - rate-limits per identity and, for unauthenticated-style entry points
//     (preview/join/recover), per IP as well,
//   - runs each read-modify-write in a Firestore transaction, so concurrent
//     submissions and conflicting host actions serialize safely,
//   - records an audit event for privileged changes.
//
// Collections (see firestore.rules for the read side):
//   parties/{partyId}                  event, categories (snapshotted), counts
//   parties/{partyId}/guests/{uid}     one per joined identity, plus the
//                                      host's own when they're tasting too
//                                      (isHost: true; not a counted guest)
//   parties/{partyId}/ballots/{id}     id = `${categoryId}__${participantKey}`
//   parties/{partyId}/results/{id}     per category at reveal; 'recap' at completion
//   parties/{partyId}/audit/{id}       privileged change log (host-readable)
//   parties/{partyId}/roster/{id}      public "Who's Tasting" list (roster.js):
//                                      names, roles, status. Members read it
//   parties/{partyId}/displays/{uid}   read-only presentation sessions
//   partySecrets/{partyId}             bottle mapping + display token hash. No
//                                      client reads it, host included: admins
//                                      get it from getBottleKey, which asks
//                                      for confirmation and logs every view
//   partyCoHostInvites/{hash}          single-use co-host invites (server-only)
//   partyCodes/{code}                  join code -> partyId (server-only)
//   partyGuestKeys/{hash}              recovery code hash -> guest (server-only)
//   partyClaims/{hash}                 guest-to-account claim tokens (server-only)
const { HttpsError } = require("firebase-functions/v2/https");
// Modular import: available before (and independent of) initializeApp,
// unlike the admin.firestore namespace inside the Functions runtime.
const { FieldValue } = require("firebase-admin/firestore");
const { assertNotRateLimited } = require("../rateLimit");
const { computeCategoryResults, computeRecap } = require("./scoring");
const v = require("./validation");
const roster = require("./roster");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CODE_LENGTH = 6;
const RECOVERY_LENGTH = 10;
const DISPLAY_TTL_MS = DAY;
const CLAIM_TTL_MS = 15 * 60 * 1000;

const RATE_LIMITS = {
  create: { maxCalls: 30, windowMs: DAY },
  host: { maxCalls: 900, windowMs: HOUR },
  preview: { maxCalls: 60, windowMs: HOUR },
  previewIp: { maxCalls: 240, windowMs: HOUR },
  join: { maxCalls: 20, windowMs: HOUR },
  joinIp: { maxCalls: 120, windowMs: HOUR },
  recover: { maxCalls: 10, windowMs: HOUR },
  recoverIp: { maxCalls: 30, windowMs: HOUR },
  ballot: { maxCalls: 400, windowMs: HOUR },
  display: { maxCalls: 20, windowMs: HOUR },
  claim: { maxCalls: 10, windowMs: HOUR },
};


function denied(message) {
  return new HttpsError("permission-denied", message || "You don't have access to do that.");
}

function precondition(message) {
  return new HttpsError("failed-precondition", message);
}

function notFound(message) {
  return new HttpsError("not-found", message);
}

function partyRef(db, partyId) {
  return db.doc(`parties/${partyId}`);
}

function secretsRef(db, partyId) {
  return db.doc(`partySecrets/${partyId}`);
}

function ballotId(categoryId, participantKey) {
  return `${categoryId}__${participantKey}`;
}

async function limit(ctx, bucket) {
  await assertNotRateLimited(ctx.uid, `party_${bucket}`, RATE_LIMITS[bucket]);
}

async function limitIp(ctx, bucket) {
  if (!ctx.ip) return;
  await assertNotRateLimited(`ip-${v.sha256(ctx.ip).slice(0, 32)}`, `party_${bucket}`, RATE_LIMITS[bucket]);
}

// `tx` is a transaction, or null for a plain read.
async function readParty(tx, db, partyId) {
  const ref = partyRef(db, partyId);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!snap.exists) throw notFound("That party doesn't exist.");
  return snap.data();
}

function assertAccount(ctx) {
  if (ctx.isAnonymous) throw denied("Sign in to your FIP account to host a party.");
}

function assertHost(ctx, party) {
  assertAccount(ctx);
  if (party.hostUid !== ctx.uid) throw denied("Only the host can do that.");
}

function isCoHost(party, uid) {
  return Array.isArray(party.coHostUids) && party.coHostUids.includes(uid);
}

// Event administrators: the host, plus any co-host / pour assistant they
// invited. Co-hosts run the event but never taste, and can't delete the
// party, change who's tasting, or manage other co-hosts.
function assertAdmin(ctx, party) {
  assertAccount(ctx);
  if (party.hostUid === ctx.uid) return "host";
  if (isCoHost(party, ctx.uid)) return "cohost";
  throw denied("Only the host or a co-host can do that.");
}

function assertNotCompleted(party) {
  if (party.status === "completed") throw precondition("This party is already wrapped up.");
}

function findCategory(party, categoryId) {
  const category = (party.categories || []).find((c) => c.id === categoryId);
  if (!category) throw notFound("That round isn't part of this party.");
  return category;
}

function replaceCategory(party, updated) {
  return party.categories.map((c) => (c.id === updated.id ? updated : c));
}

function auditEvent(tx, db, partyId, ctx, type, details) {
  const ref = db.collection(`parties/${partyId}/audit`).doc();
  tx.set(ref, { type, actorUid: ctx.uid, at: ctx.now, ...(details || {}) });
}

function newCategory(input, now) {
  return {
    id: v.randomId("c_"),
    libraryId: input.libraryId || null,
    name: input.name,
    description: input.description || "",
    state: "draft",
    sampleLabels: [],
    lockedAt: null,
    votingOpenedAt: null,
    votingClosedAt: null,
    revealedAt: null,
    createdAt: now,
  };
}

// Party doc fields a guest or display may see. The secrets never live here.
function previewOf(party) {
  return {
    partyId: party.id,
    name: party.name,
    description: party.description || "",
    eventDate: party.eventDate || null,
    coverImageUrl: party.coverImageUrl || "",
    hostName: party.hostName || "",
    status: party.status,
    categoryCount: (party.categories || []).length,
  };
}

function joinBlocker(party, now) {
  if (party.status === "completed") return "This party has wrapped up.";
  if (party.inviteActive === false) return "The host has closed this invitation.";
  if (party.inviteExpiresAt && party.inviteExpiresAt < now) return "This invitation has expired.";
  const capacity = party.capacity || v.LIMITS.MAX_GUESTS;
  if ((party.counts?.guests || 0) >= capacity) return "This party is full.";
  return null;
}

async function claimNewCode(db, partyId, now) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = v.randomCode(CODE_LENGTH);
    try {
      await db.doc(`partyCodes/${code}`).create({ partyId, createdAt: now });
      return code;
    } catch (err) {
      if (err && err.code === 6) continue; // ALREADY_EXISTS: pick another
      throw err;
    }
  }
  throw new HttpsError("unavailable", "Couldn't generate a party code. Try again.");
}

async function lookupCode(db, rawCode) {
  const code = v.normalizeCode(rawCode);
  const snap = await db.doc(`partyCodes/${code}`).get();
  if (!snap.exists) return null;
  return { code, partyId: snap.data().partyId };
}

function formatRecovery(code) {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

function recoveryKeyId(partyId, recoveryCode) {
  return v.sha256(`${partyId}:${String(recoveryCode).replace(/[\s-]/g, "").toUpperCase()}`);
}

// ---------------------------------------------------------------------------
// Host: setup

const HOST_OPT_OUT_REASON = "Host stopped tasting";
const MAX_CO_HOSTS = 3;
const CO_HOST_INVITE_TTL_MS = 2 * DAY;

// Blind integrity. A host who knows a round's bottles (they set them up,
// or opened the bottle key) before finishing that round's ballot can't be
// fully blind. Their scores still count; the ballot carries
// `unblinded: true` and results count how many such ballots they include.
// `party.hostKeyViews[categoryId]` records when the host first knew, kept
// whether or not they're tasting yet, so turning tasting on later can't
// hide it. Any host ballot saved after that point is flagged.
function hostGuestRef(db, party) {
  return db.doc(`parties/${party.id}/guests/${party.hostUid}`);
}

function ballotComplete(ballot, category) {
  return Boolean(ballot && category.sampleLabels.length && category.sampleLabels.every((label) => ballot.scores && ballot.scores[label]));
}

function isRegular(party) {
  return party.format === "regular";
}

// What a regular (non-blind) tasting shows everyone about a bottle. Never
// the host's price or My Bar id.
function publicBottle(bottle) {
  const out = { name: bottle.name };
  for (const key of ["distillery", "type", "age", "proof", "imageUrl"]) if (bottle[key] !== undefined) out[key] = bottle[key];
  return out;
}

function publicBottles(samples) {
  const out = {};
  for (const s of samples || []) out[s.label] = publicBottle(s.bottle);
  return out;
}

// Regular tastings carry each round's bottles on the party doc; blind ones
// never do (the mapping stays in partySecrets until reveal).
function withPublicBottles(party, category, samples) {
  if (!isRegular(party)) {
    const { bottles: _omit, ...rest } = category;
    return rest;
  }
  return { ...category, bottles: publicBottles(samples) };
}

function hostGuestRecord(uid, hostName, now) {
  return {
    uid,
    participantKey: v.randomId("h_"),
    nickname: hostName,
    nicknameKey: v.nicknameKey(hostName),
    joinedAt: now,
    revoked: false,
    isAccount: true,
    isHost: true,
  };
}

async function createParty(ctx) {
  assertAccount(ctx);
  await limit(ctx, "create");
  const details = v.validateDetails(ctx.data.details);
  const settings = v.validateSettings(ctx.data.settings);
  const categoriesInput = Array.isArray(ctx.data.categories) ? ctx.data.categories : [];
  if (categoriesInput.length > v.LIMITS.MAX_CATEGORIES) throw v.invalid(`A party can have up to ${v.LIMITS.MAX_CATEGORIES} rounds.`);
  const categories = categoriesInput.map((c) => newCategory(v.validateCategoryInput(c), ctx.now));
  const hostName = v.cleanText(ctx.data.hostName, 40) || "Your host";
  // "I'm tasting too" — on unless the host turns it off.
  const hostTasting = ctx.data.hostTasting !== false;
  const format = v.validateFormat(ctx.data.format);

  const ref = ctx.db.collection("parties").doc();
  const code = await claimNewCode(ctx.db, ref.id, ctx.now);
  const party = {
    id: ref.id,
    hostUid: ctx.uid,
    hostName,
    hostTasting,
    format,
    ...details,
    status: "setup",
    settings,
    categories,
    currentCategoryId: categories[0] ? categories[0].id : null,
    joinCode: code,
    inviteActive: true,
    inviteExpiresAt: null,
    counts: { guests: 0, digital: {}, paper: {} },
    createdAt: ctx.now,
    updatedAt: ctx.now,
    completedAt: null,
  };
  const secretCategories = {};
  for (const c of categories) secretCategories[c.id] = { samples: [] };
  if (format === "regular") for (const c of categories) c.bottles = {};

  const batch = ctx.db.batch();
  batch.set(ref, party);
  batch.set(secretsRef(ctx.db, ref.id), { partyId: ref.id, hostUid: ctx.uid, categories: secretCategories, display: null });
  if (hostTasting) batch.set(ctx.db.doc(`parties/${ref.id}/guests/${ctx.uid}`), hostGuestRecord(ctx.uid, hostName, ctx.now));
  batch.set(roster.rosterRef(ctx.db, ref.id, roster.HOST_ROSTER_ID), roster.hostEntry(party, Boolean(hostTasting), ctx.now));
  batch.set(ctx.db.collection(`parties/${ref.id}/audit`).doc(), { type: "party-created", actorUid: ctx.uid, at: ctx.now });
  await batch.commit();
  return { partyId: ref.id, joinCode: code, categories: categories.map((c) => ({ id: c.id, name: c.name })) };
}

async function updateParty(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  await limit(ctx, "host");
  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertAdmin(ctx, party);
    const patch = { updatedAt: ctx.now };
    if (ctx.data.details !== undefined || ctx.data.settings !== undefined) assertNotCompleted(party);
    if (ctx.data.details !== undefined) Object.assign(patch, v.validateDetails(ctx.data.details));
    if (ctx.data.settings !== undefined) patch.settings = v.validateSettings(ctx.data.settings, party.settings);
    if (ctx.data.format !== undefined) {
      const format = v.validateFormat(ctx.data.format);
      if (format !== (party.format || "blind")) {
        if (party.categories.some((c) => c.lockedAt)) throw precondition("A round has already opened for voting, so the tasting format is set.");
        const secrets = (await tx.get(secretsRef(ctx.db, partyId))).data()?.categories || {};
        const next = { ...party, format };
        patch.format = format;
        patch.categories = party.categories.map((c) => withPublicBottles(next, c, secrets[c.id]?.samples));
      }
    }
    if (ctx.data.recapNotes !== undefined) {
      patch.recapNotes = v.cleanText(ctx.data.recapNotes, v.LIMITS.MAX_HOST_NOTES);
      const recapRef = ctx.db.doc(`parties/${partyId}/results/recap`);
      const recap = await tx.get(recapRef);
      if (recap.exists) tx.update(recapRef, { notes: patch.recapNotes });
    }
    tx.update(partyRef(ctx.db, partyId), patch);
    auditEvent(tx, ctx.db, partyId, ctx, "party-updated", { fields: Object.keys(patch).filter((k) => k !== "updatedAt") });
    return { ok: true };
  });
}

// Replaces the event's category list: add (from the library, custom, or as
// a duplicate of an existing round), rename, reorder, remove. A round that
// has ever opened for voting can't be removed, and a revealed round can't
// be renamed — its results are history.
async function setCategories(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  await limit(ctx, "host");
  if (!Array.isArray(ctx.data.categories)) throw v.invalid("Categories must be a list.");
  if (ctx.data.categories.length > v.LIMITS.MAX_CATEGORIES) throw v.invalid(`A party can have up to ${v.LIMITS.MAX_CATEGORIES} rounds.`);
  const inputs = ctx.data.categories.map(v.validateCategoryInput);

  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertAdmin(ctx, party);
    assertNotCompleted(party);
    const secretsSnap = await tx.get(secretsRef(ctx.db, partyId));
    const secretCategories = { ...(secretsSnap.data()?.categories || {}) };
    const existing = new Map(party.categories.map((c) => [c.id, c]));
    const seen = new Set();
    const next = [];

    for (const input of inputs) {
      if (input.id) {
        const current = existing.get(input.id);
        if (!current) throw v.invalid("One of those rounds no longer exists. Refresh and try again.");
        if (seen.has(input.id)) throw v.invalid("A round appears twice.");
        seen.add(input.id);
        if (current.state === "revealed" && (current.name !== input.name || (current.description || "") !== input.description)) {
          throw precondition(`"${current.name}" has been revealed and can't be renamed.`);
        }
        next.push({ ...current, name: input.name, description: input.description });
      } else {
        const category = newCategory(input, ctx.now);
        let samples = [];
        if (input.duplicateOf) {
          const source = secretCategories[input.duplicateOf];
          if (!existing.has(input.duplicateOf) || !source) throw v.invalid("The round to duplicate wasn't found.");
          const labels = v.shuffle(v.SAMPLE_LABELS.slice(0, source.samples.length));
          samples = source.samples
            .map((s, i) => ({ id: v.randomId("s_"), label: labels[i], bottle: s.bottle }))
            .sort((a, b) => a.label.localeCompare(b.label));
          category.sampleLabels = samples.map((s) => s.label);
        }
        secretCategories[category.id] = { samples };
        next.push(withPublicBottles(party, category, samples));
      }
    }

    for (const [id, category] of existing) {
      if (seen.has(id)) continue;
      if (category.lockedAt) throw precondition(`"${category.name}" has already opened for voting and can't be removed.`);
      delete secretCategories[id];
    }

    const currentCategoryId = next.some((c) => c.id === party.currentCategoryId) ? party.currentCategoryId : next[0]?.id || null;
    tx.update(partyRef(ctx.db, partyId), { categories: next, currentCategoryId, updatedAt: ctx.now });
    // update() (not a merge) so a removed round's bottles are really gone.
    tx.update(secretsRef(ctx.db, partyId), { categories: secretCategories });
    auditEvent(tx, ctx.db, partyId, ctx, "categories-updated", { count: next.length });
    return { categories: next };
  });
}

// Sets one round's competing bottles and their blind labels. Allowed only
// until the round first opens for voting — after that the assignments are
// locked for good, so a reopened round keeps its submissions valid.
async function setSamples(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  const categoryId = v.requireId(ctx.data.categoryId, "category");
  await limit(ctx, "host");
  const samples = v.validateSamples(ctx.data.samples, ctx.data.assignment);

  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertAdmin(ctx, party);
    assertNotCompleted(party);
    const category = findCategory(party, categoryId);
    if (category.lockedAt) throw precondition("Voting has started for this round, so its bottles are locked.");
    const hostKnows = ctx.uid === party.hostUid && party.format !== "regular" && !party.hostKeyViews?.[categoryId];
    const sampleLabels = samples.map((s) => s.label);
    const state = category.state === "ready" && samples.length < v.LIMITS.MIN_SAMPLES ? "draft" : category.state;
    tx.update(partyRef(ctx.db, partyId), {
      categories: replaceCategory(party, withPublicBottles(party, { ...category, sampleLabels, state }, samples)),
      ...(hostKnows ? { [`hostKeyViews.${categoryId}`]: ctx.now } : {}),
      updatedAt: ctx.now,
    });
    tx.set(secretsRef(ctx.db, partyId), { categories: { [categoryId]: { samples } } }, { merge: true });
    auditEvent(tx, ctx.db, partyId, ctx, "samples-updated", { categoryId, count: samples.length });
    return { samples };
  });
}

// ---------------------------------------------------------------------------
// Host: running the event

const TRANSITIONS = {
  draft: ["ready", "voting_open"],
  ready: ["draft", "voting_open"],
  voting_open: ["voting_closed"],
  voting_closed: ["voting_open", "revealed"],
  revealed: [],
};

async function revealCategory(tx, ctx, party, category) {
  const secretsSnap = await tx.get(secretsRef(ctx.db, party.id));
  const samples = secretsSnap.data()?.categories?.[category.id]?.samples || [];
  const ballotsSnap = await tx.get(ctx.db.collection(`parties/${party.id}/ballots`).where("categoryId", "==", category.id));
  const ballots = ballotsSnap.docs.map((d) => d.data());
  const results = computeCategoryResults({ category, samples, ballots, showNicknames: party.settings?.showNicknames !== false });
  return { ...results, revealedAt: ctx.now, partyId: party.id };
}

async function setCategoryState(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  const categoryId = v.requireId(ctx.data.categoryId, "category");
  const to = ctx.data.to;
  if (!v.CATEGORY_STATES.includes(to)) throw v.invalid("Unknown round state.");
  await limit(ctx, "host");

  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertAdmin(ctx, party);
    assertNotCompleted(party);
    const category = findCategory(party, categoryId);
    // A regular tasting has nothing to reveal: closing voting can publish
    // results in the same step.
    const regularClose = isRegular(party) && category.state === "voting_open" && to === "revealed";
    if (!TRANSITIONS[category.state].includes(to) && !regularClose) {
      throw precondition(`This round is ${category.state.replace("_", " ")} and can't move to ${to.replace("_", " ")}.`);
    }
    if ((to === "ready" || to === "voting_open") && category.sampleLabels.length < v.LIMITS.MIN_SAMPLES) {
      throw precondition(`Add at least ${v.LIMITS.MIN_SAMPLES} bottles to this round first.`);
    }

    let results;
    if (to === "revealed") results = await revealCategory(tx, ctx, party, category);

    const updated = { ...category, state: to };
    const patch = { updatedAt: ctx.now };
    if (to === "voting_open") {
      updated.lockedAt = category.lockedAt || ctx.now;
      updated.votingOpenedAt = ctx.now;
      patch.status = "live";
      patch.currentCategoryId = categoryId;
    }
    if (to === "voting_closed" || regularClose) updated.votingClosedAt = ctx.now;
    if (to === "revealed") updated.revealedAt = ctx.now;
    patch.categories = replaceCategory(party, updated);

    tx.update(partyRef(ctx.db, partyId), patch);
    if (results) tx.set(ctx.db.doc(`parties/${partyId}/results/${categoryId}`), results);
    auditEvent(tx, ctx.db, partyId, ctx, "round-state", { categoryId, from: category.state, to });
    return { state: to };
  });
}

// For parties that reveal everything at the end: every closed round is
// revealed in one atomic step.
async function revealAll(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  await limit(ctx, "host");
  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertAdmin(ctx, party);
    assertNotCompleted(party);
    const closed = party.categories.filter((c) => c.state === "voting_closed");
    if (closed.length === 0) throw precondition("Close voting on a round before revealing it.");
    const allResults = [];
    for (const category of closed) allResults.push(await revealCategory(tx, ctx, party, category));
    const ids = new Set(closed.map((c) => c.id));
    const categories = party.categories.map((c) => (ids.has(c.id) ? { ...c, state: "revealed", revealedAt: ctx.now } : c));
    tx.update(partyRef(ctx.db, partyId), { categories, updatedAt: ctx.now });
    for (const results of allResults) tx.set(ctx.db.doc(`parties/${partyId}/results/${results.categoryId}`), results);
    auditEvent(tx, ctx.db, partyId, ctx, "reveal-all", { categoryIds: [...ids] });
    return { revealed: [...ids] };
  });
}

async function setCurrentCategory(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  const categoryId = v.requireId(ctx.data.categoryId, "category");
  await limit(ctx, "host");
  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertAdmin(ctx, party);
    findCategory(party, categoryId);
    tx.update(partyRef(ctx.db, partyId), { currentCategoryId: categoryId, updatedAt: ctx.now });
    return { ok: true };
  });
}

// Wraps the party up: any open round closes, and the recap is built from
// REVEALED rounds only — an unrevealed round never reaches the recap.
async function completeParty(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  await limit(ctx, "host");
  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertAdmin(ctx, party);
    assertNotCompleted(party);
    const resultsSnap = await tx.get(ctx.db.collection(`parties/${partyId}/results`));
    const revealedIds = party.categories.filter((c) => c.state === "revealed").map((c) => c.id);
    const byId = new Map(resultsSnap.docs.map((d) => [d.id, d.data()]));
    const results = revealedIds.map((id) => byId.get(id)).filter(Boolean);
    const notes =
      ctx.data.notes !== undefined ? v.cleanText(ctx.data.notes, v.LIMITS.MAX_HOST_NOTES) : party.recapNotes || "";
    const recap = { ...computeRecap({ party, results, notes }), partyId, completedAt: ctx.now };
    const categories = party.categories.map((c) =>
      c.state === "voting_open" ? { ...c, state: "voting_closed", votingClosedAt: ctx.now } : c,
    );
    tx.update(partyRef(ctx.db, partyId), {
      status: "completed",
      completedAt: ctx.now,
      categories,
      recapNotes: notes,
      inviteActive: false,
      updatedAt: ctx.now,
    });
    tx.set(ctx.db.doc(`parties/${partyId}/results/recap`), recap);
    auditEvent(tx, ctx.db, partyId, ctx, "party-completed", { revealedRounds: results.length });
    return { ok: true };
  });
}

async function setInvite(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  await limit(ctx, "host");
  if (typeof ctx.data.active !== "boolean") throw v.invalid("Invite active must be true or false.");
  const expiresAt = ctx.data.expiresAt === null || ctx.data.expiresAt === undefined ? null : ctx.data.expiresAt;
  if (expiresAt !== null && (typeof expiresAt !== "number" || !Number.isFinite(expiresAt))) throw v.invalid("Invalid expiry.");
  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertAdmin(ctx, party);
    tx.update(partyRef(ctx.db, partyId), { inviteActive: ctx.data.active, inviteExpiresAt: expiresAt, updatedAt: ctx.now });
    auditEvent(tx, ctx.db, partyId, ctx, "invite-updated", { active: ctx.data.active, expiresAt });
    return { ok: true };
  });
}

// Issues a fresh join code; the old code stops working immediately.
async function rotateJoinCode(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  await limit(ctx, "host");
  const party = await readParty(null, ctx.db, partyId);
  assertAdmin(ctx, party);
  assertNotCompleted(party);
  const code = await claimNewCode(ctx.db, partyId, ctx.now);
  const batch = ctx.db.batch();
  batch.update(partyRef(ctx.db, partyId), { joinCode: code, updatedAt: ctx.now });
  if (party.joinCode) batch.delete(ctx.db.doc(`partyCodes/${party.joinCode}`));
  batch.set(ctx.db.collection(`parties/${partyId}/audit`).doc(), { type: "code-rotated", actorUid: ctx.uid, at: ctx.now });
  await batch.commit();
  return { joinCode: code };
}

// Revokes a guest's access. Their ballots in rounds not yet revealed stop
// counting (excluded, with an audit trail); revealed results stay as they were.
async function removeGuest(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  const guestUid = v.requireId(ctx.data.guestUid, "guest");
  await limit(ctx, "host");
  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertAdmin(ctx, party);
    const guestRef = ctx.db.doc(`parties/${partyId}/guests/${guestUid}`);
    const guestSnap = await tx.get(guestRef);
    if (!guestSnap.exists) throw notFound("That guest isn't in this party.");
    const guest = guestSnap.data();
    if (guest.isHost) throw precondition("That's you. Turn off “I'm tasting too” instead.");
    if (guest.revoked) return { ok: true };
    const ballots = await tx.get(ctx.db.collection(`parties/${partyId}/ballots`).where("participantKey", "==", guest.participantKey));
    const revealed = new Set(party.categories.filter((c) => c.state === "revealed").map((c) => c.id));
    const counts = {};
    for (const doc of ballots.docs) {
      const ballot = doc.data();
      if (revealed.has(ballot.categoryId) || ballot.excluded) continue;
      tx.update(doc.ref, { excluded: true, excludedReason: "Guest removed by host", updatedAt: ctx.now });
      counts[`counts.digital.${ballot.categoryId}`] = FieldValue.increment(-1);
    }
    tx.update(guestRef, { revoked: true, revokedAt: ctx.now });
    tx.delete(roster.rosterRef(ctx.db, partyId, guest.participantKey));
    tx.update(partyRef(ctx.db, partyId), { ...counts, "counts.guests": FieldValue.increment(-1), updatedAt: ctx.now });
    auditEvent(tx, ctx.db, partyId, ctx, "guest-removed", { guestUid, nickname: guest.nickname });
    return { ok: true };
  });
}

// "I'm tasting too": the host scores through the same guest record and
// saveBallot path as everyone else (one ballot per round, same scale and
// deadlines, equal weight), never a second account or a QR join. Turning
// it off stops their ballots counting in rounds not yet revealed; turning
// it back on restores exactly those, so nothing is lost or duplicated.
async function setHostTasting(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  if (typeof ctx.data.enabled !== "boolean") throw v.invalid("Enabled must be true or false.");
  const enabled = ctx.data.enabled;
  await limit(ctx, "host");
  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertHost(ctx, party);
    assertNotCompleted(party);
    const guestRef = ctx.db.doc(`parties/${partyId}/guests/${ctx.uid}`);
    const guestSnap = await tx.get(guestRef);
    const guest = guestSnap.exists ? guestSnap.data() : null;
    if (guest && !guest.isHost) throw precondition("You already joined this party as a guest.");
    const revealed = new Set(party.categories.filter((c) => c.state === "revealed").map((c) => c.id));
    const counts = {};
    if (guest) {
      const ballots = await tx.get(ctx.db.collection(`parties/${partyId}/ballots`).where("participantKey", "==", guest.participantKey));
      for (const doc of ballots.docs) {
        const ballot = doc.data();
        if (revealed.has(ballot.categoryId)) continue;
        if (!enabled && !ballot.excluded) {
          tx.update(doc.ref, { excluded: true, excludedReason: HOST_OPT_OUT_REASON, updatedAt: ctx.now });
          counts[`counts.digital.${ballot.categoryId}`] = FieldValue.increment(-1);
        } else if (enabled && ballot.excluded && ballot.excludedReason === HOST_OPT_OUT_REASON) {
          tx.update(doc.ref, { excluded: false, excludedReason: null, updatedAt: ctx.now });
          counts[`counts.digital.${ballot.categoryId}`] = FieldValue.increment(1);
        }
      }
      tx.update(guestRef, enabled ? { revoked: false, revokedAt: null } : { revoked: true, revokedAt: ctx.now });
    } else if (enabled) {
      tx.set(guestRef, hostGuestRecord(ctx.uid, party.hostName || "Your host", ctx.now));
    }
    tx.update(partyRef(ctx.db, partyId), { ...counts, hostTasting: enabled, updatedAt: ctx.now });
    // Merged without `progress`, so the host's per-round status survives
    // switching tasting off and back on.
    const { progress: _keep, ...hostEntry } = roster.hostEntry(party, enabled, guest?.joinedAt || ctx.now);
    tx.set(roster.rosterRef(ctx.db, partyId, roster.HOST_ROSTER_ID), hostEntry, { merge: true });
    auditEvent(tx, ctx.db, partyId, ctx, enabled ? "host-tasting-on" : "host-tasting-off", {});
    return { ok: true, hostTasting: enabled };
  });
}

// The bottle key: every round's sample -> bottle mapping. Admins only,
// always behind an explicit confirmation, and every view is logged.
// Viewing it before a round is revealed marks a tasting host's unfinished
// ballots in those rounds as potentially unblinded (still counted).
async function getBottleKey(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  if (ctx.data.confirm !== true) throw v.invalid("Confirm before showing the bottle key.");
  const purpose = ctx.data.purpose === "setup" ? "setup" : "key";
  await limit(ctx, "host");
  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    const role = assertAdmin(ctx, party);
    const secrets = (await tx.get(secretsRef(ctx.db, partyId))).data()?.categories || {};
    const blind = party.format !== "regular";
    const unrevealed = party.categories.filter((c) => c.state !== "revealed");
    const flagged = [];
    if (role === "host" && blind && unrevealed.length) {
      const hostGuest = await tx.get(hostGuestRef(ctx.db, party));
      const byCategory = new Map();
      if (hostGuest.exists) {
        const ballots = await tx.get(ctx.db.collection(`parties/${partyId}/ballots`).where("participantKey", "==", hostGuest.data().participantKey));
        for (const d of ballots.docs) byCategory.set(d.data().categoryId, d);
      }
      const knows = {};
      for (const category of unrevealed) {
        if (!party.hostKeyViews?.[category.id]) knows[`hostKeyViews.${category.id}`] = ctx.now;
        const doc = byCategory.get(category.id);
        // A ballot finished before this view stays blind (until it's edited).
        if (ballotComplete(doc?.data(), category)) continue;
        if (doc && doc.data().unblinded !== true) tx.update(doc.ref, { unblinded: true });
        flagged.push(category.id);
      }
      if (Object.keys(knows).length) tx.update(partyRef(ctx.db, partyId), knows);
    }
    if (blind && unrevealed.length) {
      auditEvent(tx, ctx.db, partyId, ctx, "bottle-key-viewed", {
        role,
        purpose,
        unrevealedCategoryIds: unrevealed.map((c) => c.id),
        flaggedCategoryIds: flagged,
      });
    }
    const categories = {};
    for (const c of party.categories) categories[c.id] = { samples: secrets[c.id]?.samples || [] };
    return { categories, flaggedCategoryIds: flagged };
  });
}

// Co-host / pour assistant: a second FIP account that can prepare the
// samples, hold the bottle key and run the event, so the host can taste
// blind. Invites are single-use links that expire.
async function createCoHostInvite(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  await limit(ctx, "host");
  const party = await readParty(null, ctx.db, partyId);
  assertHost(ctx, party);
  assertNotCompleted(party);
  if ((party.coHostUids || []).length >= MAX_CO_HOSTS) throw precondition(`A party can have up to ${MAX_CO_HOSTS} co-hosts.`);
  const token = v.randomCode(24);
  const expiresAt = ctx.now + CO_HOST_INVITE_TTL_MS;
  await ctx.db.doc(`partyCoHostInvites/${v.sha256(`${partyId}:${token}`)}`).set({ partyId, createdBy: ctx.uid, createdAt: ctx.now, expiresAt });
  await ctx.db.collection(`parties/${partyId}/audit`).add({ type: "cohost-invited", actorUid: ctx.uid, at: ctx.now });
  return { token, expiresAt };
}

async function acceptCoHost(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  const token = typeof ctx.data.token === "string" ? ctx.data.token.trim() : "";
  if (!/^[A-Z0-9]{8,64}$/i.test(token)) throw v.invalid("That co-host link isn't valid.");
  assertAccount(ctx);
  await limit(ctx, "claim");
  const name = v.cleanText(ctx.data.name, 40) || "Co-host";
  const inviteRef = ctx.db.doc(`partyCoHostInvites/${v.sha256(`${partyId}:${token}`)}`);
  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    const invite = await tx.get(inviteRef);
    if (!invite.exists || invite.data().partyId !== partyId) throw notFound("That co-host link isn't valid or was already used.");
    if (invite.data().expiresAt < ctx.now) throw precondition("That co-host link has expired. Ask the host for a new one.");
    assertNotCompleted(party);
    if (party.hostUid === ctx.uid) throw precondition("You're already the host.");
    if (isCoHost(party, ctx.uid)) return { partyId, alreadyCoHost: true };
    const guest = await tx.get(ctx.db.doc(`parties/${partyId}/guests/${ctx.uid}`));
    if (guest.exists && !guest.data().revoked) throw precondition("You've joined this party as a guest. Co-hosts know the bottles, so they can't also score.");
    if ((party.coHostUids || []).length >= MAX_CO_HOSTS) throw precondition(`A party can have up to ${MAX_CO_HOSTS} co-hosts.`);
    tx.delete(inviteRef);
    tx.update(partyRef(ctx.db, partyId), {
      coHostUids: FieldValue.arrayUnion(ctx.uid),
      [`coHosts.${ctx.uid}`]: { name, addedAt: ctx.now },
      updatedAt: ctx.now,
    });
    tx.set(roster.rosterRef(ctx.db, partyId, roster.coHostRosterId(partyId, ctx.uid)), roster.coHostEntry(partyId, ctx.uid, { name, addedAt: ctx.now }));
    auditEvent(tx, ctx.db, partyId, ctx, "cohost-added", { uid: ctx.uid, name });
    return { partyId, alreadyCoHost: false };
  });
}

async function removeCoHost(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  const uid = v.requireId(ctx.data.uid, "co-host");
  await limit(ctx, "host");
  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertHost(ctx, party);
    if (!isCoHost(party, uid)) return { ok: true };
    tx.update(partyRef(ctx.db, partyId), {
      coHostUids: FieldValue.arrayRemove(uid),
      [`coHosts.${uid}`]: FieldValue.delete(),
      updatedAt: ctx.now,
    });
    tx.delete(roster.rosterRef(ctx.db, partyId, roster.coHostRosterId(partyId, uid)));
    auditEvent(tx, ctx.db, partyId, ctx, "cohost-removed", { uid });
    return { ok: true };
  });
}

// Backfills (or repairs) the public roster from the private records, for
// parties created before it existed. Admins only; idempotent.
async function syncRoster(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  await limit(ctx, "host");
  const party = await readParty(null, ctx.db, partyId);
  assertAdmin(ctx, party);
  const count = await roster.rebuildRoster(ctx.db, party);
  return { count };
}

async function deleteParty(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  if (ctx.data.confirm !== true) throw v.invalid("Confirm deleting the party.");
  await limit(ctx, "host");
  const party = await readParty(null, ctx.db, partyId);
  assertHost(ctx, party);
  const keys = await ctx.db.collection("partyGuestKeys").where("partyId", "==", partyId).get();
  const batch = ctx.db.batch();
  for (const doc of keys.docs) batch.delete(doc.ref);
  if (party.joinCode) batch.delete(ctx.db.doc(`partyCodes/${party.joinCode}`));
  batch.delete(secretsRef(ctx.db, partyId));
  await batch.commit();
  await ctx.db.recursiveDelete(partyRef(ctx.db, partyId));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Host: ballots

function paperKey(input) {
  return v.nicknameKey(input);
}

// Host-entered paper ballot. One active paper ballot per ballot number /
// nickname per round; a nickname that matches a digital guest who already
// voted in this round comes back as a duplicate warning so the host can
// resolve it (exclude one) rather than silently double counting.
async function savePaperBallot(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  const categoryId = v.requireId(ctx.data.categoryId, "category");
  await limit(ctx, "host");
  const ballotNumber = v.cleanText(ctx.data.ballotNumber, 12);
  const nickname = v.cleanText(ctx.data.nickname, v.LIMITS.MAX_NICKNAME);
  if (!ballotNumber && !nickname) throw v.invalid("Enter a ballot number or the guest's nickname.");
  const existingId = ctx.data.ballotId ? v.requireId(ctx.data.ballotId, "ballot") : null;

  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertAdmin(ctx, party);
    assertNotCompleted(party);
    const category = findCategory(party, categoryId);
    if (!["voting_open", "voting_closed"].includes(category.state)) {
      throw precondition("Paper ballots can be entered once voting opens and until the round is revealed.");
    }
    const mode = ctx.data.mode === "detailed" ? "detailed" : "quick";
    const scores = v.validateScores(ctx.data.scores, category.sampleLabels, mode);
    if (Object.keys(scores).length === 0) throw v.invalid("Enter at least one sample's score.");
    const favoriteLabel = v.validateOptionalLabel(ctx.data.favoriteLabel, category.sampleLabels, "Favorite");
    const predictionLabel = v.validateOptionalLabel(ctx.data.predictionLabel, category.sampleLabels, "Prediction");
    const identityKey = paperKey(ballotNumber || nickname);
    if (nickname && party.hostTasting) {
      const hostGuest = await tx.get(ctx.db.doc(`parties/${partyId}/guests/${party.hostUid}`));
      if (hostGuest.exists && !hostGuest.data().revoked && hostGuest.data().nicknameKey === v.nicknameKey(nickname)) {
        throw precondition("That's your own name. Score your pours in My Tasting so your ballot counts once.");
      }
    }

    const ballots = await tx.get(ctx.db.collection(`parties/${partyId}/ballots`).where("categoryId", "==", categoryId));
    const all = ballots.docs.map((d) => d.data());
    const clash = all.find((b) => b.source === "paper" && b.identityKey === identityKey && b.id !== existingId);
    if (clash) throw new HttpsError("already-exists", `Ballot "${ballotNumber || nickname}" is already entered for this round. Edit it instead.`);
    const digitalMatch = nickname
      ? all.find((b) => b.source === "digital" && b.nickname && v.nicknameKey(b.nickname) === v.nicknameKey(nickname) && !b.excluded)
      : null;

    let ref;
    let before = null;
    if (existingId) {
      ref = ctx.db.doc(`parties/${partyId}/ballots/${existingId}`);
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data().source !== "paper" || snap.data().categoryId !== categoryId) throw notFound("That paper ballot wasn't found.");
      before = snap.data();
    } else {
      ref = ctx.db.doc(`parties/${partyId}/ballots/${ballotId(categoryId, v.randomId("p_"))}`);
    }

    const ballot = {
      id: ref.id,
      partyId,
      categoryId,
      participantKey: before ? before.participantKey : ref.id.split("__")[1],
      source: "paper",
      ownerUid: party.hostUid,
      enteredBy: ctx.uid,
      ballotNumber,
      nickname,
      identityKey,
      mode,
      scores,
      favoriteLabel,
      predictionLabel,
      excluded: before ? before.excluded === true : false,
      createdAt: before ? before.createdAt : ctx.now,
      updatedAt: ctx.now,
      revision: before ? (before.revision || 1) + 1 : 1,
    };
    tx.set(ref, ballot);
    if (!before) tx.update(partyRef(ctx.db, partyId), { [`counts.paper.${categoryId}`]: FieldValue.increment(1), updatedAt: ctx.now });
    auditEvent(tx, ctx.db, partyId, ctx, before ? "paper-ballot-edited" : "paper-ballot-entered", {
      categoryId,
      ballotId: ref.id,
      before: before ? { scores: before.scores, favoriteLabel: before.favoriteLabel || null, nickname: before.nickname, ballotNumber: before.ballotNumber } : null,
      after: { scores, favoriteLabel, nickname, ballotNumber },
    });
    return { ballotId: ref.id, possibleDuplicateOf: digitalMatch ? { ballotId: digitalMatch.id, nickname: digitalMatch.nickname } : null };
  });
}

async function deletePaperBallot(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  const id = v.requireId(ctx.data.ballotId, "ballot");
  if (ctx.data.confirm !== true) throw v.invalid("Confirm deleting this ballot.");
  await limit(ctx, "host");
  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertAdmin(ctx, party);
    assertNotCompleted(party);
    const ref = ctx.db.doc(`parties/${partyId}/ballots/${id}`);
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().source !== "paper") throw notFound("That paper ballot wasn't found.");
    const ballot = snap.data();
    const category = findCategory(party, ballot.categoryId);
    if (category.state === "revealed") throw precondition("This round is revealed; its ballots are final.");
    tx.delete(ref);
    if (!ballot.excluded) tx.update(partyRef(ctx.db, partyId), { [`counts.paper.${ballot.categoryId}`]: FieldValue.increment(-1) });
    auditEvent(tx, ctx.db, partyId, ctx, "paper-ballot-deleted", { categoryId: ballot.categoryId, ballotId: id, before: { scores: ballot.scores, nickname: ballot.nickname, ballotNumber: ballot.ballotNumber } });
    return { ok: true };
  });
}

// Duplicate/incorrect entry resolution: the host can stop any ballot from
// counting (and restore it) until the round is revealed.
async function setBallotExcluded(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  const id = v.requireId(ctx.data.ballotId, "ballot");
  if (typeof ctx.data.excluded !== "boolean") throw v.invalid("Excluded must be true or false.");
  await limit(ctx, "host");
  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    assertAdmin(ctx, party);
    assertNotCompleted(party);
    const ref = ctx.db.doc(`parties/${partyId}/ballots/${id}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound("That ballot wasn't found.");
    const ballot = snap.data();
    if (findCategory(party, ballot.categoryId).state === "revealed") throw precondition("This round is revealed; its ballots are final.");
    if (ballot.excluded === ctx.data.excluded) return { ok: true };
    const reason = v.cleanText(ctx.data.reason, 120);
    tx.update(ref, { excluded: ctx.data.excluded, excludedReason: ctx.data.excluded ? reason || "Excluded by host" : null, updatedAt: ctx.now });
    const field = `counts.${ballot.source === "paper" ? "paper" : "digital"}.${ballot.categoryId}`;
    tx.update(partyRef(ctx.db, partyId), { [field]: FieldValue.increment(ctx.data.excluded ? -1 : 1) });
    auditEvent(tx, ctx.db, partyId, ctx, ctx.data.excluded ? "ballot-excluded" : "ballot-restored", { ballotId: id, categoryId: ballot.categoryId, reason });
    return { ok: true };
  });
}

// Host view of a round's ballots. Paper ballots come back in full (the host
// typed them); digital ballots come back as metadata only — never a guest's
// scores or private notes before reveal.
async function listBallots(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  const categoryId = v.requireId(ctx.data.categoryId, "category");
  await limit(ctx, "host");
  const party = await readParty(null, ctx.db, partyId);
  assertAdmin(ctx, party);
  findCategory(party, categoryId);
  const snap = await ctx.db.collection(`parties/${partyId}/ballots`).where("categoryId", "==", categoryId).get();
  const ballots = snap.docs.map((d) => {
    const b = d.data();
    const base = {
      id: b.id,
      source: b.source,
      nickname: b.nickname || "",
      ballotNumber: b.ballotNumber || "",
      scoredCount: Object.keys(b.scores || {}).length,
      hasFavorite: Boolean(b.favoriteLabel),
      excluded: b.excluded === true,
      excludedReason: b.excludedReason || null,
      updatedAt: b.updatedAt,
      revision: b.revision || 1,
    };
    if (b.source === "paper") return { ...base, scores: b.scores, favoriteLabel: b.favoriteLabel || null, predictionLabel: b.predictionLabel || null, mode: b.mode };
    return base;
  });
  ballots.sort((a, b) => a.updatedAt - b.updatedAt);
  return { ballots };
}

// ---------------------------------------------------------------------------
// Guests

async function previewParty(ctx) {
  await limitIp(ctx, "previewIp");
  if (ctx.uid) await limit(ctx, "preview");
  const found = await lookupCode(ctx.db, ctx.data.code);
  if (!found) throw notFound("That party code doesn't match an active party.");
  const party = await readParty(null, ctx.db, found.partyId);
  let guest = null;
  if (ctx.uid) {
    const snap = await ctx.db.doc(`parties/${party.id}/guests/${ctx.uid}`).get();
    if (snap.exists && !snap.data().revoked) guest = { nickname: snap.data().nickname };
  }
  const isHost = ctx.uid === party.hostUid && !ctx.isAnonymous;
  return { ...previewOf(party), joinBlocker: joinBlocker(party, ctx.now), guest, isHost };
}

async function joinParty(ctx) {
  await limitIp(ctx, "joinIp");
  await limit(ctx, "join");
  const nickname = v.validateNickname(ctx.data.nickname);
  const key = v.nicknameKey(nickname);
  const found = await lookupCode(ctx.db, ctx.data.code);
  if (!found) throw notFound("That party code doesn't match an active party.");
  const partyId = found.partyId;
  const recoveryCode = v.randomCode(RECOVERY_LENGTH);

  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    if (party.hostUid === ctx.uid) throw precondition("You're hosting this party. Turn on “I'm tasting too” from your dashboard to score.");
    if (isCoHost(party, ctx.uid)) throw precondition("You're a co-host for this party, so you know the bottles. Co-hosts run the event but don't score.");
    const guestRef = ctx.db.doc(`parties/${partyId}/guests/${ctx.uid}`);
    const existing = await tx.get(guestRef);
    if (existing.exists) {
      if (existing.data().revoked) throw denied("The host has removed you from this party.");
      return { partyId, nickname: existing.data().nickname, alreadyJoined: true };
    }
    const blocker = joinBlocker(party, ctx.now);
    if (blocker) throw precondition(blocker);
    const sameName = await tx.get(ctx.db.collection(`parties/${partyId}/guests`).where("nicknameKey", "==", key).limit(1));
    if (!sameName.empty) {
      throw new HttpsError("already-exists", "Someone already joined with that nickname. Pick another, or use your recovery code to rejoin.");
    }
    const participantKey = v.randomId("g_");
    tx.set(guestRef, {
      uid: ctx.uid,
      participantKey,
      nickname,
      nicknameKey: key,
      joinedAt: ctx.now,
      revoked: false,
      isAccount: !ctx.isAnonymous,
    });
    tx.set(ctx.db.doc(`partyGuestKeys/${recoveryKeyId(partyId, recoveryCode)}`), { partyId, participantKey, uid: ctx.uid, createdAt: ctx.now });
    tx.set(roster.rosterRef(ctx.db, partyId, participantKey), roster.guestEntry({ participantKey, nickname, joinedAt: ctx.now }));
    tx.update(partyRef(ctx.db, partyId), { "counts.guests": FieldValue.increment(1) });
    return { partyId, nickname, recoveryCode: formatRecovery(recoveryCode), alreadyJoined: false };
  });
}

// Moves a guest identity (and ownership of its ballots) from one uid to
// another inside a transaction. Used by recovery and account claiming.
async function transferGuest(tx, db, partyId, fromUid, toUid, now) {
  const fromRef = db.doc(`parties/${partyId}/guests/${fromUid}`);
  const toRef = db.doc(`parties/${partyId}/guests/${toUid}`);
  const [fromSnap, toSnap] = [await tx.get(fromRef), await tx.get(toRef)];
  if (!fromSnap.exists) return { moved: false, reason: "missing" };
  if (toSnap.exists) return { moved: false, reason: "conflict" };
  const guest = fromSnap.data();
  const ballots = await tx.get(db.collection(`parties/${partyId}/ballots`).where("participantKey", "==", guest.participantKey));
  tx.set(toRef, { ...guest, uid: toUid, transferredFrom: fromUid, transferredAt: now });
  tx.delete(fromRef);
  for (const doc of ballots.docs) {
    if (doc.data().source === "digital") tx.update(doc.ref, { ownerUid: toUid });
  }
  return { moved: true, guest };
}

// Rejoin from another device or after clearing the browser: the recovery
// code (shown once at join, stored only as a hash) proves ownership — a
// nickname or join code alone never does. Each use issues a new code.
async function recoverGuest(ctx) {
  await limitIp(ctx, "recoverIp");
  await limit(ctx, "recover");
  const found = await lookupCode(ctx.db, ctx.data.code);
  if (!found) throw notFound("That party code doesn't match an active party.");
  const partyId = found.partyId;
  if (typeof ctx.data.recoveryCode !== "string") throw v.invalid("Enter your recovery code.");
  const keyRef = ctx.db.doc(`partyGuestKeys/${recoveryKeyId(partyId, ctx.data.recoveryCode)}`);
  const newCode = v.randomCode(RECOVERY_LENGTH);

  return ctx.db.runTransaction(async (tx) => {
    const keySnap = await tx.get(keyRef);
    if (!keySnap.exists || keySnap.data().partyId !== partyId) throw denied("That recovery code isn't valid for this party.");
    const key = keySnap.data();
    if (key.uid === ctx.uid) {
      return { partyId, recovered: true, recoveryCode: null };
    }
    const result = await transferGuest(tx, ctx.db, partyId, key.uid, ctx.uid, ctx.now);
    if (!result.moved) {
      throw precondition(result.reason === "conflict" ? "This device has already joined the party as someone else." : "That guest is no longer in this party.");
    }
    if (result.guest.revoked) throw denied("The host has removed this guest from the party.");
    tx.delete(keyRef);
    tx.set(ctx.db.doc(`partyGuestKeys/${recoveryKeyId(partyId, newCode)}`), { ...key, uid: ctx.uid, createdAt: ctx.now });
    auditEvent(tx, ctx.db, partyId, ctx, "guest-recovered", { participantKey: key.participantKey });
    return { partyId, recovered: true, nickname: result.guest.nickname, recoveryCode: formatRecovery(newCode) };
  });
}

// A guest's own digital ballot for one round. Exactly one per guest per
// round (deterministic document id), accepted only while that round's
// voting is open. When the host disallows edits, already-submitted sample
// scores (and the favorite, once chosen) can't be changed — new samples can
// still be added as the guest tastes through the flight.
async function saveBallot(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  const categoryId = v.requireId(ctx.data.categoryId, "category");
  await limit(ctx, "ballot");
  const mode = ctx.data.mode === "detailed" ? "detailed" : "quick";

  return ctx.db.runTransaction(async (tx) => {
    const party = await readParty(tx, ctx.db, partyId);
    const guestSnap = await tx.get(ctx.db.doc(`parties/${partyId}/guests/${ctx.uid}`));
    if (!guestSnap.exists) throw denied("Join the party before scoring.");
    const guest = guestSnap.data();
    if (guest.revoked) throw denied("The host has removed you from this party.");
    assertNotCompleted(party);
    const category = findCategory(party, categoryId);
    if (category.state !== "voting_open") throw precondition("Voting isn't open for this round.");

    const scores = v.validateScores(ctx.data.scores, category.sampleLabels, mode);
    const favoriteLabel = v.validateOptionalLabel(ctx.data.favoriteLabel, category.sampleLabels, "Favorite");
    const predictionLabel =
      party.settings?.predictions ? v.validateOptionalLabel(ctx.data.predictionLabel, category.sampleLabels, "Prediction") : null;

    const ref = ctx.db.doc(`parties/${partyId}/ballots/${ballotId(categoryId, guest.participantKey)}`);
    const snap = await tx.get(ref);
    const before = snap.exists ? snap.data() : null;
    if (before && before.ownerUid !== ctx.uid) throw denied("That ballot belongs to someone else.");
    const rosterDoc = roster.rosterRef(ctx.db, partyId, roster.guestRosterId(guest));
    const rosterSnap = await tx.get(rosterDoc);
    const unblinded = before?.unblinded === true || Boolean(guest.isHost && party.format !== "regular" && party.hostKeyViews?.[categoryId]);

    let mergedScores = scores;
    let favorite = favoriteLabel;
    let prediction = predictionLabel;
    if (before) {
      if (party.settings?.allowEdits === false) {
        mergedScores = { ...scores, ...before.scores };
        favorite = before.favoriteLabel || favoriteLabel;
        prediction = before.predictionLabel || predictionLabel;
      } else {
        mergedScores = { ...before.scores, ...scores };
      }
    }
    if (Object.keys(mergedScores).length === 0 && !favorite) throw v.invalid("Score at least one sample.");

    tx.set(ref, {
      id: ref.id,
      partyId,
      categoryId,
      participantKey: guest.participantKey,
      source: "digital",
      ownerUid: ctx.uid,
      nickname: guest.nickname,
      mode,
      scores: mergedScores,
      favoriteLabel: favorite,
      predictionLabel: prediction,
      excluded: before ? before.excluded === true : false,
      ...(unblinded ? { unblinded: true } : {}),
      createdAt: before ? before.createdAt : ctx.now,
      updatedAt: ctx.now,
      revision: before ? (before.revision || 1) + 1 : 1,
    });
    if (!before) tx.update(partyRef(ctx.db, partyId), { [`counts.digital.${categoryId}`]: FieldValue.increment(1) });
    // Status only (tasting / submitted), never a score. A party from before
    // the roster existed has no entry until an admin rebuilds it.
    if (rosterSnap.exists) tx.update(rosterDoc, { [`progress.${categoryId}`]: roster.progressStatus({ scores: mergedScores }, category) });
    return { ballotId: ref.id, scores: mergedScores, favoriteLabel: favorite, predictionLabel: prediction, locked: party.settings?.allowEdits === false };
  });
}

// ---------------------------------------------------------------------------
// Presentation display

async function createDisplayLink(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  await limit(ctx, "host");
  const party = await readParty(null, ctx.db, partyId);
  assertAdmin(ctx, party);
  const token = v.randomToken();
  const expiresAt = ctx.now + DISPLAY_TTL_MS;
  await secretsRef(ctx.db, partyId).set({ display: { tokenHash: v.sha256(token), expiresAt } }, { merge: true });
  return { token, expiresAt };
}

async function revokeDisplays(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  await limit(ctx, "host");
  const party = await readParty(null, ctx.db, partyId);
  assertAdmin(ctx, party);
  const displays = await ctx.db.collection(`parties/${partyId}/displays`).get();
  const batch = ctx.db.batch();
  for (const doc of displays.docs) batch.delete(doc.ref);
  batch.set(secretsRef(ctx.db, partyId), { display: null }, { merge: true });
  await batch.commit();
  return { ok: true };
}

// The TV/laptop signs in anonymously and redeems the host's display token
// for a read-only session on this one party — no host credentials, no
// access to the secret mapping, and nothing it can write.
async function redeemDisplay(ctx) {
  const partyId = v.requireId(ctx.data.partyId, "party");
  await limit(ctx, "display");
  if (typeof ctx.data.token !== "string" || ctx.data.token.length > 100) throw v.invalid("Invalid display link.");
  const secrets = (await secretsRef(ctx.db, partyId).get()).data();
  const display = secrets && secrets.display;
  if (!display || display.expiresAt < ctx.now || display.tokenHash !== v.sha256(ctx.data.token)) {
    throw denied("This display link has expired. Open a new one from the host dashboard.");
  }
  await ctx.db.doc(`parties/${partyId}/displays/${ctx.uid}`).set({ uid: ctx.uid, createdAt: ctx.now, expiresAt: display.expiresAt });
  return { partyId, expiresAt: display.expiresAt };
}

// ---------------------------------------------------------------------------
// Guest -> FIP account

// Step 1, called by the anonymous guest identity itself: a short-lived,
// single-use token bound to that uid. Only the holder of the anonymous
// session can mint one, so nobody can claim another guest's scores.
async function createClaimToken(ctx) {
  if (!ctx.isAnonymous) throw precondition("Only guest sessions need to be claimed.");
  await limit(ctx, "claim");
  const token = v.randomToken();
  await ctx.db.doc(`partyClaims/${v.sha256(token)}`).set({ anonUid: ctx.uid, createdAt: ctx.now, expiresAt: ctx.now + CLAIM_TTL_MS });
  return { token, expiresAt: ctx.now + CLAIM_TTL_MS };
}

// Step 2, called by the signed-in FIP account: moves every party guest
// record (and ballot ownership) from the anonymous uid to this account.
async function claimGuest(ctx) {
  assertAccount(ctx);
  await limit(ctx, "claim");
  if (typeof ctx.data.token !== "string" || ctx.data.token.length > 100) throw v.invalid("Invalid claim.");
  const claimRef = ctx.db.doc(`partyClaims/${v.sha256(ctx.data.token)}`);
  const claimSnap = await claimRef.get();
  if (!claimSnap.exists || claimSnap.data().expiresAt < ctx.now) throw denied("This claim has expired. Open your results and try again.");
  const { anonUid } = claimSnap.data();
  await claimRef.delete();
  const guestDocs = await ctx.db.collectionGroup("guests").where("uid", "==", anonUid).get();
  const claimed = [];
  const skipped = [];
  for (const doc of guestDocs.docs) {
    const partyId = doc.ref.parent.parent.id;
    const result = await ctx.db.runTransaction((tx) => transferGuest(tx, ctx.db, partyId, anonUid, ctx.uid, ctx.now));
    if (result.moved) {
      claimed.push(partyId);
      await ctx.db.doc(`parties/${partyId}/guests/${ctx.uid}`).update({ isAccount: true });
      const keys = await ctx.db.collection("partyGuestKeys").where("partyId", "==", partyId).where("uid", "==", anonUid).get();
      for (const key of keys.docs) await key.ref.update({ uid: ctx.uid });
    } else {
      skipped.push(partyId);
    }
  }
  return { claimed, skipped };
}

// ---------------------------------------------------------------------------

const ACTIONS = {
  createParty,
  updateParty,
  setCategories,
  setSamples,
  setCategoryState,
  revealAll,
  setCurrentCategory,
  completeParty,
  setInvite,
  rotateJoinCode,
  removeGuest,
  setHostTasting,
  getBottleKey,
  createCoHostInvite,
  acceptCoHost,
  removeCoHost,
  syncRoster,
  deleteParty,
  savePaperBallot,
  deletePaperBallot,
  setBallotExcluded,
  listBallots,
  previewParty,
  joinParty,
  recoverGuest,
  saveBallot,
  createDisplayLink,
  revokeDisplays,
  redeemDisplay,
  createClaimToken,
  claimGuest,
};

// Preview is the only action that works before any sign-in (a guest sees
// the welcome screen before an anonymous identity exists).
const UNAUTHENTICATED_ACTIONS = new Set(["previewParty"]);

async function handlePartyAction(db, request) {
  const data = request.data && typeof request.data === "object" ? request.data : {};
  const action = typeof data.action === "string" && Object.prototype.hasOwnProperty.call(ACTIONS, data.action) ? data.action : null;
  if (!action) throw v.invalid("Unknown party action.");
  if (!request.auth && !UNAUTHENTICATED_ACTIONS.has(action)) throw new HttpsError("unauthenticated", "Join the party first.");
  const provider = request.auth?.token?.firebase?.sign_in_provider;
  const ctx = {
    db,
    uid: request.auth ? request.auth.uid : null,
    // Anything we can't positively identify as a full account is treated
    // as a guest identity — the safe default for host-only checks.
    isAnonymous: !request.auth || !provider || provider === "anonymous",
    ip: request.rawRequest?.ip || null,
    data,
    now: Date.now(),
  };
  return ACTIONS[action](ctx);
}

module.exports = { ACTIONS, RATE_LIMITS, TRANSITIONS, handlePartyAction, joinBlocker };
