import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../../data/firebase'
import { isMockAuthEnabled } from '../../data/devMode'
import { resizeImageFile } from '../ai/imageToBase64'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export class PhotoTooLargeError extends Error {}
export class UnsupportedFileTypeError extends Error {}
export class NotAuthenticatedError extends Error {}

function isAcceptedType(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true
  // iOS reports an empty or generic MIME type for HEIC/HEIF files picked
  // from the photo library in some browser contexts — fall back to the
  // file extension rather than reject a real photo.
  return /\.(heic|heif)$/i.test(file.name)
}

function messageForStorageError(err: unknown): string {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  switch (code) {
    case 'storage/unauthorized':
      return 'You do not have permission to upload this image.'
    case 'storage/canceled':
    case 'storage/retry-limit-exceeded':
      return 'The upload was interrupted. Tap Retry.'
    case 'storage/invalid-argument':
    case 'storage/no-default-bucket':
    case 'storage/project-not-found':
    case 'storage/bucket-not-found':
    case 'storage/unknown':
      return 'Firebase Storage is not configured correctly.'
    default:
      return code ? `The upload was interrupted. Tap Retry. (${code})` : 'The upload was interrupted. Tap Retry.'
  }
}

// Same Storage path convention as the live app: {folder}/{uid}/{timestamp}-{filename}.
export async function uploadPhoto(
  uid: string | undefined,
  file: File,
  folder: 'bottle-photos' | 'memory-photos',
  onProgress?: (fraction: number) => void,
): Promise<string> {
  if (!uid) {
    throw new NotAuthenticatedError('You must be signed in to upload a bottle photo.')
  }
  if (!isAcceptedType(file)) {
    throw new UnsupportedFileTypeError('This file type is not supported.')
  }
  if (file.size > MAX_BYTES) {
    throw new PhotoTooLargeError('That image is larger than 10 MB.')
  }

  if (isMockAuthEnabled()) {
    // Dev fixture session has no real authenticated Storage session to
    // write to — use a local object URL so the UI flow is still testable.
    return URL.createObjectURL(file)
  }

  // Shrink large camera photos before upload — but leave PNGs alone, since
  // the only PNGs in this flow are already-downscaled background-cutout
  // images and re-encoding as JPEG would destroy their transparency.
  // Resizing can fail independently of Storage (e.g. a HEIC variant some
  // mobile browsers can't decode into a canvas) — that's not a reason to
  // abort the whole upload, so fall back to the original file rather than
  // letting an unclassified decode error bubble up as "the upload failed."
  let fileToUpload = file
  if (file.type !== 'image/png') {
    try {
      fileToUpload = await resizeImageFile(file)
    } catch {
      fileToUpload = file
    }
  }

  const path = `${folder}/${uid}/${Date.now()}-${file.name}`
  const storageRef = ref(storage, path)

  try {
    return await new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, fileToUpload, { contentType: fileToUpload.type || 'image/jpeg' })
      task.on(
        'state_changed',
        (snapshot) => onProgress?.(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0),
        (error) => reject(error),
        () => {
          getDownloadURL(task.snapshot.ref).then(resolve, reject)
        },
      )
    })
  } catch (err) {
    throw new Error(messageForStorageError(err))
  }
}
