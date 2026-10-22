// Runtime switches for the Google (Gemini) step of Scan Barcode, editable
// by an administrator in the Firebase console without a redeploy:
//
//   appConfig/barcodeGoogle  (server-only; clients can't read or write it)
//     enabled           must be true for Google to be called at all; false
//                       (or a missing document) keeps it off
//     monthlyBudgetUsd  estimated Gemini spend per calendar month (UTC)
//                       after which Google is skipped and AXE is offered
//     requireAppCheck   true once Firebase App Check is set up for the web app
//     model             Gemini model id
//
// A missing field uses DEFAULTS. Google also stays off when the
// GEMINI_API_KEY secret is empty, whatever this says.

const { DEFAULT_GEMINI_MODEL } = require("./providers/gemini");

const DEFAULTS = Object.freeze({
  enabled: false,
  monthlyBudgetUsd: 20,
  requireAppCheck: false,
  model: DEFAULT_GEMINI_MODEL,
});
const CACHE_MS = 60 * 1000;

let cached = null;

function sanitize(data) {
  const d = data || {};
  return {
    enabled: d.enabled === true,
    monthlyBudgetUsd:
      typeof d.monthlyBudgetUsd === "number" && Number.isFinite(d.monthlyBudgetUsd) && d.monthlyBudgetUsd >= 0
        ? d.monthlyBudgetUsd
        : DEFAULTS.monthlyBudgetUsd,
    requireAppCheck: typeof d.requireAppCheck === "boolean" ? d.requireAppCheck : DEFAULTS.requireAppCheck,
    model: typeof d.model === "string" && /^[a-z0-9.-]{3,60}$/.test(d.model) ? d.model : DEFAULTS.model,
  };
}

// Read at most once a minute per function instance.
async function loadGoogleConfig(db, now = Date.now) {
  if (cached && now() - cached.at < CACHE_MS) return cached.config;
  let config;
  try {
    const snap = await db.doc("appConfig/barcodeGoogle").get();
    config = sanitize(snap.exists ? snap.data() : null);
  } catch (error) {
    // Fail closed: if the switch can't be read, don't spend.
    console.error("Barcode Google config unreadable", error.message);
    config = { ...DEFAULTS, enabled: false };
  }
  cached = { at: now(), config };
  return config;
}

function resetGoogleConfigCache() {
  cached = null;
}

module.exports = { loadGoogleConfig, resetGoogleConfigCache, sanitize, DEFAULTS };
