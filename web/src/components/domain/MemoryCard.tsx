import { useState } from 'react'
import type { Memory } from '../../data/types'
import { MemoryDetail } from '../../features/memories/MemoryDetail'
import styles from './MemoryCard.module.css'

interface MemoryCardProps {
  memory: Memory
  bottleName?: string
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function MemoryCard({ memory, bottleName }: MemoryCardProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const metaParts = [
    dateFormatter.format(new Date(memory.date)),
    memory.occasion,
    memory.people.length > 0 ? memory.people.join(', ') : undefined,
    bottleName,
  ].filter(Boolean)

  return (
    <>
      <button type="button" className={styles.card} onClick={() => setDetailOpen(true)}>
        {memory.photoUrl ? (
          <div className={styles.photoWrap}>
            <img className={styles.photo} src={memory.photoUrl} alt="" />
            <div className={styles.photoOverlay} />
          </div>
        ) : null}
        <div className={styles.body}>
          <div className={styles.title}>{memory.title}</div>
          <div className={styles.meta}>{metaParts.join(' · ')}</div>
          <p className={styles.story}>{memory.story}</p>
        </div>
      </button>

      {detailOpen ? (
        <MemoryDetail memory={memory} bottleName={bottleName} onClose={() => setDetailOpen(false)} />
      ) : null}
    </>
  )
}
