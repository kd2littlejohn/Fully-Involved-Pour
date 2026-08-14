export interface QuickPourReaction {
  value: 'love' | 'enjoying' | 'deciding' | 'not-for-me'
  emoji: string
  label: string
  // Starting-point score for this reaction, not a claim of precision — the
  // user can fine-tune it before saving.
  score: number
}

export const QUICK_POUR_REACTIONS: QuickPourReaction[] = [
  { value: 'love', emoji: '😍', label: 'Love it', score: 9.2 },
  { value: 'enjoying', emoji: '👍', label: 'Enjoying it', score: 8.0 },
  { value: 'deciding', emoji: '🤔', label: 'Still deciding', score: 6.5 },
  { value: 'not-for-me', emoji: '😕', label: 'Not for me', score: 4.0 },
]
