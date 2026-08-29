import { describe, expect, it } from 'vitest'
import {
  blankInstance,
  instanceFromLegacyFields,
  instanceLabel,
  openInstances,
  resolveActiveInstanceId,
  rollupFromInstances,
  sealedInstancesInOrder,
  summarizeInstanceStatuses,
} from './selectors'
import type { Bottle, BottleInstance } from '../../data/types'

function instance(overrides: Partial<BottleInstance> & Pick<BottleInstance, 'id' | 'status'>): BottleInstance {
  return { createdAt: 1, ...overrides }
}

describe('instanceLabel', () => {
  it('defaults to "Bottle #N" by position', () => {
    expect(instanceLabel(instance({ id: 'a', status: 'sealed' }), 0)).toBe('Bottle #1')
    expect(instanceLabel(instance({ id: 'b', status: 'sealed' }), 2)).toBe('Bottle #3')
  })

  it('appends an optional label', () => {
    expect(instanceLabel(instance({ id: 'a', status: 'sealed', label: 'Total Wine' }), 1)).toBe('Bottle #2 — Total Wine')
  })

  it('ignores a blank/whitespace-only label', () => {
    expect(instanceLabel(instance({ id: 'a', status: 'sealed', label: '   ' }), 0)).toBe('Bottle #1')
  })
})

describe('summarizeInstanceStatuses', () => {
  it('shows one open and two sealed in fixed order', () => {
    const instances = [instance({ id: 'a', status: 'open' }), instance({ id: 'b', status: 'sealed' }), instance({ id: 'c', status: 'sealed' })]
    expect(summarizeInstanceStatuses(instances)).toBe('1 Open · 2 Sealed')
  })

  it('shows all sealed with no other counts', () => {
    const instances = [instance({ id: 'a', status: 'sealed' }), instance({ id: 'b', status: 'sealed' }), instance({ id: 'c', status: 'sealed' })]
    expect(summarizeInstanceStatuses(instances)).toBe('3 Sealed')
  })

  it('includes finished alongside open and sealed', () => {
    const instances = [instance({ id: 'a', status: 'open' }), instance({ id: 'b', status: 'sealed' }), instance({ id: 'c', status: 'finished' })]
    expect(summarizeInstanceStatuses(instances)).toBe('1 Open · 1 Sealed · 1 Finished')
  })
})

describe('openInstances / sealedInstancesInOrder', () => {
  it('filters by status', () => {
    const instances = [instance({ id: 'a', status: 'open' }), instance({ id: 'b', status: 'sealed' }), instance({ id: 'c', status: 'finished' })]
    expect(openInstances(instances).map((i) => i.id)).toEqual(['a'])
  })

  it('orders sealed instances oldest-first', () => {
    const instances = [
      instance({ id: 'a', status: 'sealed', createdAt: 3 }),
      instance({ id: 'b', status: 'sealed', createdAt: 1 }),
      instance({ id: 'c', status: 'sealed', createdAt: 2 }),
    ]
    expect(sealedInstancesInOrder(instances).map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('resolveActiveInstanceId', () => {
  it('is undefined when nothing is open', () => {
    const instances = [instance({ id: 'a', status: 'sealed' })]
    expect(resolveActiveInstanceId(instances, undefined)).toBeUndefined()
    expect(resolveActiveInstanceId(instances, 'a')).toBeUndefined()
  })

  it('keeps the preferred id when it is still open', () => {
    const instances = [instance({ id: 'a', status: 'open' }), instance({ id: 'b', status: 'open' })]
    expect(resolveActiveInstanceId(instances, 'b')).toBe('b')
  })

  it('falls back to the most recently opened when the preferred one no longer qualifies', () => {
    const instances = [
      instance({ id: 'a', status: 'finished' }),
      instance({ id: 'b', status: 'open', openedDate: '2026-01-01' }),
      instance({ id: 'c', status: 'open', openedDate: '2026-02-01' }),
    ]
    expect(resolveActiveInstanceId(instances, 'a')).toBe('c')
  })
})

describe('rollupFromInstances', () => {
  it('status is open if any instance is open', () => {
    const instances = [instance({ id: 'a', status: 'finished' }), instance({ id: 'b', status: 'open' })]
    expect(rollupFromInstances(instances, 'b').status).toBe('open')
  })

  it('status is sealed when none are open but some are sealed', () => {
    const instances = [instance({ id: 'a', status: 'finished' }), instance({ id: 'b', status: 'sealed' })]
    expect(rollupFromInstances(instances, undefined).status).toBe('sealed')
  })

  it('status is finished only when every instance is finished', () => {
    const instances = [instance({ id: 'a', status: 'finished' }), instance({ id: 'b', status: 'finished' })]
    expect(rollupFromInstances(instances, undefined).status).toBe('finished')
  })

  it('quantity is the instance count', () => {
    const instances = [instance({ id: 'a', status: 'sealed' }), instance({ id: 'b', status: 'sealed' })]
    expect(rollupFromInstances(instances, undefined).quantity).toBe(2)
  })

  it('mirrors the active instance’s ownership facts', () => {
    const instances = [
      instance({ id: 'a', status: 'sealed', price: 40, storeLocation: 'ABC' }),
      instance({ id: 'b', status: 'open', price: 55, storeLocation: 'Total Wine' }),
    ]
    const rollup = rollupFromInstances(instances, 'b')
    expect(rollup.price).toBe(55)
    expect(rollup.storeLocation).toBe('Total Wine')
  })

  it('falls back to instance 1 when there is no active instance', () => {
    const instances = [instance({ id: 'a', status: 'sealed', price: 40 }), instance({ id: 'b', status: 'sealed', price: 55 })]
    expect(rollupFromInstances(instances, undefined).price).toBe(40)
  })
})

describe('instanceFromLegacyFields', () => {
  it('carries the bottle’s flat ownership fields onto the new instance', () => {
    const bottle: Bottle = {
      id: 'bt1',
      name: 'Eagle Rare',
      status: 'open',
      purchaseDate: '2026-08-15',
      price: 39.99,
      storeLocation: 'ABC Store',
      openedDate: '2026-08-18',
      fillLevel: 'half',
    }
    const result = instanceFromLegacyFields(bottle, 'new-id', 123)
    expect(result).toEqual({
      id: 'new-id',
      createdAt: 123,
      status: 'open',
      purchaseDate: '2026-08-15',
      price: 39.99,
      storeLocation: 'ABC Store',
      openedDate: '2026-08-18',
      finishedDate: undefined,
      fillLevel: 'half',
    })
  })

  it('falls back to sealed for a non-physical status like wishlist', () => {
    const bottle: Bottle = { id: 'bt1', name: 'Wishlist Pick', status: 'wishlist' }
    expect(instanceFromLegacyFields(bottle, 'new-id', 1).status).toBe('sealed')
  })
})

describe('blankInstance', () => {
  it('creates a fresh sealed instance with no other fields', () => {
    expect(blankInstance('id1', 500)).toEqual({ id: 'id1', createdAt: 500, status: 'sealed' })
  })
})
