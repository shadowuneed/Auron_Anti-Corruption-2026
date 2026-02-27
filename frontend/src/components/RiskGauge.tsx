import { useEffect, useState } from 'react'
import clsx from 'clsx'

interface RiskGaugeProps {
  score: number
  size?: number
}

export default function RiskGauge({ score, size = 200 }: RiskGaugeProps) {
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 100)
    return () => clearTimeout(timer)
  }, [score])

  const radius = 80
  const circumference = 2 * Math.PI * radius
  const progress = (animated / 100) * 0.75 // 270 degrees
  const offset = circumference * (1 - progress)

  const getColor = (s: number) => {
    if (s >= 75) return '#DC2626'
    if (s >= 50) return '#EF4444'
    if (s >= 25) return '#F59E0B'
    return '#22C55E'
  }

  const getLevel = (s: number) => {
    if (s >= 75) return 'CRITICAL'
    if (s >= 50) return 'HIGH'
    if (s >= 25) return 'MEDIUM'
    return 'LOW'
  }

  const color = getColor(score)

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        className="transform rotate-[135deg]"
      >
        {/* Background arc */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="#334155"
          strokeWidth="12"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1500 ease-out"
          style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" style={{ color }}>
          {Math.round(animated)}
        </span>
        <span className="text-sm text-gray-400 mt-1">{getLevel(score)}</span>
      </div>
    </div>
  )
}
