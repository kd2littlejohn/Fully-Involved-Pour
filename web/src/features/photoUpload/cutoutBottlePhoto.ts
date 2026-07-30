import { downscaleImageToJpegBase64 } from '../ai/imageToBase64'
import { removeBottleBackground } from '../../data/repositories/ai'
import { isMockAuthEnabled } from '../../data/devMode'

// Cuts the bottle out of its background on the server, so the clean product
// shot works on any device. Falls back to the original file on any failure —
// a plain cropped photo beats a broken upload.
export async function cutoutBottlePhoto(file: File): Promise<File> {
  if (isMockAuthEnabled()) return file
  try {
    const base64 = await downscaleImageToJpegBase64(file, 1024)
    const outBase64 = await removeBottleBackground(base64)
    const blob = await (await fetch(`data:image/png;base64,${outBase64}`)).blob()
    return new File([blob], file.name.replace(/\.\w+$/, '.png'), { type: 'image/png' })
  } catch {
    return file
  }
}
