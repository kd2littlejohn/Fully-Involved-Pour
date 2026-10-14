import { matchPath } from 'react-router-dom'
import type { AxeRequestContext } from '../../data/repositories/ai'

// AXE's contextual integration layer. Every screen's context comes from one
// place — the current route (resolveRouteContext) — plus an optional,
// page-supplied override for the few spots that know more than the URL does
// (the current "What Should I Pour?" pick, an in-progress tasting form).
// Resolving context is pure: it never triggers an AI request on its own.

export type AxeScreen =
  | 'home'
  | 'collection'
  | 'bottle'
  | 'pour-recommendation'
  | 'log-tasting'
  | 'palate'
  | 'blind'
  | 'friends'
  | 'journal'
  | 'infinity'
  | 'discover'
  | 'general'

export interface AxeContext extends AxeRequestContext {
  screen: AxeScreen
}

// Order matters — most specific first, mirroring router.tsx.
const ROUTE_PATTERNS: { pattern: string; build: (params: Record<string, string | undefined>) => AxeContext }[] = [
  { pattern: '/', build: () => ({ screen: 'home' }) },
  // The AXE Hub shares Home's broad context (palate + recent tastings);
  // /pour only ever redirects there.
  { pattern: '/axe', build: () => ({ screen: 'home' }) },
  { pattern: '/pour', build: () => ({ screen: 'home' }) },
  { pattern: '/collection/rarity-review', build: () => ({ screen: 'collection' }) },
  { pattern: '/collection/infinity', build: () => ({ screen: 'infinity' }) },
  { pattern: '/collection/infinity/:id/tastings/new', build: (p) => ({ screen: 'log-tasting', infinityBottleId: p.id }) },
  { pattern: '/collection/infinity/:id/*', build: (p) => ({ screen: 'infinity', infinityBottleId: p.id }) },
  { pattern: '/collection/infinity/:id', build: (p) => ({ screen: 'infinity', infinityBottleId: p.id }) },
  { pattern: '/collection/:bottleId', build: (p) => ({ screen: 'bottle', bottleId: p.bottleId }) },
  { pattern: '/collection', build: () => ({ screen: 'collection' }) },
  { pattern: '/journal', build: () => ({ screen: 'journal' }) },
  { pattern: '/discover', build: () => ({ screen: 'discover' }) },
  { pattern: '/profile', build: () => ({ screen: 'palate' }) },
  { pattern: '/friends/u/:username/*', build: (p) => ({ screen: 'friends', friendUsername: p.username }) },
  { pattern: '/friends/u/:username', build: (p) => ({ screen: 'friends', friendUsername: p.username }) },
  { pattern: '/friends/*', build: () => ({ screen: 'friends' }) },
  { pattern: '/friends', build: () => ({ screen: 'friends' }) },
  { pattern: '/blind/:roomId/:stage', build: (p) => ({ screen: 'blind', roomId: p.roomId }) },
  { pattern: '/blind', build: () => ({ screen: 'blind' }) },
]

export function resolveRouteContext(pathname: string): AxeContext {
  for (const { pattern, build } of ROUTE_PATTERNS) {
    const match = matchPath({ path: pattern, end: true }, pathname)
    if (match) return build(match.params)
  }
  return { screen: 'general' }
}

// Stable identity for a context, so the provider can tell a real screen
// change from a re-render.
export function contextKey(context: AxeContext): string {
  return [context.screen, context.bottleId, context.infinityBottleId, context.roomId, context.friendUsername].join('|')
}

export interface AxeSuggestion {
  label: string
  prompt: string
}

interface AxeScreenCopy {
  /** Short name shown in the Current Context card. */
  label: string
  title: string
  intro: string
  suggestions: AxeSuggestion[]
}

const q = (label: string, prompt = label): AxeSuggestion => ({ label, prompt })

const SCREEN_COPY: Record<AxeScreen, AxeScreenCopy> = {
  home: {
    label: 'Home',
    title: 'Where will your palate take you tonight?',
    intro:
      "I'm AXE. Whether you're exploring a new bottle, revisiting an old favorite, or discovering your next pour, I'm here to help you find your direction.",
    suggestions: [
      q('Find My Pour', 'Help me find my pour for tonight from what I have.'),
      q('Revisit a Bottle', "Which of my bottles haven't I poured in a while?"),
      q('Recent Tastings', 'What have I been enjoying in my recent tastings?'),
      q('Something Different', 'Suggest something different from my usual for tonight.'),
    ],
  },
  collection: {
    label: 'My Bar',
    title: "Let's look at your bar.",
    intro: 'Ask about what to open, what pairs up, or where your collection could grow.',
    suggestions: [
      q('What should I try tonight?'),
      q("Which bottles haven't I opened?"),
      q('Which of my bottles are similar?'),
      q('What am I missing from my collection?'),
    ],
  },
  bottle: {
    label: 'This bottle',
    title: "Let's explore this bottle.",
    intro: 'Ask about tasting notes, comparisons, food pairings, or your previous experiences with this bottle.',
    suggestions: [
      q('Tell me about this bottle.'),
      q('How does it compare with my other bottles?'),
      q('What did I think last time?'),
      q('What food would pair well with it?'),
    ],
  },
  'pour-recommendation': {
    label: "Tonight's pick",
    title: "AXE's take on tonight's pick.",
    intro: "Here's the bottle What Should I Pour? picked for you. I can explain why it fits — I won't swap it out unless you ask.",
    suggestions: [
      q('Why this pour tonight?', 'Why is this a good pour for me tonight?'),
      q('What should I look for when I taste it?'),
      q('What food would pair well with it?'),
      q('Show me an alternative', 'Can you suggest an alternative from my bar, and why?'),
    ],
  },
  'log-tasting': {
    label: 'Logging a tasting',
    title: 'Need help with your tasting notes?',
    intro: "Tell me what you're noticing and I'll help you put words to it. Your notes stay yours — nothing here changes your form.",
    suggestions: [
      q('Help me identify the aromas', 'Help me identify the aromas I might be picking up.'),
      q('What flavors might I be tasting?'),
      q('How do I describe the finish?'),
      q('How do I judge complexity?'),
    ],
  },
  palate: {
    label: 'Your Palate',
    title: "Let's talk about your palate.",
    intro: "I'll stick to what your tastings actually show — and tell you when there isn't enough data yet.",
    suggestions: [
      q('What does my palate say about me?'),
      q('How has my taste changed?'),
      q('Which flavors do I rate highest?'),
      q('What should I explore next?'),
    ],
  },
  blind: {
    label: 'Blind Room',
    title: 'Taste without the label.',
    intro: "I can help you organize a flight, taste with an open mind, and make sense of the results after the reveal. I'll never spoil a concealed pour.",
    suggestions: [
      q('How should I set up a flight?'),
      q('Tips for tasting blind'),
      q('How do I interpret our results?'),
      q('How do I keep my notes unbiased?'),
    ],
  },
  friends: {
    label: 'Friends',
    title: 'Share the pour.',
    intro: 'I can help you plan a shared tasting or pick a bottle to share, using your own bar.',
    suggestions: [
      q('Plan a tasting with friends'),
      q('What bottle should I share next?'),
      q('How do I host a blind with friends?'),
      q("What's a crowd-pleaser from my bar?"),
    ],
  },
  journal: {
    label: 'Bottle Stories',
    title: 'Your stories, your pours.',
    intro: 'Ask about the pours, occasions, and memories you’ve recorded.',
    suggestions: [
      q('What were my most memorable pours?'),
      q('Remind me of a recent story'),
      q('Which bottles show up on special occasions?'),
      q('What have I enjoyed most lately?'),
    ],
  },
  infinity: {
    label: 'Infinity Bottle',
    title: "Let's talk about your blend.",
    intro: "I can break down what's in your Infinity Bottle and suggest additions from your bar. I won't change your blend — that's always your call.",
    suggestions: [
      q("What's in my blend right now?"),
      q('What could I add next?'),
      q('How has my blend been tasting?'),
      q('How do I keep my blend balanced?'),
    ],
  },
  discover: {
    label: 'Discover',
    title: 'What to try next.',
    intro: "Let's find something new that fits what you already enjoy.",
    suggestions: [
      q('What should I buy next?'),
      q("What styles haven't I explored?"),
      q('Find something like my favorites'),
      q('What would round out my bar?'),
    ],
  },
  general: {
    label: 'Fully Involved Pour',
    title: 'Where will your palate take you tonight?',
    intro: "I'm AXE, your personal sommelier. Ask me about your bottles, your tastings, or your next pour.",
    suggestions: [
      q('Find My Pour', 'Help me find my pour for tonight from what I have.'),
      q('Explore My Palate', 'What does my tasting history say about my palate?'),
      q('Food Pairings', 'What food pairs well with something from my bar?'),
      q('My Bottle Stories', 'Remind me of a recent pour story.'),
    ],
  },
}

export function copyFor(screen: AxeScreen): AxeScreenCopy {
  return SCREEN_COPY[screen]
}

// Asking about an AXE Insight: AXE answers from that insight's verified
// facts (looked up server-side by insightId), wherever it was opened from.
const INSIGHT_COPY: AxeScreenCopy = {
  label: 'This insight',
  title: "Let's dig into what I noticed.",
  intro: "I'll stick to the facts behind this insight, and tell you plainly when there isn't enough data to say more.",
  suggestions: [
    q('Why do you think that?', 'Why do you think that? Walk me through the evidence.'),
    q('How sure are you?', 'How confident are you in this, and what would make it clearer?'),
    q('What should I pour to explore it?', 'What could I pour from my bar to explore this further?'),
    q('What does this say about my palate?'),
  ],
}

export function copyForContext(context: AxeContext): AxeScreenCopy {
  return context.insightId ? INSIGHT_COPY : copyFor(context.screen)
}
