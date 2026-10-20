import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { SignInButton } from '../../components/domain/SignInButton'
import fipIcon from '../../assets/brand/fip-icon.svg'
import { useAuth } from '../../hooks/useAuth'
import { PartyLoading, PartyMessage, PartyPage } from '../../features/party/PartyChrome'
import { useMyAdminRole, useParty } from '../../features/party/usePartyData'
import { formatEventDate } from '../../features/party/partyLabels'
import type { Party, PartyCategory } from '../../features/party/types'
import styles from '../../features/party/party.module.css'
import print from './PrintScorecardsPage.module.css'

function Scorecard({ party, category, index }: { party: Party; category: PartyCategory; index: number }) {
  const labels = category.sampleLabels.length ? category.sampleLabels : ['A', 'B']
  return (
    <article className={print.card}>
      <header className={print.head}>
        <img src={fipIcon} alt="" className={print.logo} />
        <div className={print.headText}>
          <div className={print.event}>{party.name}</div>
          <div className={print.round}>
            Round {index + 1}: {category.name}
          </div>
          {formatEventDate(party.eventDate) ? <div className={print.small}>{formatEventDate(party.eventDate)}</div> : null}
        </div>
      </header>
      <div className={print.fields}>
        <div className={print.field}>
          Nickname <span className={print.line} />
        </div>
        <div className={print.field}>
          Ballot # <span className={print.lineShort} />
        </div>
      </div>
      <table className={print.table}>
        <thead>
          <tr>
            <th scope="col">Sample</th>
            <th scope="col">Overall enjoyment (0–10)</th>
            <th scope="col">Tasting notes (optional)</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label) => (
            <tr key={label}>
              <td className={print.label}>{label}</td>
              <td className={print.scoreCell}>
                <span className={print.box} />
              </td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      <div className={print.favorite}>
        <span>Favorite — circle one:</span>
        {labels.map((label) => (
          <span key={label} className={print.circle}>
            {label}
          </span>
        ))}
      </div>
      {party.settings.predictions ? (
        <div className={print.favorite}>
          <span>Prediction — room’s top pick:</span>
          {labels.map((label) => (
            <span key={label} className={print.circle}>
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <footer className={print.foot}>Fully Involved Pour · Discover More. Savor More. Share More.</footer>
    </article>
  )
}

// Print-friendly scorecards for guests who'd rather use paper. Each card
// has exactly as many rows as its round has bottles — never an assumed
// three. The host types finished cards into Paper Ballot Entry.
export function PrintScorecardsPage() {
  const { partyId } = useParams<{ partyId: string }>()
  const { user, loading: authLoading } = useAuth()
  const party = useParty(partyId, Boolean(user))
  const adminRole = useMyAdminRole(partyId, user?.uid)
  const [copies, setCopies] = useState('1')
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  if (authLoading || (user && (party.loading || adminRole.loading))) return <PartyLoading />
  if (!user) return <PartyMessage title="Print scorecards" message="Sign in as the host to print scorecards." action={<SignInButton />} />
  if (!party.data || adminRole.role !== 'host') return <PartyMessage title="Hosts only" message="Only the party’s host can print scorecards." />

  const p = party.data
  const count = Math.max(1, Math.min(60, Number(copies) || 1))
  const chosen = p.categories.filter((c) => selected[c.id] ?? true)

  return (
    <>
      <div className={print.screenOnly}>
        <PartyPage back={{ to: `/party/${p.id}/host`, label: 'Dashboard' }}>
          <section className={styles.card}>
            <span className={styles.eyebrow}>Print scorecards</span>
            <h1 className={styles.title}>{p.name}</h1>
            <p className={styles.muted}>One card per guest per round. Each card lists that round’s actual sample letters.</p>
            <fieldset className={styles.stack} style={{ border: 0, padding: 0, margin: 0, gap: 'var(--fip-space-2)' }}>
              <legend className={styles.label}>Rounds to print</legend>
              {p.categories.map((c, i) => (
                <label key={c.id} className={styles.row}>
                  <input type="checkbox" checked={selected[c.id] ?? true} onChange={(e) => setSelected({ ...selected, [c.id]: e.target.checked })} />
                  <span>
                    {i + 1}. {c.name} ({c.sampleLabels.length || 'no'} samples)
                  </span>
                </label>
              ))}
            </fieldset>
            <label className={styles.label} htmlFor="copies">
              Copies of each
            </label>
            <input id="copies" className={styles.input} inputMode="numeric" value={copies} onChange={(e) => setCopies(e.target.value.replace(/\D/g, ''))} />
            <Button onClick={() => window.print()} disabled={chosen.length === 0}>
              Print {chosen.length * count} {chosen.length * count === 1 ? 'card' : 'cards'}
            </Button>
          </section>
          <p className={styles.muted}>Preview:</p>
        </PartyPage>
      </div>
      <div className={print.sheet}>
        {chosen.flatMap((category) =>
          Array.from({ length: count }, (_, copy) => (
            <Scorecard key={`${category.id}-${copy}`} party={p} category={category} index={p.categories.indexOf(category)} />
          )),
        )}
      </div>
    </>
  )
}
