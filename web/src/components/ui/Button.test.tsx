import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'
import styles from './Button.module.css'

describe('Button', () => {
  it('defaults to the primary variant', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(styles.primary!)
  })

  it('applies the danger variant for destructive actions', () => {
    render(<Button variant="danger">Delete Photo</Button>)
    expect(screen.getByRole('button', { name: 'Delete Photo' })).toHaveClass(styles.danger!)
  })
})
