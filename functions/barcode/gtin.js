// Barcode normalization for the Scan Barcode proof of concept. Mirrors
// web/src/features/barcode/gtin.ts — same rules, same test vectors — so the
// server never trusts a client-normalized key.
//
// Only the three retail symbologies FIP scans are accepted: UPC-A (12
// digits), UPC-E (8 digits, expanded to UPC-A) and EAN-13. Everything is
// keyed as GTIN-13 so the same bottle scanned as UPC-A or as EAN-13 (a
// leading 0) lands on one mapping document.
//
// Restricted-circulation numbers (UPC number system 2/4, EAN 02/04/2x) are
// store- or weight-specific labels — e.g. a liquor store's own sticker on a
// store pick — not product identifiers, so they are never looked up or
// cached as a shared mapping.

function checkDigit(body) {
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    const digit = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return String((10 - (sum % 10)) % 10);
}

function hasValidCheckDigit(code) {
  return checkDigit(code.slice(0, -1)) === code.slice(-1);
}

function expandUpcE(upcE) {
  const numberSystem = upcE[0];
  if (numberSystem !== "0" && numberSystem !== "1") return null;
  const d = upcE.slice(1, 7);
  const last = d[5];
  let body;
  if (last === "0" || last === "1" || last === "2") body = `${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`;
  else if (last === "3") body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  else if (last === "4") body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  else body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`;
  return `${numberSystem}${body}${upcE[7]}`;
}

function isRestrictedGtin13(gtin13) {
  return gtin13.startsWith("02") || gtin13.startsWith("04") || gtin13[0] === "2";
}

// Returns { gtin13, upcA?, symbology, restricted } or { error }.
function normalizeBarcode(raw) {
  const code = String(raw ?? "").replace(/[\s-]/g, "");
  if (!/^\d+$/.test(code)) return { error: "not-numeric" };

  if (code.length === 8) {
    const upcA = expandUpcE(code);
    if (!upcA) return { error: "unsupported-upce-number-system" };
    if (!hasValidCheckDigit(upcA)) return { error: "bad-check-digit" };
    const gtin13 = `0${upcA}`;
    return { gtin13, upcA, symbology: "UPC_E", restricted: isRestrictedGtin13(gtin13) };
  }
  if (code.length === 12) {
    if (!hasValidCheckDigit(code)) return { error: "bad-check-digit" };
    const gtin13 = `0${code}`;
    return { gtin13, upcA: code, symbology: "UPC_A", restricted: isRestrictedGtin13(gtin13) };
  }
  if (code.length === 13) {
    if (!hasValidCheckDigit(code)) return { error: "bad-check-digit" };
    const upcA = code[0] === "0" ? code.slice(1) : undefined;
    return { gtin13: code, upcA, symbology: "EAN_13", restricted: isRestrictedGtin13(code) };
  }
  return { error: "unsupported-length" };
}

module.exports = { normalizeBarcode, checkDigit, expandUpcE };
