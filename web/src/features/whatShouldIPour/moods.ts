export type MoodId =
  | 'big-bold'
  | 'easy-night'
  | 'something-special'
  | 'explore-bar'
  | 'sharing-friends'
  | 'nightcap'
  | 'surprise-me'

export interface Mood {
  id: MoodId
  label: string
}

// Order shown in the mood picker.
export const MOODS: Mood[] = [
  { id: 'big-bold', label: 'Big & Bold' },
  { id: 'easy-night', label: 'Easy Night' },
  { id: 'something-special', label: 'Something Special' },
  { id: 'explore-bar', label: 'Explore My Bar' },
  { id: 'sharing-friends', label: 'Sharing With Friends' },
  { id: 'nightcap', label: 'Nightcap' },
  { id: 'surprise-me', label: 'Surprise Me' },
]
