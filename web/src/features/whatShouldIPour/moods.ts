export type MoodId = 'something-familiar' | 'something-special' | 'havent-had-lately' | 'sweet' | 'high-proof' | 'surprise-me'

export interface Mood {
  id: MoodId
  label: string
}

// Order shown in the mood picker.
export const MOODS: Mood[] = [
  { id: 'something-familiar', label: 'Something Familiar' },
  { id: 'something-special', label: 'Something Special' },
  { id: 'havent-had-lately', label: "Haven't Had Lately" },
  { id: 'sweet', label: 'Sweet' },
  { id: 'high-proof', label: 'High Proof' },
  { id: 'surprise-me', label: 'Surprise Me' },
]
