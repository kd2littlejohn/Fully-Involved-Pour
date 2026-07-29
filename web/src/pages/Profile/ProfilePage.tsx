import { signInWithPopup, signOut } from 'firebase/auth'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { auth, googleProvider } from '../../data/firebase'

export function ProfilePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Profile" title="My Journey" />
      </>
    )
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Profile" title="My Journey" subtitle="Sign in to see your whiskey journey." />
        <EmptyState
          title="Sign in to continue."
          message="Fully Involved Pour uses Google sign-in to sync your collection."
          action={<Button onClick={() => signInWithPopup(auth, googleProvider)}>Sign in with Google</Button>}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader eyebrow="Profile" title="My Journey" subtitle={user.displayName ?? user.email ?? undefined} />
      <EmptyState
        title="Your journey stats will live here."
        message="Collection totals, favorite distillery, and Legacy Shelf arrive in a later phase."
        action={
          <Button variant="secondary" onClick={() => signOut(auth)}>
            Sign out
          </Button>
        }
      />
    </>
  )
}
