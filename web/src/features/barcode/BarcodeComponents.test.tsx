import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { BarcodeBottle } from '../../data/repositories/barcode'
import type { Bottle } from '../../data/types'
import { BarcodeMatchList } from './BarcodeMatchList'
import { BarcodeBottleForm } from './BarcodeBottleForm'
import { BarcodeSaveActions } from './BarcodeSaveActions'
import { draftFromOption, type BarcodeOption, type BottleDraft } from './options'

const bottle = (overrides: Partial<BarcodeBottle> = {}): BarcodeBottle => ({
  name: 'Example Bourbon',
  distillery: 'Example Distillery',
  brand: null,
  expression: null,
  category: 'Bourbon',
  sizeMl: 750,
  proof: 90,
  proofVaries: false,
  ageStatement: null,
  releaseKind: 'standard',
  batch: null,
  barrel: null,
  storePick: null,
  releaseYear: null,
  ...overrides,
})

const option = (overrides: Partial<BarcodeOption> = {}): BarcodeOption => ({
  key: 'verified:std',
  trust: 'verified',
  bottle: bottle(),
  candidateId: 'std',
  origin: 'verified',
  bottleId: null,
  savedByYou: false,
  notes: null,
  ...overrides,
})

const noop = () => {}

describe('BarcodeMatchList', () => {
  const options = [
    option(),
    option({ key: 'verified:c924', candidateId: 'c924', bottle: bottle({ name: 'Example Barrel Proof', releaseKind: 'barrel-proof-batch', batch: 'C924', proof: 124.6 }) }),
    option({ key: 'axe-barcode:1', trust: 'axe', origin: 'axe-barcode', candidateId: null, bottle: bottle({ name: 'Example Store Pick', releaseKind: 'store-pick', proof: null, proofVaries: true }) }),
  ]

  it('asks the user to pick when one barcode has several bottles, and labels how far each can be trusted', () => {
    render(<BarcodeMatchList options={options} selectedKey={null} onSelect={noop} onScanLabel={noop} onManual={noop} />)
    expect(screen.getByText('This barcode can be 3 different bottles. Pick yours.')).toBeInTheDocument()
    expect(screen.getAllByText('Verified by FIP')).toHaveLength(2)
    expect(screen.getByText('AXE suggestion · not verified')).toBeInTheDocument()
    expect(screen.getByText(/Barrel-proof batch · Example Distillery · 750 ml · 124.6 proof · Batch C924/)).toBeInTheDocument()
    expect(screen.getByText(/Store pick · Example Distillery · 750 ml · Proof varies/)).toBeInTheDocument()
  })

  it('reports the picked bottle and marks it selected', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(<BarcodeMatchList options={options} selectedKey={null} onSelect={onSelect} onScanLabel={noop} onManual={noop} />)
    await userEvent.click(screen.getByRole('button', { name: /Example Barrel Proof/ }))
    expect(onSelect).toHaveBeenCalledWith(options[1])
    rerender(<BarcodeMatchList options={options} selectedKey="verified:c924" onSelect={onSelect} onScanLabel={noop} onManual={noop} />)
    expect(screen.getByRole('button', { name: /Example Barrel Proof/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows which matches are already in your bar', () => {
    render(<BarcodeMatchList options={options} selectedKey={null} inBarKeys={new Set(['verified:std'])} onSelect={noop} onScanLabel={noop} onManual={noop} />)
    expect(screen.getAllByText('In your bar')).toHaveLength(1)
  })

  it('offers AXE, the front label and manual entry when nothing matches', async () => {
    const onAskAxe = vi.fn()
    const onScanLabel = vi.fn()
    const onManual = vi.fn()
    render(<BarcodeMatchList options={[]} selectedKey={null} onSelect={noop} onAskAxe={onAskAxe} onScanLabel={onScanLabel} onManual={onManual} />)
    expect(screen.getByText("No match in FIP's catalog yet.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ask AXE about this barcode' }))
    await userEvent.click(screen.getByRole('button', { name: 'Scan Front Label with AXE' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enter details manually' }))
    expect([onAskAxe, onScanLabel, onManual].map((f) => f.mock.calls.length)).toEqual([1, 1, 1])
  })
})

describe('BarcodeBottleForm', () => {
  function Harness({ initial }: { initial: BottleDraft }) {
    const [draft, setDraft] = useState(initial)
    return <BarcodeBottleForm draft={draft} onChange={setDraft} />
  }

  it('tags verified values, AXE suggestions and label readings differently', () => {
    const axeOption = option({ trust: 'axe', origin: 'axe-barcode', bottle: bottle({ name: 'Example Barrel Proof', releaseKind: 'barrel-proof-batch', proof: null, proofVaries: true }) })
    const draft = draftFromOption(axeOption, { name: null, distillery: null, proof: 124.6, batch: 'C924', barrel: null, storePick: null, ageStatement: null, sizeMl: null })
    render(<Harness initial={draft} />)
    expect(screen.getByLabelText(/Bottle name/)).toHaveValue('Example Barrel Proof')
    expect(screen.getAllByText('AXE suggestion').length).toBeGreaterThan(0)
    expect(screen.getAllByText('From your label — check it')).toHaveLength(2)
    expect(screen.getByLabelText('Proof')).toHaveValue('124.6')
    expect(screen.getByLabelText('Batch (from your label)')).toHaveValue('C924')
  })

  it('leaves a variable proof empty with a hint to read it from the label', () => {
    render(<Harness initial={draftFromOption(option({ bottle: bottle({ releaseKind: 'single-barrel', proof: null, proofVaries: true }) }), null)} />)
    expect(screen.getByLabelText('Proof')).toHaveValue('')
    expect(screen.getByLabelText('Proof')).toHaveAttribute('placeholder', 'Varies by batch or barrel — enter it from your label')
  })

  it('shows a label that disagrees with a verified value and lets the user use it', async () => {
    render(<Harness initial={draftFromOption(option(), { name: null, distillery: null, proof: 94, batch: null, barrel: null, storePick: null, ageStatement: null, sizeMl: null })} />)
    expect(screen.getByLabelText('Proof')).toHaveValue('90')
    expect(screen.getByText(/Your label shows 94/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Use that' }))
    expect(screen.getByLabelText('Proof')).toHaveValue('94')
    expect(screen.queryByText(/Your label shows 94/)).not.toBeInTheDocument()
  })

  it('tags anything the user types as theirs', async () => {
    render(<Harness initial={draftFromOption(option(), null)} />)
    await userEvent.type(screen.getByLabelText('Store pick (from your label)'), 'Store A')
    expect(screen.getByText('You')).toBeInTheDocument()
  })
})

describe('BarcodeSaveActions', () => {
  const inBar: Bottle = { id: 'b1', name: 'Example Bourbon', status: 'sealed', quantity: 2 }
  const props = { canSave: true, busy: false, submitForReview: false, onSubmitForReviewChange: noop, onAdd: noop, onIncrease: noop }

  it('adds to My Bar or Wishlist when the bottle is new', async () => {
    const onAdd = vi.fn()
    render(<BarcodeSaveActions {...props} matches={{ sameRelease: [], sameBarcode: [] }} onAdd={onAdd} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add to My Bar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add to Wishlist' }))
    expect(onAdd.mock.calls).toEqual([['sealed'], ['wishlist']])
  })

  it('offers Increase quantity first when the same release is already in My Bar', async () => {
    const onIncrease = vi.fn()
    render(<BarcodeSaveActions {...props} matches={{ sameRelease: [inBar], sameBarcode: [] }} onIncrease={onIncrease} />)
    expect(screen.getByText(/is already in My Bar \(2\)/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    expect(onIncrease).toHaveBeenCalledWith(inBar)
    expect(screen.getByRole('button', { name: 'Add as a separate bottle' })).toBeInTheDocument()
  })

  it('moves a wishlist copy to My Bar instead', () => {
    render(<BarcodeSaveActions {...props} matches={{ sameRelease: [{ ...inBar, status: 'wishlist' }], sameBarcode: [] }} />)
    expect(screen.getByRole('button', { name: 'Move to My Bar' })).toBeInTheDocument()
  })

  it('mentions other releases with the same barcode without treating them as duplicates', () => {
    render(<BarcodeSaveActions {...props} matches={{ sameRelease: [], sameBarcode: [{ ...inBar, name: 'Example — Store A Pick' }] }} />)
    expect(screen.getByText(/Also in your bar with this barcode: Example — Store A Pick/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Increase quantity' })).not.toBeInTheDocument()
  })

  it('keeps catalog submission opt-in', async () => {
    const onChange = vi.fn()
    render(<BarcodeSaveActions {...props} matches={{ sameRelease: [], sameBarcode: [] }} onSubmitForReviewChange={onChange} />)
    const box = screen.getByRole('checkbox', { name: /Suggest this bottle for FIP's shared catalog/ })
    expect(box).not.toBeChecked()
    await userEvent.click(box)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
