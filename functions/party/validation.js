// Blind Room Party Mode — input validation. Every value a client sends to
// partyAction passes through here before it touches Firestore; anything
// malformed is rejected with invalid-argument rather than coerced into
// something the caller didn't mean.
const crypto = require("crypto");
const { HttpsError } = require("firebase-functions/v2/https");

const LIMITS = {
  MAX_CATEGORIES: 24,
  MIN_SAMPLES: 2,
  MAX_SAMPLES: 12,
  MAX_GUESTS: 150,
  MAX_NAME: 80,
  MAX_DESCRIPTION: 400,
  MAX_NICKNAME: 24,
  MAX_NOTES: 500,
  MAX_DESCRIPTORS: 12,
  MAX_DESCRIPTOR: 40,
  MAX_HOST_NOTES: 1000,
};

const SAMPLE_LABELS = "ABCDEFGHIJKL".split("");
const CATEGORY_STATES = ["draft", "ready", "voting_open", "voting_closed", "revealed"];
// Unambiguous alphabet — no O/0 or I/1 confusion when a code is read aloud.
// Same alphabet the existing Blind Room codes use.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function invalid(message) {
  return new HttpsError("invalid-argument", message);
}

function randomCode(length) {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return out;
}

function randomId(prefix) {
  return `${prefix}${crypto.randomBytes(8).toString("hex")}`;
}

function randomToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Plain text with angle brackets and control characters stripped and
// whitespace collapsed — safe to render anywhere and to embed in prompts.
function cleanText(value, max) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw invalid("Expected text.");
  return value
    .replace(/[<>\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function requiredText(value, max, what) {
  const text = cleanText(value, max);
  if (!text) throw invalid(`${what} is required.`);
  return text;
}

function optionalNumber(value, min, max, what) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw invalid(`${what} must be a number from ${min} to ${max}.`);
  }
  return value;
}

function requireId(value, what) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw invalid(`A valid ${what} is required.`);
  return value;
}

function normalizeCode(value) {
  if (typeof value !== "string") throw invalid("Enter a party code.");
  const code = value.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) throw invalid("That party code doesn't look right.");
  return code;
}

function nicknameKey(nickname) {
  return nickname.toLowerCase().replace(/\s+/g, " ");
}

function validateNickname(value) {
  const nickname = cleanText(value, LIMITS.MAX_NICKNAME);
  if (nickname.length < 1) throw invalid("Enter a nickname.");
  return nickname;
}

function validateEventDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value)) throw invalid("Invalid event date.");
  return value;
}

function validateImageUrl(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.length > 1000 || !/^https:\/\//.test(value)) throw invalid("Images must be https links.");
  return value;
}

const DEFAULT_SETTINGS = {
  defaultScoring: "quick",
  allowEdits: true,
  manualVoting: true,
  revealByCategory: true,
  showNicknames: true,
  predictions: false,
};

function validateSettings(input, current) {
  const base = { ...DEFAULT_SETTINGS, ...(current || {}) };
  if (input === undefined || input === null) return base;
  if (typeof input !== "object") throw invalid("Invalid settings.");
  const out = { ...base };
  if (input.defaultScoring !== undefined) {
    if (!["quick", "detailed"].includes(input.defaultScoring)) throw invalid("Invalid scoring mode.");
    out.defaultScoring = input.defaultScoring;
  }
  for (const key of ["allowEdits", "manualVoting", "revealByCategory", "showNicknames", "predictions"]) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "boolean") throw invalid(`Invalid setting: ${key}.`);
      out[key] = input[key];
    }
  }
  return out;
}

// "blind" (the default, and every party created before formats existed)
// hides bottles until reveal; "regular" shows them from the start; "dual"
// runs both at once: a guided group sees the bottles, a blind group sees
// only sample letters until the reveal.
const PARTY_FORMATS = ["blind", "regular", "dual"];

function validateFormat(input) {
  if (input === undefined || input === null) return "blind";
  if (!PARTY_FORMATS.includes(input)) throw invalid("Choose a regular, blind or dual tasting.");
  return input;
}

// Dual Experience participant groups.
const GROUPS = ["guided", "blind"];

function validateGroup(input, what = "Group") {
  if (!GROUPS.includes(input)) throw invalid(`${what} must be guided or blind.`);
  return input;
}

// Dual Experience event options. `joinGroup` is where a newly joined guest
// starts (blind by default: nobody sees a bottle until the host moves
// them); the planned counts are only the host's targets for the dashboard.
const DEFAULT_DUAL = { joinGroup: "blind", plannedGuided: null, plannedBlind: null };

function validateDual(input, current) {
  const base = { ...DEFAULT_DUAL, ...(current || {}) };
  if (input === undefined || input === null) return base;
  if (typeof input !== "object" || Array.isArray(input)) throw invalid("Invalid dual experience options.");
  const out = { ...base };
  if (input.joinGroup !== undefined) out.joinGroup = validateGroup(input.joinGroup, "New guests' group");
  for (const key of ["plannedGuided", "plannedBlind"]) {
    if (input[key] === undefined) continue;
    const value = optionalNumber(input[key], 0, LIMITS.MAX_GUESTS, key === "plannedGuided" ? "Guided count" : "Blind count");
    out[key] = value === undefined ? null : Math.floor(value);
  }
  return out;
}

// Optional education for any party: aroma stations and per-round pairings.
// Shown to everyone in the party, blind tasters included, so they're
// category-level only (never tied to a sample letter).
const MAX_STATIONS = 8;

function validateExtras(input, categoryIds) {
  if (input === undefined || input === null) return { stations: [], pairings: {} };
  if (typeof input !== "object" || Array.isArray(input)) throw invalid("Invalid stations and pairings.");
  const stationsInput = input.stations === undefined ? [] : input.stations;
  if (!Array.isArray(stationsInput)) throw invalid("Stations must be a list.");
  if (stationsInput.length > MAX_STATIONS) throw invalid(`Up to ${MAX_STATIONS} stations.`);
  const stations = stationsInput.map((station) => {
    if (!station || typeof station !== "object") throw invalid("Invalid station.");
    return {
      id: station.id ? requireId(station.id, "station") : randomId("st_"),
      name: requiredText(station.name, 60, "Station name"),
      description: cleanText(station.description, 300),
      guidance: cleanText(station.guidance, 300),
    };
  });
  const pairingsInput = input.pairings === undefined ? {} : input.pairings;
  if (!pairingsInput || typeof pairingsInput !== "object" || Array.isArray(pairingsInput)) throw invalid("Pairings must be keyed by round.");
  const pairings = {};
  for (const [categoryId, pairing] of Object.entries(pairingsInput)) {
    requireId(categoryId, "round");
    if (!categoryIds.includes(categoryId)) throw invalid("A pairing points at a round that isn't part of this party.");
    if (!pairing || typeof pairing !== "object") throw invalid("Invalid pairing.");
    const name = cleanText(pairing.name, 80);
    if (!name) continue;
    pairings[categoryId] = { name, note: cleanText(pairing.note, 200) };
  }
  return { stations, pairings };
}

function validateDetails(input) {
  const data = input || {};
  const capacity = optionalNumber(data.capacity, 1, LIMITS.MAX_GUESTS, "Guest capacity");
  return {
    name: requiredText(data.name, LIMITS.MAX_NAME, "Event name"),
    description: cleanText(data.description, LIMITS.MAX_DESCRIPTION),
    eventDate: validateEventDate(data.eventDate),
    coverImageUrl: validateImageUrl(data.coverImageUrl),
    capacity: capacity === undefined ? null : Math.floor(capacity),
  };
}

// A category definition as the host edits it. `id` is present for an
// existing event category; `libraryId` is the stable id of the library
// category (predefined or saved custom) it was created from, if any.
function validateCategoryInput(input) {
  if (!input || typeof input !== "object") throw invalid("Invalid category.");
  const out = {
    name: requiredText(input.name, LIMITS.MAX_NAME, "Category name"),
    description: cleanText(input.description, LIMITS.MAX_DESCRIPTION),
    libraryId: input.libraryId ? requireId(input.libraryId, "library category") : null,
  };
  if (input.id !== undefined && input.id !== null) out.id = requireId(input.id, "category");
  if (input.duplicateOf !== undefined && input.duplicateOf !== null) out.duplicateOf = requireId(input.duplicateOf, "category");
  return out;
}

// A competing bottle, snapshotted at selection time. Copying (rather than
// referencing) means editing or finishing the bottle in My Bar later never
// changes a party's history, and selecting it never touches inventory.
function validateBottle(input) {
  if (!input || typeof input !== "object") throw invalid("Invalid bottle.");
  const out = { name: requiredText(input.name, 120, "Bottle name") };
  const distillery = cleanText(input.distillery, 120);
  if (distillery) out.distillery = distillery;
  const type = cleanText(input.type, 60);
  if (type) out.type = type;
  const age = cleanText(input.age, 40);
  if (age) out.age = age;
  const proof = optionalNumber(input.proof, 0, 200, "Proof");
  if (proof !== undefined) out.proof = proof;
  const price = optionalNumber(input.price, 0, 100000, "Price");
  if (price !== undefined && price > 0) out.price = price;
  const imageUrl = validateImageUrl(input.imageUrl);
  if (imageUrl) out.imageUrl = imageUrl;
  if (input.bottleId) out.bottleId = requireId(input.bottleId, "bottle");
  out.source = ["my-bar", "manual", "catalog"].includes(input.source) ? input.source : "manual";
  return out;
}

// samples: [{ bottle, label? }]. Returns [{ id, label, bottle }] with labels
// assigned: shuffled server-side for 'random', or validated as an exact
// permutation of A..N for 'manual'.
function validateSamples(samplesInput, assignment) {
  if (!Array.isArray(samplesInput)) throw invalid("Samples must be a list.");
  if (samplesInput.length > LIMITS.MAX_SAMPLES) throw invalid(`A category can hold up to ${LIMITS.MAX_SAMPLES} bottles.`);
  const labels = SAMPLE_LABELS.slice(0, samplesInput.length);
  const bottles = samplesInput.map((s) => validateBottle(s && s.bottle));
  let assigned;
  if (assignment === "manual") {
    const requested = samplesInput.map((s) => (s && typeof s.label === "string" ? s.label : ""));
    const sorted = [...requested].sort();
    if (sorted.join() !== labels.join()) throw invalid(`Assign each bottle exactly one of ${labels.join(", ")}.`);
    assigned = requested;
  } else if (assignment === "random") {
    assigned = shuffle(labels);
  } else {
    throw invalid("Choose random or manual sample assignment.");
  }
  return bottles
    .map((bottle, index) => ({ id: randomId("s_"), label: assigned[index], bottle }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function validateScore(input, mode) {
  if (!input || typeof input !== "object") throw invalid("Invalid score.");
  const overall = optionalNumber(input.overall, 0, 10, "Overall enjoyment");
  if (overall === undefined) throw invalid("Every scored sample needs an overall enjoyment rating.");
  const out = { overall: Math.round(overall * 10) / 10 };
  if (mode === "detailed") {
    for (const key of ["nose", "palate", "finish", "complexity"]) {
      const value = optionalNumber(input[key], 0, 10, key);
      if (value !== undefined) out[key] = Math.round(value * 10) / 10;
    }
  }
  if (input.descriptors !== undefined) {
    if (!Array.isArray(input.descriptors)) throw invalid("Descriptors must be a list.");
    const descriptors = [...new Set(input.descriptors.map((d) => cleanText(d, LIMITS.MAX_DESCRIPTOR)).filter(Boolean))].slice(
      0,
      LIMITS.MAX_DESCRIPTORS,
    );
    if (descriptors.length) out.descriptors = descriptors;
  }
  const notes = cleanText(input.notes, LIMITS.MAX_NOTES);
  if (notes) out.notes = notes;
  return out;
}

// scores: { [label]: score }. Only labels that belong to the category are
// accepted — a ballot can never reference another category's samples.
function validateScores(input, sampleLabels, mode) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("Scores are required.");
  const out = {};
  for (const [label, score] of Object.entries(input)) {
    if (!sampleLabels.includes(label)) throw invalid(`Sample ${String(label).slice(0, 4)} isn't part of this round.`);
    out[label] = validateScore(score, mode);
  }
  return out;
}

function validateOptionalLabel(value, sampleLabels, what) {
  if (value === undefined || value === null || value === "") return null;
  if (!sampleLabels.includes(value)) throw invalid(`${what} must be one of this round's samples.`);
  return value;
}

module.exports = {
  CATEGORY_STATES,
  DEFAULT_SETTINGS,
  LIMITS,
  SAMPLE_LABELS,
  cleanText,
  invalid,
  nicknameKey,
  normalizeCode,
  randomCode,
  randomId,
  randomToken,
  requireId,
  sha256,
  shuffle,
  validateCategoryInput,
  validateDetails,
  validateNickname,
  validateOptionalLabel,
  validateSamples,
  validateScores,
  validateSettings,
  PARTY_FORMATS,
  validateFormat,
  GROUPS,
  DEFAULT_DUAL,
  validateDual,
  validateExtras,
  validateGroup,
};
