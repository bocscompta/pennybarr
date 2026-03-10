import { useState, useMemo } from 'react'
import { X, Search, Filter, Calendar, DollarSign, FileText } from 'lucide-react'
import { useInvoices } from '../hooks/useSupabase'
import type { Invoice, BankTransaction } from '../types/database'

interface InvoiceSearchModalProps {
  transaction: BankTransaction
  onClose: () => void
  onReconcile: (invoiceIds: string[]) => Promise<void>
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function InvoiceSearchModal({ transaction, onClose, onReconcile }: InvoiceSearchModalProps) {
  const { invoices, loading: isLoading } = useInvoices('supplier')

  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25
  const [isReconciling, setIsReconciling] = useState(false)

  // Filtrer les factures
  const filteredInvoices = useMemo(() => {
    let filtered = invoices

    // Filtre par recherche (numéro ou tiers)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(inv =>
        inv.number.toLowerCase().includes(query) ||
        inv.third_party?.name.toLowerCase().includes(query)
      )
    }

    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter)
    }

    return filtered
  }, [invoices, searchQuery, statusFilter])

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage)
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Calculer le montant total des factures sélectionnées
  const selectedTotal = useMemo(() => {
    return Array.from(selectedInvoiceIds).reduce((sum, id) => {
      const invoice = invoices.find(inv => inv.id === id)
      return sum + (invoice?.total_ttc || 0)
    }, 0)
  }, [selectedInvoiceIds, invoices])

  const transactionAmount = Math.abs(transaction.amount)
  const remainingAmount = transactionAmount - Math.abs(selectedTotal)

  const handleToggleInvoice = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoiceIds)
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId)
    } else {
      newSelected.add(invoiceId)
    }
    setSelectedInvoiceIds(newSelected)
  }

  const handleReconcile = async () => {
    if (selectedInvoiceIds.size === 0) return

    setIsReconciling(true)
    try {
      await onReconcile(Array.from(selectedInvoiceIds))
      onClose()
    } catch (error) {
      console.error('Reconciliation error:', error)
    } finally {
      setIsReconciling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            Rapprochez des factures à la transaction {transaction.label} du {formatDate(transaction.date)}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            style={{ color: '#6C767F' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Summary bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-blue-50 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: '#6C767F' }}>
              {selectedInvoiceIds.size === 0 ? 'Aucune facture sélectionnée' : `${selectedInvoiceIds.size} facture${selectedInvoiceIds.size > 1 ? 's' : ''} sélectionnée${selectedInvoiceIds.size > 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: '#006666' }}>
                {formatCurrency(transactionAmount)}
              </span>
              <span className="text-sm" style={{ color: '#6C767F' }}>total de la transaction</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: remainingAmount === 0 ? '#2E7D32' : '#006666' }}>
                {formatCurrency(remainingAmount)}
              </span>
              <span className="text-sm" style={{ color: '#6C767F' }}>restant à rapprocher</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6C767F' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Numéro facture ou tiers"
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyé</option>
              <option value="paid">Payé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: '#6C767F' }}>Chargement des factures...</p>
            </div>
          ) : paginatedInvoices.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: '#6C767F' }}>Aucune facture trouvée</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" className="rounded" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6C767F' }}>Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6C767F' }}>Émission</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6C767F' }}>Échéance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6C767F' }}>Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6C767F' }}>Tiers</th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6C767F' }}>Numéro de facture</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6C767F' }}>Montant TTC</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6C767F' }}>À rapprocher</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#E4E5E7' }}>
                {paginatedInvoices.map((invoice) => {
                  const isSelected = selectedInvoiceIds.has(invoice.id)
                  return (
                    <tr
                      key={invoice.id}
                      className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                      onClick={() => handleToggleInvoice(invoice.id)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleInvoice(invoice.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                          invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          invoice.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {invoice.status === 'paid' ? 'Payée' :
                           invoice.status === 'sent' ? 'Envoyée' :
                           invoice.status === 'draft' ? 'Brouillon' : 'Annulée'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#141A1F' }}>
                        {formatDate(invoice.date)}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#141A1F' }}>
                        {invoice.due_date ? formatDate(invoice.due_date) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#141A1F' }}>
                        {invoice.type === 'supplier' ? 'Achat' : 'Vente'}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#141A1F' }}>
                        {invoice.third_party?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: '#141A1F' }}>
                        {invoice.number}
                      </td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: '#141A1F' }}>
                        {formatCurrency(invoice.total_ttc)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right" style={{ color: '#141A1F' }}>
                        {formatCurrency(invoice.total_ttc)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer - Pagination & Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center gap-3">
            <select
              defaultValue={itemsPerPage}
              className="px-3 py-1.5 border rounded text-sm"
              style={{ borderColor: '#D6D9DB' }}
              disabled
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm" style={{ color: '#6C767F' }}>
              {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredInvoices.length)} sur {filteredInvoices.length}
            </span>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
              style={{ borderColor: '#D6D9DB' }}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 border rounded text-sm ${currentPage === page ? 'bg-stone-600 text-white' : ''}`}
                  style={{ borderColor: '#D6D9DB' }}
                >
                  {page}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
              style={{ borderColor: '#D6D9DB' }}
            >
              ›
            </button>
          </div>

          {/* Reconcile button */}
          <button
            onClick={handleReconcile}
            disabled={selectedInvoiceIds.size === 0 || isReconciling}
            className="px-6 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: '#006666' }}
          >
            {isReconciling ? 'Rapprochement...' : 'Rapprocher'}
          </button>
        </div>
      </div>
    </div>
  )
}
