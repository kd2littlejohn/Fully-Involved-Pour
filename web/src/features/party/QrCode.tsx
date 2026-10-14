import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

interface QrCodeProps {
  value: string
  size?: number
  label: string
  className?: string
}

// Builds the module grid once per value. Error correction 'M' tolerates a
// smudged TV screen or a glare spot on a printed card.
function qrModules(value: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(value)
  qr.make()
  const count = qr.getModuleCount()
  return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, col) => qr.isDark(row, col)))
}

// Scannable QR code as inline SVG. Always dark-on-light: phone cameras read
// that reliably, and it stays legible on a TV across the room. Rendered
// crisp at any size (shape-rendering) with the standard 4-module quiet zone.
export function QrCode({ value, size = 220, label, className }: QrCodeProps) {
  const path = useMemo(() => {
    const modules = qrModules(value)
    let d = ''
    modules.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x + 4} ${y + 4}h1v1h-1z`
      }),
    )
    return { d, count: modules.length + 8 }
  }, [value])

  return (
    <svg
      className={className}
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${path.count} ${path.count}`}
      shapeRendering="crispEdges"
    >
      <rect width={path.count} height={path.count} fill="#f3e7d1" rx="1" />
      <path d={path.d} fill="#1d1712" />
    </svg>
  )
}
