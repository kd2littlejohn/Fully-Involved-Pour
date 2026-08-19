import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { fetchProfile } from '../../data/repositories/profile'
import { acceptFriendRequestWithNotification, cancelFriendRequestAction, declineFriendRequestAction } from './friendActions'
import type { FriendRequest, Profile } from '../../data/types'
import styles from './FriendRequestCard.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

interface FriendRequestCardProps {
  request: FriendRequest
  direction: 'incoming' | 'outgoing'
  onChange: () => void
}

export function FriendRequestCard({ request, direction, onChange }: FriendRequestCardProps) {
  const { user } = useAuth()
  const { userDoc, profile } = useUserData()
  const [acting, setActing] = useState(false)
  const [receiverProfile, setReceiverProfile] = useState<Profile | undefined>(undefined)

  useEffect(() => {
    if (direction !== 'outgoing') return
    let cancelled = false
    fetchProfile(request.receiverId).then((p) => {
      if (!cancelled) setReceiverProfile(p)
    })
    return () => {
      cancelled = true
    }
  }, [direction, request.receiverId])

  const name =
    direction === 'incoming'
      ? request.senderDisplayName || request.senderUsername
      : receiverProfile?.displayName || receiverProfile?.username || 'this person'
  const username = direction === 'incoming' ? request.senderUsername : receiverProfile?.username

  async function handleAccept() {
    if (!user) return
    setActing(true)
    try {
      await acceptFriendRequestWithNotification(request, {
        uid: user.uid,
        username: userDoc.username ?? '',
        displayName: profile?.displayName || user.displayName || undefined,
        photoURL: profile?.photoURL,
      })
      onChange()
    } finally {
      setActing(false)
    }
  }

  async function handleDecline() {
    setActing(true)
    try {
      await declineFriendRequestAction(request.senderId, request.receiverId)
      onChange()
    } finally {
      setActing(false)
    }
  }

  async function handleCancel() {
    setActing(true)
    try {
      await cancelFriendRequestAction(request.senderId, request.receiverId)
      onChange()
    } finally {
      setActing(false)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.avatarFallback} aria-hidden="true">
        {initials(name)}
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{name}</div>
        {username ? <div className={styles.username}>@{username}</div> : null}
        <div className={styles.meta}>{direction === 'incoming' ? 'Wants to be friends' : 'Request sent'}</div>
      </div>
      {direction === 'incoming' ? (
        <div className={styles.actions}>
          <Button onClick={() => void handleAccept()} disabled={acting} className={styles.actionButton}>
            Accept
          </Button>
          <Button variant="ghost" onClick={() => void handleDecline()} disabled={acting} className={styles.actionButton}>
            Decline
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => void handleCancel()} disabled={acting} className={styles.actionButton}>
          Cancel
        </Button>
      )}
    </div>
  )
}
