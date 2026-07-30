import type { Bottle } from '../../../data/types'
import { EmptyState } from '../../../components/ui/EmptyState'
import { PhotoUploadField } from '../../../features/photoUpload/PhotoUploadField'
import { useUserData } from '../../../hooks/useUserData'
import styles from './GalleryTab.module.css'

export function GalleryTab({ bottle }: { bottle: Bottle }) {
  const gallery = bottle.gallery ?? []
  const { addGalleryPhoto } = useUserData()

  return (
    <>
      {gallery.length === 0 ? (
        <EmptyState title="No photos yet." message="Add a photo of this bottle." />
      ) : (
        <div className={styles.grid}>
          {gallery.map((photo, index) => (
            <figure className={styles.item} key={photo.url + index}>
              <img className={styles.image} src={photo.url} alt={photo.caption ?? ''} />
              {photo.caption ? <figcaption className={styles.caption}>{photo.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      )}

      <PhotoUploadField
        label="Add a photo"
        folder="bottle-photos"
        onUploaded={(url) => addGalleryPhoto(bottle.id, { url })}
      />
    </>
  )
}
