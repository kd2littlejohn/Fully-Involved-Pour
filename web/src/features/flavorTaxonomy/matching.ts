// Normalizes and matches free-text tasting notes against the flavor
// taxonomy (taxonomy.ts). Used by features/flavorRadar/flavorCategories.ts
// so a note like "hints of vanilla and toasted oak" contributes to the
// radar the same way tapping those chips would.
import { FLAVOR_DESCRIPTORS } from './taxonomy'

export function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// A simple plural alternate for a phrase's last word — "cherry" ->
// "cherries", "grape" -> "grapes", "peach" -> "peaches". Good enough for
// the "simple plural variations" requirement without a full inflection
// engine, and only ever adds an alternate spelling to match against, never
// changes what a match resolves to (the canonical label is unaffected).
function pluralAlternate(phrase: string): string | undefined {
  const words = phrase.split(' ')
  const last = words[words.length - 1]
  if (!last) return undefined
  let altLast: string
  if (/[^aeiou]y$/i.test(last)) altLast = `${last.slice(0, -1)}ies`
  else if (/(s|x|z|ch|sh)$/i.test(last)) altLast = `${last}es`
  else altLast = `${last}s`
  return [...words.slice(0, -1), altLast].join(' ')
}

interface Matcher {
  label: string
  pattern: RegExp
}

function buildMatchers(label: string, aliases: string[] = []): Matcher[] {
  const phrases = new Set<string>([label, ...aliases])
  for (const phrase of [...phrases]) {
    const plural = pluralAlternate(phrase)
    if (plural) phrases.add(plural)
  }
  return [...phrases].map((phrase) => ({
    label,
    // Word-boundary match, case-insensitive — "hints of vanilla and oak"
    // matches, "soak" does not match "oak" (word-boundary between 's' and
    // 'o' fails). 'g' so a single scan can find every occurrence and its
    // span, needed for the longest-match resolution below.
    pattern: new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi'),
  }))
}

let cachedMatchers: Matcher[] | undefined
function allMatchers(): Matcher[] {
  if (!cachedMatchers) {
    cachedMatchers = FLAVOR_DESCRIPTORS.flatMap((d) => buildMatchers(d.label, d.aliases))
  }
  return cachedMatchers
}

interface Span {
  label: string
  start: number
  end: number
}

// Longest-match, non-overlapping resolution — "toasted oak" resolves to
// Toasted Oak only, never also Oak; "dark chocolate" resolves to Dark
// Chocolate only, never also Chocolate; "candied orange"/"orange peel"
// resolve to Orange Peel only, never also bare Orange. One generic
// algorithm (find every candidate span, keep the longest ones, discard any
// shorter span fully contained inside an accepted one) rather than
// hand-listing every overlapping phrase pair.
export function matchDescriptorsInText(text: string | undefined): Set<string> {
  const result = new Set<string>()
  if (!text) return result

  const candidates: Span[] = []
  for (const { label, pattern } of allMatchers()) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text))) {
      candidates.push({ label, start: match.index, end: match.index + match[0].length })
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1
    }
  }

  candidates.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start)

  const accepted: Span[] = []
  for (const candidate of candidates) {
    const overlaps = accepted.some((a) => candidate.start < a.end && candidate.end > a.start)
    if (overlaps) continue
    accepted.push(candidate)
    result.add(candidate.label)
  }

  return result
}
