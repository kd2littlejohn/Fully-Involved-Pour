import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useUserData } from '../../hooks/useUserData'
import { recommendBottles, type RecommendedBottle } from '../../data/repositories/ai'
import { summarizeCollectionForAi } from '../sommelier/collectionSummary'
import styles from './AiRecommendations.module.css'

export function AiRecommendations() {
  const navigate = useNavigate()
  const { userDoc } = useUserData()
  const [recommendations, setRecommendations] = useState<RecommendedBottle[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const results = await recommendBottles(summarizeCollectionForAi(userDoc.bottles))
      setRecommendations(results)
      if (results.length === 0) {
        setError("We don't have enough of a taste profile yet — log a few more ratings and try again.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI couldn't come up with recommendations right now.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.panel}>
      {recommendations && recommendations.length > 0 ? (
        <ul className={styles.list}>
          {recommendations.map((rec) => (
            <li key={rec.name} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.name}>{rec.name}</span>
                {rec.type ? <Badge tone="amber">{rec.type}</Badge> : null}
              </div>
              {rec.distillery ? <p className={styles.distillery}>{rec.distillery}</p> : null}
              <p className={styles.reason}>{rec.reason}</p>
              <button
                type="button"
                className={styles.addLink}
                onClick={() =>
                  navigate('/bottles/new', {
                    state: {
                      defaultStatus: 'wishlist',
                      prefill: { name: rec.name, distillery: rec.distillery, type: rec.type },
                    },
                  })
                }
              >
                + Add to Wishlist
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Button variant="secondary" onClick={handleGenerate} disabled={loading}>
        {loading ? 'Thinking…' : recommendations ? '✨ Get New Recommendations' : '✨ Get AI Recommendations'}
      </Button>
    </div>
  )
}
