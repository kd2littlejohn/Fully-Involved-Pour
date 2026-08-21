import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { FipScoreBadge } from '../../components/ui/FipScoreBadge'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { useFriendBottleQuickView } from './useFriendBottleQuickView'
import { findMyMatchingBottle } from './friendProfileSelectors'
import { whyYouMightLikeIt } from './whyYouMightLikeIt'
import { RecommendToFriendModal } from './RecommendToFriendModal'
import type { BottleBuyAgain, BottleStatus, FriendBottleTake, WouldReplace } from '../../data/types'
import styles from './FriendBottleQuickView.module.css'

export interface FriendBottleQuickViewTarget {
  friendUid: string
  friendName: string
  friendUsername?: string
  bottleName: string
  distillery?: string
  imageUrl?: string
  type?: string
  proof?: number
  ageStatement?: string
  status?: BottleStatus
  take?: FriendBottleTake
}

interface FriendBottleQuickViewProps {
  target: FriendBottleQuickViewTarget | undefined
  onClose: () => void
}

const STATUS_LABEL: Partial<Record<BottleStatus, string>> = { open: 'Opened', sealed: 'Sealed', finished: 'Finished', incoming: 'Incoming' }
const BUY_AGAIN_LABEL: Record<BottleBuyAgain, string> = {
  absolutely: 'Absolutely',
  'at-msrp': 'At MSRP',
  maybe: 'Maybe',
  'probably-not': 'Probably Not',
  no: 'No',
}
const REPLACE_LABEL: Record<WouldReplace, string> = { yes: 'Yes', maybe: 'Maybe', no: 'No' }

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function metaLine(target: FriendBottleQuickViewTarget): string {
  return [target.type, target.proof != null ? `${target.proof} proof` : undefined, target.ageStatement].filter(Boolean).join(' · ')
}

// A fast, tap-to-open bottom sheet (the shared Modal primitive already
// becomes one at mobile widths — see Modal.module.css) answering "do I
// want to try or add this bottle?" from six different entry points across
// Friends (Friend Profile, Shared With You, Recent Friend Activity,
// Bottles We Both Own, Recommendations, Shared Pour Stories) — never a
// full navigation away, and never a rebuild of Bottle Details, which stays
// the private, owner-only page it already is.
export function FriendBottleQuickView({ target, onClose }: FriendBottleQuickViewProps) {
  const { user } = useAuth()
  const { userDoc, profile: myProfile, addBottle } = useUserData()
  const navigate = useNavigate()
  const { data } = useFriendBottleQuickView(target?.friendUid, user?.uid, target?.bottleName)
  const [showStories, setShowStories] = useState(false)
  const [showRecommend, setShowRecommend] = useState(false)
  const [adding, setAdding] = useState(false)

  // A different bottle (or closing) shouldn't carry over the previous
  // one's expanded/nested-modal state.
  useEffect(() => {
    setShowStories(false)
    setShowRecommend(false)
  }, [target?.friendUid, target?.bottleName])

  if (!target) return null
  // Facts already in hand at the tap site win — data.bottleFacts only
  // backfills whatever a given entry point didn't already know (e.g.
  // Recent Friend Activity only has a bottle name), and only ever with the
  // SAME owner-computed, privacy-filtered projection Bottles We Both Own
  // already reads, never anything more.
  const bottleFacts = data?.bottleFacts
  const bottle = {
    ...target,
    imageUrl: target.imageUrl ?? bottleFacts?.imageUrl,
    type: target.type ?? bottleFacts?.type,
    proof: target.proof ?? bottleFacts?.proof,
    ageStatement: target.ageStatement ?? bottleFacts?.ageStatement,
    status: target.status ?? bottleFacts?.status,
  }
  const take = target.take ?? bottleFacts?.take

  const myBottle = findMyMatchingBottle(userDoc.bottles, bottle.bottleName, bottle.distillery)
  const reason = whyYouMightLikeIt(myProfile?.whiskeyIdentityTags, data?.friendProfile?.whiskeyIdentityTags, bottle.friendName)

  async function handleAddToWishlist() {
    if (!user) return
    setAdding(true)
    try {
      await addBottle({
        name: bottle.bottleName,
        distillery: bottle.distillery,
        imageUrl: bottle.imageUrl,
        type: bottle.type,
        proof: bottle.proof,
        ageStatement: bottle.ageStatement,
        status: 'wishlist',
      })
    } finally {
      setAdding(false)
    }
  }

  return (
    <Modal title={bottle.bottleName} onClose={onClose}>
      <div className={styles.sheet}>
        {bottle.imageUrl ? <img className={styles.image} src={bottle.imageUrl} alt="" /> : null}

        <div className={styles.header}>
          <div className={styles.name}>{bottle.bottleName}</div>
          {bottle.distillery ? <div className={styles.distillery}>{bottle.distillery}</div> : null}
          {metaLine(bottle) ? <div className={styles.meta}>{metaLine(bottle)}</div> : null}
          {bottle.status && STATUS_LABEL[bottle.status] ? (
            <div className={styles.statusRow}>
              <Badge>{STATUS_LABEL[bottle.status]}</Badge>
            </div>
          ) : null}
        </div>

        {myBottle ? (
          <p className={styles.ownedNote}>
            {myBottle.status === 'wishlist' ? "You've already wishlisted this." : "You already own this bottle."}
          </p>
        ) : null}

        <div className={styles.takeCard}>
          <div className={styles.takeHeading}>{bottle.friendName}&rsquo;s Take</div>
          {take ? (
            <>
              {typeof take.score === 'number' ? (
                <div className={styles.scoreRow}>
                  <FipScoreBadge score={take.score} />
                </div>
              ) : null}
              {take.latestTake ? <p className={styles.quote}>&ldquo;{take.latestTake}&rdquo;</p> : null}
              <div className={styles.factRow}>
                {take.buyAgain ? (
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>Would Buy Again</span>
                    <span className={styles.factValue}>{BUY_AGAIN_LABEL[take.buyAgain]}</span>
                  </div>
                ) : null}
                {take.wouldReplace ? (
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>Would Replace</span>
                    <span className={styles.factValue}>{REPLACE_LABEL[take.wouldReplace]}</span>
                  </div>
                ) : null}
              </div>
              {take.topFlavors && take.topFlavors.length > 0 ? (
                <div className={styles.flavorRow}>
                  {take.topFlavors.map((flavor) => (
                    <span key={flavor} className={styles.flavorChip}>
                      {flavor}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className={styles.pourMeta}>
                {take.pourCount > 0 ? `${take.pourCount} ${take.pourCount === 1 ? 'Pour' : 'Pours'} Logged` : 'No pours logged yet'}
                {take.lastPourDate ? ` · Last poured ${formatDate(take.lastPourDate)}` : ''}
              </p>
            </>
          ) : (
            <p className={styles.noTake}>{bottle.friendName} hasn&rsquo;t shared their take on this bottle yet.</p>
          )}
        </div>

        {reason ? <p className={styles.reason}>{reason}</p> : null}

        <div className={styles.actions}>
          {myBottle ? (
            myBottle.status === 'wishlist' ? (
              <Button variant="secondary" disabled className={styles.primaryAction}>
                On Wish List
              </Button>
            ) : (
              <Button onClick={() => navigate(`/collection/${myBottle.id}`)} className={styles.primaryAction}>
                View in My Bar
              </Button>
            )
          ) : (
            <Button onClick={() => void handleAddToWishlist()} disabled={adding} className={styles.primaryAction}>
              {adding ? 'Adding…' : 'Add to Wish List'}
            </Button>
          )}

          {data && data.stories.length > 0 ? (
            <Button variant="secondary" onClick={() => setShowStories((v) => !v)}>
              {showStories ? 'Hide' : 'See'} {bottle.friendName}&rsquo;s Pour Stories
            </Button>
          ) : null}

          <Button variant="ghost" onClick={() => setShowRecommend(true)}>
            Recommend to a Friend
          </Button>
        </div>

        {showStories && data ? (
          <div className={styles.storyList}>
            {data.stories.map((moment) => (
              <button key={moment.id} type="button" className={styles.storyRow} onClick={() => navigate(`/friends/shared/${moment.id}`)}>
                <span className={styles.storyDate}>{formatDate(moment.snapshot.date)}</span>
                {typeof moment.snapshot.rating === 'number' ? <FipScoreBadge score={moment.snapshot.rating} /> : null}
                {moment.snapshot.memory ? <span className={styles.storyMemory}>{moment.snapshot.memory}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {showRecommend ? (
        <RecommendToFriendModal
          bottle={{ name: bottle.bottleName, distillery: bottle.distillery, imageUrl: bottle.imageUrl }}
          onClose={() => setShowRecommend(false)}
        />
      ) : null}
    </Modal>
  )
}
