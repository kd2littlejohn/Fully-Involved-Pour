import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { controlClassName } from './Field'
import styles from './Combobox.module.css'

export interface ComboboxOption {
  id: string
  label: string
  sublabel?: string
}

interface ComboboxProps {
  id: string
  value: string
  onChange: (value: string) => void
  onSelect?: (option: ComboboxOption) => void
  getOptions: (query: string) => ComboboxOption[]
  placeholder?: string
}

// A free-typing text input with a filtered suggestion panel underneath —
// picking a suggestion replaces the input value, but nothing stops the
// user from just typing their own text and ignoring the list entirely
// (this field is never required). No existing dropdown/combobox primitive
// existed in the design system before this.
export function Combobox({ id, value, onChange, onSelect, getOptions, placeholder }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)

  const options = open ? getOptions(value) : []

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function selectOption(option: ComboboxOption) {
    onChange(option.label)
    onSelect?.(option)
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || options.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      const active = options[activeIndex]
      if (active) {
        event.preventDefault()
        selectOption(active)
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <input
        id={id}
        className={controlClassName}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange(event.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
        autoComplete="off"
      />
      {open && options.length > 0 ? (
        <ul id={`${id}-listbox`} className={styles.panel} role="listbox">
          {options.map((option, index) => (
            <li key={option.id}>
              <button
                type="button"
                className={index === activeIndex ? `${styles.option} ${styles.optionActive}` : styles.option}
                // Prevents the input from blurring (and the panel from
                // closing) before the click's own onClick fires.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
                role="option"
                aria-selected={index === activeIndex}
              >
                <span className={styles.optionLabel}>{option.label}</span>
                {option.sublabel ? <span className={styles.optionSublabel}>{option.sublabel}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
