import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { RouteErrorFallback } from './RouteErrorFallback'

function ThrowingPage(): never {
  throw new Error('boom')
}

function renderWithCrash() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        errorElement: <RouteErrorFallback backTo="/collection" backLabel="Back to My Bar" />,
        children: [{ index: true, element: <ThrowingPage /> }],
      },
      { path: '/collection', element: <div>My Bar</div> },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('RouteErrorFallback', () => {
  it('shows a branded error state instead of a raw stack trace when a route crashes', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderWithCrash()

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to My Bar' })).toBeInTheDocument()
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('Back to My Bar navigates to the given backTo route', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderWithCrash()

    await userEvent.click(screen.getByRole('button', { name: 'Back to My Bar' }))
    // Navigating away from the crashed route unmounts it — the error state
    // disappears without needing a page reload.
    expect(screen.queryByText('Something went wrong.')).not.toBeInTheDocument()

    consoleSpy.mockRestore()
  })
})
