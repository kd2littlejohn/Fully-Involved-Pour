export interface QuickPourReaction {
  value: 'love-it' | 'enjoying-it' | 'interesting' | 'just-okay' | 'not-for-me'
  emoji: string
  label: string
  // Starting-point score for this reaction, not a claim of precision — the
  // user can fine-tune it before saving.
  score: number
}

export const QUICK_POUR_REACTIONS: QuickPourReaction[] = [
  { value: 'love-it', emoji: '😍', label: 'Love It', score: 9.3 },
  { value: 'enjoying-it', emoji: '👍', label: 'Enjoying It', score: 8.3 },
  { value: 'interesting', emoji: '🤔', label: 'Interesting', score: 7.2 },
  { value: 'just-okay', emoji: '😐', label: 'Just Okay', score: 6.0 },
  { value: 'not-for-me', emoji: '😕', label: 'Not For Me', score: 4.0 },
]
