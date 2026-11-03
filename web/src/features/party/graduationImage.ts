// The shareable graduation card, drawn on a canvas from the summary only
// (revealed bottles and the taster's own scores). No server, no third party.
import type { EventGraduation } from './graduation'
import { formatEventDate, formatScore } from './partyLabels'

const W = 1080
const H = 1350

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

// A shareable 1080×1350 graduation card drawn on a canvas, from the
// summary only (revealed bottles and the taster's own scores).
export async function renderGraduationImage(g: EventGraduation, name: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#2a1d12')
  bg.addColorStop(0.6, '#11161c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(228,154,58,0.7)'
  ctx.lineWidth = 3
  ctx.strokeRect(36, 36, W - 72, H - 72)
  ctx.strokeRect(50, 50, W - 100, H - 100)
  const serif = 'Fraunces, Georgia, serif'
  const sans = 'Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  let y = 140
  ctx.fillStyle = '#e49a3a'
  ctx.font = `600 28px ${sans}`
  ctx.fillText('FULLY INVOLVED POUR · CERTIFICATE OF GRADUATION', W / 2, y)
  y += 90
  ctx.fillStyle = '#f3e7d1'
  ctx.font = `600 70px ${serif}`
  for (const line of wrap(ctx, g.eventName, W - 200).slice(0, 2)) {
    ctx.fillText(line, W / 2, y)
    y += 80
  }
  ctx.fillStyle = '#dccbb0'
  ctx.font = `400 30px ${sans}`
  ctx.fillText([formatEventDate(g.eventDate), g.hostName ? `Hosted by ${g.hostName}` : ''].filter(Boolean).join(' · '), W / 2, y)
  y += 90
  ctx.font = `italic 400 36px ${serif}`
  ctx.fillText('This certifies that', W / 2, y)
  y += 80
  ctx.fillStyle = '#f3e7d1'
  ctx.font = `600 64px ${serif}`
  ctx.fillText(name, W / 2, y)
  y += 70
  ctx.fillStyle = '#e49a3a'
  ctx.font = `600 40px ${serif}`
  ctx.fillText(g.profile.title, W / 2, y)
  y += 90
  ctx.textAlign = 'left'
  const rows: [string, string][] = [
    ['Pours rated', `${g.poursRated} of ${g.totalPours}${g.experience ? ` · ${g.experience === 'guided' ? 'Guided' : 'Blind'}` : ''}`],
    ['Favorite bottle', g.favoriteBottles.map((b) => b.name).join(' & ') || '—'],
    ['Favorite flight', g.favoriteFlight ? `${g.favoriteFlight.name} (${formatScore(g.favoriteFlight.average)} avg)` : '—'],
    ['Flavors you noticed most', g.topFlavors.join(', ') || '—'],
  ]
  for (const [label, value] of rows) {
    ctx.fillStyle = '#e49a3a'
    ctx.font = `700 24px ${sans}`
    ctx.fillText(label.toUpperCase(), 110, y)
    y += 42
    ctx.fillStyle = '#f3e7d1'
    ctx.font = `400 32px ${sans}`
    for (const line of wrap(ctx, value, W - 220).slice(0, 2)) {
      ctx.fillText(line, 110, y)
      y += 42
    }
    y += 22
  }
  ctx.fillStyle = '#dccbb0'
  ctx.font = `italic 400 30px ${serif}`
  for (const line of wrap(ctx, g.profile.summary, W - 220).slice(0, 3)) {
    ctx.fillText(line, 110, y)
    y += 40
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = '#afa79b'
  ctx.font = `400 26px ${sans}`
  ctx.fillText('Where there’s proof, there’s fire.', W / 2, H - 90)
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image'))), 'image/png'))
}
