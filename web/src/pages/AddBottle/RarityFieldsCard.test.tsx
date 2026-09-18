import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { RarityFieldsCard, blankRarityFieldsValues, type RarityFieldsValues } from './RarityFieldsCard'

const mockRequestRaritySuggestion = vi.fn()

vi.mock('../../data/repositories/rarity', async () => {
  const actual = await vi.importActual<typeof import('../../data/repositories/rarity')>('../../data/repositories/rarity')
  return {
    ...actual,
    requestRaritySuggestion: (...args: unknown[]) => mockRequestRaritySuggestion(...args),
  }
})

const bottleContext = { name: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace', type: 'Bourbon', region: '', ageStatement: '', proof: '' }

// The component only treats a suggestion as valid once its identityKey
// matches what it computes from bottleContext — a placeholder key would
// never match, so every fixture uses the real computed key.
async function realIdentityKey(): Promise<string> {
  const { rarityIdentity, rarityIdentityKey } = await import('../../data/repositories/rarity')
  return rarityIdentityKey(rarityIdentity({ name: bottleContext.name, distillery: bottleContext.distillery, type: bottleContext.type }))
}

// AddBottlePage feeds RarityFieldsCard's onChange patches back into its own
// state (the standard controlled-component pattern every *FieldsCard here
// uses) — this small wrapper replicates that so a fetched suggestion
// actually reappears as an updated `values` prop, the same as in the real
// app, instead of asserting against a `values` object that's frozen at
// whatever it was on first render.
function ControlledCard({ initial = blankRarityFieldsValues(), onChangeSpy }: { initial?: RarityFieldsValues; onChangeSpy?: (patch: Partial<RarityFieldsValues>) => void }) {
  const [values, setValues] = useState<RarityFieldsValues>(initial)
  return (
    <RarityFieldsCard
      values={values}
      onChange={(patch) => {
        onChangeSpy?.(patch)
        setValues((prev) => ({ ...prev, ...patch }))
      }}
      bottleContext={bottleContext}
    />
  )
}

describe('RarityFieldsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('a new-bottle suggestion can be accepted', async () => {
    mockRequestRaritySuggestion.mockResolvedValue({
      status: 'ready',
      suggestion: { rarity: 'allocated', confidence: 'high', reason: 'Usually released via lottery.', identityKey: await realIdentityKey(), generatedAt: 1, classifierVersion: 'rarity-v1' },
    })
    const onChangeSpy = vi.fn()
    render(<ControlledCard onChangeSpy={onChangeSpy} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Suggest Rarity/ }))
    await waitFor(() => expect(screen.getByText(/High confidence/)).toBeInTheDocument())
    expect(screen.getByText('Usually released via lottery.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Accept Suggestion' }))
    expect(onChangeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ rarity: 'allocated', raritySource: 'suggested-confirmed', rarityConfidence: 'high', rarityReason: 'Usually released via lottery.' }),
    )
  })

  it('the user can choose a different rarity instead of accepting', async () => {
    mockRequestRaritySuggestion.mockResolvedValue({
      status: 'ready',
      suggestion: { rarity: 'rare', confidence: 'high', reason: 'Very limited.', identityKey: await realIdentityKey(), generatedAt: 1, classifierVersion: 'rarity-v1' },
    })
    const onChangeSpy = vi.fn()
    render(<ControlledCard onChangeSpy={onChangeSpy} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Suggest Rarity/ }))
    await waitFor(() => expect(screen.getByText('Very limited.')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Choose Different Rarity' }))
    await user.click(screen.getByRole('button', { name: 'Allocated' }))

    expect(onChangeSpy).toHaveBeenCalledWith(expect.objectContaining({ rarity: 'allocated', raritySource: 'manual' }))
    const lastCall = onChangeSpy.mock.calls.at(-1)![0]
    expect(lastCall.rarityConfidence).toBeUndefined()
    expect(lastCall.rarityReason).toBeUndefined()
  })

  it('a manually-set rarity is never auto-overwritten — no automatic request fires while rarity is set', async () => {
    vi.useFakeTimers()
    render(<ControlledCard initial={{ rarity: 'common', raritySource: 'manual', rarityConfirmedAt: 1 }} />)
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockRequestRaritySuggestion).not.toHaveBeenCalled()
  })

  it('does not request a suggestion when bottle identity is insufficient (name alone)', async () => {
    vi.useFakeTimers()
    render(
      <RarityFieldsCard
        values={blankRarityFieldsValues()}
        onChange={vi.fn()}
        bottleContext={{ name: 'Eagle Rare', distillery: '', type: '', region: '', ageStatement: '', proof: '' }}
      />,
    )
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockRequestRaritySuggestion).not.toHaveBeenCalled()
  })

  it('debounces the automatic suggestion request rather than firing on every render', async () => {
    vi.useFakeTimers()
    mockRequestRaritySuggestion.mockResolvedValue({
      status: 'ready',
      suggestion: { rarity: 'common', confidence: 'high', reason: 'x', identityKey: await realIdentityKey(), generatedAt: 1, classifierVersion: 'rarity-v1' },
    })
    render(<ControlledCard />)
    await vi.advanceTimersByTimeAsync(400)
    expect(mockRequestRaritySuggestion).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(600)
    expect(mockRequestRaritySuggestion).toHaveBeenCalledTimes(1)
  })

  it('reuses a still-valid existing suggestion with zero requests (duplicate-request avoidance)', async () => {
    vi.useFakeTimers()
    const { rarityIdentity, rarityIdentityKey } = await import('../../data/repositories/rarity')
    const identity = rarityIdentity({ name: bottleContext.name, distillery: bottleContext.distillery, type: bottleContext.type })
    const initial: RarityFieldsValues = {
      rarity: '',
      raritySuggestion: { rarity: 'uncommon', confidence: 'medium', reason: 'x', identityKey: rarityIdentityKey(identity), generatedAt: 1, classifierVersion: 'rarity-v1' },
    }
    render(<ControlledCard initial={initial} />)
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockRequestRaritySuggestion).not.toHaveBeenCalled()
    const panel = document.querySelector('[class*="panel"]') as HTMLElement
    expect(within(panel).getByText('Uncommon')).toBeInTheDocument()
  })

  it('a suggestion failure shows the nontechnical error message without any technical detail', async () => {
    mockRequestRaritySuggestion.mockResolvedValue({ status: 'failed' })
    render(<ControlledCard />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Suggest Rarity/ }))
    await waitFor(() => expect(screen.getByText("We couldn't suggest a rarity for this bottle.")).toBeInTheDocument())
  })
})
