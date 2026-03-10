// DemandesPaiementPage - Payment Requests page (Pennylane style)

interface DemandesPaiementPageProps {
  onNavigate?: (page: string) => void
}

export default function DemandesPaiementPage({ onNavigate }: DemandesPaiementPageProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
        <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
          Demandes de paiement
        </h1>
        <button
          className="px-4 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#006666' }}
        >
          Faire une demande de paiement
        </button>
      </div>

      {/* Empty state */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          {/* Illustration - payment with green blobs */}
          <div className="mb-8">
            <svg className="w-48 h-48 mx-auto" viewBox="0 0 200 200">
              {/* Green blobs */}
              <ellipse cx="100" cy="170" rx="50" ry="18" fill="#6FD89C" opacity="0.7" />
              <ellipse cx="130" cy="165" rx="25" ry="12" fill="#A7E8BD" opacity="0.6" />

              {/* Credit card back */}
              <rect x="40" y="60" width="120" height="75" rx="8" fill="#E8E8E8" stroke="#CCCCCC" strokeWidth="1.5" />

              {/* Credit card front */}
              <rect x="50" y="70" width="110" height="70" rx="6" fill="#D9EFEB" stroke="#006666" strokeWidth="2" />

              {/* Card chip */}
              <rect x="62" y="85" width="20" height="15" rx="2" fill="#F5D67B" stroke="#D4A84B" strokeWidth="1" />

              {/* Card lines */}
              <rect x="62" y="110" width="60" height="4" rx="2" fill="#006666" opacity="0.3" />
              <rect x="62" y="120" width="40" height="4" rx="2" fill="#006666" opacity="0.3" />

              {/* Decorative checkmark */}
              <circle cx="145" cy="75" r="12" fill="#6FD89C" />
              <path d="M140 75 L143 78 L151 70" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h2 className="text-lg font-semibold mb-3" style={{ color: '#141A1F' }}>
            Pas encore de demande de paiement ?
          </h2>

          <p className="text-sm mb-6" style={{ color: '#6C767F', lineHeight: '1.6' }}>
            C'est ici que vous pouvez soumettre vos demandes de paiement et suivre leur statut jusqu'à leur validation.
          </p>

          <button
            className="px-5 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#006666' }}
          >
            Faire une demande de paiement
          </button>
        </div>
      </div>
    </div>
  )
}
