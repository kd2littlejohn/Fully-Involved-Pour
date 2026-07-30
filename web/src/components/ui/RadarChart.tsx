interface RadarSeries {
  label: string
  color: string
  values: number[] // normalized 0-1, same order/length as axes
}

interface RadarChartProps {
  axes: string[]
  series: RadarSeries[]
  size?: number
}

export function RadarChart({ axes, series, size = 220 }: RadarChartProps) {
  const center = size / 2
  const radius = size / 2 - 34
  const angleStep = (2 * Math.PI) / axes.length

  function pointFor(index: number, value: number): [number, number] {
    const angle = -Math.PI / 2 + index * angleStep
    const r = radius * Math.max(0, Math.min(1, value))
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)]
  }

  const rings = [0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label="Radar comparison chart">
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={axes.map((_, i) => pointFor(i, ring).join(',')).join(' ')}
          fill="none"
          stroke="var(--fip-border-subtle)"
        />
      ))}
      {axes.map((axis, i) => {
        const [x, y] = pointFor(i, 1.18)
        return (
          <text key={axis} x={x} y={y} fontSize="10" fill="var(--fip-muted)" textAnchor="middle" dominantBaseline="middle">
            {axis}
          </text>
        )
      })}
      {series.map((s) => (
        <polygon
          key={s.label}
          points={s.values.map((v, i) => pointFor(i, v).join(',')).join(' ')}
          fill={s.color}
          fillOpacity={0.22}
          stroke={s.color}
          strokeWidth={2}
        />
      ))}
    </svg>
  )
}
