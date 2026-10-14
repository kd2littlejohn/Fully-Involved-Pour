import { useMemo, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { searchDistilleries } from '../../../data/distillery/search'
import type { Bottle } from '../../../data/types'
import { MAX_SAMPLES, addSample, moveSample, removeSample, replaceSample, type DraftCategory } from '../setupDraft'
import type { PartyBottle } from '../types'
import { bottleSummary, partyBottleFromMyBar } from '../partyBottle'
import styles from '../party.module.css'
import local from './setup.module.css'

interface PickerTarget {
  categoryKey: string
  replaceKey?: string
}

export function BottlesStep({
  categories,
  onChange,
  myBar,
}: {
  categories: DraftCategory[]
  onChange: (categories: DraftCategory[]) => void
  myBar: Bottle[]
}) {
  const [picker, setPicker] = useState<PickerTarget | null>(null)

  function updateCategory(next: DraftCategory) {
    onChange(categories.map((c) => (c.key === next.key ? next : c)))
  }

  function choose(bottle: PartyBottle) {
    if (!picker) return
    const category = categories.find((c) => c.key === picker.categoryKey)
    if (!category) return
    updateCategory(picker.replaceKey ? replaceSample(category, picker.replaceKey, bottle) : addSample(category, bottle))
    setPicker(null)
  }

  const pickerCategory = picker ? categories.find((c) => c.key === picker.categoryKey) : undefined

  return (
    <div className={styles.stack} style={{ gap: 'var(--fip-space-5)' }}>
      <p className={styles.notice}>
        Only you see these bottles. Guests see sample letters until you reveal. Picking a bottle never changes your My Bar
        inventory or history.
      </p>
      {categories.map((category, index) => (
        <section key={category.key} className={styles.card} aria-labelledby={`bottles-${category.key}`}>
          <div className={styles.spread}>
            <h2 id={`bottles-${category.key}`} className={styles.sectionTitle}>
              {index + 1}. {category.name}
            </h2>
            <span className={styles.pill}>
              {category.samples.length} {category.samples.length === 1 ? 'bottle' : 'bottles'}
            </span>
          </div>
          {category.locked ? <p className={styles.muted}>Voting has started for this round, so its bottles are locked.</p> : null}
          {category.samples.length === 0 ? (
            <p className={styles.muted}>Add two or more bottles to compete in this round.</p>
          ) : (
            <ol className={styles.list}>
              {category.samples.map((sample, sampleIndex) => (
                <li key={sample.key} className={local.bottleRow}>
                  {sample.bottle.imageUrl ? (
                    <img className={local.bottleThumb} src={sample.bottle.imageUrl} alt="" />
                  ) : (
                    <span className={`${local.bottleThumb} ${local.bottleThumbEmpty}`} aria-hidden="true">
                      FIP
                    </span>
                  )}
                  <div className={styles.grow}>
                    <div className={styles.truncate}>{sample.bottle.name}</div>
                    <div className={`${styles.muted} ${styles.truncate}`}>{bottleSummary(sample.bottle) || 'No details'}</div>
                  </div>
                  {!category.locked ? (
                    <div className={local.bottleActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Move ${sample.bottle.name} up`}
                        disabled={sampleIndex === 0}
                        onClick={() => updateCategory(moveSample(category, sampleIndex, sampleIndex - 1))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Replace ${sample.bottle.name}`}
                        onClick={() => setPicker({ categoryKey: category.key, replaceKey: sample.key })}
                      >
                        ⇄
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Remove ${sample.bottle.name}`}
                        onClick={() => updateCategory(removeSample(category, sample.key))}
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {!category.locked ? (
            <Button
              variant="secondary"
              disabled={category.samples.length >= MAX_SAMPLES}
              onClick={() => setPicker({ categoryKey: category.key })}
            >
              + Add a bottle
            </Button>
          ) : null}
        </section>
      ))}
      {picker && pickerCategory ? (
        <BottlePicker
          title={picker.replaceKey ? 'Replace bottle' : `Add to ${pickerCategory.name}`}
          myBar={myBar}
          alreadyIn={pickerCategory.samples.map((s) => s.bottle.bottleId).filter((id): id is string => Boolean(id))}
          onPick={choose}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  )
}

function BottlePicker({
  title,
  myBar,
  alreadyIn,
  onPick,
  onClose,
}: {
  title: string
  myBar: Bottle[]
  alreadyIn: string[]
  onPick: (bottle: PartyBottle) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'bar' | 'manual'>(myBar.length ? 'bar' : 'manual')
  const [search, setSearch] = useState('')
  const [manual, setManual] = useState({ name: '', distillery: '', type: '', age: '', proof: '', price: '' })
  const [error, setError] = useState<string | null>(null)

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    return myBar
      .filter((b) => !q || b.name.toLowerCase().includes(q) || (b.distillery ?? '').toLowerCase().includes(q) || (b.type ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 60)
  }, [myBar, search])

  const distillerySuggestions = manual.distillery.trim().length >= 2 ? searchDistilleries(manual.distillery, 5) : []

  function submitManual() {
    const name = manual.name.trim()
    if (!name) {
      setError('Enter the bottle name.')
      return
    }
    const proof = manual.proof ? Number(manual.proof) : undefined
    const price = manual.price ? Number(manual.price) : undefined
    if (proof !== undefined && (!Number.isFinite(proof) || proof < 0 || proof > 200)) {
      setError('Proof must be between 0 and 200.')
      return
    }
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
      setError('Enter a valid price.')
      return
    }
    onPick({
      name,
      ...(manual.distillery.trim() ? { distillery: manual.distillery.trim() } : {}),
      ...(manual.type.trim() ? { type: manual.type.trim() } : {}),
      ...(manual.age.trim() ? { age: manual.age.trim() } : {}),
      ...(proof !== undefined ? { proof } : {}),
      ...(price ? { price } : {}),
      source: 'manual',
    })
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className={styles.stack}>
        <div className={styles.row} role="tablist" aria-label="Bottle source">
          <button type="button" role="tab" aria-selected={tab === 'bar'} className={styles.choice} style={{ width: 'auto' }} onClick={() => setTab('bar')}>
            From My Bar
          </button>
          <button type="button" role="tab" aria-selected={tab === 'manual'} className={styles.choice} style={{ width: 'auto' }} onClick={() => setTab('manual')}>
            Add manually
          </button>
        </div>
        {tab === 'bar' ? (
          <>
            <label className={styles.srOnly} htmlFor="bar-search">
              Search My Bar
            </label>
            <input
              id="bar-search"
              type="search"
              className={styles.input}
              placeholder="Search by name, distillery or type"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className={local.pickerList}>
              {matches.length === 0 ? <p className={styles.muted}>No bottles match. Try “Add manually”.</p> : null}
              {matches.map((bottle) => {
                const snapshot = partyBottleFromMyBar(bottle)
                const used = alreadyIn.includes(bottle.id)
                return (
                  <button
                    key={bottle.id}
                    type="button"
                    className={styles.choice}
                    aria-label={`${bottle.name}${used ? ' (already in this round)' : ''}`}
                    onClick={() => onPick(snapshot)}
                    disabled={used}
                  >
                    <div className={styles.grow}>
                      <div className={styles.truncate}>{bottle.name}</div>
                      <div className={`${styles.muted} ${styles.truncate}`}>{used ? 'Already in this round' : bottleSummary(snapshot)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <p className={styles.muted}>Bottles added here stay with this party only — nothing is added to My Bar.</p>
            <label className={styles.label} htmlFor="manual-name">
              Bottle name
            </label>
            <input id="manual-name" className={styles.input} value={manual.name} maxLength={120} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
            <label className={styles.label} htmlFor="manual-distillery">
              Distillery
            </label>
            <input
              id="manual-distillery"
              className={styles.input}
              list="manual-distillery-options"
              value={manual.distillery}
              maxLength={120}
              onChange={(e) => setManual({ ...manual, distillery: e.target.value })}
            />
            <datalist id="manual-distillery-options">
              {distillerySuggestions.map((d) => (
                <option key={d.id} value={d.name} />
              ))}
            </datalist>
            <div className={local.formGrid}>
              <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
                <label className={styles.label} htmlFor="manual-type">
                  Type
                </label>
                <input id="manual-type" className={styles.input} value={manual.type} maxLength={60} placeholder="Bourbon" onChange={(e) => setManual({ ...manual, type: e.target.value })} />
              </div>
              <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
                <label className={styles.label} htmlFor="manual-age">
                  Age
                </label>
                <input id="manual-age" className={styles.input} value={manual.age} maxLength={40} placeholder="8 years" onChange={(e) => setManual({ ...manual, age: e.target.value })} />
              </div>
              <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
                <label className={styles.label} htmlFor="manual-proof">
                  Proof
                </label>
                <input id="manual-proof" className={styles.input} inputMode="decimal" value={manual.proof} onChange={(e) => setManual({ ...manual, proof: e.target.value })} />
              </div>
              <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
                <label className={styles.label} htmlFor="manual-price">
                  Price ($)
                </label>
                <input id="manual-price" className={styles.input} inputMode="decimal" value={manual.price} onChange={(e) => setManual({ ...manual, price: e.target.value })} />
              </div>
            </div>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <Button onClick={submitManual}>Add bottle</Button>
          </>
        )}
      </div>
    </Modal>
  )
}
