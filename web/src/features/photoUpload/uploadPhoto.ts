import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../../data/firebase'
import { isMockAuthEnabled } from '../../data/devMode'

const MAX_BYTES = 8 * 1024 * 1024

export class PhotoTooLargeError extends Error {}

// Same Storage path convention as the live app: {folder}/{uid}/{timestamp}-{filename}.
export async function uploadPhoto(uid: string, file: File, folder: 'bottle-photos' | 'memory-photos'): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new PhotoTooLargeError('Photo must be under 8MB.')
  }

  if (isMockAuthEnabled()) {
    // Dev fixture session has no real authenticated Storage session to
    // write to — use a local object URL so the UI flow is still testable.
    return URL.createObjectURL(file)
  }

  const path = `${folder}/${uid}/${Date.now()}-${file.name}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}
