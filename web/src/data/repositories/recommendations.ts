import { collection, deleteDoc, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { Recommendation, RecommendationStatus } from '../types'

function now(): number {
  return Date.now()
}

const mockRecommendations = new Map<string, Recommendation>()

function mockGenerateId(): string {
  return `mock-rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// A cached, single seeding promise every exported function awaits before
// touching the mock store — see the identical comment in
// data/repositories/relationships.ts for why a fire-and-forget import on
// app mount isn't safe here.
let seedPromise: Promise<void> | undefined

function ensureSeeded(): Promise<void> {
  if (!isMockAuthEnabled()) return Promise.resolve()
  if (!seedPromise) {
    seedPromise = import('../mockSocialData').then(({ MOCK_RECOMMENDATIONS }) => {
      for (const recommendation of MOCK_RECOMMENDATIONS) mockRecommendations.set(recommendation.id, recommendation)
    })
  }
  return seedPromise
}

export type NewRecommendationInput = Omit<Recommendation, 'id' | 'status' | 'createdAt'>

export async function sendRecommendation(input: NewRecommendationInput): Promise<Recommendation> {
  await ensureSeeded()
  const id = isMockAuthEnabled() ? mockGenerateId() : doc(collection(db, 'recommendations')).id
  const recommendation: Recommendation = { ...input, id, status: 'pending', createdAt: now() }
  if (isMockAuthEnabled()) {
    mockRecommendations.set(id, recommendation)
    return recommendation
  }
  await setDoc(doc(db, 'recommendations', id), recommendation)
  return recommendation
}

// A single equality filter (recipientId) — same "no composite index"
// discipline as relationships.ts. Newest first, computed client-side.
export async function getRecommendationsForRecipient(recipientId: string): Promise<Recommendation[]> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    return [...mockRecommendations.values()].filter((r) => r.recipientId === recipientId).sort((a, b) => b.createdAt - a.createdAt)
  }
  const snap = await getDocs(query(collection(db, 'recommendations'), where('recipientId', '==', recipientId)))
  return snap.docs.map((d) => d.data() as Recommendation).sort((a, b) => b.createdAt - a.createdAt)
}

export async function setRecommendationStatus(id: string, status: RecommendationStatus): Promise<void> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    const existing = mockRecommendations.get(id)
    if (existing) mockRecommendations.set(id, { ...existing, status })
    return
  }
  await updateDoc(doc(db, 'recommendations', id), { status })
}

export async function deleteRecommendation(id: string): Promise<void> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    mockRecommendations.delete(id)
    return
  }
  await deleteDoc(doc(db, 'recommendations', id))
}
