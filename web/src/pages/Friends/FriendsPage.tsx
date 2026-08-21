import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useFriends } from '../../features/friends/useFriends'
import { useFriendRequests } from '../../features/friends/useFriendRequests'
import { useSharedWithYou } from '../../features/friends/useSharedWithYou'
import { useNotifications } from '../../features/friends/useNotifications'
import { useFriendsPouring } from '../../features/friends/useFriendsPouring'
import { FriendCard } from '../../features/friends/FriendCard'
import { FriendRequestCard } from '../../features/friends/FriendRequestCard'
import { SharedMomentCard } from '../../features/friends/SharedMomentCard'
import { RecommendationCard } from '../../features/friends/RecommendationCard'
import { SharedPreviewCard } from '../../features/friends/SharedPreviewCard'
import { FriendActivityRow } from '../../features/friends/FriendActivityRow'
import { FriendsPouringRow } from '../../features/friends/FriendsPouringRow'
import styles from './FriendsPage.module.css'

type Tab = 'shared' | 'friends' | 'requests'
type RequestsSubTab = 'incoming' | 'outgoing'

const ACTIVITY_PREVIEW_COUNT = 5

function isTab(value: string | null): value is Tab {
  return value === 'shared' || value === 'friends' || value === 'requests'
}

function inviteAFriend() {
  const url = `${window.location.origin}${window.location.pathname}#/`
  const text = "Join me on Fully Involved Pour — I'm tracking pours and swapping recommendations there."
  if (navigator.share) {
    navigator.share({ title: 'Fully Involved Pour', text, url }).catch(() => {})
  } else {
    navigator.clipboard.writeText(url).catch(() => {})
  }
}

export function FriendsPage() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(isTab(searchParams.get('tab')) ? (searchParams.get('tab') as Tab) : 'shared')
  const [requestsSubTab, setRequestsSubTab] = useState<RequestsSubTab>('incoming')
  const [showAllShared, setShowAllShared] = useState(false)
  const [showAllActivity, setShowAllActivity] = useState(false)

  useEffect(() => {
    const fromUrl = searchParams.get('tab')
    if (isTab(fromUrl) && fromUrl !== tab) setTab(fromUrl)
    // Only react to external URL changes (e.g. a Link elsewhere in the app
    // pointing at ?tab=requests) — not every local setSearchParams call
    // this component makes itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const { friends, loading: friendsLoading, reload: reloadFriends } = useFriends(user?.uid)
  const { incoming, outgoing, loading: requestsLoading, reload: reloadRequests } = useFriendRequests(user?.uid)

  // Accepting a request creates a new friendship — the Friends list needs
  // to refresh alongside Requests, or the newly-accepted friend wouldn't
  // show up there until an unrelated navigation happened to remount it.
  function handleRequestChange() {
    reloadRequests()
    reloadFriends()
  }
  const { items, loading: sharedLoading, reload: reloadShared } = useSharedWithYou(user?.uid)
  const { notifications, loading: activityLoading, markRead } = useNotifications(user?.uid)
  const { items: pouring, loading: pouringLoading } = useFriendsPouring(friends)

  function selectTab(next: Tab) {
    setTab(next)
    setSearchParams(next === 'shared' ? {} : { tab: next })
  }

  if (authLoading) {
    return <PageHeader eyebrow="Friends" title="Friends" />
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Friends" title="Friends" subtitle="Sign in to connect with friends." />
        <EmptyState
          title="Sign in to continue."
          message="Fully Involved Pour uses Google sign-in to sync your bar."
          action={<SignInButton />}
        />
      </>
    )
  }

  const visibleActivity = showAllActivity ? notifications : notifications.slice(0, ACTIVITY_PREVIEW_COUNT)
  const sharedTabEmpty =
    !sharedLoading && !activityLoading && !pouringLoading && items.length === 0 && notifications.length === 0 && pouring.length === 0

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Friends</h1>
        <div className={styles.headerActions}>
          <Link to="/friends/add" className={styles.iconButton} aria-label="Find Friends">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="1.6" />
              <path d="M19 19l-4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </Link>
          <button type="button" className={styles.iconButton} aria-label="Friend Requests" onClick={() => selectTab('requests')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="16" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
              <path d="M2.5 20c.6-3.6 2.9-5.5 5.5-5.5s4.9 1.9 5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M14.5 15c2.1.3 3.6 1.9 4 4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {incoming.length > 0 ? <span className={styles.iconBadge}>{incoming.length}</span> : null}
          </button>
        </div>
      </div>

      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'shared'}
          className={tab === 'shared' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => selectTab('shared')}
        >
          Shared
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'friends'}
          className={tab === 'friends' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => selectTab('friends')}
        >
          Friends
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'requests'}
          className={tab === 'requests' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => selectTab('requests')}
        >
          Requests
          {incoming.length > 0 ? <span className={styles.badge}>{incoming.length}</span> : null}
        </button>
      </div>

      {tab === 'shared' ? (
        sharedTabEmpty ? (
          <EmptyState
            title="Nothing shared yet."
            message="When a friend tags you in a Pour Story or recommends a bottle, it shows up here."
          />
        ) : (
          <div className={styles.sharedTab}>
            {items.length > 0 ? (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Shared With You</h2>
                  <button type="button" className={styles.seeAll} onClick={() => setShowAllShared((v) => !v)}>
                    {showAllShared ? 'Hide' : 'See All'}
                  </button>
                </div>
                <div className={styles.hScroll}>
                  {items.map((item) => (
                    <SharedPreviewCard key={item.kind === 'shared-moment' ? item.moment.id : item.recommendation.id} item={item} />
                  ))}
                </div>
                {showAllShared ? (
                  <div className={styles.list}>
                    {items.map((item) =>
                      item.kind === 'shared-moment' ? (
                        <SharedMomentCard key={item.moment.id} moment={item.moment} onChange={reloadShared} />
                      ) : (
                        <RecommendationCard key={item.recommendation.id} recommendation={item.recommendation} onChange={reloadShared} />
                      ),
                    )}
                  </div>
                ) : null}
              </section>
            ) : null}

            {notifications.length > 0 ? (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Recent Friend Activity</h2>
                  {notifications.length > ACTIVITY_PREVIEW_COUNT ? (
                    <button type="button" className={styles.seeAll} onClick={() => setShowAllActivity((v) => !v)}>
                      {showAllActivity ? 'Show Less' : 'See All'}
                    </button>
                  ) : null}
                </div>
                <div className={styles.activityList}>
                  {visibleActivity.map((notification) => (
                    <FriendActivityRow key={notification.id} notification={notification} onOpen={markRead} />
                  ))}
                </div>
              </section>
            ) : null}

            {pouring.length > 0 ? (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Friends Are Pouring</h2>
                <div className={styles.hScroll}>
                  {pouring.map((friend) => (
                    <FriendsPouringRow key={friend.uid} friend={friend} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )
      ) : null}

      {tab === 'friends' ? (
        friendsLoading ? null : friends.length === 0 ? (
          <EmptyState
            title="Whiskey is better shared."
            message="Add a few friends to swap pours, recommendations, and stories."
            action={
              <div className={styles.emptyActions}>
                <Link to="/friends/add">
                  <Button>Find Friends</Button>
                </Link>
                <Button variant="secondary" onClick={inviteAFriend}>
                  Invite a Friend
                </Button>
              </div>
            }
          />
        ) : (
          <div className={styles.list}>
            {friends.map((friend) => (
              <FriendCard key={friend.uid} friend={friend} />
            ))}
          </div>
        )
      ) : null}

      {tab === 'requests' ? (
        <div className={styles.requestsTab}>
          <div className={styles.subTabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={requestsSubTab === 'incoming'}
              className={requestsSubTab === 'incoming' ? `${styles.subTab} ${styles.subTabActive}` : styles.subTab}
              onClick={() => setRequestsSubTab('incoming')}
            >
              Incoming
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={requestsSubTab === 'outgoing'}
              className={requestsSubTab === 'outgoing' ? `${styles.subTab} ${styles.subTabActive}` : styles.subTab}
              onClick={() => setRequestsSubTab('outgoing')}
            >
              Outgoing
            </button>
          </div>

          {requestsLoading ? null : requestsSubTab === 'incoming' ? (
            incoming.length === 0 ? (
              <EmptyState title="No pending requests." message="Friend requests you receive will show up here." />
            ) : (
              <div className={styles.list}>
                {incoming.map((request) => (
                  <FriendRequestCard key={request.id} request={request} direction="incoming" onChange={handleRequestChange} />
                ))}
              </div>
            )
          ) : outgoing.length === 0 ? (
            <EmptyState title="No pending requests." message="Friend requests you send will show up here." />
          ) : (
            <div className={styles.list}>
              {outgoing.map((request) => (
                <FriendRequestCard key={request.id} request={request} direction="outgoing" onChange={reloadRequests} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
