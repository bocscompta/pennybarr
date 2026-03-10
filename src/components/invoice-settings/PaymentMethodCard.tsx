interface PaymentMethodCardProps {
  title: string
  description: string
  enabled: boolean
  onToggle?: (enabled: boolean) => void
  learnMoreLink?: string
  badge?: string
}

export default function PaymentMethodCard({
  title,
  description,
  enabled,
  onToggle,
  learnMoreLink,
  badge
}: PaymentMethodCardProps) {
  return (
    <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-medium" style={{ color: '#141A1F' }}>
              {title}
            </h3>
            {badge && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: '#F0FDF4', color: '#10B981' }}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: '#6C767F' }}>
            {description}
            {learnMoreLink && (
              <>
                {' '}
                <a href={learnMoreLink} className="text-stone-600 hover:underline">
                  En savoir plus
                </a>
              </>
            )}
          </p>
        </div>
        {onToggle && (
          <button
            onClick={() => onToggle(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-stone-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        )}
      </div>

      {enabled && onToggle && (
        <div className="pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
          <p className="text-xs" style={{ color: '#6C767F' }}>
            Fonctionnalité activée
          </p>
        </div>
      )}
    </div>
  )
}
