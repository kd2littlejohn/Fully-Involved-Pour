import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PourWizard } from './PourWizard'
import type { Bottle, Pour } from '../../data/types'

const mockAddPour = vi.fn().mockResolvedValue(undefined)
let mockBottles: Bottle[] = []
const mockUpdatePour = vi.fn().mockResolvedValue(undefined)
const mockAddOrReusePerson = vi.fn()
const mockUpdatePersonPhoto = vi.fn().mockResolvedValue(undefined)
const mockUpdatePourMemoryPhoto = vi.fn().mockResolvedValue(undefined)
const mockGenerateAndSaveTastingSummary = vi.fn().mockResolvedValue(undefined)
const mockUploadAndSaveMemoryPhoto = vi.fn().mockResolvedValue(undefined)
const mockUploadPhoto = vi.fn()
const mockDeletePhotoIfSafe = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { bottles: mockBottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
    addPour: mockAddPour,
    updatePour: mockUpdatePour,
    updatePourAiSummary: vi.fn(),
    updatePourMemoryPhoto: mockUpdatePourMemoryPhoto,
    addOrReusePerson: mockAddOrReusePerson,
    updatePersonPhoto: mockUpdatePersonPhoto,
  }),
}))

vi.mock('./tastingSummaryOnSave', () => ({
  generateAndSaveTastingSummary: (...args: unknown[]) => mockGenerateAndSaveTastingSummary(...args),
}))

vi.mock('./memoryPhotoOnSave', () => ({
  uploadAndSaveMemoryPhoto: (...args: unknown[]) => mockUploadAndSaveMemoryPhoto(...args),
}))

// Only the person-avatar picker (PouredWithField, rendered inside
// SessionStep) touches this module in these tests — the memory photo's own
// upload path is covered via the mocked memoryPhotoOnSave above instead.
vi.mock('../photoUpload/uploadPhoto', () => ({
  uploadPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
  deletePhotoIfSafe: (...args: unknown[]) => mockDeletePhotoIfSafe(...args),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'test-uid' }, loading: false }),
}))

// The Session step's friend-tagging field (see features/friends/
// TagFriendsField) reads this repository — mocked so it never attempts a
// real Firestore call in tests.
vi.mock('../../data/repositories/relationships', () => ({
  getFriendIds: () => Promise.resolve([]),
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockAddPour.mockResolvedValue(undefined)
  mockUpdatePour.mockResolvedValue(undefined)
  mockUpdatePersonPhoto.mockResolvedValue(undefined)
  mockUpdatePourMemoryPhoto.mockResolvedValue(undefined)
  mockGenerateAndSaveTastingSummary.mockResolvedValue(undefined)
  mockUploadAndSaveMemoryPhoto.mockResolvedValue(undefined)
  mockDeletePhotoIfSafe.mockResolvedValue(undefined)
  mockBottles = []
})

async function goNext() {
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
}

async function goToSummary() {
  for (let i = 0; i < 5; i++) {
    await goNext()
  }
}

describe('PourWizard', () => {
  it('walks all six steps, computes the correct total, and saves the pour', async () => {
    const onClose = vi.fn()
    const onSaved = vi.fn()
    render(<PourWizard bottleId="b1" bottleName="Eagle Rare" onClose={onClose} onSaved={onSaved} />)

    // Session
    expect(screen.getByText('Add a Pour Story — Eagle Rare')).toBeInTheDocument()
    await goNext()

    // Nose
    fireEvent.change(screen.getByLabelText('Nose'), { target: { value: '2' } })
    await userEvent.click(screen.getByRole('button', { name: 'Vanilla' }))
    await goNext()

    // Palate
    fireEvent.change(screen.getByLabelText('Palate'), { target: { value: '3' } })
    await userEvent.click(screen.getByRole('button', { name: 'Oak' }))
    await goNext()

    // Finish
    fireEvent.change(screen.getByLabelText('Finish'), { target: { value: '1.5' } })
    await goNext()

    // Complexity
    fireEvent.change(screen.getByLabelText('Complexity & Balance'), { target: { value: '0.8' } })
    await userEvent.selectOptions(screen.getByLabelText('Would you buy it again?'), 'absolutely')
    await goNext()

    // Summary: 2 + 3 + 1.5 + 0.8 + 1 (absolutely) = 8.3 → Working Fire (8.0–8.9)
    expect(screen.getByText('8.3')).toBeInTheDocument()
    expect(screen.getByText('Working Fire')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('The memory'), 'Great porch pour.')
    await userEvent.click(screen.getByRole('button', { name: 'Save Story' }))

    expect(mockAddPour).toHaveBeenCalledWith(
      expect.objectContaining({
        bottleId: 'b1',
        rating: 8.3,
        memory: 'Great porch pour.',
        buyAgain: 'absolutely',
        companion: undefined,
        pouredWith: undefined,
        memoryPhoto: undefined,
        fip: expect.objectContaining({
          nose: 2,
          palate: 3,
          finish: 1.5,
          complexity: 0.8,
          value: 1,
          total: 8.3,
          noseAromas: ['Vanilla'],
          palateFlavors: ['Oak'],
        }),
      }),
    )
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    // addPour resolved undefined in this test, so there's no saved pour to
    // generate a tasting summary for.
    expect(mockGenerateAndSaveTastingSummary).not.toHaveBeenCalled()
    expect(mockUploadAndSaveMemoryPhoto).not.toHaveBeenCalled()
  })

  it('stamps bottleInstanceId on a new pour when the bottle has exactly one open instance', async () => {
    mockBottles = [
      {
        id: 'b1',
        name: 'Eagle Rare',
        status: 'open',
        instances: [
          { id: 'i1', status: 'open', createdAt: 1 },
          { id: 'i2', status: 'sealed', createdAt: 2 },
        ],
      },
    ]
    render(<PourWizard bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} onSaved={vi.fn()} />)
    await goToSummary()
    await userEvent.click(screen.getByRole('button', { name: 'Save Story' }))

    expect(mockAddPour).toHaveBeenCalledWith(expect.objectContaining({ bottleInstanceId: 'i1' }))
  })

  it('never stamps a bottleInstanceId when editing an existing pour', async () => {
    mockBottles = [
      {
        id: 'b1',
        name: 'Eagle Rare',
        status: 'open',
        instances: [{ id: 'i1', status: 'open', createdAt: 1 }],
      },
    ]
    const existingPour: Pour = {
      id: 'p1',
      bottleId: 'b1',
      bottleInstanceId: 'i1',
      date: '2026-08-01',
      rating: 7.5,
      fip: { nose: 2, palate: 2.5, finish: 1.5, complexity: 0.5, value: 1, total: 7.5, noseAromas: [], palateFlavors: [] },
    }
    render(<PourWizard bottleId="b1" bottleName="Eagle Rare" existingPour={existingPour} onClose={vi.fn()} />)
    await goToSummary()
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(mockUpdatePour).toHaveBeenCalled()
    const [, patch] = mockUpdatePour.mock.calls[0]!
    expect(patch).not.toHaveProperty('bottleInstanceId')
  })

  it('fires the tasting summary generator in the background once a real saved pour comes back, after onSaved/onClose', async () => {
    const saved = {
      id: 'p-new',
      bottleId: 'b1',
      date: '2026-08-14',
      rating: 8.3,
      fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 1, total: 8.3, noseAromas: ['Vanilla'], palateFlavors: ['Oak'] },
    }
    mockAddPour.mockResolvedValueOnce(saved)
    const onClose = vi.fn()
    const onSaved = vi.fn()
    render(<PourWizard bottleId="b1" bottleName="Eagle Rare" onClose={onClose} onSaved={onSaved} />)

    await goToSummary()
    await userEvent.click(screen.getByRole('button', { name: 'Save Story' }))

    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    expect(mockGenerateAndSaveTastingSummary).toHaveBeenCalledWith(saved, expect.any(Function))
  })

  it('adds a new Poured With person and mirrors it into the legacy companion field on save', async () => {
    mockAddOrReusePerson.mockResolvedValueOnce({ id: 'new-person-id', name: 'Dad', normalizedName: 'dad', createdAt: 1 })
    const onClose = vi.fn()
    render(<PourWizard bottleId="b4" bottleName="Weller 12" onClose={onClose} />)

    await userEvent.type(screen.getByPlaceholderText('Add someone…'), 'Dad')
    await userEvent.click(screen.getByRole('button', { name: 'Add “Dad”' }))

    await goToSummary()
    await userEvent.click(screen.getByRole('button', { name: 'Save Story' }))

    expect(mockAddOrReusePerson).toHaveBeenCalledWith('Dad')
    expect(mockAddPour).toHaveBeenCalledWith(
      expect.objectContaining({
        pouredWith: [{ personId: 'new-person-id', name: 'Dad' }],
        companion: 'Dad',
      }),
    )
  })

  it('background-uploads a picked memory photo and attaches it after save, without blocking onSaved/onClose', async () => {
    const saved = {
      id: 'p-new',
      bottleId: 'b1',
      date: '2026-08-14',
      rating: 0,
      fip: { nose: 0, palate: 0, finish: 0, complexity: 0, value: 0, total: 0, noseAromas: [], palateFlavors: [] },
    }
    mockAddPour.mockResolvedValueOnce(saved)
    const onClose = vi.fn()
    const onSaved = vi.fn()
    render(<PourWizard bottleId="b1" bottleName="Eagle Rare" onClose={onClose} onSaved={onSaved} />)

    await goToSummary()

    await userEvent.click(screen.getByRole('button', { name: 'Add Memory Photo' }))
    const file = new File(['data'], 'moment.jpg', { type: 'image/jpeg' })
    const [, chooseInput] = screen.getAllByLabelText(/photo/i, { selector: 'input' })
    await userEvent.upload(chooseInput!, file)

    await userEvent.click(screen.getByRole('button', { name: 'Save Story' }))

    // The pour itself saves with no memoryPhoto yet — the upload hasn't
    // resolved at save time, so nothing waits on it.
    expect(mockAddPour).toHaveBeenCalledWith(expect.objectContaining({ memoryPhoto: undefined }))
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    expect(mockUploadAndSaveMemoryPhoto).toHaveBeenCalledWith('test-uid', saved, file, expect.any(Function))
  })

  it('editing an existing pour: removing its memory photo deletes the stored file without losing other pour data', async () => {
    const existingPour: Pour = {
      id: 'p1',
      bottleId: 'b1',
      date: '2026-08-10',
      rating: 7,
      companion: 'Dad',
      pouredWith: [{ personId: 'pp1', name: 'Dad' }],
      memory: 'Old memory text',
      memoryPhoto: { url: 'https://example.com/old.jpg', storagePath: 'memory-photos/test-uid/1-old.jpg', createdAt: 1 },
      fip: { nose: 1, palate: 1, finish: 1, complexity: 1, value: 1, total: 7, noseAromas: [], palateFlavors: [] },
    }
    const onClose = vi.fn()
    render(<PourWizard bottleId="b1" bottleName="Eagle Rare" existingPour={existingPour} onClose={onClose} />)

    await goToSummary()

    await userEvent.click(screen.getByRole('button', { name: 'Change memory photo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove Photo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(mockUpdatePour).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        memoryPhoto: undefined,
        memory: 'Old memory text',
        companion: 'Dad',
        pouredWith: [{ personId: 'pp1', name: 'Dad' }],
      }),
    )
    expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('memory-photos/test-uid/1-old.jpg')
    expect(mockUploadAndSaveMemoryPhoto).not.toHaveBeenCalled()
  })

  it('persists a draft to localStorage so reopening the wizard resumes it', async () => {
    const onClose = vi.fn()
    const { unmount } = render(<PourWizard bottleId="b2" bottleName="Weller 12" onClose={onClose} />)

    await goNext() // Session -> Nose
    fireEvent.change(screen.getByLabelText('Nose'), { target: { value: '2.2' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(onClose).toHaveBeenCalled()
    unmount()

    render(<PourWizard bottleId="b2" bottleName="Weller 12" onClose={vi.fn()} />)
    await goNext() // Session -> Nose again
    expect(screen.getByLabelText('Nose')).toHaveValue('2.2')
  })

  it('keeps drafts separate per bottle', async () => {
    render(<PourWizard bottleId="b3" bottleName="Blanton's" onClose={vi.fn()} />)
    await goNext()
    expect(screen.getByLabelText('Nose')).toHaveValue('0')
  })
})
