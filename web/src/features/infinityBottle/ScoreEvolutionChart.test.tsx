import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreEvolutionChart } from './ScoreEvolutionChart'

describe('ScoreEvolutionChart', () => {
  it('renders nothing with fewer than 2 points', () => {
    const { container } = render(<ScoreEvolutionChart points={[{ date: '2026-01-01', score: 7 }]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders an accessible svg line chart with 2+ points', () => {
    render(
      <ScoreEvolutionChart
        points={[
          { date: '2026-01-01', score: 7 },
          { date: '2026-02-01', score: 8.5 },
        ]}
      />,
    )
    expect(screen.getByRole('img', { name: 'Score evolution over your tastings' })).toBeInTheDocument()
  })

  it('caps date labels to first/middle/last past 5 points', () => {
    const points = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ date: `2026-0${n <= 9 ? n : 9}-01`, score: n }))
    render(<ScoreEvolutionChart points={points} />)
    expect(screen.getAllByText(/^[A-Z][a-z]{2} \d/).length).toBe(3)
  })
})
