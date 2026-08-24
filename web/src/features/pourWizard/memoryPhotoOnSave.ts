import { uploadPhoto, deletePhotoIfSafe } from '../photoUpload/uploadPhoto'
import type { Pour, PourMemoryPhoto } from '../../data/types'

// Fires after a pour is already safely saved (see PourWizard.tsx) — never
// awaited from the save flow, so a slow or failed upload never delays
// finishing a pour or loses any of its other data. Mirrors the same
// fire-and-forget shape as tastingSummaryOnSave.ts. Best-effort deletes the
// previously stored file on a replace, once the new one is safely attached.
export async function uploadAndSaveMemoryPhoto(
  uid: string,
  pour: Pour,
  file: File,
  updatePourMemoryPhoto: (pourId: string, memoryPhoto: PourMemoryPhoto | undefined) => Promise<void>,
): Promise<void> {
  const oldPath = pour.memoryPhoto?.storagePath
  try {
    const { url, path } = await uploadPhoto(uid, file, 'memory-photos')
    await updatePourMemoryPhoto(pour.id, { url, storagePath: path, createdAt: Date.now() })
    if (oldPath && oldPath !== path) void deletePhotoIfSafe(oldPath)
  } catch (err) {
    console.error('[memoryPhotoOnSave] uploadAndSaveMemoryPhoto failed', { pourId: pour.id, err })
  }
}
