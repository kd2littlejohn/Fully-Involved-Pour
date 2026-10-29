import { GROUP_HINT, GROUP_LABEL, GROUPS } from '../dualGroups'
import type { PartyDualSettings } from '../types'
import styles from '../party.module.css'
import local from './setup.module.css'

function parseCount(raw: string): number | null {
  const digits = raw.replace(/\D/g, '')
  return digits ? Math.min(150, Number(digits)) : null
}

// Dual Experience options in the Details step: where new guests start,
// and the planned group sizes (just targets, shown on the dashboard; any
// number of people can join either group).
export function DualOptions({ dual, onChange }: { dual: PartyDualSettings; onChange: (next: PartyDualSettings) => void }) {
  return (
    <section className={styles.stack} style={{ gap: 'var(--fip-space-3)' }} aria-labelledby="dual-options-heading">
      <h3 id="dual-options-heading" className={styles.label}>
        Guided and blind groups
      </h3>
      <p className={styles.muted}>
        Everyone joins with the same code. You move people between groups from your dashboard before they start scoring.
      </p>
      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>New guests start in</legend>
        <div className={styles.row}>
          {(['blind', 'guided'] as const).map((group) => (
            <label key={group} className={styles.choice} style={{ flex: '1 1 200px', width: 'auto' }}>
              <input type="radio" name="join-group" value={group} checked={dual.joinGroup === group} onChange={() => onChange({ ...dual, joinGroup: group })} />
              <span style={{ fontWeight: 700 }}>
                {GROUP_LABEL[group]}
                {group === 'blind' ? ' (recommended)' : ''}
                <span className={styles.muted} style={{ display: 'block', fontWeight: 400 }}>
                  {group === 'blind' ? 'Nobody sees a bottle until you move them to Guided.' : GROUP_HINT.guided}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className={local.formGrid}>
        {GROUPS.map((group) => {
          const key = group === 'guided' ? 'plannedGuided' : 'plannedBlind'
          return (
            <div key={group} className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
              <label className={styles.label} htmlFor={`planned-${group}`}>
                Planned {GROUP_LABEL[group].toLowerCase()} tasters (optional)
              </label>
              <input
                id={`planned-${group}`}
                className={styles.input}
                inputMode="numeric"
                value={dual[key] ?? ''}
                placeholder={group === 'guided' ? 'e.g. 7' : 'e.g. 3'}
                onChange={(e) => onChange({ ...dual, [key]: parseCount(e.target.value) })}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
