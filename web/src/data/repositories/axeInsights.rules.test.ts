/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

// users/{uid}/axeInsights/current is server-owned (functions/axeInsights.js
// writes it with the Admin SDK). No client may read or write it, not even
// its owner, so an insight can never be forged or edited from a browser.

const RULES_PATH = resolve(__dirname, '../../../../firestore.rules')
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'fip-rules-test-axe-insights',
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/alice'), { bottles: [], pours: [] })
    await setDoc(doc(context.firestore(), 'users/alice/axeInsights/current'), { state: { generation: 3 }, updatedAt: 1 })
  })
})

describe('users/{uid}/axeInsights', () => {
  it('denies the owner direct reads and every kind of write', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const ref = doc(alice, 'users/alice/axeInsights/current')
    await assertFails(getDoc(ref))
    await assertFails(setDoc(ref, { state: { generation: 99 } }))
    await assertFails(updateDoc(ref, { 'state.generation': 99 }))
    await assertFails(deleteDoc(ref))
    await assertFails(setDoc(doc(alice, 'users/alice/axeInsights/other'), { forged: true }))
  })

  it('denies other users and signed-out visitors', async () => {
    const bob = testEnv.authenticatedContext('bob').firestore()
    await assertFails(getDoc(doc(bob, 'users/alice/axeInsights/current')))
    await assertFails(setDoc(doc(bob, 'users/alice/axeInsights/current'), { state: {} }))
    const anon = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(anon, 'users/alice/axeInsights/current')))
  })

  it('leaves the owner’s own user document exactly as accessible as before', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    await assertSucceeds(getDoc(doc(alice, 'users/alice')))
    await assertSucceeds(setDoc(doc(alice, 'users/alice'), { pours: [] }, { merge: true }))
  })
})
