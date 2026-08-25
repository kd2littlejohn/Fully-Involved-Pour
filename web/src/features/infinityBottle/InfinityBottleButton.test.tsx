import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InfinityBottleButton } from './InfinityBottleButton'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

describe('InfinityBottleButton', () => {
  it('navigates to the Infinity Bottle home screen', async () => {
    render(<InfinityBottleButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Infinity Bottle' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity')
  })
})
