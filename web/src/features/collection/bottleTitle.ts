export interface BottleTitleParts {
  title: string
  subtitle?: string
}

// Bottle names have no dedicated "edition" field — this is a conservative,
// opportunistic split of the existing name string, never a guess. Only
// splits when the name itself carries a clear structural separator (a
// spaced dash, a trailing parenthetical, or a trailing "Batch 25A"-style
// release identifier); anything else is shown whole
// rather than risk cutting an ordinary name in a confusing place.
const DASH_SEPARATOR = /\s+[—–-]\s+/
const TRAILING_PAREN = /^(.*\S)\s*\(([^()]+)\)\s*$/
// A trailing release identifier written straight into the name, e.g.
// "George T. Stagg Batch 25A", "Booker's Batch 2024-03", "Lot 2B",
// "Release #4". The identifier must contain a digit, so ordinary words
// ("Small Batch", "Barrel Proof", "Single Barrel Select") never split.
const TRAILING_RELEASE = /^(.*\S)\s+((?:Batch|Release|Lot|Edition)\s+#?[A-Za-z]*\d[\w.-]*)$/i

export function splitBottleTitle(name: string): BottleTitleParts {
  const trimmed = name.trim()

  const dashParts = trimmed.split(DASH_SEPARATOR)
  if (dashParts.length === 2 && dashParts[0] && dashParts[1]) {
    return { title: dashParts[0].trim(), subtitle: dashParts[1].trim() }
  }

  const parenMatch = trimmed.match(TRAILING_PAREN)
  if (parenMatch?.[1] && parenMatch[2]) {
    return { title: parenMatch[1].trim(), subtitle: parenMatch[2].trim() }
  }

  const releaseMatch = trimmed.match(TRAILING_RELEASE)
  if (releaseMatch?.[1] && releaseMatch[2]) {
    return { title: releaseMatch[1].trim(), subtitle: releaseMatch[2].trim() }
  }

  return { title: trimmed }
}
