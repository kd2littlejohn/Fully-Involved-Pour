// Renders the Party Recap as a shareable 1080×1350 PNG on a canvas — no
// server, no third-party service. Draws only what's on the recap document
// (revealed rounds), so an image can never carry unrevealed bottles.
import { formatEventDate, formatScore } from './partyLabels'
import type { PartyRecap } from './types'

const W = 1080
const H = 1350

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

export function recapImageLines(recap: PartyRecap): { heading: string; lines: string[] }[] {
  const sections: { heading: string; lines: string[] }[] = []
  sections.push({
    heading: 'Category Champions',
    lines: recap.champions.map((c) =>
      c.winners.length ? `${c.categoryName}: ${c.winners.map((w) => `${w.bottle.name} (${formatScore(w.average ?? null)})`).join(' & ')}` : `${c.categoryName}: no scores`,
    ),
  })
  if (recap.highestRated.length) {
    sections.push({
      heading: 'Highest Rated',
      lines: recap.highestRated.map((h) => `${h.bottle.name} — ${formatScore(h.average)} avg (${h.count} ratings)`),
    })
  }
  const choice = recap.peoplesChoice.filter((p) => p.winners.length)
  if (choice.length) {
    sections.push({ heading: 'People’s Choice', lines: choice.map((p) => `${p.categoryName}: ${p.winners.map((w) => w.bottle.name).join(' & ')}`) })
  }
  return sections
}

export async function renderRecapImage(recap: PartyRecap): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#2a1d12')
  bg.addColorStop(0.55, '#11161c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(228,154,58,0.65)'
  ctx.lineWidth = 3
  ctx.strokeRect(36, 36, W - 72, H - 72)

  const serif = 'Fraunces, Georgia, serif'
  const sans = 'Inter, system-ui, sans-serif'
  let y = 120
  ctx.fillStyle = '#e49a3a'
  ctx.font = `600 28px ${sans}`
  ctx.fillText('FULLY INVOLVED POUR · PARTY RECAP', 80, y)
  y += 80
  ctx.fillStyle = '#f3e7d1'
  ctx.font = `600 64px ${serif}`
  for (const line of wrap(ctx, recap.partyName, W - 160).slice(0, 2)) {
    ctx.fillText(line, 80, y)
    y += 74
  }
  ctx.fillStyle = '#dccbb0'
  ctx.font = `400 30px ${sans}`
  const meta = [formatEventDate(recap.eventDate), `${recap.participantCount} tasters`, `${recap.totalBallots} ballots`, `${recap.bottles.length} bottles`]
    .filter(Boolean)
    .join(' · ')
  ctx.fillText(meta, 80, y)
  y += 70

  for (const section of recapImageLines(recap)) {
    if (y > H - 200) break
    ctx.fillStyle = '#e49a3a'
    ctx.font = `700 28px ${sans}`
    ctx.fillText(section.heading.toUpperCase(), 80, y)
    y += 46
    ctx.fillStyle = '#f3e7d1'
    ctx.font = `400 32px ${sans}`
    for (const entry of section.lines) {
      for (const line of wrap(ctx, entry, W - 160)) {
        if (y > H - 160) break
        ctx.fillText(line, 80, y)
        y += 42
      }
    }
    y += 30
  }

  ctx.fillStyle = '#afa79b'
  ctx.font = `400 26px ${sans}`
  ctx.fillText('Discover More. Savor More. Share More.', 80, H - 90)

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image'))), 'image/png'))
}
