import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { AppNotification, NotificationType } from '../types'

function now(): number {
  return Date.now()
}

const mockNotifications = new Map<string, AppNotification>()

function mockGenerateId(): string {
  return `mock-notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// A cached, single seeding promise every exported function awaits before
// touching the mock store — see the identical comment in
// data/repositories/relationships.ts for why a fire-and-forget import on
// app mount isn't safe here.
let seedPromise: Promise<void> | undefined

function ensureSeeded(): Promise<void> {
  if (!isMockAuthEnabled()) return Promise.resolve()
  if (!seedPromise) {
    seedPromise = import('../mockSocialData').then(({ MOCK_NOTIFICATIONS }) => {
      for (const notification of MOCK_NOTIFICATIONS) mockNotifications.set(notification.id, notification)
    })
  }
  return seedPromise
}

export type NewNotificationInput = Omit<AppNotification, 'id' | 'read' | 'createdAt'>

// Called from the same place each triggering write already happens (accept
// a request, tag a friend, send a recommendation, react, comment) — never
// a separate background job. Keeps every notification tied to one of the
// six meaningful events this feature actually supports; nothing generic.
export async function createNotification(input: NewNotificationInput): Promise<void> {
  await ensureSeeded()
  const id = isMockAuthEnabled() ? mockGenerateId() : doc(collection(db, 'notifications')).id
  const notification: AppNotification = { ...input, id, read: false, createdAt: now() }
  if (isMockAuthEnabled()) {
    mockNotifications.set(id, notification)
    return
  }
  await setDoc(doc(db, 'notifications', id), notification)
}

export async function getNotifications(recipientId: string): Promise<AppNotification[]> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    return [...mockNotifications.values()].filter((n) => n.recipientId === recipientId).sort((a, b) => b.createdAt - a.createdAt)
  }
  const snap = await getDocs(query(collection(db, 'notifications'), where('recipientId', '==', recipientId)))
  return snap.docs.map((d) => d.data() as AppNotification).sort((a, b) => b.createdAt - a.createdAt)
}

export async function markNotificationRead(id: string): Promise<void> {
  await ensureSeeded()
  if (isMockAuthEnabled()) {
    const existing = mockNotifications.get(id)
    if (existing) mockNotifications.set(id, { ...existing, read: true })
    return
  }
  await updateDoc(doc(db, 'notifications', id), { read: true })
}

export function unreadCount(notifications: AppNotification[]): number {
  return notifications.filter((n) => !n.read).length
}

export type { NotificationType }
