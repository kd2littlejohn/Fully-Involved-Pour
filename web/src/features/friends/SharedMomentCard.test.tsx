import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SharedMomentCard } from './SharedMomentCard'
import type { SharedMoment } from '../../data/types'

const mockAcceptSharedMoment = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'me' }, loading: false }),
}))

vi.mock('../../data/repositories/sharedMoments', () => ({
  acceptSharedMoment: (...args: unknown[]) => mockAcceptSharedMoment(...args),
}))

vi.mock('./ReactionBar', () => ({
  ReactionBar: () => <div>Reaction bar</div>,
}))

vi.mock('./CommentsList', () => ({
  CommentsList: () => <div>Comments list</div>,
}))

beforeEach(() => {
  mockAcceptSharedMoment.mockClear()
  localStorage.clear()
})

const moment: SharedMoment = {
  id: 'moment-1',
  storyId: 'p1',
  ownerId: 'friend-1',
  ownerUsername: 'kevin',
  ownerDisplayName: 'Kevin Littlejohn',
  participantIds: ['me'],
  acceptedParticipantIds: ['me'],
  snapshot: { bottleName: 'Stagg Batch 23', distillery: 'Buffalo Trace', rating: 8.7, date: '2026-01-01' },
  createdAt: 1,
}

describe('SharedMomentCard', () => {
  it('removing from view hides it locally without deleting the owner’s original', async () => {
    const onChange = vi.fn()
    render(<SharedMomentCard moment={moment} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Shared story actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove from my view' }))

    expect(localStorage.getItem('fip:hiddenSharedMoments:me')).toBe(JSON.stringify(['moment-1']))
    expect(onChange).toHaveBeenCalled()
  })

  it('does not require confirmation — a local, non-destructive hide', async () => {
    render(<SharedMomentCard moment={moment} />)
    await userEvent.click(screen.getByRole('button', { name: 'Shared story actions' }))
    expect(screen.getByRole('menuitem', { name: 'Remove from my view' })).toBeInTheDocument()
    expect(screen.queryByText(/cannot be undone/)).not.toBeInTheDocument()
  })
})
