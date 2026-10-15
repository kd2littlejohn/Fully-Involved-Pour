// Shareable Party Mode URLs. The app uses hash routing (see router.tsx), so
// every link is the app's own base URL plus a #/ route.

function appBase(): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}`
}

export function partyInviteUrl(joinCode: string): string {
  return `${appBase()}#/p/${encodeURIComponent(joinCode)}`
}

export function partyDisplayUrl(partyId: string, token: string): string {
  return `${appBase()}#/party/${encodeURIComponent(partyId)}/display?t=${encodeURIComponent(token)}`
}

export function partyCoHostUrl(partyId: string, token: string): string {
  return `${appBase()}#/party/${encodeURIComponent(partyId)}/cohost?t=${encodeURIComponent(token)}`
}

export function formatJoinCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code
}

// Native share sheet where the browser has one (mobile Safari, Android
// Chrome); otherwise copy to the clipboard. Resolves to what happened so
// the caller can confirm it to the host.
export async function shareOrCopy(title: string, text: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, text, url })
      return 'shared'
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'failed'
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
