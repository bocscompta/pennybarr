import type { ReactNode } from 'react'
import { useState } from 'react'

interface DisabledFeatureProps {
  children: ReactNode
  tooltip?: string
  className?: string
}

/**
 * Wrapper component for features that are disabled because Dolibarr API
 * doesn't support them. Shows a tooltip on hover explaining why it's disabled.
 */
export default function DisabledFeature({
  children,
  tooltip = 'Fonctionnalité non disponible via API Dolibarr',
  className = ''
}: DisabledFeatureProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Disabled overlay */}
      <div
        className="opacity-50 cursor-not-allowed pointer-events-none select-none"
        aria-disabled="true"
      >
        {children}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute z-50 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap"
          style={{
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '8px'
          }}
        >
          {tooltip}
          {/* Arrow */}
          <div
            className="absolute w-2 h-2 bg-gray-900 rotate-45"
            style={{
              top: '-4px',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Wrapper for menu items that are disabled.
 * Prevents click propagation and shows disabled state.
 */
export function DisabledMenuItem({
  children,
  tooltip = 'API Dolibarr indisponible',
  className = ''
}: DisabledFeatureProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      className={`relative ${className}`}
      onClick={handleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Disabled content with visual indicator */}
      <div className="opacity-50 cursor-not-allowed">
        {children}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute z-50 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap"
          style={{
            top: '50%',
            left: '100%',
            transform: 'translateY(-50%)',
            marginLeft: '8px'
          }}
        >
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {tooltip}
          </div>
          {/* Arrow */}
          <div
            className="absolute w-2 h-2 bg-gray-900 rotate-45"
            style={{
              top: '50%',
              left: '-4px',
              transform: 'translateY(-50%)'
            }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * For inline elements like navigation links
 */
export function DisabledNavItem({
  label,
  icon,
  count,
  tooltip = 'API Dolibarr indisponible'
}: {
  label: string
  icon?: ReactNode
  count?: number
  tooltip?: string
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm opacity-50 cursor-not-allowed"
        style={{ color: '#6C767F' }}
      >
        {icon}
        <span>{label}</span>
        {count !== undefined && (
          <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#F2F2F3' }}>
            {count}
          </span>
        )}
        <svg className="w-3.5 h-3.5 ml-auto text-amber-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute z-50 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap"
          style={{
            top: '50%',
            left: '100%',
            transform: 'translateY(-50%)',
            marginLeft: '8px'
          }}
        >
          {tooltip}
          <div
            className="absolute w-2 h-2 bg-gray-900 rotate-45"
            style={{
              top: '50%',
              left: '-4px',
              transform: 'translateY(-50%)'
            }}
          />
        </div>
      )}
    </div>
  )
}
