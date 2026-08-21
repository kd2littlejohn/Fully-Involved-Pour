import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { controlClassName } from '../../components/ui/Field'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { addComment, deleteComment, getComments } from '../../data/repositories/sharedMoments'
import { createNotification } from '../../data/repositories/notifications'
import type { StoryComment } from '../../data/types'
import styles from './CommentsList.module.css'

interface CommentsListProps {
  sharedMomentId: string
  storyOwnerId: string
  bottleName?: string
}

// Deletion rules enforced here AND in firestore.rules: the comment's own
// author can always delete it, and the story's owner can moderate any
// comment on their own story.
export function CommentsList({ sharedMomentId, storyOwnerId, bottleName }: CommentsListProps) {
  const { user } = useAuth()
  const { userDoc, profile } = useUserData()
  const [comments, setComments] = useState<StoryComment[]>([])
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    let cancelled = false
    getComments(sharedMomentId).then((c) => {
      if (!cancelled) setComments(c)
    })
    return () => {
      cancelled = true
    }
  }, [sharedMomentId])

  async function handlePost() {
    if (!user || !text.trim()) return
    setPosting(true)
    try {
      const comment = await addComment({
        sharedMomentId,
        authorId: user.uid,
        authorUsername: userDoc.username ?? '',
        authorDisplayName: profile?.displayName || user.displayName || undefined,
        authorPhotoURL: profile?.photoURL,
        text: text.trim(),
      })
      setComments((prev) => [...prev, comment])
      setText('')
      if (user.uid !== storyOwnerId) {
        await createNotification({
          recipientId: storyOwnerId,
          type: 'story-comment',
          actorId: user.uid,
          actorUsername: userDoc.username ?? '',
          actorDisplayName: profile?.displayName || user.displayName || undefined,
          actorPhotoURL: profile?.photoURL,
          refId: sharedMomentId,
          refBottleName: bottleName,
        })
      }
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteComment(id)
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className={styles.wrap}>
      {comments.map((comment) => {
        const canDelete = Boolean(user && (user.uid === comment.authorId || user.uid === storyOwnerId))
        return (
          <div className={styles.comment} key={comment.id}>
            <div className={styles.commentHeader}>
              <span className={styles.author}>{comment.authorDisplayName || comment.authorUsername}</span>
              {canDelete ? (
                <button type="button" className={styles.delete} onClick={() => void handleDelete(comment.id)} aria-label="Delete comment">
                  ×
                </button>
              ) : null}
            </div>
            <p className={styles.text}>{comment.text}</p>
          </div>
        )
      })}
      <div className={styles.composer}>
        <input className={controlClassName} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" maxLength={280} />
        <Button onClick={() => void handlePost()} disabled={posting || !text.trim()}>
          Post
        </Button>
      </div>
    </div>
  )
}
