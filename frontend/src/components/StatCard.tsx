import clsx from 'clsx'
import type { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  trend?: string
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
}

const colorMap = {
  blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  green: 'from-green-500/20 to-green-600/5 border-green-500/30',
  yellow: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/30',
  red: 'from-red-500/20 to-red-600/5 border-red-500/30',
  purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
}

const iconColorMap = {
  blue: 'text-blue-400',
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
  purple: 'text-purple-400',
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  color = 'blue',
}: StatCardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border p-5 bg-gradient-to-br',
        colorMap[color]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {trend && (
            <p className="text-xs text-gray-500 mt-1">{trend}</p>
          )}
        </div>
        <div className={clsx('p-2 rounded-lg bg-white/5', iconColorMap[color])}>
          {icon}
        </div>
      </div>
    </div>
  )
}
