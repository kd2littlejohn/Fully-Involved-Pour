import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RarityDonutChart } from './RarityDonutChart'
import { rarityBreakdown } from '../../features/rarity/rarityBreakdown'
import type { Bottle } from '../../data/types'

function bottle(overrides: Partial<Bottle> & Pick<Bottle, 'id' | 'status'>): Bottle {
  return { name: 'Test Bottle', ...overrides }
}

const sampleBottles: Bottle[] = [
  bottle({ id: 'b1', status: 'open', rarity: 'rare', raritySource: 'manual' }),
  bottle({ id: 'b2', status: 'sealed', rarity: 'common', raritySource: 'manual' }),
  bottle({ id: 'b3', status: 'sealed' }),
]

function legend() {
  return within(screen.getByTestId('rarity-legend'))
}

describe('RarityDonutChart', () => {
  it('renders the empty-inventory state with no segments when total is 0', () => {
    const { rows, total } = rarityBreakdown([])
    render(<RarityDonutChart rows={rows} total={total} selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('No bottles yet.')).toBeInTheDocument()
    expect(document.querySelectorAll('circle[role="button"]')).toHaveLength(0)
  })

  it('shows the total physical bottle count in the center', () => {
    const { rows, total } = rarityBreakdown(sampleBottles)
    render(<RarityDonutChart rows={rows} total={total} selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('bottles')).toBeInTheDocument()
  })

  it('renders a legend row with count and percent for every level, including zero-count ones', () => {
    const { rows, total } = rarityBreakdown(sampleBottles)
    render(<RarityDonutChart rows={rows} total={total} selected={null} onSelect={vi.fn()} />)
    expect(legend().getByRole('button', { name: /Rare: 1 bottles, 33 percent/ })).toBeInTheDocument()
    expect(legend().getByRole('button', { name: /Unicorn: 0 bottles, 0 percent/ })).toBeInTheDocument()
  })

  it('clicking a legend row selects it and calls onSelect with that key', async () => {
    const { rows, total } = rarityBreakdown(sampleBottles)
    const onSelect = vi.fn()
    render(<RarityDonutChart rows={rows} total={total} selected={null} onSelect={onSelect} />)
    const user = userEvent.setup()
    await user.click(legend().getByRole('button', { name: /^Rare:/ }))
    expect(onSelect).toHaveBeenCalledWith('rare')
  })

  it('clicking the already-active legend row again clears the filter', async () => {
    const { rows, total } = rarityBreakdown(sampleBottles)
    const onSelect = vi.fn()
    render(<RarityDonutChart rows={rows} total={total} selected="rare" onSelect={onSelect} />)
    const user = userEvent.setup()
    await user.click(legend().getByRole('button', { name: /^Rare:/ }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('the active legend row shows aria-pressed="true", others false', () => {
    const { rows, total } = rarityBreakdown(sampleBottles)
    render(<RarityDonutChart rows={rows} total={total} selected="rare" onSelect={vi.fn()} />)
    expect(legend().getByRole('button', { name: /^Rare:/ })).toHaveAttribute('aria-pressed', 'true')
    expect(legend().getByRole('button', { name: /^Common:/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('"All Bottles" clears the filter', async () => {
    const { rows, total } = rarityBreakdown(sampleBottles)
    const onSelect = vi.fn()
    render(<RarityDonutChart rows={rows} total={total} selected="rare" onSelect={onSelect} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'All Bottles' }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('a chart segment (SVG circle) is independently keyboard-operable and toggles on Enter', async () => {
    const { rows, total } = rarityBreakdown(sampleBottles)
    const onSelect = vi.fn()
    render(<RarityDonutChart rows={rows} total={total} selected={null} onSelect={onSelect} />)
    const segment = document.querySelector('circle[aria-label^="Rare:"]') as HTMLElement
    expect(segment).toHaveAttribute('tabindex', '0')
    segment.focus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('rare')
  })

  it('clicking "Unclassified" selects it, whether its count is zero or not', async () => {
    const { rows, total } = rarityBreakdown(sampleBottles)
    const onSelect = vi.fn()
    render(<RarityDonutChart rows={rows} total={total} selected={null} onSelect={onSelect} />)
    const user = userEvent.setup()
    await user.click(legend().getByRole('button', { name: /^Unclassified:/ }))
    expect(onSelect).toHaveBeenCalledWith('unclassified')
  })

  it('never produces a NaN dasharray for a normal, non-empty breakdown', () => {
    const { rows, total } = rarityBreakdown(sampleBottles)
    render(<RarityDonutChart rows={rows} total={total} selected={null} onSelect={vi.fn()} />)
    for (const circle of document.querySelectorAll('circle[role="button"]')) {
      const dasharray = circle.getAttribute('stroke-dasharray') ?? ''
      expect(dasharray).not.toContain('NaN')
    }
  })
})
