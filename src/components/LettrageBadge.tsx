// LettrageBadge - Pennylane-style lettrage badge component
import type { LettrageType } from '../types/database'
import { getLettrageColor, formatLettrageCode } from '../utils/lettrageColors'

interface LettrageBadgeProps {
  code: string
  type?: LettrageType
  isComplete?: boolean
  size?: 'sm' | 'md'
  showTooltip?: boolean
}

// Labels for lettrage types
const TYPE_LABELS: Record<LettrageType, string> = {
  tiers: 'Lettrage tiers',
  autoliquidation: 'Autoliquidation',
  tva_encaissement: 'TVA sur encaissements',
}

export default function LettrageBadge({
  code,
  type = 'tiers',
  isComplete = true,
  size = 'sm',
  showTooltip = true,
}: LettrageBadgeProps) {
  const colors = getLettrageColor(type)
  const displayCode = formatLettrageCode(code, isComplete)

  const sizeClasses = {
    sm: 'w-5 h-5 text-xs',
    md: 'w-6 h-6 text-sm',
  }

  const tooltip = showTooltip
    ? `${TYPE_LABELS[type]} - ${isComplete ? 'Complet' : 'Partiel'}`
    : undefined

  return (
    <span
      className={`inline-flex items-center justify-center font-semibold rounded ${sizeClasses[size]}`}
      style={{
        backgroundColor: colors.badge.bg,
        color: colors.badge.text,
        border: `1px solid ${colors.badge.border}`,
      }}
      title={tooltip}
    >
      {displayCode}
    </span>
  )
}

// Wrapper component for displaying lettrage info with label
interface LettrageInfoProps {
  code?: string
  type?: LettrageType
  isComplete?: boolean
  label?: string
}

export function LettrageInfo({ code, type, isComplete = true, label }: LettrageInfoProps) {
  if (!code) return null

  return (
    <div className="flex items-center gap-1.5">
      <LettrageBadge code={code} type={type} isComplete={isComplete} />
      {label && (
        <span className="text-xs" style={{ color: '#6C767F' }}>
          {label}
        </span>
      )}
    </div>
  )
}

// Component for showing lettrage status text
interface LettrageStatusProps {
  code?: string
  type?: LettrageType
  isComplete?: boolean
}

export function LettrageStatus({ code, type, isComplete = true }: LettrageStatusProps) {
  if (!code) {
    return (
      <span className="text-xs" style={{ color: '#9CA3AF' }}>
        Non lettré
      </span>
    )
  }

  const colors = getLettrageColor(type)
  const statusText = isComplete ? 'Lettré' : 'Lettrage partiel'

  return (
    <div className="flex items-center gap-1.5">
      <LettrageBadge code={code} type={type} isComplete={isComplete} size="sm" />
      <span className="text-xs" style={{ color: colors.badge.text }}>
        {statusText}
      </span>
    </div>
  )
}
