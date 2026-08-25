import { uploadPhoto } from './uploadPhoto'
import { standardizeBottlePhoto } from './standardizeBottlePhoto'
import type { ImageProcessingStatus } from '../../data/types'

export interface BottlePhotoUploadResult {
  imageUrl: string
  originalImageUrl: string
  imageStoragePath?: string
  originalImageStoragePath?: string
  imageProcessingStatus: ImageProcessingStatus
}

// The single place Add Bottle / Edit Bottle / "Replace Photo" all go
// through: standardize the photo into a 4:5 FIP display image, then upload
// it alongside the untouched original — both land in the same
// bottle-photos/{uid}/ Storage path used today, just as two distinct,
// uniquely-named objects (see displayFileName in standardizeBottlePhoto.ts),
// so nothing is ever overwritten and no new Storage rules are needed.
export async function standardizeAndUploadBottlePhoto(
  uid: string | undefined,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<BottlePhotoUploadResult> {
  const { displayFile, originalFile, status } = await standardizeBottlePhoto(file)

  const [display, original] = await Promise.all([
    uploadPhoto(uid, displayFile, 'bottle-photos', onProgress),
    uploadPhoto(uid, originalFile, 'bottle-photos'),
  ])

  return {
    imageUrl: display.url,
    originalImageUrl: original.url,
    imageStoragePath: display.path,
    originalImageStoragePath: original.path,
    imageProcessingStatus: status,
  }
}
