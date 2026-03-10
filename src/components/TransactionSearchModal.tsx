// TransactionSearchModal - Modal to search and reconcile transactions to an invoice
import { useState, useEffect, useMemo } from 'react'
import { getAllBankTransactions } from '../services/supabaseService'
import type { BankTransaction, Invoice } from '../types/database'

interface TransactionSearchModalProps {
  isOpen: boolean
  onClose: () => void
  invoice: Invoice
  onReconcile?: (transactionIds: string[]) => void
}

export default function TransactionSearchModal({
  isOpen,
  onClose,
  invoice,
  onReconcile
}: TransactionSearchModalProps) {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([])
  const [searchText, setSearchText] = useState('')
  const [showReconciled, setShowReconciled] = useState(false)
  const [perPage, setPerPage] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (isOpen) {
      loadTransactions()
    }
  }, [isOpen])

  const loadTransactions = async () => {
    try {
      setLoading(true)
      const data = await getAllBankTransactions()
      setTransactions(data)
    } catch (err) {
      console.error('Error loading transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatInvoiceDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Filter and paginate transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions

    // Filter by search text
    if (searchText) {
      const search = searchText.toLowerCase()
      filtered = filtered.filter(t =>
        t.description?.toLowerCase().includes(search) ||
        t.reference?.toLowerCase().includes(search)
      )
    }

    // Filter by reconciliation status
    if (!showReconciled) {
      filtered = filtered.filter(t => !t.is_reconciled)
    }

    return filtered
  }, [transactions, searchText, showReconciled])

  const totalPages = Math.ceil(filteredTransactions.length / perPage)
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  )

  const toggleTransaction = (id: string) => {
    setSelectedTransactions(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  const selectedAmount = useMemo(() => {
    return transactions
      .filter(t => selectedTransactions.includes(t.id))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  }, [transactions, selectedTransactions])

  const remainingAmount = invoice.total_ttc - selectedAmount

  const handleReconcile = () => {
    if (onReconcile && selectedTransactions.length > 0) {
      onReconcile(selectedTransactions)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-screen flex items-start justify-center p-4 pt-8">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-6xl" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
            <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
              Rapprochez des transactions à la facture {invoice.number} du {formatInvoiceDate(invoice.date)}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Summary Bar */}
          <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b" style={{ borderColor: '#E4E5E7' }}>
            <span className="text-sm" style={{ color: '#6C767F' }}>
              {selectedTransactions.length === 0
                ? 'Aucune nouvelle transaction sélectionnée'
                : `${selectedTransactions.length} transaction(s) sélectionnée(s)`}
            </span>
            <div className="flex items-center gap-6">
              <span className="text-sm">
                <span className="font-semibold" style={{ color: '#141A1F' }}>-{formatCurrency(invoice.total_ttc)} €</span>
                <span style={{ color: '#6C767F' }}> total de la facture</span>
              </span>
              <span className="text-sm">
                <span className="font-semibold" style={{ color: remainingAmount === 0 ? '#22C55E' : '#141A1F' }}>
                  {formatCurrency(remainingAmount)} €
                </span>
                <span style={{ color: '#6C767F' }}> restant à rapprocher</span>
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="px-6 py-3 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: '#E4E5E7' }}>
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Libellé ou tiers"
                className="pl-9 pr-3 py-2 border rounded-lg text-sm w-48"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>

            {/* Filter buttons */}
            {['Comptes bancaires', 'Statut', 'Tiers', 'Date d\'émission', 'Montant TTC', 'Restant à rapprocher'].map((filter) => (
              <button
                key={filter}
                className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm bg-white"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                {filter}
                <svg className="w-3.5 h-3.5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            ))}

            <div className="flex-1" />

            {/* Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setShowReconciled(!showReconciled)}
                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${showReconciled ? 'bg-teal-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showReconciled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm" style={{ color: '#141A1F' }}>Déjà rapprochées à cette facture</span>
            </label>
          </div>

          {/* Table */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 20rem)' }}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
                    <th className="w-10 p-3">
                      <input type="checkbox" className="rounded" />
                    </th>
                    <th className="w-10 p-3"></th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Statut</th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>
                      <div className="flex items-center gap-1">
                        Émission
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                        </svg>
                      </div>
                    </th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Libellé</th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Tiers</th>
                    <th className="text-right p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Montant TTC</th>
                    <th className="text-right p-3 text-sm font-medium" style={{ color: '#6C767F' }}>À rapprocher</th>
                    <th className="text-center p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center" style={{ color: '#6C767F' }}>
                        Aucune transaction trouvée
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((tx) => {
                      const isSelected = selectedTransactions.includes(tx.id)
                      return (
                        <tr
                          key={tx.id}
                          className={`border-b hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-green-50' : ''}`}
                          style={{ borderColor: '#F2F2F3' }}
                          onClick={() => toggleTransaction(tx.id)}
                        >
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={isSelected}
                              onChange={() => toggleTransaction(tx.id)}
                            />
                          </td>
                          <td className="p-3">
                            <div className="w-6 h-4 rounded flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#1E3A5F' }}>
                              CIC
                            </div>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${tx.is_reconciled ? 'text-white' : 'border'}`}
                              style={{
                                backgroundColor: tx.is_reconciled ? '#006666' : 'transparent',
                                borderColor: tx.is_reconciled ? undefined : '#D6D9DB',
                                color: tx.is_reconciled ? 'white' : '#141A1F'
                              }}
                            >
                              {tx.is_reconciled ? 'Justifié' : 'Non justifié'}
                            </span>
                          </td>
                          <td className="p-3 text-sm" style={{ color: '#141A1F' }}>{formatDate(tx.date)}</td>
                          <td className="p-3 text-sm" style={{ color: '#141A1F' }}>
                            {tx.description?.substring(0, 50) || '-'}
                            {tx.description && tx.description.length > 50 ? '...' : ''}
                          </td>
                          <td className="p-3 text-sm font-medium" style={{ color: '#141A1F' }}>
                            {tx.reference || '-'}
                          </td>
                          <td className="p-3 text-sm text-right" style={{ color: '#141A1F' }}>
                            {formatCurrency(tx.amount)} €
                          </td>
                          <td className="p-3 text-sm text-right" style={{ color: '#141A1F' }}>
                            {formatCurrency(tx.amount)} €
                          </td>
                          <td className="p-3 text-center">
                            <button className="p-1.5 hover:bg-gray-100 rounded">
                              <svg className="w-4 h-4" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: '#E4E5E7' }}>
            {/* Pagination */}
            <div className="flex items-center gap-2">
              {[25, 50, 100].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    setPerPage(num)
                    setCurrentPage(1)
                  }}
                  className={`px-2.5 py-1 rounded text-sm ${perPage === num ? 'text-white' : ''}`}
                  style={{
                    backgroundColor: perPage === num ? '#006666' : 'transparent',
                    color: perPage === num ? 'white' : '#6C767F'
                  }}
                >
                  {num}
                </button>
              ))}
              <span className="text-sm ml-2" style={{ color: '#6C767F' }}>éléments par page</span>
            </div>

            {/* Reconcile Button */}
            <button
              onClick={handleReconcile}
              disabled={selectedTransactions.length === 0}
              className="px-6 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: '#006666' }}
            >
              Rapprocher
            </button>

            {/* Page info */}
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: '#6C767F' }}>
                {(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, filteredTransactions.length)} sur {filteredTransactions.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded border disabled:opacity-50"
                  style={{ borderColor: '#D6D9DB' }}
                >
                  <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded text-sm ${currentPage === page ? 'text-white' : ''}`}
                    style={{
                      backgroundColor: currentPage === page ? '#006666' : 'transparent',
                      color: currentPage === page ? 'white' : '#6C767F'
                    }}
                  >
                    {page}
                  </button>
                ))}
                {totalPages > 5 && <span className="text-sm" style={{ color: '#6C767F' }}>...</span>}
                {totalPages > 5 && (
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="px-3 py-1 rounded text-sm"
                    style={{ color: '#6C767F' }}
                  >
                    {totalPages}
                  </button>
                )}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded border disabled:opacity-50"
                  style={{ borderColor: '#D6D9DB' }}
                >
                  <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
