import clsx from 'clsx'

interface RiskBadgeProps {
  level: string
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export default function RiskBadge({ level, size = 'md', label }: RiskBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm',
  }

  return (
    <span
      className={clsx(
        'risk-badge inline-flex items-center gap-1',
        sizeClasses[size],
        {
          'risk-low': level === 'LOW',
          'risk-medium': level === 'MEDIUM',
          'risk-high': level === 'HIGH',
          'risk-critical': level === 'CRITICAL',
        }
      )}
    >
      <span
        className={clsx('w-1.5 h-1.5 rounded-full', {
          'bg-risk-low': level === 'LOW',
          'bg-risk-medium': level === 'MEDIUM',
          'bg-risk-high': level === 'HIGH',
          'bg-risk-critical': level === 'CRITICAL',
        })}
      />
      {label || level}
    </span>
  )
}
