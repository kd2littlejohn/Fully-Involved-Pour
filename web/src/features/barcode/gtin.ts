// Barcode normalization for Scan Barcode. Mirrors functions/barcode/gtin.js
// — same rules, same test vectors — so the client can reject a misread
// before any network call, while the server still re-validates.
//
// Only UPC-A, UPC-E (expanded to UPC-A) and EAN-13 are accepted, all keyed
// as GTIN-13. Restricted-circulation numbers (UPC number system 2/4, EAN
// 02/04/2x) are store- or weight-specific labels — e.g. a store's own
// sticker on a store pick — not product identifiers.

export type Symbology = 'UPC_A' | 'UPC_E' | 'EAN_13'

export type NormalizedBarcode =
  | { gtin13: string; upcA?: string; symbology: Symbology; restricted: boolean; error?: undefined }
  | { error: 'not-numeric' | 'unsupported-length' | 'unsupported-upce-number-system' | 'bad-check-digit' }

export function checkDigit(body: string): string {
  let sum = 0
  for (let i = 0; i < body.length; i += 1) {
    const digit = Number(body[body.length - 1 - i])
    sum += i % 2 === 0 ? digit * 3 : digit
  }
  return String((10 - (sum % 10)) % 10)
}

function hasValidCheckDigit(code: string): boolean {
  return checkDigit(code.slice(0, -1)) === code.slice(-1)
}

export function expandUpcE(upcE: string): string | null {
  const numberSystem = upcE[0]
  if (numberSystem !== '0' && numberSystem !== '1') return null
  const d = upcE.slice(1, 7)
  const last = d[5]
  let body: string
  if (last === '0' || last === '1' || last === '2') body = `${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`
  else if (last === '3') body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`
  else if (last === '4') body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`
  else body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`
  return `${numberSystem}${body}${upcE[7]}`
}

function isRestrictedGtin13(gtin13: string): boolean {
  return gtin13.startsWith('02') || gtin13.startsWith('04') || gtin13[0] === '2'
}

export function normalizeBarcode(raw: unknown): NormalizedBarcode {
  const code = String(raw ?? '').replace(/[\s-]/g, '')
  if (!/^\d+$/.test(code)) return { error: 'not-numeric' }

  if (code.length === 8) {
    const upcA = expandUpcE(code)
    if (!upcA) return { error: 'unsupported-upce-number-system' }
    if (!hasValidCheckDigit(upcA)) return { error: 'bad-check-digit' }
    const gtin13 = `0${upcA}`
    return { gtin13, upcA, symbology: 'UPC_E', restricted: isRestrictedGtin13(gtin13) }
  }
  if (code.length === 12) {
    if (!hasValidCheckDigit(code)) return { error: 'bad-check-digit' }
    const gtin13 = `0${code}`
    return { gtin13, upcA: code, symbology: 'UPC_A', restricted: isRestrictedGtin13(gtin13) }
  }
  if (code.length === 13) {
    if (!hasValidCheckDigit(code)) return { error: 'bad-check-digit' }
    const upcA = code[0] === '0' ? code.slice(1) : undefined
    return { gtin13: code, upcA, symbology: 'EAN_13', restricted: isRestrictedGtin13(code) }
  }
  return { error: 'unsupported-length' }
}
