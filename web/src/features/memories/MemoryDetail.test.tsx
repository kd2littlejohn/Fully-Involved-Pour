import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryDetail } from './MemoryDetail'
import type { Bottle, Memory } from '../../data/types'

const mockUpdateMemory = vi.fn().mockResolvedValue(undefined)
const mockDeleteMemory = vi.fn().mockResolvedValue(undefined)
const mockUploadPhoto = vi.fn()
const mockDeletePhotoIfSafe = vi.fn().mockResolvedValue(undefined)
const bottles: Bottle[] = [{ id: 'b1', name: 'Eagle Rare', status: 'open' }]

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] }, updateMemory: mockUpdateMemory, deleteMemory: mockDeleteMemory }),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}))

vi.mock('../photoUpload/uploadPhoto', () => ({
  uploadPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
  deletePhotoIfSafe: (...args: unknown[]) => mockDeletePhotoIfSafe(...args),
}))

beforeEach(() => {
  mockUpdateMemory.mockClear()
  mockDeleteMemory.mockClear()
  mockUploadPhoto.mockReset()
  mockDeletePhotoIfSafe.mockReset().mockResolvedValue(undefined)
})

const memory: Memory = {
  id: 'm1',
  title: "Dad's retirement toast",
  date: '2026-06-01',
  location: 'Back porch',
  people: ['Dad', 'Mike'],
  bottleId: 'b1',
  story: 'Celebrated 30 years on the job.',
}

const memoryWithPhoto: Memory = {
  ...memory,
  photoUrl: 'https://example.com/toast.jpg',
  photoStoragePath: 'memory-photos/u1/1-toast.jpg',
}

describe('MemoryDetail', () => {
  it('shows the full read-only memory', () => {
    render(<MemoryDetail memory={memory} bottleName="Eagle Rare" onClose={vi.fn()} />)

    expect(screen.getByText("Dad's retirement toast")).toBeInTheDocument()
    expect(screen.getByText('Celebrated 30 years on the job.')).toBeInTheDocument()
    expect(screen.getByText('With Dad, Mike')).toBeInTheDocument()
  })

  it('requires confirmation before deleting, then calls deleteMemory and closes', async () => {
    const onClose = vi.fn()
    render(<MemoryDetail memory={memory} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(mockDeleteMemory).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }))
    expect(mockDeleteMemory).toHaveBeenCalledWith('m1')
    expect(onClose).toHaveBeenCalled()
  })

  it('opens the form prefilled when Edit is clicked, and saves via updateMemory', async () => {
    const onClose = vi.fn()
    render(<MemoryDetail memory={memory} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Title')).toHaveValue("Dad's retirement toast")

    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(mockUpdateMemory).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ title: "Dad's retirement toast", people: ['Dad', 'Mike'] }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('mentions the photo in the whole-memory delete confirmation when one exists', async () => {
    render(<MemoryDetail memory={memoryWithPhoto} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText(/Delete this memory\?.*also removes its photo/)).toBeInTheDocument()
  })

  it('deleting just the photo requires confirmation, clears it, and cleans up storage, without deleting the memory', async () => {
    const onClose = vi.fn()
    render(<MemoryDetail memory={memoryWithPhoto} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Photo actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete Photo' }))
    expect(screen.getByText('Delete this photo? This removes the photo from this memory and cannot be undone.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Photo' }))

    expect(mockUpdateMemory).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ photoUrl: undefined, photoStoragePath: undefined }),
    )
    expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('memory-photos/u1/1-toast.jpg')
    expect(mockDeleteMemory).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('replacing the photo uploads the new one, saves it, and deletes the old stored file', async () => {
    mockUploadPhoto.mockResolvedValue({ url: 'https://example.com/new.jpg', path: 'memory-photos/u1/2-new.jpg' })
    render(<MemoryDetail memory={memoryWithPhoto} onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Photo actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Replace Photo' }))

    const file = new File(['data'], 'new.jpg', { type: 'image/jpeg' })
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    await userEvent.upload(input!, file)

    expect(mockUploadPhoto).toHaveBeenCalledWith('u1', file, 'memory-photos')
    expect(mockUpdateMemory).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ photoUrl: 'https://example.com/new.jpg', photoStoragePath: 'memory-photos/u1/2-new.jpg' }),
    )
    expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('memory-photos/u1/1-toast.jpg')
  })
})
