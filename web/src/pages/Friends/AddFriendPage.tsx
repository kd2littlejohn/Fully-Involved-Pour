import { useNavigate } from 'react-router-dom'
import { Field, controlClassName } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { useFriendSearch } from '../../features/friends/useFriendSearch'
import { AddFriendButton } from '../../features/friends/AddFriendButton'
import styles from './AddFriendPage.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

export function AddFriendPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { query, setQuery, results, loading } = useFriendSearch(user?.uid)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className={styles.title}>Add Friend</h1>
      </header>

      <div className={styles.searchWrap}>
        <Field label="Search" htmlFor="friend-search">
          <input
            id="friend-search"
            className={controlClassName}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or name"
            autoComplete="off"
          />
        </Field>
      </div>

      {!query.trim() ? (
        <p className={styles.hint}>Search for a friend by their @username or display name. Email addresses are never shown.</p>
      ) : loading ? null : results.length === 0 ? (
        <EmptyState title="No one found." message="Double-check the spelling, or ask your friend for their @username." />
      ) : (
        <div className={styles.results}>
          {results.map((result) => {
            const name = result.displayName || result.username
            return (
              <div className={styles.resultCard} key={result.uid}>
                <div className={styles.avatarWrap}>
                  {result.photoURL ? (
                    <img className={styles.avatar} src={result.photoURL} alt="" />
                  ) : (
                    <div className={styles.avatarFallback} aria-hidden="true">
                      {initials(name)}
                    </div>
                  )}
                </div>
                <div className={styles.info}>
                  <div className={styles.name}>{name}</div>
                  <div className={styles.username}>@{result.username}</div>
                  {result.whiskeyIdentityTags && result.whiskeyIdentityTags.length > 0 ? (
                    <div className={styles.identity}>{result.whiskeyIdentityTags.slice(0, 3).join(' · ')}</div>
                  ) : null}
                </div>
                <AddFriendButton targetUid={result.uid} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
