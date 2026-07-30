import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UsernameClaim } from './UsernameClaim'

const mockClaimUsername = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ claimUsername: mockClaimUsername }),
}))

describe('UsernameClaim', () => {
  it('shows the claim form when no username is set', async () => {
    render(<UsernameClaim />)
    await userEvent.type(screen.getByLabelText('Claim a username'), 'whiskeywanderer')
    await userEvent.click(screen.getByRole('button', { name: 'Claim' }))
    expect(mockClaimUsername).toHaveBeenCalledWith('whiskeywanderer')
  })

  it('shows the handle once a username is already claimed', () => {
    render(<UsernameClaim current="whiskeywanderer" />)
    expect(screen.getByText('@whiskeywanderer')).toBeInTheDocument()
    expect(screen.queryByLabelText('Claim a username')).not.toBeInTheDocument()
  })
})
