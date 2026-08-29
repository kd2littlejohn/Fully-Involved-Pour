import type { Bottle, BottleInstance, BottleStatus, FillLevel } from '../../data/types'

export function instanceLabel(instance: BottleInstance, index: number): string {
  const base = `Bottle #${index + 1}`
  return instance.label?.trim() ? `${base} — ${instance.label.trim()}` : base
}

type SimpleStatus = 'open' | 'sealed' | 'finished'

const STATUS_SUMMARY_LABEL: Record<SimpleStatus, string> = {
  open: 'Open',
  sealed: 'Sealed',
  finished: 'Finished',
}

function toSimpleStatus(status: BottleStatus): SimpleStatus | undefined {
  return status === 'open' || status === 'sealed' || status === 'finished' ? status : undefined
}

// "1 Open · 2 Sealed" / "3 Sealed" / "1 Open · 1 Sealed · 1 Finished" —
// fixed Open/Sealed/Finished order, omitting any status with zero instances.
export function summarizeInstanceStatuses(instances: BottleInstance[]): string {
  const counts: Record<SimpleStatus, number> = { open: 0, sealed: 0, finished: 0 }
  for (const instance of instances) {
    const status = toSimpleStatus(instance.status)
    if (status) counts[status] += 1
  }
  return (['open', 'sealed', 'finished'] as const)
    .filter((status) => counts[status] > 0)
    .map((status) => `${counts[status]} ${STATUS_SUMMARY_LABEL[status]}`)
    .join(' · ')
}

export function openInstances(instances: BottleInstance[]): BottleInstance[] {
  return instances.filter((i) => i.status === 'open')
}

export function sealedInstancesInOrder(instances: BottleInstance[]): BottleInstance[] {
  return instances.filter((i) => i.status === 'sealed').sort((a, b) => a.createdAt - b.createdAt)
}

// activeInstanceId must only ever reference an open instance — every
// instance mutation recomputes it from scratch rather than trusting stored
// state, so a finish/delete/reseal can never leave it dangling on a
// non-open instance. More than one instance may legitimately be open at
// once (the user confirmed opening a second); this just picks the most
// recently opened as the default "active" one — pour logging still
// resolves and asks whenever more than one is actually open.
export function resolveActiveInstanceId(instances: BottleInstance[], preferredId: string | undefined): string | undefined {
  const open = openInstances(instances)
  if (open.length === 0) return undefined
  if (preferredId && open.some((i) => i.id === preferredId)) return preferredId
  return [...open].sort((a, b) => (b.openedDate ?? '').localeCompare(a.openedDate ?? '') || b.createdAt - a.createdAt)[0]?.id
}

export interface InstanceRollup {
  status: BottleStatus
  quantity: number
  purchaseDate?: string
  price?: number
  storeLocation?: string
  openedDate?: string
  finishedDate?: string
  fillLevel?: FillLevel
}

// Top-level Bottle ownership fields are a read-only compatibility rollup
// once `instances` exists — every mutator that touches instances[]
// recomputes these afterward rather than ever letting a caller set them
// directly, so old call sites (My Bar filters, journey stage,
// Discover/Friends previews) keep working without becoming
// instance-aware, and a stray top-level edit can never silently clobber a
// specific instance's own history. Mirrors the active instance when one
// exists, else instance 1, purely for a sane display fallback.
export function rollupFromInstances(instances: BottleInstance[], activeInstanceId: string | undefined): InstanceRollup {
  const active = instances.find((i) => i.id === activeInstanceId) ?? instances[0]
  const status: BottleStatus = instances.some((i) => i.status === 'open')
    ? 'open'
    : instances.some((i) => i.status === 'sealed')
      ? 'sealed'
      : 'finished'
  return {
    status,
    quantity: instances.length,
    purchaseDate: active?.purchaseDate,
    price: active?.price,
    storeLocation: active?.storeLocation,
    openedDate: active?.openedDate,
    finishedDate: active?.finishedDate,
    fillLevel: active?.fillLevel,
  }
}

// Converts a bottle's current flat ownership fields into what becomes
// Instance 1 the moment quantity is first raised above 1 — "inherit, don't
// re-enter." Never called once `instances` already exists.
export function instanceFromLegacyFields(bottle: Bottle, id: string, createdAt: number): BottleInstance {
  return {
    id,
    createdAt,
    status: toSimpleStatus(bottle.status) ?? 'sealed',
    purchaseDate: bottle.purchaseDate,
    price: bottle.price,
    storeLocation: bottle.storeLocation,
    openedDate: bottle.openedDate,
    finishedDate: bottle.finishedDate,
    fillLevel: bottle.fillLevel,
  }
}

export function blankInstance(id: string, createdAt: number): BottleInstance {
  return { id, createdAt, status: 'sealed' }
}
