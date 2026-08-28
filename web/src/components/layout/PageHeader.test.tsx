import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the eyebrow, title, and optional subtitle', () => {
    render(<PageHeader eyebrow="Home" title="Good evening." subtitle="What are you pouring tonight?" />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Good evening.' })).toBeInTheDocument()
    expect(screen.getByText('What are you pouring tonight?')).toBeInTheDocument()
  })

  it('omits the subtitle when none is given', () => {
    render(<PageHeader eyebrow="Home" title="Good evening." />)
    expect(screen.queryByText('What are you pouring tonight?')).not.toBeInTheDocument()
  })

  // Every page that renders PageHeader gets this — the shared-component
  // brand watermark replacing the old per-page pasted logo. Decorative
  // only: aria-hidden, no accessible name, never competes with content.
  it('renders a decorative brand watermark, not an accessible image', () => {
    render(<PageHeader eyebrow="Home" title="Good evening." />)
    const watermark = document.querySelector('img[aria-hidden="true"]')
    expect(watermark).toBeInTheDocument()
    expect(watermark).toHaveAttribute('alt', '')
  })
})
