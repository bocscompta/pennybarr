import { ReactNode } from 'react'

interface AccordionSectionProps {
  title: string
  description?: string
  isExpanded: boolean
  onToggle: () => void
  children: ReactNode
}

export default function AccordionSection({
  title,
  description,
  isExpanded,
  onToggle,
  children
}: AccordionSectionProps) {
  return (
    <div className="bg-white rounded-lg border mb-4" style={{ borderColor: '#E4E5E7' }}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="text-left">
          <h3 className="text-base font-medium" style={{ color: '#141A1F' }}>
            {title}
          </h3>
          {description && (
            <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
              {description}
            </p>
          )}
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          style={{ color: '#6C767F' }}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t" style={{ borderColor: '#E4E5E7' }}>
          {children}
        </div>
      )}
    </div>
  )
}
