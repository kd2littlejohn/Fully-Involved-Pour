import type { UserDoc } from '../../data/types'

// A real export of exactly what's already loaded client-side (userDoc) — no
// new Firestore reads, no server round-trip. Triggers a normal browser
// download; this is the user's own app downloading the user's own data to
// the user's own device, not a third-party host.
export function downloadUserDataExport(userDoc: UserDoc): void {
  const payload = JSON.stringify(userDoc, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `fip-export-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
