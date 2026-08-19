import { describe, expect, it, vi } from 'vitest'

vi.mock('../devMode', () => ({ isMockAuthEnabled: () => true }))

import { deleteRecommendation, getRecommendationsForRecipient, sendRecommendation, setRecommendationStatus } from './recommendations'

describe('sendRecommendation', () => {
  it('always starts pending and is visible to the recipient, newest first', async () => {
    await sendRecommendation({ senderId: 's1', senderUsername: 's1', recipientId: 'r1', bottleName: 'Bottle A' })
    await new Promise((resolve) => setTimeout(resolve, 2))
    await sendRecommendation({ senderId: 's2', senderUsername: 's2', recipientId: 'r1', bottleName: 'Bottle B' })
    const results = await getRecommendationsForRecipient('r1')
    expect(results.map((r) => r.bottleName)).toEqual(['Bottle B', 'Bottle A'])
    expect(results.every((r) => r.status === 'pending')).toBe(true)
  })
})

describe('setRecommendationStatus', () => {
  it('updates status in place', async () => {
    const rec = await sendRecommendation({ senderId: 's3', senderUsername: 's3', recipientId: 'r2', bottleName: 'Bottle C' })
    await setRecommendationStatus(rec.id, 'added-to-wishlist')
    const [reloaded] = await getRecommendationsForRecipient('r2')
    expect(reloaded?.status).toBe('added-to-wishlist')
  })
})

describe('deleteRecommendation', () => {
  it('removes it from the recipient list', async () => {
    const rec = await sendRecommendation({ senderId: 's4', senderUsername: 's4', recipientId: 'r3', bottleName: 'Bottle D' })
    await deleteRecommendation(rec.id)
    expect(await getRecommendationsForRecipient('r3')).toEqual([])
  })
})
