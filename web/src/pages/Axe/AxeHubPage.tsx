import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { greetingForHour } from '../../features/home/selectors'
import { usePourQuickActions } from '../../features/startAPour/usePourQuickActions'
import { WhatShouldIPourButton } from '../../features/whatShouldIPour/WhatShouldIPourButton'
import { useSommelier } from '../../features/sommelier/SommelierProvider'
import { AxeWordmark } from '../../features/sommelier/AxeMark'
import styles from './AxeHubPage.module.css'

interface AxeHubLocationState {
  // Set by the legacy /pour route: open the Pour menu on arrival.
  openPour?: boolean
}

// The AXE Hub: the centre tab. A personal front door to everything AXE and
// every Pour workflow. Each card opens what already exists (the Pour menu,
// What Should I Pour?, Your Palate, My Bar, Discover, the AXE chat); the
// Hub itself has no workflow or AI of its own, so it works the same when
// AI services are down.
export function AxeHubPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { userDoc } = useUserData()
  const { openAxe } = useSommelier()
  const pourMenu = usePourQuickActions()

  const greeting = greetingForHour(new Date().getHours())
  const name = userDoc.greetingName || user?.displayName?.split(' ')[0]

  const handledKey = useRef<string | null>(null)
  useEffect(() => {
    const state = location.state as AxeHubLocationState | null
    if (state?.openPour && handledKey.current !== location.key) {
      handledKey.current = location.key
      pourMenu.open()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per navigation
  }, [location.key])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <AxeWordmark />
      </header>

      <section className={styles.greeting} aria-labelledby="axe-hub-greeting">
        <h1 id="axe-hub-greeting" className={styles.greetingTitle}>
          {name ? `${greeting}, ${name}.` : `${greeting}.`}
        </h1>
        <p className={styles.greetingSubtitle}>What can I help you discover tonight?</p>
      </section>

      <div className={styles.actions}>
        <HubCard icon={ICONS.pour} title="Start a Pour" subtitle="Capture your experience." onClick={pourMenu.open} haspopup />
        <WhatShouldIPourButton
          renderTrigger={(open) => (
            <HubCard icon={ICONS.compass} title="What Should I Pour?" subtitle="Find the right bottle for the moment." onClick={open} haspopup />
          )}
        />
        <HubCard
          icon={ICONS.palate}
          title="Explore My Palate"
          subtitle="Understand your preferences."
          onClick={() => navigate('/profile', { state: { scrollTo: 'palate' } })}
        />
        <HubCard icon={ICONS.bar} title="Explore My Bar" subtitle="Rediscover your collection." onClick={() => navigate('/collection')} />
        <HubCard icon={ICONS.discover} title="Discover Something New" subtitle="Explore beyond your collection." onClick={() => navigate('/discover')} />
        <HubCard icon={ICONS.chat} title="Ask AXE" subtitle="Your personal whiskey guide." onClick={() => openAxe()} haspopup />
      </div>

      {pourMenu.modal}
    </div>
  )
}

function HubCard({
  icon,
  title,
  subtitle,
  onClick,
  haspopup = false,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  onClick: () => void
  haspopup?: boolean
}) {
  return (
    <button type="button" className={styles.card} onClick={onClick} aria-haspopup={haspopup ? 'dialog' : undefined}>
      <span className={styles.cardIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.cardTitle}>{title}</span>
      <span className={styles.cardSubtitle}>{subtitle}</span>
    </button>
  )
}

const ICON_PROPS = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const ICONS = {
  pour: (
    <svg {...ICON_PROPS}>
      <path d="M8 3h8M9 3v3.5c0 1.2-3 3-3 7.5a6 6 0 0 0 12 0c0-4.5-3-6.3-3-7.5V3" />
      <path d="M6.3 14h11.4" />
    </svg>
  ),
  compass: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </svg>
  ),
  palate: (
    <svg {...ICON_PROPS}>
      <path d="M5 20V12M10 20V6M15 20v-9M20 20V9" />
    </svg>
  ),
  bar: (
    <svg {...ICON_PROPS}>
      <path d="M8.5 3h2v3l1.5 2v12H7V8l1.5-2V3Z" />
      <path d="M15 8h2v2l1.5 2v8h-5v-8L15 10V8Z" />
    </svg>
  ),
  discover: (
    <svg {...ICON_PROPS}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2M11 8v6M8 11h6" />
    </svg>
  ),
  chat: (
    <svg {...ICON_PROPS}>
      <path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-3.9A8 8 0 1 1 20 12Z" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
    </svg>
  ),
}
