import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditProfilePage } from './EditProfilePage'

const mockNavigate = vi.fn()
const mockUpdateProfile = vi.fn().mockResolvedValue(undefined)
const mockClaimUsername = vi.fn().mockResolvedValue(undefined)
const mockUploadPhoto = vi.fn()
const mockDeletePhotoIfSafe = vi.fn().mockResolvedValue(undefined)

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', displayName: 'Dev Preview' }, loading: false }),
}))

let mockProfile: { displayName?: string; photoURL?: string; photoStoragePath?: string } | undefined

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    userDoc: { username: 'devpreview' },
    profile: mockProfile,
    claimUsername: mockClaimUsername,
    updateProfile: mockUpdateProfile,
  }),
}))

vi.mock('../../features/photoUpload/uploadPhoto', () => ({
  uploadPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
  deletePhotoIfSafe: (...args: unknown[]) => mockDeletePhotoIfSafe(...args),
  NotAuthenticatedError: class NotAuthenticatedError extends Error {},
  PhotoTooLargeError: class PhotoTooLargeError extends Error {},
  UnsupportedFileTypeError: class UnsupportedFileTypeError extends Error {},
}))

beforeEach(() => {
  mockNavigate.mockClear()
  mockUpdateProfile.mockClear()
  mockClaimUsername.mockClear()
  mockUploadPhoto.mockReset()
  mockDeletePhotoIfSafe.mockReset().mockResolvedValue(undefined)
  mockProfile = { displayName: 'Dev Preview', photoURL: 'https://example.com/old.jpg', photoStoragePath: 'profile-photos/u1/1-old.jpg' }
})

describe('EditProfilePage', () => {
  it('shows a Remove Photo button only when a photo exists', () => {
    render(<EditProfilePage />)
    expect(screen.getByRole('button', { name: 'Remove Photo' })).toBeInTheDocument()
  })

  it('does not show Remove Photo when there is no photo', () => {
    mockProfile = { displayName: 'Dev Preview' }
    render(<EditProfilePage />)
    expect(screen.queryByRole('button', { name: 'Remove Photo' })).not.toBeInTheDocument()
  })

  it('removing the photo clears the preview and saves the removal, cleaning up the old file only after a successful save', async () => {
    const { container } = render(<EditProfilePage />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/old.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Remove Photo' }))
    expect(container.querySelector('img')).not.toBeInTheDocument()
    // Nothing deleted yet — only cleared locally until the form is saved.
    expect(mockDeletePhotoIfSafe).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ photoURL: undefined, photoStoragePath: undefined }),
    )
    expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('profile-photos/u1/1-old.jpg')
    expect(mockNavigate).toHaveBeenCalledWith('/profile')
  })

  it('replacing the photo uploads the new one and cleans up the old stored file on save', async () => {
    mockUploadPhoto.mockResolvedValue({ url: 'https://example.com/new.jpg', path: 'profile-photos/u1/2-new.jpg' })
    render(<EditProfilePage />)

    const file = new File(['data'], 'new.jpg', { type: 'image/jpeg' })
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    await userEvent.upload(input!, file)

    expect(mockDeletePhotoIfSafe).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ photoURL: 'https://example.com/new.jpg', photoStoragePath: 'profile-photos/u1/2-new.jpg' }),
    )
    expect(mockDeletePhotoIfSafe).toHaveBeenCalledWith('profile-photos/u1/1-old.jpg')
  })

  it('does not delete anything when the photo is left unchanged', async () => {
    render(<EditProfilePage />)
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(mockDeletePhotoIfSafe).not.toHaveBeenCalled()
  })
})
