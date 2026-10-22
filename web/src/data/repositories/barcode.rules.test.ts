/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const RULES_PATH = resolve(__dirname, '../../../../firestore.rules')

let testEnv: RulesTestEnvironment

const UID_A = 'user-a'
const UID_B = 'user-b'
const GTIN = '0080244009236'

function confirmation(overrides: Record<string, unknown> = {}) {
  return {
    gtin13: GTIN,
    name: 'Example Straight Bourbon',
    distillery: 'Example Distillery',
    sizeMl: 750,
    proof: null,
    proofVaries: true,
    upcSharedAcrossVariants: true,
    origin: 'ai-claude',
    confirmedAt: serverTimestamp(),
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
      await setDoc(doc(ctx.firestore(), 'upcMappings', GTIN), { name: 'Verified', status: 'verified' })
    })
  })

  it('a signed-in user can read a verified mapping', async () => {
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(UID_A).firestore(), 'upcMappings', GTIN)))
  })

  it('an unauthenticated visitor cannot read mappings', async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'upcMappings', GTIN)))
  })

  it('no client can create, overwrite, or delete a mapping', async () => {
    const db = testEnv.authenticatedContext(UID_A).firestore()
    await assertFails(setDoc(doc(db, 'upcMappings', '0012345000065'), { name: 'Mine', status: 'verified' }))
    await assertFails(setDoc(doc(db, 'upcMappings', GTIN), { name: 'Hijacked', status: 'verified' }))
    await assertFails(deleteDoc(doc(db, 'upcMappings', GTIN)))
  })
})

describe('upcConfirmations/{gtin13}/confirmedBy/{uid}', () => {
  const path = (uid: string, gtin = GTIN) => ['upcConfirmations', gtin, 'confirmedBy', uid] as const

  it('a user can save, read, update and delete their own confirmation', async () => {
    const db = testEnv.authenticatedContext(UID_A).firestore()
    await assertSucceeds(setDoc(doc(db, ...path(UID_A)), confirmation()))
    await assertSucceeds(getDoc(doc(db, ...path(UID_A))))
    await assertSucceeds(setDoc(doc(db, ...path(UID_A)), confirmation({ name: 'Corrected name', origin: 'manual', bottleId: 'b1' })))
    await assertSucceeds(deleteDoc(doc(db, ...path(UID_A))))
  })

  it("another user can neither read nor write someone else's confirmation", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), ...path(UID_A)), { ...confirmation(), confirmedAt: new Date() })
    })
    const db = testEnv.authenticatedContext(UID_B).firestore()
    await assertFails(getDoc(doc(db, ...path(UID_A))))
    await assertFails(setDoc(doc(db, ...path(UID_A)), confirmation()))
    await assertFails(deleteDoc(doc(db, ...path(UID_A))))
  })

  it('rejects batch, barrel, store-pick or price fields', async () => {
    const db = testEnv.authenticatedContext(UID_A).firestore()
    await assertFails(setDoc(doc(db, ...path(UID_A)), confirmation({ batch: 'C924' })))
    await assertFails(setDoc(doc(db, ...path(UID_A)), confirmation({ barrelNumber: '5521' })))
    await assertFails(setDoc(doc(db, ...path(UID_A)), confirmation({ storePick: 'Local Liquors' })))
    await assertFails(setDoc(doc(db, ...path(UID_A)), confirmation({ price: 59.99 })))
  })

  it('rejects a mismatched or malformed barcode key, a missing name, or an unknown origin', async () => {
    const db = testEnv.authenticatedContext(UID_A).firestore()
    await assertFails(setDoc(doc(db, ...path(UID_A)), confirmation({ gtin13: '0012345000065' })))
    await assertFails(setDoc(doc(db, ...path(UID_A, 'not-a-gtin')), confirmation({ gtin13: 'not-a-gtin' })))
    await assertFails(setDoc(doc(db, ...path(UID_A)), confirmation({ name: '' })))
    await assertFails(setDoc(doc(db, ...path(UID_A)), confirmation({ origin: 'admin' })))
    await assertFails(setDoc(doc(db, ...path(UID_A)), confirmation({ confirmedAt: new Date(0) })))
  })

  it('a user cannot promote their own confirmation by writing a status field', async () => {
    const db = testEnv.authenticatedContext(UID_A).firestore()
    await assertFails(setDoc(doc(db, ...path(UID_A)), confirmation({ status: 'verified' })))
  })
})
