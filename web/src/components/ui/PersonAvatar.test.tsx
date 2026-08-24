import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PersonAvatar } from './PersonAvatar'

describe('PersonAvatar', () => {
  it('shows the photo when one exists', () => {
    const { container } = render(<PersonAvatar name="Marcus" photoUrl="https://example.com/marcus.jpg" />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://example.com/marcus.jpg')
  })

  it('falls back to initials when there is no photo', () => {
    const { container } = render(<PersonAvatar name="Marcus Chen" />)
    expect(screen.getByText('MC')).toBeInTheDocument()
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('renders as a plain, non-interactive element when no onClick is given', () => {
    render(<PersonAvatar name="Marcus" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders as a tappable button and fires onClick when given one', async () => {
    const onClick = vi.fn()
    render(<PersonAvatar name="Marcus" onClick={onClick} />)

    await userEvent.click(screen.getByRole('button', { name: /Marcus/ }))

    expect(onClick).toHaveBeenCalled()
  })
})
