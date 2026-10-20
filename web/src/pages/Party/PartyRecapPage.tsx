import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { LinkButton } from '../../components/ui/LinkButton'
import fipIcon from '../../assets/brand/fip-icon.svg'
import { PartyLoading, PartyMessage, PartyPage } from '../../features/party/PartyChrome'
import { KeepYourResults } from '../../features/party/KeepYourResults'
import { useGuestIdentity } from '../../features/party/useGuestIdentity'
import { useMyAdminRole, useMyBallots, useParty, usePartyRecap } from '../../features/party/usePartyData'
import { formatEventDate, formatScore } from '../../features/party/partyLabels'
import { recapImageLines, renderRecapImage } from '../../features/party/recapImage'
import type { PartyRecap } from '../../features/party/types'
import styles from '../../features/party/party.module.css'
import recapStyles from './PartyRecapPage.module.css'

function recapText(recap: PartyRecap): string {
  const parts = [`${recap.partyName} — Party Recap`]
  for (const section of recapImageLines(recap)) parts.push(`${section.heading}: ${section.lines.join('; ')}`)
  parts.push('Fully Involved Pour')
  return parts.join('\n')
}

// The FIP-branded conclusion of the party. Built server-side from revealed
// rounds only, readable by the host and the party's guests.
export function PartyRecapPage() {
  const { partyId } = useParams<{ partyId: string }>()
  const { user, loading } = useGuestIdentity()
  const party = useParty(partyId, Boolean(user))
  const adminRole = useMyAdminRole(partyId, user?.uid)
  const recap = usePartyRecap(partyId, Boolean(user) && !party.error)
  const ballots = useMyBallots(partyId, user?.uid, Boolean(user) && !party.error)
  const [status, setStatus] = useState<string | null>(null)

  if (loading || (user && (party.loading || recap.loading))) return <PartyLoading />
  if (!user || party.error === 'denied' || !party.data) {
    return (
      <PartyMessage
        title="Party recap"
        message="This recap is for the party’s host and guests. If you joined on another device, rejoin with your recovery code first."
        action={<LinkButton to="/p">Enter a party code</LinkButton>}
      />
    )
  }
  const p = party.data
  if (!recap.data) {
    return (
      <PartyMessage
        title="Not wrapped up yet"
        message="The recap appears when the host completes the party."
        action={<LinkButton to={adminRole.role === 'host' ? `/party/${p.id}/host` : `/party/${p.id}`}>Back to the party</LinkButton>}
      />
    )
  }
  const r = recap.data
  const isHost = adminRole.role === 'host'
  const mine = ballots.data.filter((b) => b.source === 'digital' && !b.excluded)

  async function share() {
    setStatus(null)
    try {
      const blob = await renderRecapImage(r)
      const file = new File([blob], `${r.partyName.replace(/[^\w-]+/g, '-')}-recap.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${r.partyName} — Party Recap`, text: recapText(r) })
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus('Recap image saved.')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setStatus('Couldn’t create the image. Try Save as PDF instead.')
    }
  }

  return (
    <PartyPage back={{ to: isHost ? `/party/${p.id}/host` : `/party/${p.id}`, label: isHost ? 'Dashboard' : 'Party' }}>
      <article className={`${styles.card} ${styles.cardWarm} ${recapStyles.recap}`} aria-labelledby="recap-title">
        <header className={recapStyles.header}>
          <img src={fipIcon} alt="" className={recapStyles.logo} />
          <span className={styles.eyebrow}>Party Recap</span>
          <h1 id="recap-title" className={styles.title}>
            {r.partyName}
          </h1>
          {formatEventDate(r.eventDate) ? <p className={styles.muted}>{formatEventDate(r.eventDate)}</p> : null}
        </header>

        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{r.participantCount}</span>
            <span className={styles.statLabel}>Tasters</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{r.totalBallots}</span>
            <span className={styles.statLabel}>Valid ballots</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{r.categories.length}</span>
            <span className={styles.statLabel}>Rounds</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{r.bottles.length}</span>
            <span className={styles.statLabel}>Bottles</span>
          </div>
        </div>

        {r.highestRated.length ? (
          <section className={recapStyles.hero}>
            <span className={styles.eyebrow}>Highest Rated Bottle</span>
            {r.highestRated.map((h) => (
              <div key={`${h.categoryId}-${h.label}`} className={recapStyles.heroItem}>
                {h.bottle.imageUrl ? <img src={h.bottle.imageUrl} alt="" className={recapStyles.heroImage} /> : null}
                <div>
                  <div className={recapStyles.heroName}>{h.bottle.name}</div>
                  <div className={styles.muted}>
                    {formatScore(h.average)} avg · {h.count} ratings · {h.categoryName}
                  </div>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <section className={styles.stack} aria-labelledby="champions-heading">
          <h2 id="champions-heading" className={styles.sectionTitle}>
            Category Champions
          </h2>
          <ul className={styles.list}>
            {r.champions.map((c) => {
              const choice = r.peoplesChoice.find((pc) => pc.categoryId === c.categoryId)
              return (
                <li key={c.categoryId} className={styles.listItem} style={{ alignItems: 'flex-start' }}>
                  <div className={styles.grow}>
                    <div className={styles.muted}>{c.categoryName}</div>
                    <div className={recapStyles.winner}>
                      {c.winners.length ? c.winners.map((w) => w.bottle.name).join(' & ') : 'No scores'}
                      {c.winners[0] ? <span className={styles.muted}> · {formatScore(c.winners[0].average ?? null)} avg</span> : null}
                    </div>
                    {choice?.winners.length ? (
                      <div className={styles.muted}>People’s Choice: {choice.winners.map((w) => `${w.bottle.name} (${w.favoriteVotes} votes)`).join(' & ')}</div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
          {r.categories.length === 0 ? <p className={styles.muted}>No rounds were revealed at this party.</p> : null}
        </section>

        {r.bottles.length ? (
          <section className={styles.stack} aria-labelledby="bottles-heading">
            <h2 id="bottles-heading" className={styles.sectionTitle}>
              Bottles tasted
            </h2>
            <p className={styles.muted}>{r.bottles.map((b) => b.name).join(' · ')}</p>
          </section>
        ) : null}

        {r.notes ? (
          <section className={styles.stack}>
            <h2 className={styles.sectionTitle}>From your host</h2>
            <p className={styles.subtitle}>{r.notes}</p>
          </section>
        ) : null}
        <footer className={styles.muted}>Fully Involved Pour · Discover More. Savor More. Share More.</footer>
      </article>

      <div className={`${styles.row} ${recapStyles.actions}`}>
        <Button onClick={share}>Share recap image</Button>
        <Button variant="secondary" onClick={() => window.print()}>
          Save as PDF
        </Button>
      </div>
      <p className={styles.muted} aria-live="polite">
        {status}
      </p>

      {mine.length ? (
        <section className={`${styles.card} ${recapStyles.actions}`} aria-labelledby="mine-heading">
          <h2 id="mine-heading" className={styles.sectionTitle}>
            Your scores
          </h2>
          <ul className={styles.list}>
            {mine.map((b) => {
              const round = p.categories.find((c) => c.id === b.categoryId)
              return (
                <li key={b.id} className={styles.listItem}>
                  <div className={styles.grow}>
                    <div>{round?.name ?? 'Round'}</div>
                    <div className={styles.muted}>
                      {Object.entries(b.scores)
                        .sort(([a], [z]) => a.localeCompare(z))
                        .map(([l, s]) => `${l} ${formatScore(s.overall)}`)
                        .join(' · ')}
                      {b.favoriteLabel ? ` · ★ ${b.favoriteLabel}` : ''}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <LinkButton to={`/party/${p.id}`} variant="secondary">
            See round results
          </LinkButton>
        </section>
      ) : null}

      {user.isAnonymous ? (
        <div className={recapStyles.actions}>
          <KeepYourResults />
        </div>
      ) : null}
    </PartyPage>
  )
}
