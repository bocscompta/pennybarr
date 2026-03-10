import type { DocumentType } from '../../types/invoiceSettings'

interface DocumentTypeCardProps {
  type: DocumentType
  label: string
  prefix: string
  nextNumber: number
  status: 'active' | 'pending' | 'resetable'
  onClick?: () => void
}

export default function DocumentTypeCard({
  type,
  label,
  prefix,
  nextNumber,
  status,
  onClick
}: DocumentTypeCardProps) {
  const exampleNumber = `${prefix}${new Date().getFullYear()}-${String(nextNumber).padStart(4, '0')}`

  const statusConfig = {
    active: {
      badge: '✓',
      badgeColor: '#10B981',
      bgColor: '#F0FDF4'
    },
    pending: {
      badge: null,
      badgeColor: null,
      bgColor: null,
      text: 'En attente...',
      textColor: '#6C767F'
    },
    resetable: {
      badge: null,
      badgeColor: null,
      bgColor: null,
      text: 'Réinitialisation possible',
      textColor: '#F59E0B'
    }
  }

  const config = statusConfig[status]

  return (
    <button
      onClick={onClick}
      className="w-full p-4 rounded-lg border hover:border-gray-300 transition-colors text-left"
      style={{ borderColor: '#E4E5E7' }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm font-medium" style={{ color: '#141A1F' }}>
            {label}
          </div>
          <div className="text-xs mt-1" style={{ color: '#6C767F' }}>
            {exampleNumber}
          </div>
        </div>
        {config.badge && (
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: config.bgColor,
              color: config.badgeColor
            }}
          >
            {config.badge}
          </span>
        )}
      </div>
      {config.text && (
        <div className="text-xs" style={{ color: config.textColor }}>
          {config.text}
        </div>
      )}
    </button>
  )
}
