import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickAddFromPhotoButton } from './QuickAddFromPhotoButton'

const mockScan = vi.fn()
const mockAddBottle = vi.fn().mockResolvedValue(undefined)

vi.mock('../ai/imageToBase64', () => ({
  downscaleImageToJpegBase64: () => Promise.resolve('base64data'),
}))

vi.mock('../../data/repositories/ai', () => ({
  scanBottleLabel: (...args: unknown[]) => mockScan(...args),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ addBottle: mockAddBottle }),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}))

beforeEach(() => {
  mockScan.mockReset()
  mockAddBottle.mockClear()
})

describe('QuickAddFromPhotoButton', () => {
  it('scans an uploaded photo and opens the Add Bottle form prefilled', async () => {
    mockScan.mockResolvedValue({
      found: true,
      name: 'Eagle Rare 10 Year',
      distillery: 'Buffalo Trace',
      type: 'Bourbon',
      proof: 90,
    })
    render(<QuickAddFromPhotoButton />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(await screen.findByDisplayValue('Eagle Rare 10 Year')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Buffalo Trace')).toBeInTheDocument()
    expect(screen.getByDisplayValue('90')).toBeInTheDocument()
  })

  it('still opens the form for manual entry when the scan finds nothing', async () => {
    mockScan.mockResolvedValue({ found: false })
    render(<QuickAddFromPhotoButton />)

    const file = new File(['data'], 'bottle.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(
      await screen.findByText("Couldn't read a bottle label in that photo — fill in the details manually below."),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Bottle name')).toHaveValue('')
  })
})
