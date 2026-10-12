// Calendar dates (pour dates, openedDate, finishedDate, purchaseDate,
// memory dates…) are stored as plain YYYY-MM-DD strings: the day the user
// lived it, with no time or timezone. Two easy mistakes turn that day into
// a different one, so every read and write of such a field goes through
// here:
//
// - Writing "today" as `new Date().toISOString().slice(0, 10)` gives the
//   UTC day. From late afternoon / evening in the Americas that is already
//   tomorrow, so the record is saved a day late.
// - Reading with `new Date('2026-06-14')` parses as UTC midnight, which a
//   local-time formatter shows as the day before anywhere west of UTC.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// The viewer's local calendar day for an instant (Date or epoch ms).
export function localIsoDate(at: Date | number = new Date()): string {
  const d = typeof at === 'number' ? new Date(at) : at
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayLocalIsoDate(): string {
  return localIsoDate(new Date())
}

// A YYYY-MM-DD string as local midnight of that same day.
export function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

// For values that may be either a calendar date or a full timestamp:
// calendar dates are read as local days, timestamps as the instant they are.
export function parseDisplayDate(value: string): Date {
  return DATE_ONLY.test(value) ? parseLocalDate(value) : new Date(value)
}
