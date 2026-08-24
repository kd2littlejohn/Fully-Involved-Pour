import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PouredWithField } from './PouredWithField'
import type { PourPerson, PourPersonRef } from '../../data/types'

const mockUploadPhoto = vi.fn()
const mockDeletePhotoIfSafe = vi.fn()

vi.mock('../photoUpload/uploadPhoto', () => ({
  uploadPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
  deletePhotoIfSafe: (...args: unknown[]) => mockDeletePhotoIfSafe(...args),
}))

const marcus: PourPerson = { id: 'p1', name: 'Marcus', normalizedName: 'marcus', createdAt: 1 }
const marcusWithPhoto: PourPerson = { ...marcus, photoUrl: 'https://example.com/marcus.jpg', photoStoragePath: 'person-photos/u1/1-marcus.jpg' }
const chris: PourPerson = { id: 'p2', name: 'Chris', normalizedName: 'chris', createdAt: 2 }

beforeEach(() => {
  mockUploadPhoto.mockReset()
  mockDeletePhotoIfSafe.mockReset().mockResolvedValue(undefined)
})

function setup(overrides: { people?: PourPerson[]; selected?: PourPersonRef[] } = {}) {
  const onChange = vi.fn()
  const onCreatePerson = vi.fn()
  const onUpdatePersonPhoto = vi.fn().mockResolvedValue(undefined)
  const result = render(
    <PouredWithField
      uid="u1"
      people={overrides.people ?? [marcus, chris]}
      selected={overrides.selected ?? []}
      onChange={onChange}
      onCreatePerson={onCreatePerson}
      onUpdatePersonPhoto={onUpdatePersonPhoto}
    />,
  )
  return { onChange, onCreatePerson, onUpdatePersonPhoto, container: result.container }
}

describe('PouredWithField', () => {
  it('shows selected chips with avatar and name', () => {
    setup({ selected: [{ personId: 'p1', name: 'Marcus' }] })
    expect(screen.getByText('Marcus')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Marcus' })).toBeInTheDocument()
  })

  it('suggests matching existing people while typing', async () => {
    setup()
    await userEvent.type(screen.getByPlaceholderText('Add someone…'), 'mar')
    expect(screen.getByRole('button', { name: 'Marcus' })).toBeInTheDocument()
    expect(screen.queryByText('Chris', { selector: 'button *' })).not.toBeInTheDocument()
  })

  it('selecting a suggestion adds them to the pour and clears the input', async () => {
    const { onChange } = setup()
    await userEvent.type(screen.getByPlaceholderText('Add someone…'), 'Marcus')
    await userEvent.click(screen.getByRole('button', { name: /^Marcus$/ }))

    expect(onChange).toHaveBeenCalledWith([{ personId: 'p1', name: 'Marcus' }])
    expect(screen.getByPlaceholderText('Add someone…')).toHaveValue('')
  })

  it('offers to add a brand-new person when nothing matches', async () => {
    setup({ people: [marcus] })

    await userEvent.type(screen.getByPlaceholderText('Add someone…'), 'Priya')

    expect(screen.getByRole('button', { name: /Add “Priya”/ })).toBeInTheDocument()
  })

  it('tapping "Add" creates the person and selects them on the pour', async () => {
    const onCreatePerson = vi.fn().mockResolvedValue({ id: 'p3', name: 'Priya', normalizedName: 'priya', createdAt: 3 })
    const onChange = vi.fn()
    render(
      <PouredWithField
        uid="u1"
        people={[marcus]}
        selected={[]}
        onChange={onChange}
        onCreatePerson={onCreatePerson}
        onUpdatePersonPhoto={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByPlaceholderText('Add someone…'), 'Priya')
    await userEvent.click(screen.getByRole('button', { name: /Add “Priya”/ }))

    expect(onCreatePerson).toHaveBeenCalledWith('Priya')
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith([{ personId: 'p3', name: 'Priya' }]))
  })

  it('does not offer "Add" when the typed name exactly matches an existing person', async () => {
    setup()
    await userEvent.type(screen.getByPlaceholderText('Add someone…'), 'Marcus')
    expect(screen.queryByRole('button', { name: /Add “/ })).not.toBeInTheDocument()
  })

  it('reusing an existing avatar on another pour requires no new upload', () => {
    const { container } = setup({ selected: [{ personId: 'p1', name: 'Marcus' }], people: [marcusWithPhoto, chris] })
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/marcus.jpg')
    expect(mockUploadPhoto).not.toHaveBeenCalled()
  })

  it('shows initials fallback for a person with no avatar', () => {
    setup({ selected: [{ personId: 'p1', name: 'Marcus' }] })
    expect(screen.getByText('MA')).toBeInTheDocument()
  })

  it('removing a chip only deselects them for this pour, without deleting the contact', async () => {
    const { onChange } = setup({
      selected: [
        { personId: 'p1', name: 'Marcus' },
        { personId: 'p2', name: 'Chris' },
      ],
    })

    await userEvent.click(screen.getByRole('button', { name: 'Remove Marcus' }))

    expect(onChange).toHaveBeenCalledWith([{ personId: 'p2', name: 'Chris' }])
  })

  it('tapping an avatar opens the photo action sheet, and picking a file uploads + saves it', async () => {
    mockUploadPhoto.mockResolvedValue({ url: 'https://example.com/new.jpg', path: 'person-photos/u1/2-new.jpg' })
    const { onUpdatePersonPhoto } = setup({ selected: [{ personId: 'p1', name: 'Marcus' }] })

    await userEvent.click(screen.getByRole('button', { name: /Change Marcus/ }))
    expect(screen.getByText('Take Photo')).toBeInTheDocument()

    const file = new File(['data'], 'marcus.jpg', { type: 'image/jpeg' })
    const [, chooseInput] = screen.getAllByLabelText(/photo/i, { selector: 'input' })
    await userEvent.upload(chooseInput!, file)

    expect(mockUploadPhoto).toHaveBeenCalledWith('u1', file, 'person-photos')
    await vi.waitFor(() =>
      expect(onUpdatePersonPhoto).toHaveBeenCalledWith('p1', { photoUrl: 'https://example.com/new.jpg', photoStoragePath: 'person-photos/u1/2-new.jpg' }),
    )
  })

  it('replacing an avatar deletes the old stored file', async () => {
    mockUploadPhoto.mockResolvedValue({ url: 'https://example.com/new.jpg', path: 'person-photos/u1/2-new.jpg' })
    setup({ selected: [{ personId: 'p1', name: 'Marcus' }], people: [marcusWithPhoto, chris] })

    await userEvent.click(screen.getByRole('button', { name: /Change Marcus/ }))
    const file = new File(['data'], 'marcus.jpg', { type: 'image/jpeg' })
    const [, chooseInput] = screen.getAllByLabelText(/photo/i, { selector: 'input' })
    await userEvent.upload(chooseInput!, file)

    await vi.waitFor(() => expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('person-photos/u1/1-marcus.jpg'))
  })

  it('removing an avatar clears it and deletes the stored file', async () => {
    const { onUpdatePersonPhoto } = setup({ selected: [{ personId: 'p1', name: 'Marcus' }], people: [marcusWithPhoto, chris] })

    await userEvent.click(screen.getByRole('button', { name: /Change Marcus/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove Photo' }))

    expect(onUpdatePersonPhoto).toHaveBeenCalledWith('p1', undefined)
    await vi.waitFor(() => expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('person-photos/u1/1-marcus.jpg'))
  })

  it('creates and links a real person before opening the sheet for a still-unlinked legacy chip', async () => {
    const onCreatePerson = vi.fn().mockResolvedValue({ id: 'p9', name: 'Someone New', normalizedName: 'someone new', createdAt: 9 })
    const onChange = vi.fn()
    const onUpdatePersonPhoto = vi.fn().mockResolvedValue(undefined)
    render(
      <PouredWithField
        uid="u1"
        people={[]}
        selected={[{ name: 'Someone New' }]}
        onChange={onChange}
        onCreatePerson={onCreatePerson}
        onUpdatePersonPhoto={onUpdatePersonPhoto}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Change Someone New/ }))

    expect(onCreatePerson).toHaveBeenCalledWith('Someone New')
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith([{ personId: 'p9', name: 'Someone New' }]))
    expect(await screen.findByText('Take Photo')).toBeInTheDocument()
  })
})
