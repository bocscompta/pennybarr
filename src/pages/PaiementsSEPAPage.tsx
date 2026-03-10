import { useState, useEffect, useCallback } from 'react'
import {
  getPayableSupplierInvoices,
  generatePaymentBatchFromInvoices,
  getSEPABatchHistory,
  saveSEPABatch,
  updateSEPABatchStatus,
  downloadSEPAFile,
  generateSEPAFilename,
  validateIBAN,
  validateBIC,
  formatIBAN,
  type SEPABatch,
  type SEPABatchPayment,
} from '../services/sepaService'

// ============ Types ============

interface PayableInvoice {
  id: string
  number: string
  date: string
  dueDate: string | null
  totalTTC: number
  thirdParty: {
    id: string
    name: string
    iban: string | null
    bic: string | null
  }
}

// ============ Utilitaires ============

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getStatusLabel = (status: SEPABatch['status']): string => {
  switch (status) {
    case 'pending': return 'En attente'
    case 'generated': return 'Genere'
    case 'sent': return 'Envoye'
    case 'executed': return 'Execute'
    default: return status
  }
}

const getStatusColor = (status: SEPABatch['status']): string => {
  switch (status) {
    case 'pending': return '#B8A038'
    case 'generated': return '#6C767F'
    case 'sent': return '#006666'
    case 'executed': return '#57534e'
    default: return '#6C767F'
  }
}

// ============ Composants ============

// Checkbox pour selection
function Checkbox({ checked, onChange, disabled = false }: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
      style={{
        borderColor: checked ? '#006666' : '#d4d4d4',
        backgroundColor: checked ? '#006666' : 'transparent',
      }}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}

// Badge IBAN valide/invalide
function IBANBadge({ iban, bic }: { iban: string | null; bic: string | null }) {
  const hasIBAN = iban && validateIBAN(iban)
  const hasBIC = bic && validateBIC(bic)
  const isValid = hasIBAN && hasBIC

  if (!iban && !bic) {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-700">
        IBAN manquant
      </span>
    )
  }

  if (!isValid) {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
        {!hasIBAN ? 'IBAN invalide' : 'BIC invalide'}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-stone-100 text-stone-600">
      {formatIBAN(iban).substring(0, 14)}...
    </span>
  )
}

// Card de preview des paiements
function PaymentPreviewCard({ payments, onClose, onConfirm, loading }: {
  payments: { creditorName: string; amount: number; reference: string }[]
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}) {
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
              Confirmation du lot SEPA
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-4 p-4 bg-stone-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span style={{ color: '#6C767F' }}>Nombre de virements</span>
              <span className="font-semibold" style={{ color: '#141A1F' }}>{payments.length}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span style={{ color: '#6C767F' }}>Montant total</span>
              <span className="font-semibold text-lg" style={{ color: '#141A1F' }}>
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-sm" style={{ color: '#6C767F' }}>
              Detail des paiements
            </h3>
            {payments.map((payment, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2 px-3 bg-white border rounded-lg"
                style={{ borderColor: '#E4E5E7' }}
              >
                <div>
                  <div className="font-medium" style={{ color: '#141A1F' }}>
                    {payment.creditorName}
                  </div>
                  <div className="text-sm" style={{ color: '#6C767F' }}>
                    {payment.reference}
                  </div>
                </div>
                <div className="font-mono font-medium" style={{ color: '#141A1F' }}>
                  {formatCurrency(payment.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-lg font-medium transition-colors hover:bg-stone-50"
              style={{ borderColor: '#E4E5E7', color: '#6C767F' }}
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#006666' }}
            >
              {loading ? 'Generation...' : 'Generer et telecharger'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ Page principale ============

export default function PaiementsSEPAPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  // State
  const [invoices, setInvoices] = useState<PayableInvoice[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [executionDate, setExecutionDate] = useState(() => {
    // Date par defaut: J+2 (delai SEPA standard)
    const date = new Date()
    date.setDate(date.getDate() + 2)
    return date.toISOString().split('T')[0]
  })
  const [batches, setBatches] = useState<SEPABatch[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewPayments, setPreviewPayments] = useState<{ creditorName: string; amount: number; reference: string }[]>([])
  const [activeTab, setActiveTab] = useState<'virements' | 'historique'>('virements')

  // Charger les donnees
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [invoicesData, batchesData] = await Promise.all([
        getPayableSupplierInvoices(),
        getSEPABatchHistory(20),
      ])
      setInvoices(invoicesData)
      setBatches(batchesData)
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err instanceof Error ? err.message : 'Erreur chargement donnees')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Selection
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    const validInvoices = invoices.filter(
      inv => inv.thirdParty.iban && validateIBAN(inv.thirdParty.iban) &&
             inv.thirdParty.bic && validateBIC(inv.thirdParty.bic)
    )
    if (selectedIds.size === validInvoices.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(validInvoices.map(inv => inv.id)))
    }
  }

  // Generer le lot SEPA
  const handleGenerateBatch = async () => {
    if (selectedIds.size === 0) return

    setError(null)
    try {
      const { payments } = await generatePaymentBatchFromInvoices(
        Array.from(selectedIds),
        executionDate
      )
      setPreviewPayments(payments.map(p => ({
        creditorName: p.creditorName,
        amount: p.amount,
        reference: p.reference,
      })))
      setShowPreview(true)
    } catch (err) {
      console.error('Error preparing SEPA batch:', err)
      setError(err instanceof Error ? err.message : 'Erreur preparation lot SEPA')
    }
  }

  const confirmGeneration = async () => {
    setGenerating(true)
    setError(null)
    try {
      const { xml } = await generatePaymentBatchFromInvoices(
        Array.from(selectedIds),
        executionDate
      )

      // Generer le nom de fichier
      const filename = generateSEPAFilename('transfer', executionDate)

      // Sauvegarder le lot en base
      const batchPayments: SEPABatchPayment[] = invoices
        .filter(inv => selectedIds.has(inv.id))
        .map(inv => ({
          invoiceId: inv.id,
          invoiceNumber: inv.number,
          thirdPartyName: inv.thirdParty.name,
          iban: inv.thirdParty.iban || '',
          bic: inv.thirdParty.bic || '',
          amount: inv.totalTTC,
          reference: `Paiement facture ${inv.number}`,
        }))

      await saveSEPABatch('transfer', executionDate, batchPayments, filename)

      // Telecharger le fichier
      downloadSEPAFile(xml, filename)

      // Rafraichir les donnees
      await loadData()
      setSelectedIds(new Set())
      setShowPreview(false)
    } catch (err) {
      console.error('Error generating SEPA batch:', err)
      setError(err instanceof Error ? err.message : 'Erreur generation lot SEPA')
    } finally {
      setGenerating(false)
    }
  }

  // Mettre a jour le statut d'un lot
  const handleUpdateBatchStatus = async (batchId: string, status: SEPABatch['status']) => {
    try {
      await updateSEPABatchStatus(batchId, status)
      await loadData()
    } catch (err) {
      console.error('Error updating batch status:', err)
      setError(err instanceof Error ? err.message : 'Erreur mise a jour statut')
    }
  }

  // Calculs
  const validInvoicesCount = invoices.filter(
    inv => inv.thirdParty.iban && validateIBAN(inv.thirdParty.iban) &&
           inv.thirdParty.bic && validateBIC(inv.thirdParty.bic)
  ).length
  const selectedTotal = invoices
    .filter(inv => selectedIds.has(inv.id))
    .reduce((sum, inv) => sum + inv.totalTTC, 0)

  // ============ Rendu ============

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="border-b px-8 py-6" style={{ borderColor: '#E4E5E7', backgroundColor: '#FBFBFB' }}>
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => onNavigate('plan-tresorerie')}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
              Virements SEPA
            </h1>
            <p className="text-sm" style={{ color: '#6C767F' }}>
              Generez des fichiers de virement XML ISO 20022 pour vos factures fournisseurs
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b -mb-6 pb-0" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={() => setActiveTab('virements')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'virements'
                ? 'border-current'
                : 'border-transparent hover:border-stone-300'
            }`}
            style={{ color: activeTab === 'virements' ? '#006666' : '#6C767F' }}
          >
            Nouveau virement
          </button>
          <button
            onClick={() => setActiveTab('historique')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'historique'
                ? 'border-current'
                : 'border-transparent hover:border-stone-300'
            }`}
            style={{ color: activeTab === 'historique' ? '#006666' : '#6C767F' }}
          >
            Historique ({batches.length})
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div className="whitespace-pre-wrap">{error}</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#006666' }}></div>
          </div>
        ) : activeTab === 'virements' ? (
          <>
            {/* Parametres du lot */}
            <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="font-semibold mb-4" style={{ color: '#141A1F' }}>
                Parametres du virement
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#6C767F' }}>
                    Date d'execution
                  </label>
                  <input
                    type="date"
                    value={executionDate}
                    onChange={(e) => setExecutionDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: '#E4E5E7' }}
                  />
                  <p className="text-xs mt-1" style={{ color: '#a8a29e' }}>
                    Delai standard SEPA: J+2
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#6C767F' }}>
                    Factures selectionnees
                  </label>
                  <div className="px-3 py-2 bg-stone-50 rounded-lg">
                    <span className="font-semibold" style={{ color: '#141A1F' }}>
                      {selectedIds.size}
                    </span>
                    <span className="text-sm ml-1" style={{ color: '#6C767F' }}>
                      / {validInvoicesCount} valides
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#6C767F' }}>
                    Montant total
                  </label>
                  <div className="px-3 py-2 bg-stone-50 rounded-lg">
                    <span className="font-semibold font-mono" style={{ color: '#141A1F' }}>
                      {formatCurrency(selectedTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleGenerateBatch}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#006666' }}
                >
                  Generer le fichier SEPA
                </button>
              </div>
            </div>

            {/* Liste des factures */}
            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
                <h2 className="font-semibold" style={{ color: '#141A1F' }}>
                  Factures fournisseurs a payer
                </h2>
                <button
                  onClick={selectAll}
                  className="text-sm font-medium transition-colors hover:underline"
                  style={{ color: '#006666' }}
                >
                  {selectedIds.size === validInvoicesCount ? 'Tout deselectionner' : 'Selectionner tout'}
                </button>
              </div>

              {invoices.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="w-16 h-16 mx-auto mb-4" style={{ color: '#d4d4d4' }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                  <h3 className="font-medium mb-2" style={{ color: '#141A1F' }}>
                    Aucune facture a payer
                  </h3>
                  <p className="text-sm" style={{ color: '#6C767F' }}>
                    Toutes vos factures fournisseurs sont payees ou aucune facture n'a ete saisie.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-stone-50">
                        <th className="px-4 py-3 text-left w-12">
                          <Checkbox
                            checked={selectedIds.size === validInvoicesCount && validInvoicesCount > 0}
                            onChange={selectAll}
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                          Fournisseur
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                          Facture
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                          Echeance
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                          IBAN
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                          Montant
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: '#E4E5E7' }}>
                      {invoices.map((invoice) => {
                        const isValid = invoice.thirdParty.iban && validateIBAN(invoice.thirdParty.iban) &&
                                       invoice.thirdParty.bic && validateBIC(invoice.thirdParty.bic)
                        const isSelected = selectedIds.has(invoice.id)
                        const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date()

                        return (
                          <tr
                            key={invoice.id}
                            className={`transition-colors ${isSelected ? 'bg-stone-50' : 'hover:bg-stone-50/50'}`}
                          >
                            <td className="px-4 py-3">
                              <Checkbox
                                checked={isSelected}
                                onChange={() => toggleSelect(invoice.id)}
                                disabled={!isValid}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium" style={{ color: '#141A1F' }}>
                                {invoice.thirdParty.name}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div style={{ color: '#141A1F' }}>{invoice.number}</div>
                              <div className="text-sm" style={{ color: '#6C767F' }}>
                                {formatDate(invoice.date)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {invoice.dueDate ? (
                                <span style={{ color: isOverdue ? '#b91c1c' : '#141A1F' }}>
                                  {formatDate(invoice.dueDate)}
                                  {isOverdue && (
                                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded">
                                      En retard
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span style={{ color: '#a8a29e' }}>-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <IBANBadge iban={invoice.thirdParty.iban} bic={invoice.thirdParty.bic} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-mono font-medium" style={{ color: '#141A1F' }}>
                                {formatCurrency(invoice.totalTTC)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Info IBAN manquants */}
            {invoices.some(inv => !inv.thirdParty.iban || !inv.thirdParty.bic) && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div>
                    <h4 className="font-medium text-amber-800">Coordonnees bancaires manquantes</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Certains fournisseurs n'ont pas d'IBAN/BIC enregistre.
                      Modifiez leur fiche dans la liste des fournisseurs pour ajouter leurs coordonnees bancaires.
                    </p>
                    <button
                      onClick={() => onNavigate('fournisseurs')}
                      className="mt-2 text-sm font-medium text-amber-800 hover:underline"
                    >
                      Gerer les fournisseurs
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Onglet Historique */
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="font-semibold" style={{ color: '#141A1F' }}>
                Historique des lots SEPA
              </h2>
            </div>

            {batches.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-16 h-16 mx-auto mb-4" style={{ color: '#d4d4d4' }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <h3 className="font-medium mb-2" style={{ color: '#141A1F' }}>
                  Aucun lot genere
                </h3>
                <p className="text-sm" style={{ color: '#6C767F' }}>
                  Generez votre premier fichier de virement SEPA depuis l'onglet "Nouveau virement".
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-stone-50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Date creation
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Fichier
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Execution
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Virements
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Montant
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Statut
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#E4E5E7' }}>
                    {batches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div style={{ color: '#141A1F' }}>{formatDateTime(batch.createdAt)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm" style={{ color: '#141A1F' }}>
                            {batch.filename}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div style={{ color: '#141A1F' }}>{formatDate(batch.executionDate)}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span style={{ color: '#141A1F' }}>{batch.paymentCount}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono font-medium" style={{ color: '#141A1F' }}>
                            {formatCurrency(batch.totalAmount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full"
                            style={{
                              backgroundColor: `${getStatusColor(batch.status)}15`,
                              color: getStatusColor(batch.status),
                            }}
                          >
                            {getStatusLabel(batch.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {batch.status === 'generated' && (
                              <button
                                onClick={() => handleUpdateBatchStatus(batch.id, 'sent')}
                                className="text-xs px-2 py-1 rounded border transition-colors hover:bg-stone-50"
                                style={{ borderColor: '#E4E5E7', color: '#006666' }}
                                title="Marquer comme envoye"
                              >
                                Envoye
                              </button>
                            )}
                            {batch.status === 'sent' && (
                              <button
                                onClick={() => handleUpdateBatchStatus(batch.id, 'executed')}
                                className="text-xs px-2 py-1 rounded border transition-colors hover:bg-stone-50"
                                style={{ borderColor: '#E4E5E7', color: '#57534e' }}
                                title="Marquer comme execute"
                              >
                                Execute
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de preview */}
      {showPreview && (
        <PaymentPreviewCard
          payments={previewPayments}
          onClose={() => setShowPreview(false)}
          onConfirm={confirmGeneration}
          loading={generating}
        />
      )}
    </div>
  )
}
