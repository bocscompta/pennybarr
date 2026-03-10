// DemandesAchatPage - Purchase Requests page (Pennylane style)
import { useState, useEffect } from 'react'
import { getPurchaseRequests } from '../services/supabaseService'
import type { PurchaseRequest } from '../types/database'

interface DemandesAchatPageProps {
  onNavigate?: (page: string) => void
}

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#92400E', bg: '#FEF3C7' },
  approved: { label: 'Approuvée', color: '#065F46', bg: '#D1FAE5' },
  rejected: { label: 'Rejetée', color: '#991B1B', bg: '#FEE2E2' },
  ordered: { label: 'Commandée', color: '#1E40AF', bg: '#DBEAFE' },
  received: { label: 'Reçue', color: '#5B21B6', bg: '#EDE9FE' },
  invoiced: { label: 'Facturée', color: '#047857', bg: '#ECFDF5' },
}

export default function DemandesAchatPage({ onNavigate }: DemandesAchatPageProps) {
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    try {
      setLoading(true)
      const data = await getPurchaseRequests()
      setRequests(data)
    } catch (err) {
      console.error('Error loading purchase requests:', err)
      // If table doesn't exist yet, just show empty state instead of error
      const errorMessage = err instanceof Error ? err.message : ''
      if (errorMessage.includes('Could not find the table') || errorMessage.includes('purchase_requests')) {
        setRequests([])
      } else {
        setError(errorMessage || 'Erreur de chargement')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  // If loading
  if (loading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
          <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
            Demandes d'achat
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <svg className="animate-spin w-5 h-5" style={{ color: '#006666' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span style={{ color: '#6C767F' }}>Chargement...</span>
          </div>
        </div>
      </div>
    )
  }

  // If error
  if (error) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
          <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
            Demandes d'achat
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-sm mb-4" style={{ color: '#DC2626' }}>{error}</p>
            <button
              onClick={loadRequests}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#006666' }}
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    )
  }

  // If no requests - empty state
  if (requests.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
          <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
            Demandes d'achat
          </h1>
          <button
            onClick={() => onNavigate?.('creer-demande-achat')}
            className="px-4 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#006666' }}
          >
            Faire une demande d'achat
          </button>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            {/* Illustration - folders with green blobs */}
            <div className="mb-8">
              <svg className="w-48 h-48 mx-auto" viewBox="0 0 200 200">
                {/* Green blobs */}
                <ellipse cx="100" cy="170" rx="50" ry="18" fill="#6FD89C" opacity="0.7" />
                <ellipse cx="130" cy="165" rx="25" ry="12" fill="#A7E8BD" opacity="0.6" />

                {/* Back folder */}
                <path
                  d="M45 70 L45 140 L155 140 L155 70 L105 70 L98 58 L52 58 L45 70Z"
                  fill="#E8E8E8"
                  stroke="#CCCCCC"
                  strokeWidth="1.5"
                />

                {/* Middle folder */}
                <path
                  d="M55 80 L55 145 L145 145 L145 80 L100 80 L93 68 L62 68 L55 80Z"
                  fill="#F5F5F5"
                  stroke="#DDDDDD"
                  strokeWidth="1.5"
                />

                {/* Front folder - green tinted */}
                <path
                  d="M65 90 L65 150 L135 150 L135 90 L95 90 L88 78 L72 78 L65 90Z"
                  fill="#D9EFEB"
                  stroke="#006666"
                  strokeWidth="2"
                />

                {/* Document lines inside front folder */}
                <rect x="75" y="105" width="50" height="3" rx="1.5" fill="#006666" opacity="0.3" />
                <rect x="75" y="115" width="40" height="3" rx="1.5" fill="#006666" opacity="0.3" />
                <rect x="75" y="125" width="45" height="3" rx="1.5" fill="#006666" opacity="0.3" />

                {/* Decorative green accent */}
                <circle cx="140" cy="85" r="8" fill="#6FD89C" />
              </svg>
            </div>

            <h2 className="text-lg font-semibold mb-3" style={{ color: '#141A1F' }}>
              Pas encore de commande ?
            </h2>

            <p className="text-sm mb-6" style={{ color: '#6C767F', lineHeight: '1.6' }}>
              C'est ici que vous pouvez soumettre vos demandes d'achat et suivre vos commandes jusqu'à leur facturation.
            </p>

            <button
              onClick={() => onNavigate?.('creer-demande-achat')}
              className="px-5 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#006666' }}
            >
              Faire une demande d'achat
            </button>
          </div>
        </div>
      </div>
    )
  }

  // List view with requests
  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
        <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
          Demandes d'achat
        </h1>
        <button
          onClick={() => onNavigate?.('creer-demande-achat')}
          className="px-4 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#006666' }}
        >
          Faire une demande d'achat
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b text-xs font-medium uppercase tracking-wider" style={{ borderColor: '#E4E5E7', color: '#6C767F' }}>
            <div className="col-span-2">Référence</div>
            <div className="col-span-3">Fournisseur</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2 text-right">Montant TTC</div>
            <div className="col-span-2">Statut</div>
            <div className="col-span-1"></div>
          </div>

          {/* Table body */}
          {requests.map((request) => {
            const status = statusLabels[request.status] || statusLabels.pending
            return (
              <div
                key={request.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-b hover:bg-gray-50 items-center"
                style={{ borderColor: '#E4E5E7' }}
              >
                <div className="col-span-2">
                  <span className="text-sm font-medium" style={{ color: '#006666' }}>
                    {request.reference}
                  </span>
                </div>
                <div className="col-span-3">
                  <span className="text-sm" style={{ color: '#141A1F' }}>
                    {request.supplier_name || 'Non spécifié'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-sm" style={{ color: '#6C767F' }}>
                    {formatDate(request.created_at)}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                    {formatCurrency(request.total_ttc)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span
                    className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: status.bg, color: status.color }}
                  >
                    {status.label}
                  </span>
                </div>
                <div className="col-span-1 flex justify-end">
                  <button className="p-1.5 rounded hover:bg-gray-100">
                    <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
