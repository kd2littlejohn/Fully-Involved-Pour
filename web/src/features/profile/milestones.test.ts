import { describe, expect, it } from 'vitest'
import { getRecentMilestones } from './milestones'
import type { Bottle, BlindRoom, Pour } from '../../data/types'

function pour(id: string, bottleId: string, date: string, rating: number): Pour {
  return { id, bottleId, date, rating, fip: { nose: 2, palate: 3, finish: 2, complexity: 1, value: 1, total: rating, noseAromas: [], palateFlavors: [] } }
}

describe('getRecentMilestones', () => {
  it('returns nothing when there is no genuine event yet', () => {
    expect(getRecentMilestones([], [])).toEqual([])
  })

  it('surfaces a Bottle Kill with the real finished date', () => {
    const bottles: Bottle[] = [{ id: 'b1', name: 'Eagle Rare', status: 'finished', finishedDate: '2026-02-10' }]
    const milestones = getRecentMilestones(bottles, [])
    expect(milestones).toHaveLength(1)
    expect(milestones[0]).toMatchObject({ label: 'Bottle Kill', detail: 'Eagle Rare', date: '2026-02-10' })
  })

  it('surfaces a Hall of Fame Pour only for a pour that actually scored 9.5+', () => {
    const bottles: Bottle[] = [{ id: 'b1', name: 'Weller Full Proof', status: 'open' }]
    const pours: Pour[] = [pour('p1', 'b1', '2026-01-05', 9.6), pour('p2', 'b1', '2026-01-06', 8.0)]
    const milestones = getRecentMilestones(bottles, pours)
    expect(milestones).toHaveLength(1)
    expect(milestones[0]).toMatchObject({ label: 'Hall of Fame Pour', date: '2026-01-05' })
  })

  it('surfaces only the highest Pour Story count threshold actually reached, dated to the real pour that crossed it', () => {
    const bottles: Bottle[] = [{ id: 'b1', name: 'Eagle Rare', status: 'open' }]
    const pours: Pour[] = Array.from({ length: 10 }, (_, i) => pour(`p${i}`, 'b1', `2026-01-${String(i + 1).padStart(2, '0')}`, 7))
    const milestones = getRecentMilestones(bottles, pours)
    const pourMilestone = milestones.find((m) => m.label === '10 Pour Stories')
    expect(pourMilestone).toBeDefined()
    expect(pourMilestone!.date).toBe('2026-01-10')
    expect(milestones.some((m) => m.label === '25 Pour Stories')).toBe(false)
  })

  it('surfaces First Blind Completed from real room data, never inventing a date', () => {
    const room: BlindRoom = {
      id: 'r1',
      code: 'ABC123',
      name: 'Friday Flight',
      hostUid: 'u1',
      hostUsername: 'kevin',
      sessionType: 'solo',
      knowledgeMode: 'single',
      pourCount: 2,
      state: 'completed',
      createdAt: 1,
      completedAt: 1700000000000,
      participantCount: 1,
    }
    const milestones = getRecentMilestones([], [], [{ room }])
    expect(milestones).toHaveLength(1)
    expect(milestones[0]).toMatchObject({ label: 'First Blind Completed', detail: 'Friday Flight' })
  })

  it('sorts every real milestone most-recent-first', () => {
    const bottles: Bottle[] = [
      { id: 'b1', name: 'Old Kill', status: 'finished', finishedDate: '2020-01-01' },
      { id: 'b2', name: 'New Kill', status: 'finished', finishedDate: '2026-01-01' },
    ]
    const milestones = getRecentMilestones(bottles, [])
    expect(milestones.map((m) => m.detail)).toEqual(['New Kill', 'Old Kill'])
  })
})
