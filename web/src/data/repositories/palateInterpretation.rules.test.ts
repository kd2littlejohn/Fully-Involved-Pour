/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const RULES_PATH = resolve(__dirname, '../../../../firestore.rules')

let testEnv: RulesTestEnvironment

const UID_A = 'user-a'
const UID_B = 'user-b'

function interpretationDoc(overrides: Record<string, unknown> = {}) {
  return {
    text: "You've been leaning into Bourbon lately.",
    profileHash: 'abc123',
    generatedAt: Date.now(),
    ...overrides,
  }
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'fip-rules-test-palate-interpretation',
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

describe('palateInterpretations/{uid}', () => {
  it('a signed-in user can create their own interpretation', async () => {
    const user = testEnv.authenticatedContext(UID_A)
    await assertSucceeds(setDoc(doc(user.firestore(), 'palateInterpretations', UID_A), interpretationDoc()))
  })

  it('a signed-in user can regenerate (overwrite) their own interpretation — unlike fipGuides, this is not create-only', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'palateInterpretations', UID_A), interpretationDoc())
    })
    const user = testEnv.authenticatedContext(UID_A)
    await assertSucceeds(setDoc(doc(user.firestore(), 'palateInterpretations', UID_A), interpretationDoc({ text: 'Updated.' })))
  })

  it('a signed-in user can read their own interpretation', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'palateInterpretations', UID_A), interpretationDoc())
    })
    const user = testEnv.authenticatedContext(UID_A)
    await assertSucceeds(getDoc(doc(user.firestore(), 'palateInterpretations', UID_A)))
  })

  it('a user cannot read another user\'s interpretation', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'palateInterpretations', UID_A), interpretationDoc())
    })
    const other = testEnv.authenticatedContext(UID_B)
    await assertFails(getDoc(doc(other.firestore(), 'palateInterpretations', UID_A)))
  })

  it('a user cannot write another user\'s interpretation', async () => {
    const other = testEnv.authenticatedContext(UID_B)
    await assertFails(setDoc(doc(other.firestore(), 'palateInterpretations', UID_A), interpretationDoc()))
  })

  it('an unauthenticated visitor can neither read nor write', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'palateInterpretations', UID_A), interpretationDoc())
    })
    const anon = testEnv.unauthenticatedContext()
    await assertFails(getDoc(doc(anon.firestore(), 'palateInterpretations', UID_A)))
    await assertFails(setDoc(doc(anon.firestore(), 'palateInterpretations', UID_A), interpretationDoc()))
  })

  it('a user can delete their own interpretation', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'palateInterpretations', UID_A), interpretationDoc())
    })
    const user = testEnv.authenticatedContext(UID_A)
    await assertSucceeds(deleteDoc(doc(user.firestore(), 'palateInterpretations', UID_A)))
  })
})
