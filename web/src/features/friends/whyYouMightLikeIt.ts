const MAX_SHARED_TAGS = 2

// "Why You Might Like It" (Friend Bottle Quick View) — purely a real overlap
// between the viewer's own and the friend's whiskeyIdentityTags (already
// public, already computed elsewhere — see features/profile/identity.ts).
// Undefined whenever there's no real overlap, never a fabricated guess.
export function whyYouMightLikeIt(
  viewerTags: string[] | undefined,
  friendTags: string[] | undefined,
  friendFirstName: string,
): string | undefined {
  if (!viewerTags?.length || !friendTags?.length) return undefined

  const viewerSet = new Set(viewerTags.map((t) => t.toLowerCase()))
  const shared = friendTags.filter((t) => viewerSet.has(t.toLowerCase())).slice(0, MAX_SHARED_TAGS)
  if (shared.length === 0) return undefined

  const descriptor = shared.map((t) => t.toLowerCase()).join(', ')
  return `You and ${friendFirstName} both tend to rate ${descriptor} pours highly.`
}
