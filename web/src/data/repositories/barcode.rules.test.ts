/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const RULES_PATH = resolve(__dirname, '../../../../firestore.rules')

let testEnv: RulesTestEnvironment

const UID_A = 'user-a'
const UID_B = 'user-b'
const GTIN = '0080244009236'

function entry(overrides: Record<string, unknown> = {}) {
  return {
    gtin13: GTIN,
    bottle: {
      name: 'Example Barrel Proof',
      distillery: 'Example Distillery',
      sizeMl: 750,
      proof: 124.6,
      proofVaries: false,
      releaseKind: 'barrel-proof-batch',
      batch: 'C924',
    },
    origin: 'axe-label',
    candidateId: null,
    bottleId: 'b1',
    submitForReview: false,
    createdAt: serverTimestamp(),
    ...overrides,
  }
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'fip-rules-test-barcode',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe('upcMappings/{gtin13}', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'upcMappings', GTIN), { status: 'verified', candidates: [{ id: 'std', name: 'Verified' }] })
    })
  })

  it('a signed-in user can read the verified candidates', async () => {
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(UID_A).firestore(), 'upcMappings', GTIN)))
  })

  it('an unauthenticated visitor cannot read them', async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'upcMappings', GTIN)))
  })

  it('no client can add, change or delete a verified candidate', async () => {
    const db = testEnv.authenticatedContext(UID_A).firestore()
    await assertFails(setDoc(doc(db, 'upcMappings', '0012345000065'), { status: 'verified', candidates: [] }))
    await assertFails(setDoc(doc(db, 'upcMappings', GTIN), { status: 'verified', candidates: [{ id: 'x', name: 'Hijacked' }] }))
    await assertFails(deleteDoc(doc(db, 'upcMappings', GTIN)))
  })
})

describe('upcPending/{gtin13}', () => {
  it('is server-only: no client can read the review queue or stored AI suggestions', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'upcPending', GTIN), { lookups: 3 })
    })
    const db = testEnv.authenticatedContext(UID_A).firestore()
    await assertFails(getDoc(doc(db, 'upcPending', GTIN)))
    await assertFails(setDoc(doc(db, 'upcPending', GTIN), { lookups: 0 }))
  })
})

describe('users/{uid}/barcodeEntries/{entryId}', () => {
  const path = (uid: string, id = 'e1') => ['users', uid, 'barcodeEntries', id] as const

  it('a user can save, read, update and delete their own entries, several per barcode', async () => {
    const db = testEnv.authenticatedContext(UID_A).firestore()
    await assertSucceeds(setDoc(doc(db, ...path(UID_A, 'e1')), entry()))
    await assertSucceeds(
      setDoc(doc(db, ...path(UID_A, 'e2')), entry({ bottle: { name: 'Example Single Barrel', releaseKind: 'store-pick', storePick: 'Store A', barrel: '77' } })),
    )
    await assertSucceeds(getDoc(doc(db, ...path(UID_A, 'e1'))))
    const saved = await getDoc(doc(db, ...path(UID_A, 'e1')))
    await assertSucceeds(setDoc(doc(db, ...path(UID_A, 'e1')), { ...entry({ submitForReview: true }), createdAt: saved.data()?.createdAt }))
    await assertSucceeds(deleteDoc(doc(db, ...path(UID_A, 'e2'))))
  })

  it("another user can neither read nor write someone else's entries", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), ...path(UID_A)), { ...entry(), createdAt: Timestamp.now() })
    })
    const db = testEnv.authenticatedContext(UID_B).firestore()
    await assertFails(getDoc(doc(db, ...path(UID_A))))
    await assertFails(setDoc(doc(db, ...path(UID_A, 'e9')), entry()))
    await assertFails(deleteDoc(doc(db, ...path(UID_A))))
  })

  it("no client can list other users' submissions across the collection group", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), ...path(UID_A)), { ...entry({ submitForReview: true }), createdAt: Timestamp.now() })
    })
    const db = testEnv.authenticatedContext(UID_B).firestore()
    await assertFails(getDocs(query(collectionGroup(db, 'barcodeEntries'), where('submitForReview', '==', true))))
  })

  it('rejects price, unknown fields and unknown release kinds', async () => {
    const db = testEnv.authenticatedContext(UID_A).firestore()
    await assertFails(setDoc(doc(db, ...path(UID_A)), entry({ bottle: { name: 'X', price: 59.99 } })))
    await assertFails(setDoc(doc(db, ...path(UID_A)), entry({ status: 'verified' })))
    await assertFails(setDoc(doc(db, ...path(UID_A)), entry({ bottle: { name: 'X', releaseKind: 'mystery' } })))
  })

  it('rejects a malformed barcode, a missing name, an unknown origin or a back-dated entry', async () => {
    const db = testEnv.authenticatedContext(UID_A).firestore()
    await assertFails(setDoc(doc(db, ...path(UID_A)), entry({ gtin13: '36000291452' })))
    await assertFails(setDoc(doc(db, ...path(UID_A)), entry({ bottle: { name: '' } })))
    await assertFails(setDoc(doc(db, ...path(UID_A)), entry({ origin: 'admin' })))
    await assertFails(setDoc(doc(db, ...path(UID_A)), entry({ createdAt: Timestamp.fromMillis(0) })))
  })

  it('cannot rewrite when an entry was created', async () => {
    const db = testEnv.authenticatedContext(UID_A).firestore()
    await assertSucceeds(setDoc(doc(db, ...path(UID_A)), entry()))
    await assertFails(setDoc(doc(db, ...path(UID_A)), entry({ createdAt: Timestamp.fromMillis(0) })))
  })
})
