/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const RULES_PATH = resolve(__dirname, '../../../../firestore.rules')

let testEnv: RulesTestEnvironment

const UID_A = 'user-a'
const UID_B = 'user-b'
const GUIDE_KEY = 'eagle-rare-10-year__buffalo-trace-distillery'

function guideDoc(overrides: Record<string, unknown> = {}) {
  return {
    bottleKey: GUIDE_KEY,
    whySpecial: '10-year age statement with a classic Buffalo Trace profile.',
    bestFor: 'Bourbon drinkers who enjoy caramel, fruit, and oak.',
    value: 'Strong near MSRP.',
    buyIf: 'You want a balanced, approachable age-stated bourbon.',
    skipIf: 'You prefer high proof or heavily finished whiskey.',
    verdict: 'Worth buying near retail.',
    story: 'A long-running favorite in the Buffalo Trace lineup.',
    availability: 'Limited',
    flavorProfile: ['Caramel', 'Vanilla', 'Cherry', 'Oak', 'Baking Spice'],
    intensity: 0.6,
    generatedAt: Date.now(),
    ...overrides,
  }
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'fip-rules-test-guide',
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

describe('fipGuides/{bottleKey}', () => {
  it('a signed-in user can create a new guide', async () => {
    const user = testEnv.authenticatedContext(UID_A)
    await assertSucceeds(setDoc(doc(user.firestore(), 'fipGuides', GUIDE_KEY), guideDoc()))
  })

  it('an unauthenticated visitor cannot create a guide', async () => {
    const anon = testEnv.unauthenticatedContext()
    await assertFails(setDoc(doc(anon.firestore(), 'fipGuides', GUIDE_KEY), guideDoc()))
  })

  it('any signed-in user can read an existing guide', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'fipGuides', GUIDE_KEY), guideDoc())
    })
    const user = testEnv.authenticatedContext(UID_B)
    await assertSucceeds(getDoc(doc(user.firestore(), 'fipGuides', GUIDE_KEY)))
  })

  it('an unauthenticated visitor cannot read a guide', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'fipGuides', GUIDE_KEY), guideDoc())
    })
    const anon = testEnv.unauthenticatedContext()
    await assertFails(getDoc(doc(anon.firestore(), 'fipGuides', GUIDE_KEY)))
  })

  it('a cached guide can never be overwritten, even by the user who created it', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'fipGuides', GUIDE_KEY), guideDoc())
    })
    const user = testEnv.authenticatedContext(UID_A)
    await assertFails(updateDoc(doc(user.firestore(), 'fipGuides', GUIDE_KEY), { verdict: 'Changed my mind.' }))
  })

  it('a cached guide can never be deleted', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'fipGuides', GUIDE_KEY), guideDoc())
    })
    const user = testEnv.authenticatedContext(UID_A)
    await assertFails(deleteDoc(doc(user.firestore(), 'fipGuides', GUIDE_KEY)))
  })
})
