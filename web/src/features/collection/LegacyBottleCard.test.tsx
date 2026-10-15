import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LegacyBottleCard } from './LegacyBottleCard'
import type { Bottle } from '../../data/types'

const mockUpdateBottle = vi.fn().mockResolvedValue(undefined)
const mockChangeLegacyBottle = vi.fn().mockResolvedValue(undefined)
vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    updateBottle: mockUpdateBottle,
    changeLegacyBottle: mockChangeLegacyBottle,
  }),
}))

function BottleRoute() {
  const location = useLocation()
  return <div>Bottle page {JSON.stringify(location.state)}</div>
}

function renderCard(bottles: Bottle[]) {
  return render(
    <MemoryRouter initialEntries={['/collection']}>
      <Routes>
        <Route path="/collection" element={<LegacyBottleCard bottles={bottles} />} />
        <Route path="/collection/:bottleId" element={<BottleRoute />} />
      </Routes>
    </MemoryRouter>,
  )
}

const blantons: Bottle = {
  id: 'b1',
  name: "Blanton's Original",
  distillery: 'Buffalo Trace',
  status: 'finished',
  imageUrl: 'https://example.com/blantons.jpg',
  legacyShelf: true,
  legacyShelfReason: 'First bourbon I ever loved',
  createdAt: 1,
}
const weller: Bottle = {
  id: 'b2',
  name: 'Weller 12',
  status: 'open',
  createdAt: 2,
}

describe('LegacyBottleCard', () => {
  beforeEach(() => {
    mockUpdateBottle.mockReset().mockResolvedValue(undefined)
    mockChangeLegacyBottle.mockReset().mockResolvedValue(undefined)
  })

  it('features the designated bottle with its real photo, story and status, finished included', () => {
    const { container } = renderCard([blantons, weller])
    expect(screen.getByRole('heading', { name: "Blanton's Original" })).toBeInTheDocument()
    expect(screen.getByText('“First bourbon I ever loved”')).toBeInTheDocument()
    expect(screen.getByText('Buffalo Trace · Finished')).toBeInTheDocument()
    const photos = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'))
    expect(photos).toContain('https://example.com/blantons.jpg')
  })

  it('Open Story shows the complete story with an Edit button, and links on to the Journey', async () => {
    const withStory: Bottle = {
      ...blantons,
      legacyStoryTitle: 'The first pour',
      legacyStory: 'Opened on the porch the night I graduated.\nDad poured two fingers each.',
      legacyOccasion: 'Graduation',
      legacyDate: '2019-06-14',
    }
    renderCard([withStory])
    await userEvent.click(screen.getByRole('button', { name: 'Open Story' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(
      within(dialog).getByRole('heading', {
        name: 'The first pour',
        hidden: true,
      }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(/Dad poured two fingers each/)).toBeInTheDocument()
    expect(within(dialog).getByText('Graduation')).toBeInTheDocument()
    expect(within(dialog).getByText('Jun 14, 2019')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Edit', hidden: true })).toBeInTheDocument()

    await userEvent.click(
      within(dialog).getByRole('link', {
        name: /Pours & memories/,
        hidden: true,
      }),
    )
    expect(screen.getByText(/Bottle page/)).toHaveTextContent('"initialTab":"journey"')
  })

  it('Edit from the full story opens the editor prefilled', async () => {
    renderCard([blantons])
    await userEvent.click(screen.getByRole('button', { name: 'Open Story' }))
    await userEvent.click(screen.getByRole('button', { name: 'Edit', hidden: true }))
    expect(screen.getByRole('dialog', { hidden: true })).toHaveTextContent('Edit Legacy Story')
    expect(screen.getByLabelText('Why it matters')).toHaveValue('First bourbon I ever loved')
  })

  it('offers the Legacy actions in the ••• menu', async () => {
    renderCard([blantons, weller])
    await userEvent.click(screen.getByRole('button', { name: 'Legacy Bottle actions' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Edit Legacy Story',
      'Change Legacy Bottle',
      'View Bottle Details',
      'Add another Legacy Bottle',
      'Remove Legacy Status',
    ])
  })

  it('edits the Legacy Story prefilled with what is saved, and saves only story fields to the same bottle', async () => {
    const saved: Bottle = {
      ...blantons,
      legacyStoryTitle: 'Old title',
      legacyStory: 'Old story',
      notes: 'Caramel, cherry',
    }
    renderCard([saved])
    await userEvent.click(screen.getByRole('button', { name: 'Legacy Bottle actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit Legacy Story' }))

    expect(screen.getByLabelText('Story title')).toHaveValue('Old title')
    expect(screen.getByLabelText('Your story')).toHaveValue('Old story')
    expect(screen.getByLabelText('Why it matters')).toHaveValue('First bourbon I ever loved')

    await userEvent.clear(screen.getByLabelText('Story title'))
    await userEvent.type(screen.getByLabelText('Story title'), '  Dad’s bottle  ')
    await userEvent.clear(screen.getByLabelText('Your story'))
    await userEvent.type(screen.getByLabelText('Occasion or person'), 'Gift from Dad')
    await userEvent.click(screen.getByRole('button', { name: 'Save story', hidden: true }))

    expect(mockUpdateBottle).toHaveBeenCalledTimes(1)
    const [id, patch] = mockUpdateBottle.mock.calls[0]!
    expect(id).toBe('b1')
    expect(patch).toMatchObject({
      legacyStoryTitle: 'Dad’s bottle',
      legacyShelfReason: 'First bourbon I ever loved',
      legacyStory: undefined,
      legacyOccasion: 'Gift from Dad',
    })
    // Tasting notes are a separate thing and are never touched here.
    expect(patch).not.toHaveProperty('notes')
    expect(patch).not.toHaveProperty('legacyShelf')
    expect(await screen.findByText('Legacy story saved.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument()
  })

  it('shows Saving… while saving, and keeps the editor open with an error if the save fails', async () => {
    let reject!: (error: Error) => void
    mockUpdateBottle.mockImplementationOnce(() => new Promise((_resolve, r) => (reject = r)))
    renderCard([blantons])
    await userEvent.click(screen.getByRole('button', { name: 'Legacy Bottle actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit Legacy Story' }))
    await userEvent.type(screen.getByLabelText('Your story'), 'A long night')
    await userEvent.click(screen.getByRole('button', { name: 'Save story', hidden: true }))

    expect(screen.getByRole('button', { name: 'Saving…', hidden: true })).toBeDisabled()
    reject(new Error('offline'))
    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent('couldn’t be saved')
    expect(screen.getByLabelText('Your story')).toHaveValue('A long night')
    expect(screen.getByRole('button', { name: 'Save story', hidden: true })).toBeEnabled()
  })

  it('changes the Legacy Bottle to another bottle in My Bar via a searchable list', async () => {
    const eagle: Bottle = {
      id: 'b3',
      name: 'Eagle Rare 10',
      distillery: 'Buffalo Trace',
      status: 'sealed',
      createdAt: 3,
    }
    renderCard([blantons, weller, eagle])
    await userEvent.click(screen.getByRole('button', { name: 'Legacy Bottle actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Change Legacy Bottle' }))

    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog).toHaveTextContent("Blanton's Original stays in your bar with its story saved")
    // The current Legacy Bottle isn't offered; search narrows the rest.
    expect(within(dialog).queryByRole('button', { name: /Blanton/, hidden: true })).not.toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Search your bottles'), 'eagle')
    expect(within(dialog).queryByRole('button', { name: /Weller 12/, hidden: true })).not.toBeInTheDocument()
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: /Eagle Rare 10/,
        hidden: true,
      }),
    )
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'Make it my Legacy Bottle',
        hidden: true,
      }),
    )

    expect(mockChangeLegacyBottle).toHaveBeenCalledWith('b1', 'b3', {})
    expect(mockUpdateBottle).not.toHaveBeenCalled()
    expect(await screen.findByText('Eagle Rare 10 is now your Legacy Bottle.')).toBeInTheDocument()
  })

  it('View Bottle Details opens the regular bottle page', async () => {
    renderCard([blantons])
    await userEvent.click(screen.getByRole('button', { name: 'Legacy Bottle actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'View Bottle Details' }))
    expect(screen.getByText(/Bottle page/)).toBeInTheDocument()
  })

  it('asks before removing Legacy status, and only clears the flag', async () => {
    renderCard([blantons])
    await userEvent.click(screen.getByRole('button', { name: 'Legacy Bottle actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove Legacy Status' }))

    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog).toHaveTextContent('The bottle, its story, pours and tasting history all stay in My Bar')
    expect(mockUpdateBottle).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep it', hidden: true }))
    expect(mockUpdateBottle).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Legacy Bottle actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove Legacy Status' }))
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove Legacy status',
        hidden: true,
      }),
    )
    expect(mockUpdateBottle).toHaveBeenCalledWith('b1', { legacyShelf: false })
    expect(await screen.findByText(/Legacy status removed/)).toBeInTheDocument()
  })

  it('shows an error and keeps the confirmation open if removing fails', async () => {
    mockUpdateBottle.mockRejectedValueOnce(new Error('offline'))
    renderCard([blantons])
    await userEvent.click(screen.getByRole('button', { name: 'Legacy Bottle actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove Legacy Status' }))
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove Legacy status',
        hidden: true,
      }),
    )
    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent('couldn’t be removed')
    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument()
  })

  it('quotes the full story on the card when there is no short reason', () => {
    renderCard([
      {
        ...blantons,
        legacyShelfReason: undefined,
        legacyStory: 'Bought the day my son was born',
      },
    ])
    expect(screen.getByText('“Bought the day my son was born”')).toBeInTheDocument()
  })

  it('shows a quiet setup prompt, not an empty card, when no Legacy Bottle is designated', () => {
    renderCard([weller])
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose a Legacy Bottle' })).toBeInTheDocument()
  })

  it('designates an existing bottle (no new record) with an optional reason', async () => {
    renderCard([weller])
    await userEvent.click(screen.getByRole('button', { name: 'Choose a Legacy Bottle' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await userEvent.click(within(dialog).getByRole('button', { name: /Weller 12/ }))
    await userEvent.type(within(dialog).getByLabelText('Why it matters (optional)'), 'Shared with Dad')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Make it my Legacy Bottle' }))
    expect(mockUpdateBottle).toHaveBeenCalledWith('b2', {
      legacyShelf: true,
      legacyShelfReason: 'Shared with Dad',
    })
  })

  it('keeps an existing saved reason when none is entered', async () => {
    const withOldReason: Bottle = { ...weller, legacyShelfReason: 'Old note' }
    renderCard([withOldReason])
    await userEvent.click(screen.getByRole('button', { name: 'Choose a Legacy Bottle' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await userEvent.click(within(dialog).getByRole('button', { name: /Weller 12/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Make it my Legacy Bottle' }))
    expect(mockUpdateBottle).toHaveBeenCalledWith('b2', { legacyShelf: true })
  })

  it('cycles through several Legacy Bottles', async () => {
    renderCard([blantons, { ...weller, legacyShelf: true }])
    await userEvent.click(screen.getByRole('button', { name: /1 of 2/ }))
    expect(screen.getByRole('heading', { name: 'Weller 12' })).toBeInTheDocument()
  })
})
