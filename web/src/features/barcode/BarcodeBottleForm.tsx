import { Field, controlClassName } from '../../components/ui/Field'
import { RELEASE_KIND_LABELS, SOURCE_LABELS, editDraft, type BottleDraft, type DraftField } from './options'
import styles from './Barcode.module.css'

// The details of the picked bottle, every value tagged with where it came
// from, so verified facts, AXE suggestions and what was read off this
// bottle's own label are never confused. All fields stay editable.

const CATEGORIES = ['Bourbon', 'Rye', 'Scotch', 'Irish', 'Tequila', 'Rum', 'Other Spirit']

interface FieldSpec {
  field: DraftField
  label: string
  inputMode?: 'decimal' | 'numeric'
}

const TEXT_FIELDS: FieldSpec[] = [
  { field: 'name', label: 'Bottle name' },
  { field: 'distillery', label: 'Distillery' },
  { field: 'expression', label: 'Expression' },
  { field: 'proof', label: 'Proof', inputMode: 'decimal' },
  { field: 'sizeMl', label: 'Size (ml)', inputMode: 'numeric' },
  { field: 'ageStatement', label: 'Age statement' },
  { field: 'batch', label: 'Batch (from your label)' },
  { field: 'barrel', label: 'Barrel (from your label)' },
  { field: 'storePick', label: 'Store pick (from your label)' },
]

interface BarcodeBottleFormProps {
  draft: BottleDraft
  onChange: (draft: BottleDraft) => void
}

export function BarcodeBottleForm({ draft, onChange }: BarcodeBottleFormProps) {
  const id = (field: DraftField) => `barcode-bottle-${field}`
  const tag = (field: DraftField) => {
    const source = draft.sources[field]
    return source && draft.values[field] ? (
      <span className={styles.tag} data-trust={source}>
        {SOURCE_LABELS[source]}
      </span>
    ) : null
  }
  const conflict = (field: DraftField) =>
    draft.labelConflicts[field] ? (
      <p className={styles.conflict}>
        Your label shows {draft.labelConflicts[field]}.{' '}
        <button type="button" className={styles.linkButton} onClick={() => onChange(editDraft(draft, field, draft.labelConflicts[field] ?? ''))}>
          Use that
        </button>
      </p>
    ) : null

  return (
    <div className={styles.form}>
      {TEXT_FIELDS.map(({ field, label, inputMode }) => (
        <div key={field}>
          <Field label={label} htmlFor={id(field)} required={field === 'name'}>
            <input
              id={id(field)}
              className={controlClassName}
              inputMode={inputMode}
              value={draft.values[field]}
              placeholder={field === 'proof' && draft.proofVaries ? 'Varies by batch or barrel — enter it from your label' : undefined}
              onChange={(e) => onChange(editDraft(draft, field, e.target.value))}
            />
          </Field>
          {tag(field)}
          {conflict(field)}
        </div>
      ))}
      <div>
        <Field label="Release" htmlFor={id('releaseKind')}>
          <select
            id={id('releaseKind')}
            className={controlClassName}
            value={draft.values.releaseKind}
            onChange={(e) => onChange(editDraft(draft, 'releaseKind', e.target.value))}
          >
            <option value="">Not sure</option>
            {Object.entries(RELEASE_KIND_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </Field>
        {tag('releaseKind')}
      </div>
      <div>
        <Field label="Type" htmlFor={id('category')}>
          <select
            id={id('category')}
            className={controlClassName}
            value={draft.values.category}
            onChange={(e) => onChange(editDraft(draft, 'category', e.target.value))}
          >
            <option value="">Not sure</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        {tag('category')}
      </div>
    </div>
  )
}
