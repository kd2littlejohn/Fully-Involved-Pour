import type { BlindComparison, BlindComparisonReason, BlindTastingResponse } from '../../data/types'

const CHARACTERISTIC_PHRASES: Record<string, string> = {
  Sweetness: 'its sweetness',
  'Rich Flavor': 'its rich flavor',
  Smoothness: 'how smooth it was',
  Spice: 'its spice',
  Oak: 'its oak character',
  Finish: 'its finish',
}

const COMPARISON_REASON_PHRASES: Partial<Record<BlindComparisonReason, string>> = {
  'better-smell': 'its aroma',
  'better-flavor': 'its flavor',
  'better-finish': 'its finish',
  'less-heat': 'its lower perceived heat',
  'more-flavor': 'how much flavor it had',
  'better-balance': 'how balanced it was',
}

function joinPhrases(phrases: string[]): string {
  if (phrases.length === 1) return phrases[0]!
  return `${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`
}

// Everything here reads only from what the taster actually recorded — no
// inferred or fabricated detail. If nothing supporting was captured (e.g.
// an "I've Got This" minimal-guidance taste with just a reaction), the
// summary stays a single honest sentence rather than padding it out.
export function generateTastingSummary(input: {
  bottleName: string
  response?: BlindTastingResponse
  wins: BlindComparison[]
}): string {
  const opener = `You chose ${input.bottleName} before seeing the label.`

  const phrases: string[] = []
  const seen = new Set<string>()
  function add(phrase: string | undefined) {
    if (!phrase || seen.has(phrase)) return
    seen.add(phrase)
    phrases.push(phrase)
  }

  const characteristicPhrase = input.response?.likedCharacteristic
    ? CHARACTERISTIC_PHRASES[input.response.likedCharacteristic]
    : undefined
  add(characteristicPhrase)

  for (const win of input.wins) {
    add(win.reason ? COMPARISON_REASON_PHRASES[win.reason] : undefined)
  }

  if (input.response?.finishLength === 'medium' || input.response?.finishLength === 'long') {
    add('its finish')
  }

  if (phrases.length === 0) return opener
  return `${opener} You consistently preferred ${joinPhrases(phrases)}.`
}
