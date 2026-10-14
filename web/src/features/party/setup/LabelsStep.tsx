import { Button } from '../../../components/ui/Button'
import { SAMPLE_LABELS, assignLabel, shuffleLabels, type DraftCategory } from '../setupDraft'
import styles from '../party.module.css'
import local from './setup.module.css'

// Step 4: each round gets its own blind letters. Randomized by default;
// the host can reshuffle or pick letters by hand.
export function LabelsStep({ categories, onChange }: { categories: DraftCategory[]; onChange: (categories: DraftCategory[]) => void }) {
  function update(next: DraftCategory) {
    onChange(categories.map((c) => (c.key === next.key ? next : c)))
  }

  const withBottles = categories.filter((c) => c.samples.length > 0)

  return (
    <div className={styles.stack} style={{ gap: 'var(--fip-space-5)' }}>
      <p className={styles.notice}>
        Pour each bottle into the glass with its letter. Letters are shuffled for you — only you can see this mapping, and
        it’s stored where guests can’t read it.
      </p>
      {withBottles.length === 0 ? <p className={styles.muted}>Add bottles to your rounds first.</p> : null}
      {withBottles.map((category) => {
        const labels = SAMPLE_LABELS.slice(0, category.samples.length)
        const sorted = [...category.samples].sort((a, b) => a.label.localeCompare(b.label))
        return (
          <section key={category.key} className={styles.card} aria-labelledby={`labels-${category.key}`}>
            <div className={styles.spread}>
              <h2 id={`labels-${category.key}`} className={styles.sectionTitle}>
                {category.name}
              </h2>
              {category.locked ? (
                <span className={styles.pill}>Locked</span>
              ) : (
                <Button variant="secondary" onClick={() => update({ ...category, samples: shuffleLabels(category.samples), manualLabels: true, samplesDirty: true })}>
                  Shuffle letters
                </Button>
              )}
            </div>
            <ul className={styles.list}>
              {sorted.map((sample) => (
                <li key={sample.key} className={styles.listItem}>
                  <span className={styles.sampleBadge} aria-hidden="true">
                    {sample.label}
                  </span>
                  <span className={`${styles.grow} ${styles.truncate}`}>{sample.bottle.name}</span>
                  {!category.locked ? (
                    <>
                      <label className={styles.srOnly} htmlFor={`label-${sample.key}`}>
                        Letter for {sample.bottle.name}
                      </label>
                      <select
                        id={`label-${sample.key}`}
                        className={`${styles.input} ${local.labelSelect}`}
                        style={{ width: 'auto' }}
                        value={sample.label}
                        onChange={(e) =>
                          update({ ...category, samples: assignLabel(category.samples, sample.key, e.target.value), manualLabels: true, samplesDirty: true })
                        }
                      >
                        {labels.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
