import { useState } from 'react'
import { TapChip } from '../ui/TapChip'
import { FLAVOR_FAMILIES, OTHER_LABEL, type FamilyId, type FlavorDescriptor } from '../../features/flavorTaxonomy/taxonomy'
import styles from './FlavorFamilySelector.module.css'

interface FlavorFamilySelectorProps {
  descriptors: FlavorDescriptor[]
  selected: string[]
  onToggle: (label: string) => void
}

// Groups the full tasting-note taxonomy into collapsible, per-family
// sections (Sweet/Fruit/Spice/...) so ~95 descriptors don't render as one
// overwhelming wall of chips. A family starts expanded only if it already
// contains a selected descriptor — so editing an older pour never hides a
// selection the user made — otherwise it starts collapsed. `Other`, plus
// any currently-selected label that isn't in the taxonomy at all (an
// older pour's tag from before this feature, or a renamed/removed one),
// render as their own standalone chips below the family list so nothing
// selected ever silently disappears.
export function FlavorFamilySelector({ descriptors, selected, onToggle }: FlavorFamilySelectorProps) {
  const [openFamilies, setOpenFamilies] = useState<Set<FamilyId>>(
    () => new Set(FLAVOR_FAMILIES.filter((f) => descriptors.some((d) => d.family === f.id && selected.includes(d.label))).map((f) => f.id)),
  )

  function toggleFamily(id: FamilyId) {
    setOpenFamilies((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const knownLabels = new Set(descriptors.map((d) => d.label))
  const legacyLabels = selected.filter((label) => label !== OTHER_LABEL && !knownLabels.has(label))

  return (
    <div className={styles.wrap}>
      {FLAVOR_FAMILIES.map((family) => {
        const familyDescriptors = descriptors.filter((d) => d.family === family.id)
        if (familyDescriptors.length === 0) return null
        const selectedCount = familyDescriptors.filter((d) => selected.includes(d.label)).length
        const isOpen = openFamilies.has(family.id)

        return (
          <div key={family.id} className={styles.family}>
            <button type="button" className={styles.familyHeader} onClick={() => toggleFamily(family.id)} aria-expanded={isOpen}>
              <span className={styles.familyLabel}>{family.label}</span>
              {selectedCount > 0 ? <span className={styles.familyCount}>{selectedCount} selected</span> : null}
              <span className={styles.chevron} aria-hidden="true">
                {isOpen ? '−' : '+'}
              </span>
            </button>
            {isOpen ? (
              <div className={styles.chipRow}>
                {familyDescriptors.map((d) => (
                  <TapChip key={d.label} label={d.label} active={selected.includes(d.label)} onToggle={() => onToggle(d.label)} />
                ))}
              </div>
            ) : null}
          </div>
        )
      })}

      <div className={styles.otherRow}>
        {legacyLabels.map((label) => (
          <TapChip key={label} label={label} active onToggle={() => onToggle(label)} />
        ))}
        <TapChip label={OTHER_LABEL} active={selected.includes(OTHER_LABEL)} onToggle={() => onToggle(OTHER_LABEL)} />
      </div>
    </div>
  )
}
