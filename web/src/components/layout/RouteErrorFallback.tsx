import { useNavigate, useRouteError } from 'react-router-dom'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import styles from './RouteErrorFallback.module.css'

interface RouteErrorFallbackProps {
  title?: string
  message?: string
  backTo: string
  backLabel: string
}

// Branded replacement for React Router's default "Unexpected Application
// Error" page (raw stack trace, no way back) — attached as an errorElement
// on a route so a page-level crash still leaves the surrounding AppShell
// (nav, header) intact instead of blanking the whole app.
export function RouteErrorFallback({
  title = 'Something went wrong.',
  message = 'This page ran into a problem loading. Your data is safe — try again, or head back.',
  backTo,
  backLabel,
}: RouteErrorFallbackProps) {
  const navigate = useNavigate()
  const error = useRouteError()

  if (import.meta.env.DEV) console.error(error)

  return (
    <EmptyState
      title={title}
      message={message}
      action={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Try Again
          </Button>
          <Button onClick={() => navigate(backTo)}>{backLabel}</Button>
        </div>
      }
    />
  )
}
