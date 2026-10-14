import { useMemo, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { TapChip } from '../../../components/ui/TapChip'
import { DEFAULT_CATEGORY_LIBRARY, libraryTags, searchLibrary, type LibraryCategory } from '../categoryLibrary'
import { MAX_CATEGORIES, duplicateCategory, moveItem, newDraftCategory, type DraftCategory } from '../setupDraft'
import type { PartyTemplate, SavedTastingCategory } from '../types'
import styles from '../party.module.css'
import local from './setup.module.css'

interface CategoriesStepProps {
  categories: DraftCategory[]
  onChange: (categories: DraftCategory[]) => void
  saved: SavedTastingCategory[]
  templates: PartyTemplate[]
  onSaveCustom: (input: { id?: string; name: string; description: string }) => Promise<SavedTastingCategory | undefined>
  onDeleteCustom: (id: string) => Promise<void>
  onSaveTemplate: (name: string) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
}

export function CategoriesStep({
  categories,
  onChange,
  saved,
  templates,
  onSaveCustom,
  onDeleteCustom,
  onSaveTemplate,
  onDeleteTemplate,
}: CategoriesStepProps) {
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<string | undefined>(undefined)
  const [customName, setCustomName] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [saveToLibrary, setSaveToLibrary] = useState(true)
  const [templateName, setTemplateName] = useState('')
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null)
  const [editingSavedName, setEditingSavedName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const library: LibraryCategory[] = useMemo(
    () => [
      ...saved.map((s) => ({ id: s.id, name: s.name, description: s.description, tags: ['my categories'], custom: true })),
      ...DEFAULT_CATEGORY_LIBRARY,
    ],
    [saved],
  )
  const tags = useMemo(() => libraryTags(library), [library])
  const results = searchLibrary(library, search, tag)
  const full = categories.length >= MAX_CATEGORIES

  function add(entry: { libraryId: string | null; name: string; description: string }) {
    if (full) return
    onChange([...categories, newDraftCategory(entry)])
    setMessage(`Added "${entry.name}".`)
  }

  function update(key: string, patch: Partial<DraftCategory>) {
    onChange(categories.map((c) => (c.key === key ? { ...c, ...patch } : c)))
  }

  async function addCustom() {
    const name = customName.trim()
    if (!name) return
    let libraryId: string | null = null
    if (saveToLibrary) {
      const record = await onSaveCustom({ name, description: customDescription.trim() })
      libraryId = record?.id ?? null
    }
    add({ libraryId, name, description: customDescription.trim() })
    setCustomName('')
    setCustomDescription('')
  }

  function applyTemplate(template: PartyTemplate) {
    const room = MAX_CATEGORIES - categories.length
    onChange([...categories, ...template.categories.slice(0, room).map((c) => newDraftCategory(c))])
    setMessage(`Added ${Math.min(room, template.categories.length)} rounds from "${template.name}".`)
  }

  return (
    <div className={styles.stack} style={{ gap: 'var(--fip-space-5)' }}>
      <section className={styles.card} aria-labelledby="selected-heading">
        <div className={styles.spread}>
          <h2 id="selected-heading" className={styles.sectionTitle}>
            Your rounds
          </h2>
          <span className={styles.pill}>
            {categories.length} / {MAX_CATEGORIES}
          </span>
        </div>
        {categories.length === 0 ? (
          <p className={styles.muted}>Pick categories below. Each one becomes a round with its own blind flight.</p>
        ) : (
          <ol className={styles.list}>
            {categories.map((category, index) => (
              <li key={category.key} className={`${styles.listItem} ${local.roundItem}`}>
                <span className={`${styles.sampleBadge} ${styles.sampleBadgeSmall}`} aria-hidden="true">
                  {index + 1}
                </span>
                <div className={`${styles.grow} ${styles.stack}`} style={{ gap: 'var(--fip-space-2)' }}>
                  <label className={styles.srOnly} htmlFor={`round-name-${category.key}`}>
                    Round {index + 1} name
                  </label>
                  <input
                    id={`round-name-${category.key}`}
                    className={styles.input}
                    value={category.name}
                    maxLength={80}
                    onChange={(e) => update(category.key, { name: e.target.value })}
                  />
                  <label className={styles.srOnly} htmlFor={`round-theme-${category.key}`}>
                    Round {index + 1} description or tasting theme
                  </label>
                  <input
                    id={`round-theme-${category.key}`}
                    className={styles.input}
                    value={category.description}
                    maxLength={400}
                    placeholder="Description or tasting theme (optional)"
                    onChange={(e) => update(category.key, { description: e.target.value })}
                  />
                  {category.locked ? <span className={styles.muted}>Voting has started — this round can’t be removed.</span> : null}
                </div>
                <div className={local.roundActions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={`Move ${category.name} up`}
                    disabled={index === 0}
                    onClick={() => onChange(moveItem(categories, index, index - 1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={`Move ${category.name} down`}
                    disabled={index === categories.length - 1}
                    onClick={() => onChange(moveItem(categories, index, index + 1))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={`Duplicate ${category.name} as another round`}
                    disabled={full}
                    onClick={() => {
                      const copy = duplicateCategory(category, categories.map((c) => c.name))
                      onChange([...categories.slice(0, index + 1), copy, ...categories.slice(index + 1)])
                    }}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={`Remove ${category.name}`}
                    disabled={category.locked}
                    onClick={() => onChange(categories.filter((c) => c.key !== category.key))}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {categories.length > 0 ? (
          <div className={styles.row}>
            <label className={styles.srOnly} htmlFor="template-name">
              Setup name
            </label>
            <input
              id="template-name"
              className={`${styles.input} ${styles.grow}`}
              style={{ width: 'auto' }}
              placeholder="Save this lineup as a setup…"
              value={templateName}
              maxLength={80}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <Button
              variant="secondary"
              disabled={!templateName.trim()}
              onClick={async () => {
                await onSaveTemplate(templateName.trim())
                setMessage(`Saved setup "${templateName.trim()}".`)
                setTemplateName('')
              }}
            >
              Save setup
            </Button>
          </div>
        ) : null}
      </section>

      {templates.length > 0 ? (
        <section className={styles.card} aria-labelledby="templates-heading">
          <h2 id="templates-heading" className={styles.sectionTitle}>
            Saved setups
          </h2>
          <ul className={styles.list}>
            {templates.map((t) => (
              <li key={t.id} className={styles.listItem}>
                <div className={styles.grow}>
                  <div>{t.name}</div>
                  <div className={`${styles.muted} ${styles.truncate}`}>{t.categories.map((c) => c.name).join(' · ')}</div>
                </div>
                <Button variant="secondary" disabled={full} onClick={() => applyTemplate(t)}>
                  Use
                </Button>
                <button type="button" className={styles.iconButton} aria-label={`Delete setup ${t.name}`} onClick={() => onDeleteTemplate(t.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.card} aria-labelledby="library-heading">
        <h2 id="library-heading" className={styles.sectionTitle}>
          Tasting Category Library
        </h2>
        <label className={styles.srOnly} htmlFor="library-search">
          Search categories
        </label>
        <input
          id="library-search"
          type="search"
          className={styles.input}
          placeholder="Search categories"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className={styles.row} role="group" aria-label="Filter by tag">
          <TapChip label="All" active={!tag} onToggle={() => setTag(undefined)} />
          {tags.map((t) => (
            <TapChip key={t} label={t} active={tag === t} onToggle={() => setTag(tag === t ? undefined : t)} />
          ))}
        </div>
        <div className={local.libraryGrid}>
          {results.map((entry) => {
            const count = categories.filter((c) => c.libraryId === entry.id).length
            return (
              <div key={entry.id} className={local.libraryCard}>
                <div className={styles.grow}>
                  <div className={styles.spread}>
                    <strong>{entry.name}</strong>
                    {entry.custom ? <span className={styles.pill}>Mine</span> : null}
                  </div>
                  <p className={styles.muted}>{entry.description}</p>
                </div>
                <div className={styles.spread}>
                  <span className={styles.muted}>{count ? `${count} in this party` : ''}</span>
                  <Button
                    variant={count ? 'secondary' : 'primary'}
                    disabled={full}
                    aria-label={`Add ${entry.name}`}
                    onClick={() => add({ libraryId: entry.id, name: entry.name, description: entry.description })}
                  >
                    {count ? 'Add again' : 'Add'}
                  </Button>
                </div>
                {entry.custom ? (
                  editingSavedId === entry.id ? (
                    <div className={styles.row}>
                      <label className={styles.srOnly} htmlFor={`rename-${entry.id}`}>
                        New name
                      </label>
                      <input
                        id={`rename-${entry.id}`}
                        className={`${styles.input} ${styles.grow}`}
                        style={{ width: 'auto' }}
                        value={editingSavedName}
                        maxLength={80}
                        onChange={(e) => setEditingSavedName(e.target.value)}
                      />
                      <Button
                        variant="secondary"
                        disabled={!editingSavedName.trim()}
                        onClick={async () => {
                          await onSaveCustom({ id: entry.id, name: editingSavedName.trim(), description: entry.description })
                          setEditingSavedId(null)
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  ) : (
                    <div className={styles.row}>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingSavedId(entry.id)
                          setEditingSavedName(entry.name)
                        }}
                      >
                        Rename
                      </Button>
                      <Button variant="ghost" onClick={() => onDeleteCustom(entry.id)}>
                        Delete
                      </Button>
                    </div>
                  )
                ) : null}
              </div>
            )
          })}
          {results.length === 0 ? <p className={styles.muted}>No categories match. Create your own below.</p> : null}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="custom-heading">
        <h2 id="custom-heading" className={styles.sectionTitle}>
          Create a custom category
        </h2>
        <label className={styles.label} htmlFor="custom-name">
          Name
        </label>
        <input
          id="custom-name"
          className={styles.input}
          value={customName}
          maxLength={80}
          placeholder="e.g. Kentucky Owl Night"
          onChange={(e) => setCustomName(e.target.value)}
        />
        <label className={styles.label} htmlFor="custom-description">
          Description or tasting theme
        </label>
        <input
          id="custom-description"
          className={styles.input}
          value={customDescription}
          maxLength={400}
          onChange={(e) => setCustomDescription(e.target.value)}
        />
        <label className={styles.row}>
          <input type="checkbox" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)} />
          <span className={styles.muted}>Save to my library for future parties</span>
        </label>
        <Button disabled={!customName.trim() || full} onClick={addCustom}>
          Add custom category
        </Button>
      </section>
      <p className={styles.srOnly} aria-live="polite">
        {message}
      </p>
    </div>
  )
}
