import type { BlindGuidanceLevel, BlindTastingResponse } from '../../data/types'
import { NOSE_DETAILS, type NoseBroadFlavor } from './vocabulary'

export type SubStep = 'nose-broad' | 'nose-detail' | 'reaction' | 'liked' | 'finish'

// "Guide Me" asks every question; "Keep It Casual" keeps only the ones that
// actually distinguish one pour from another (what stands out, first
// reaction, finish); "I've Got This" is just the reaction, matching Quick
// Pour's own pace for tasters who don't want hand-holding.
const STEPS_BY_LEVEL: Record<BlindGuidanceLevel, SubStep[]> = {
  guide: ['nose-broad', 'nose-detail', 'reaction', 'liked', 'finish'],
  casual: ['nose-broad', 'reaction', 'finish'],
  minimal: ['reaction'],
}

// 'nose-detail' only applies once a broad flavor with a defined second level
// has been picked (see NOSE_DETAILS) — Oaky/Rich/Light/Nutty/Not Sure skip
// straight past it, so nobody is asked to narrow down a category that has
// nothing more specific to offer.
export function activeSubStepsFor(level: BlindGuidanceLevel, noseBroad: string | undefined): SubStep[] {
  const steps = STEPS_BY_LEVEL[level]
  if (noseBroad && NOSE_DETAILS[noseBroad as NoseBroadFlavor]) return steps
  return steps.filter((step) => step !== 'nose-detail')
}

export function isSubStepAnswered(step: SubStep, response: BlindTastingResponse | undefined): boolean {
  switch (step) {
    case 'nose-broad':
      return response?.noseBroad != null
    case 'nose-detail':
      return response?.noseDetail != null
    case 'reaction':
      return response?.reaction != null
    case 'liked':
      return response?.likedCharacteristic != null
    case 'finish':
      return response?.finishImpression != null
  }
}

export function promptFor(step: SubStep, label: string, noseBroad?: string): string {
  switch (step) {
    case 'nose-broad':
      return `Give Pour ${label} a smell. What stands out?`
    case 'nose-detail':
      return `Any more specific ${(noseBroad ?? '').toLowerCase()} notes?`
    case 'reaction':
      return 'Take a sip. What’s your first reaction?'
    case 'liked':
      return 'What do you like most about it?'
    case 'finish':
      return 'After you swallow, what happens?'
  }
}
