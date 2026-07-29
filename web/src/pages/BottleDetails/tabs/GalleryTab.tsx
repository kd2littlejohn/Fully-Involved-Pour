import type { Bottle } from '../../../data/types'
import { EmptyState } from '../../../components/ui/EmptyState'
import styles from './GalleryTab.module.css'

export function GalleryTab({ bottle }: { bottle: Bottle }) {
  const gallery = bottle.gallery ?? []

  if (gallery.length === 0) {
    return <EmptyState title="No photos yet." message="Photo uploads are coming in a later phase of this rebuild." />
  }

  return (
    <div className={styles.grid}>
      {gallery.map((photo, index) => (
        <figure className={styles.item} key={photo.url + index}>
          <img className={styles.image} src={photo.url} alt={photo.caption ?? ''} />
          {photo.caption ? <figcaption className={styles.caption}>{photo.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  )
}
