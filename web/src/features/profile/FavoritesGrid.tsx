import type { Bottle } from '../../data/types'
import { EmptyState } from '../../components/ui/EmptyState'
import styles from './FavoritesGrid.module.css'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return '?'
  if (!second) return first.slice(0, 2).toUpperCase()
  return (first.charAt(0) + second.charAt(0)).toUpperCase()
}

interface FavoriteCardProps {
  label: string
  title: string
  subtitle?: string
  imageUrl?: string
  monogramSource: string
}

function FavoriteCard({ label, title, subtitle, imageUrl, monogramSource }: FavoriteCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.media}>
        {imageUrl ? (
          <img className={styles.image} src={imageUrl} alt="" />
        ) : (
          <div className={styles.monogram} aria-hidden="true">
            {initials(monogramSource)}
          </div>
        )}
      </div>
      <div className={styles.label}>{label}</div>
      <div className={styles.title}>{title}</div>
      {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
    </div>
  )
}

interface FavoritesGridProps {
  favoriteBottle?: { bottle: Bottle; score?: number }
  favoriteDistillery?: { name: string; count: number }
  favoriteCompanion?: { name: string; pourCount: number }
  mostShared?: { bottle: Bottle; sharedPourCount: number }
}

export function FavoritesGrid({ favoriteBottle, favoriteDistillery, favoriteCompanion, mostShared }: FavoritesGridProps) {
  const hasAny = favoriteBottle || favoriteDistillery || favoriteCompanion || mostShared

  if (!hasAny) {
    return (
      <EmptyState
        title="Your favorites will build up here."
        message="Mark a favorite bottle, log companions, and share pours to see your patterns emerge."
      />
    )
  }

  return (
    <div className={styles.grid}>
      {favoriteBottle ? (
        <FavoriteCard
          label="Favorite Bottle"
          title={favoriteBottle.bottle.name}
          subtitle={typeof favoriteBottle.score === 'number' ? `Scored ${favoriteBottle.score.toFixed(1)}` : undefined}
          imageUrl={favoriteBottle.bottle.imageUrl}
          monogramSource={favoriteBottle.bottle.name}
        />
      ) : null}
      {favoriteDistillery ? (
        <FavoriteCard
          label="Favorite Distillery"
          title={favoriteDistillery.name}
          subtitle={`${favoriteDistillery.count} ${favoriteDistillery.count === 1 ? 'bottle' : 'bottles'}`}
          monogramSource={favoriteDistillery.name}
        />
      ) : null}
      {favoriteCompanion ? (
        <FavoriteCard
          label="Favorite Companion"
          title={favoriteCompanion.name}
          subtitle={`${favoriteCompanion.pourCount} shared ${favoriteCompanion.pourCount === 1 ? 'pour' : 'pours'}`}
          monogramSource={favoriteCompanion.name}
        />
      ) : null}
      {mostShared ? (
        <FavoriteCard
          label="Most Shared Bottle"
          title={mostShared.bottle.name}
          subtitle={`${mostShared.sharedPourCount} shared ${mostShared.sharedPourCount === 1 ? 'pour' : 'pours'}`}
          imageUrl={mostShared.bottle.imageUrl}
          monogramSource={mostShared.bottle.name}
        />
      ) : null}
    </div>
  )
}
