import { useMemo, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { controlClassName } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import type { Bottle, Pour } from '../../data/types'
import styles from './BottlePickerModal.module.css'

interface BottlePickerModalProps {
  bottles: Bottle[]
  pours?: Pour[]
  onPick: (bottleId: string) => void
  onClose: () => void
}

const RECENTLY_POURED_LIMIT = 5

function matchesQuery(bottle: Bottle, query: string): boolean {
  const haystack = `${bottle.name} ${bottle.distillery ?? ''}`.toLowerCase()
  return haystack.includes(query)
}

// Shared by StartPourStoryButton, QuickPourButton, and StartAPourButton —
// all need to ask "which bottle?" before opening their respective flow when
// no bottleId is already known from context (Home/Journal vs. Bottle
// Details). Tapping a row picks immediately — no separate "Continue" step.
export function BottlePickerModal({ bottles, pours = [], onPick, onClose }: BottlePickerModalProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? bottles.filter((b) => matchesQuery(b, q)) : bottles
  }, [bottles, query])

  const { recentlyPoured, openBottles, otherBottles } = useMemo(() => {
    const lastPourDate = new Map<string, string>()
    for (const pour of pours) {
      const existing = lastPourDate.get(pour.bottleId)
      if (!existing || pour.date > existing) lastPourDate.set(pour.bottleId, pour.date)
    }

    const recent = filtered
      .filter((b) => lastPourDate.has(b.id))
      .sort((a, b) => (lastPourDate.get(b.id) ?? '').localeCompare(lastPourDate.get(a.id) ?? ''))
      .slice(0, RECENTLY_POURED_LIMIT)
    const recentIds = new Set(recent.map((b) => b.id))

    const open = filtered.filter((b) => !recentIds.has(b.id) && b.status === 'open')
    const openIds = new Set(open.map((b) => b.id))

    const rest = filtered.filter((b) => !recentIds.has(b.id) && !openIds.has(b.id))

    return { recentlyPoured: recent, openBottles: open, otherBottles: rest }
  }, [filtered, pours])

  const groups: { label: string; items: Bottle[] }[] = [
    { label: 'Recently Poured', items: recentlyPoured },
    { label: 'Open Bottles', items: openBottles },
    { label: query.trim() ? 'Other Matches' : 'All Bottles', items: otherBottles },
  ].filter((g) => g.items.length > 0)

  return (
    <Modal title="Which bottle?" onClose={onClose}>
      {bottles.length === 0 ? (
        <EmptyState title="No bottles to pour yet." message="Add a bottle to your bar first." />
      ) : (
        <>
          <input
            type="search"
            className={controlClassName}
            placeholder="Search your bar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search your bar"
          />

          {groups.length === 0 ? (
            <p className={styles.noMatches}>No bottles match &ldquo;{query}&rdquo;.</p>
          ) : (
            <div className={styles.groups}>
              {groups.map((group) => (
                <div key={group.label} className={styles.group}>
                  <div className={styles.groupLabel}>{group.label}</div>
                  {group.items.map((bottle) => (
                    <button key={bottle.id} type="button" className={styles.row} onClick={() => onPick(bottle.id)}>
                      <span className={styles.rowName}>{bottle.name}</span>
                      {bottle.distillery ? <span className={styles.rowMeta}>{bottle.distillery}</span> : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
