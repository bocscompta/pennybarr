import { useState, useEffect, useMemo } from 'react'
import {
  getCreditNotes,
  getCreditNote,
  createCreditNote,
  validateCreditNote,
  applyCreditNoteToInvoice,
  refundCreditNote,
  deleteCreditNote,
  generateCreditNoteNumber,
  previewCreditNoteEntries,
  type CreditNoteFormData,
  type CreditNoteLineFormData,
  type CreditNoteFilters,
  type CreditNoteStatus,
  type PreviewCreditNoteEntry,
} from '../services/avoirsService'
import { getCustomerInvoices } from '../services/venteService'
import { useCustomers, useChartOfAccounts, useBankAccounts } from '../hooks/useSupabase'
import ThirdPartyPicker from '../components/ThirdPartyPicker'
import AccountPicker from '../components/AccountPicker'
import type { CreditNote, Invoice, ThirdParty, BankAccount } from '../types/database'

// Format date from ISO string
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

// Get status badge style
const getStatusBadge = (status: CreditNoteStatus) => {
  switch (status) {
    case 'draft':
      return { bg: '#F3F4F6', text: '#374151', label: 'Brouillon' }
    case 'validated':
      return { bg: '#DBEAFE', text: '#1E40AF', label: 'Valide' }
    case 'applied':
      return { bg: '#D6D9DB', text: '#374151', label: 'Impute' }
    case 'refunded':
      return { bg: '#D1FAE5', text: '#065F46', label: 'Rembourse' }
    default:
      return { bg: '#F3F4F6', text: '#374151', label: status }
  }
}

// VAT rates
const VAT_RATES = [
  { value: '20', label: '20%' },
  { value: '10', label: '10%' },
  { value: '5.5', label: '5,5%' },
  { value: '0', label: '0% (Exonere)' },
]

// Initial line state
const initialLineData: CreditNoteLineFormData = {
  description: '',
  quantity: 1,
  unitPrice: 0,
  vatRate: '20',
  accountingCode: '706000',
}

// Initial form state
const initialFormData: CreditNoteFormData = {
  customerId: null,
  customerName: '',
  originalInvoiceId: undefined,
  creditNoteNumber: '',
  date: new Date().toISOString().split('T')[0],
  reason: '',
  lines: [{ ...initialLineData }],
  currency: 'EUR',
}

interface AvoirsPageProps {
  onNavigate?: (page: string) => void
}

export default function AvoirsPage({ onNavigate: _onNavigate }: AvoirsPageProps) {
  // State
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [perPage, setPerPage] = useState(50)

  // Filters
  const [statusFilter, setStatusFilter] = useState<CreditNoteStatus | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortField, setSortField] = useState<'date' | 'total_ttc'>('date')
  const [sortAsc, setSortAsc] = useState(false)

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<CreditNoteFormData>(initialFormData)
  const [previewEntries, setPreviewEntries] = useState<PreviewCreditNoteEntry[]>([])
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  // Apply modal state
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('')
  const [applyAmount, setApplyAmount] = useState<number>(0)

  // Refund modal state
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('')

  // Hooks
  const { customers } = useCustomers()
  const { accounts } = useChartOfAccounts()
  const { accounts: bankAccounts } = useBankAccounts()

  // Fetch credit notes
  const fetchCreditNotes = async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: CreditNoteFilters = {}
      if (statusFilter !== 'all') {
        filters.status = statusFilter
      }
      if (startDate) filters.startDate = startDate
      if (endDate) filters.endDate = endDate
      if (searchTerm) filters.searchTerm = searchTerm

      const data = await getCreditNotes(filters)
      setCreditNotes(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
      console.error('Error fetching credit notes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCreditNotes()
  }, [statusFilter, startDate, endDate, searchTerm])

  // Filter and sort credit notes
  const filteredCreditNotes = useMemo(() => {
    let result = [...creditNotes]

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
      } else if (sortField === 'total_ttc') {
        comparison = a.total_ttc - b.total_ttc
      }
      return sortAsc ? comparison : -comparison
    })

    return result.slice(0, perPage)
  }, [creditNotes, sortField, sortAsc, perPage])

  // Create customer map
  const customerMap = useMemo(() => {
    const map = new Map<string, string>()
    customers.forEach(c => map.set(c.id, c.name))
    return map
  }, [customers])

  // Toggle selection
  const toggleRow = (id: string) => {
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedRows.length === filteredCreditNotes.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(filteredCreditNotes.map(cn => cn.id))
    }
  }

  // Toggle sort
  const toggleSort = (field: 'date' | 'total_ttc') => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  // Calculate line totals
  const calculateLineTotals = (line: CreditNoteLineFormData) => {
    const ht = line.quantity * line.unitPrice
    const vatRate = parseFloat(line.vatRate) / 100
    const vat = ht * vatRate
    return {
      ht: Math.round(ht * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      ttc: Math.round((ht + vat) * 100) / 100,
    }
  }

  // Calculate form totals
  const calculateFormTotals = () => {
    let totalHT = 0
    let totalVAT = 0
    for (const line of formData.lines) {
      const { ht, vat } = calculateLineTotals(line)
      totalHT += ht
      totalVAT += vat
    }
    return {
      totalHT: Math.round(totalHT * 100) / 100,
      totalVAT: Math.round(totalVAT * 100) / 100,
      totalTTC: Math.round((totalHT + totalVAT) * 100) / 100,
    }
  }

  // Update form
  const updateForm = (updates: Partial<CreditNoteFormData>) => {
    const newData = { ...formData, ...updates }
    setFormData(newData)

    // Update preview entries
    if (newData.customerName && newData.lines.some(l => l.unitPrice > 0)) {
      previewCreditNoteEntries(newData, newData.customerId || undefined)
        .then(entries => setPreviewEntries(entries))
        .catch(err => {
          console.error('Error previewing credit note entries:', err)
          setPreviewEntries([])
        })
    } else {
      setPreviewEntries([])
    }
  }

  // Update line
  const updateLine = (index: number, updates: Partial<CreditNoteLineFormData>) => {
    const newLines = [...formData.lines]
    newLines[index] = { ...newLines[index], ...updates }
    updateForm({ lines: newLines })
  }

  // Add line
  const addLine = () => {
    updateForm({ lines: [...formData.lines, { ...initialLineData }] })
  }

  // Remove line
  const removeLine = (index: number) => {
    if (formData.lines.length <= 1) return
    const newLines = formData.lines.filter((_, i) => i !== index)
    updateForm({ lines: newLines })
  }

  // Handle customer selection
  const handleCustomerSelect = (name: string, id: string | null, _thirdParty?: ThirdParty) => {
    updateForm({
      customerName: name,
      customerId: id,
    })
  }

  // Generate credit note number
  const handleGenerateNumber = async () => {
    try {
      const number = await generateCreditNoteNumber()
      updateForm({ creditNoteNumber: number })
    } catch (err) {
      console.error('Error generating number:', err)
    }
  }

  // Open create modal
  const openCreateModal = async () => {
    const number = await generateCreditNoteNumber()
    setFormData({
      ...initialFormData,
      creditNoteNumber: number,
      date: new Date().toISOString().split('T')[0],
    })
    setPreviewEntries([])
    setSelectedCreditNote(null)
    setIsCreateModalOpen(true)
  }

  // Open view modal
  const openViewModal = async (creditNote: CreditNote) => {
    try {
      const fullCreditNote = await getCreditNote(creditNote.id)
      setSelectedCreditNote(fullCreditNote)
      setIsViewModalOpen(true)
    } catch (err) {
      console.error('Error fetching credit note:', err)
      setError('Erreur lors du chargement de l\'avoir')
    }
  }

  // Open apply modal
  const openApplyModal = async (creditNote: CreditNote) => {
    setSelectedCreditNote(creditNote)
    setSelectedInvoiceId('')
    setApplyAmount(creditNote.total_ttc)

    // Fetch unpaid invoices for this customer
    try {
      const invoices = await getCustomerInvoices({
        customerId: creditNote.customer_id,
        status: 'sent',
      })
      setCustomerInvoices(invoices)
    } catch (err) {
      console.error('Error fetching invoices:', err)
    }

    setIsApplyModalOpen(true)
  }

  // Open refund modal
  const openRefundModal = (creditNote: CreditNote) => {
    setSelectedCreditNote(creditNote)
    setSelectedBankAccountId(bankAccounts[0]?.id || '')
    setIsRefundModalOpen(true)
  }

  // Submit create form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.customerName) {
      setError('Veuillez selectionner un client')
      return
    }
    if (!formData.reason) {
      setError('Veuillez saisir un motif')
      return
    }
    if (formData.lines.every(l => l.unitPrice <= 0)) {
      setError('Au moins une ligne avec un montant est requise')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await createCreditNote(formData)
      setIsCreateModalOpen(false)
      await fetchCreditNotes()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la creation'
      setError(errorMessage)
      console.error('Error creating credit note:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Validate credit note
  const handleValidate = async (creditNoteId: string) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await validateCreditNote(creditNoteId)
      setIsViewModalOpen(false)
      await fetchCreditNotes()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la validation'
      setError(errorMessage)
      console.error('Error validating credit note:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Apply credit note
  const handleApply = async () => {
    if (!selectedCreditNote || !selectedInvoiceId) {
      setError('Veuillez selectionner une facture')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await applyCreditNoteToInvoice(selectedCreditNote.id, selectedInvoiceId, applyAmount)
      setIsApplyModalOpen(false)
      await fetchCreditNotes()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'imputation'
      setError(errorMessage)
      console.error('Error applying credit note:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Refund credit note
  const handleRefund = async () => {
    if (!selectedCreditNote || !selectedBankAccountId) {
      setError('Veuillez selectionner un compte bancaire')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await refundCreditNote(selectedCreditNote.id, selectedBankAccountId)
      setIsRefundModalOpen(false)
      await fetchCreditNotes()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du remboursement'
      setError(errorMessage)
      console.error('Error refunding credit note:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete credit note
  const handleDelete = async (creditNoteId: string) => {
    try {
      await deleteCreditNote(creditNoteId)
      setShowDeleteConfirm(null)
      await fetchCreditNotes()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la suppression'
      setError(errorMessage)
      console.error('Error deleting credit note:', err)
    }
  }

  const formTotals = calculateFormTotals()

  // Loading state
  if (loading && creditNotes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p style={{ color: '#6C767F' }}>Chargement des avoirs clients...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>Avoirs clients</h1>
          <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#57534e' }}></span>
            Exercice 2024-2025
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm"
          style={{ backgroundColor: '#57534e' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvel avoir
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-4 rounded-lg border" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span className="text-sm text-red-800">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Numero/Motif..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 border rounded-lg text-sm bg-white w-48"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          {/* Date range */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
            style={{ borderColor: '#D6D9DB' }}
          />
          <span style={{ color: '#6C767F' }}>-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
            style={{ borderColor: '#D6D9DB' }}
          />
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: 'all', label: 'Tous' },
            { value: 'draft', label: 'Brouillon' },
            { value: 'validated', label: 'Valides' },
            { value: 'applied', label: 'Imputes' },
            { value: 'refunded', label: 'Rembourses' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value as CreditNoteStatus | 'all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                statusFilter === filter.value ? 'text-white' : 'border bg-white'
              }`}
              style={{
                backgroundColor: statusFilter === filter.value ? '#57534e' : undefined,
                borderColor: statusFilter === filter.value ? undefined : '#D6D9DB',
                color: statusFilter === filter.value ? 'white' : '#141A1F',
              }}
            >
              {filter.label}
            </button>
          ))}

          <div className="flex-1" />

          <span className="text-sm" style={{ color: '#6C767F' }}>
            {creditNotes.length} avoir{creditNotes.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={filteredCreditNotes.length > 0 && selectedRows.length === filteredCreditNotes.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Numero</th>
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Client</th>
              <th
                className="text-left p-3 text-sm font-medium cursor-pointer hover:bg-gray-50"
                style={{ color: '#6C767F' }}
                onClick={() => toggleSort('date')}
              >
                <div className="flex items-center gap-1">
                  Date
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                  </svg>
                </div>
              </th>
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Motif</th>
              <th
                className="text-right p-3 text-sm font-medium cursor-pointer hover:bg-gray-50"
                style={{ color: '#6C767F' }}
                onClick={() => toggleSort('total_ttc')}
              >
                <div className="flex items-center justify-end gap-1">
                  Montant TTC
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                  </svg>
                </div>
              </th>
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Statut</th>
              <th className="w-20 p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredCreditNotes.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center">
                  <p style={{ color: '#6C767F' }}>Aucun avoir client trouve</p>
                </td>
              </tr>
            ) : (
              filteredCreditNotes.map((creditNote) => {
                const badge = getStatusBadge(creditNote.status)
                const customerName = creditNote.customer?.name || customerMap.get(creditNote.customer_id) || 'Client inconnu'

                return (
                  <tr
                    key={creditNote.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    style={{ borderColor: '#F2F2F3' }}
                    onClick={() => openViewModal(creditNote)}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedRows.includes(creditNote.id)}
                        onChange={() => toggleRow(creditNote.id)}
                      />
                    </td>
                    <td className="p-3 text-sm font-medium" style={{ color: '#141A1F' }}>{creditNote.number}</td>
                    <td className="p-3 text-sm" style={{ color: '#141A1F' }}>{customerName}</td>
                    <td className="p-3 text-sm" style={{ color: '#141A1F' }}>{formatDate(creditNote.date)}</td>
                    <td className="p-3 text-sm max-w-xs truncate" style={{ color: '#6C767F' }}>{creditNote.reason}</td>
                    <td className="p-3 text-sm text-right font-medium" style={{ color: '#141A1F' }}>
                      {formatCurrency(creditNote.total_ttc)}
                    </td>
                    <td className="p-3">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ backgroundColor: badge.bg, color: badge.text }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="relative group">
                        <button className="p-1 rounded hover:bg-gray-100">
                          <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                          </svg>
                        </button>
                        {/* Dropdown menu */}
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10" style={{ borderColor: '#E4E5E7' }}>
                          <button
                            onClick={() => openViewModal(creditNote)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            style={{ color: '#141A1F' }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Voir details
                          </button>
                          {creditNote.status === 'draft' && (
                            <button
                              onClick={() => handleValidate(creditNote.id)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              style={{ color: '#141A1F' }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Valider
                            </button>
                          )}
                          {creditNote.status === 'validated' && (
                            <>
                              <button
                                onClick={() => openApplyModal(creditNote)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                style={{ color: '#141A1F' }}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                                Imputer sur facture
                              </button>
                              <button
                                onClick={() => openRefundModal(creditNote)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                style={{ color: '#141A1F' }}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                                </svg>
                                Rembourser
                              </button>
                            </>
                          )}
                          {creditNote.status === 'draft' && (
                            <>
                              <div className="border-t my-1" style={{ borderColor: '#E4E5E7' }}></div>
                              <button
                                onClick={() => setShowDeleteConfirm(creditNote.id)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                                Supprimer
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-1">
          {[50, 100, 300].map((num) => (
            <button
              key={num}
              onClick={() => setPerPage(num)}
              className={`px-2 py-1 rounded text-sm ${perPage === num ? 'text-white' : ''}`}
              style={{
                backgroundColor: perPage === num ? '#57534e' : 'transparent',
                color: perPage === num ? 'white' : '#6C767F'
              }}
            >
              {num}
            </button>
          ))}
          <span className="text-sm ml-2" style={{ color: '#6C767F' }}>elements par page</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: '#6C767F' }}>1-{Math.min(perPage, creditNotes.length)} sur {creditNotes.length}</span>
        </div>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                Nouvel avoir client
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Customer */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Client</label>
                    <ThirdPartyPicker
                      thirdParties={customers}
                      value={formData.customerName}
                      selectedId={formData.customerId}
                      type="customer"
                      onChange={handleCustomerSelect}
                      placeholder="Rechercher un client..."
                    />
                  </div>

                  {/* Credit note number */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Numero d'avoir</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.creditNoteNumber}
                        onChange={(e) => updateForm({ creditNoteNumber: e.target.value })}
                        className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        style={{ borderColor: '#D6D9DB' }}
                      />
                      <button
                        type="button"
                        onClick={handleGenerateNumber}
                        className="px-3 py-2 border rounded-lg text-sm"
                        style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                      >
                        Generer
                      </button>
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => updateForm({ date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>

                  {/* Reason */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Motif de l'avoir</label>
                    <input
                      type="text"
                      value={formData.reason}
                      onChange={(e) => updateForm({ reason: e.target.value })}
                      placeholder="Ex: Retour marchandise, remise commerciale..."
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                </div>

                {/* Lines */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium" style={{ color: '#141A1F' }}>Lignes</label>
                    <button
                      type="button"
                      onClick={addLine}
                      className="text-sm flex items-center gap-1"
                      style={{ color: '#57534e' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Ajouter une ligne
                    </button>
                  </div>

                  <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: '#F9FAFB' }}>
                          <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Description</th>
                          <th className="text-right p-2 font-medium w-20" style={{ color: '#6C767F' }}>Qte</th>
                          <th className="text-right p-2 font-medium w-28" style={{ color: '#6C767F' }}>P.U. HT</th>
                          <th className="text-center p-2 font-medium w-24" style={{ color: '#6C767F' }}>TVA</th>
                          <th className="text-left p-2 font-medium w-32" style={{ color: '#6C767F' }}>Compte</th>
                          <th className="text-right p-2 font-medium w-24" style={{ color: '#6C767F' }}>Total HT</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.lines.map((line, index) => {
                          const lineTotals = calculateLineTotals(line)
                          return (
                            <tr key={index} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={line.description}
                                  onChange={(e) => updateLine(index, { description: e.target.value })}
                                  placeholder="Description..."
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  style={{ borderColor: '#D6D9DB' }}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={line.quantity}
                                  onChange={(e) => updateLine(index, { quantity: parseInt(e.target.value) || 1 })}
                                  className="w-full px-2 py-1 border rounded text-sm text-right"
                                  style={{ borderColor: '#D6D9DB' }}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={line.unitPrice || ''}
                                  onChange={(e) => updateLine(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                                  className="w-full px-2 py-1 border rounded text-sm text-right"
                                  style={{ borderColor: '#D6D9DB' }}
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={line.vatRate}
                                  onChange={(e) => updateLine(index, { vatRate: e.target.value })}
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  style={{ borderColor: '#D6D9DB' }}
                                >
                                  {VAT_RATES.map((rate) => (
                                    <option key={rate.value} value={rate.value}>{rate.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2">
                                <AccountPicker
                                  accounts={accounts}
                                  value={line.accountingCode}
                                  onChange={(code) => updateLine(index, { accountingCode: code })}
                                  filterClass="7"
                                  placeholder="7xxx..."
                                />
                              </td>
                              <td className="p-2 text-right font-medium" style={{ color: '#141A1F' }}>
                                {formatCurrency(lineTotals.ht)}
                              </td>
                              <td className="p-2">
                                {formData.lines.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeLine(index)}
                                    className="p-1 rounded hover:bg-red-50 text-red-500"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="grid grid-cols-3 gap-4 p-4 rounded-lg mb-6" style={{ backgroundColor: '#F9FAFB' }}>
                  <div>
                    <span className="text-sm" style={{ color: '#6C767F' }}>Total HT</span>
                    <p className="text-lg font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(formTotals.totalHT)}</p>
                  </div>
                  <div>
                    <span className="text-sm" style={{ color: '#6C767F' }}>TVA</span>
                    <p className="text-lg font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(formTotals.totalVAT)}</p>
                  </div>
                  <div>
                    <span className="text-sm" style={{ color: '#6C767F' }}>Total TTC</span>
                    <p className="text-lg font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(formTotals.totalTTC)}</p>
                  </div>
                </div>

                {/* Preview entries */}
                {previewEntries.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium mb-2" style={{ color: '#141A1F' }}>Apercu des ecritures comptables</h3>
                    <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: '#F9FAFB' }}>
                            <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Compte</th>
                            <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Libelle</th>
                            <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>Debit</th>
                            <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewEntries.map((entry) => (
                            <tr key={entry.id} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                              <td className="p-2 font-mono" style={{ color: '#141A1F' }}>{entry.accountCode}</td>
                              <td className="p-2" style={{ color: '#141A1F' }}>{entry.accountLabel}</td>
                              <td className="p-2 text-right" style={{ color: entry.debit > 0 ? '#141A1F' : '#6C767F' }}>
                                {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                              </td>
                              <td className="p-2 text-right" style={{ color: entry.credit > 0 ? '#141A1F' : '#6C767F' }}>
                                {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 border rounded-lg text-sm font-medium"
                    style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.customerName || !formData.reason || formTotals.totalTTC <= 0}
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: '#57534e' }}
                  >
                    {isSubmitting ? 'Creation...' : 'Creer l\'avoir'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && selectedCreditNote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                  Avoir {selectedCreditNote.number}
                </h2>
                <p className="text-sm" style={{ color: '#6C767F' }}>
                  {selectedCreditNote.customer?.name || 'Client'}
                </p>
              </div>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              {/* Info */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <span className="text-sm" style={{ color: '#6C767F' }}>Date</span>
                  <p className="font-medium" style={{ color: '#141A1F' }}>{formatDate(selectedCreditNote.date)}</p>
                </div>
                <div>
                  <span className="text-sm" style={{ color: '#6C767F' }}>Statut</span>
                  <p>
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: getStatusBadge(selectedCreditNote.status).bg,
                        color: getStatusBadge(selectedCreditNote.status).text,
                      }}
                    >
                      {getStatusBadge(selectedCreditNote.status).label}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-sm" style={{ color: '#6C767F' }}>Montant TTC</span>
                  <p className="font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(selectedCreditNote.total_ttc)}</p>
                </div>
              </div>

              {/* Reason */}
              <div className="mb-6">
                <span className="text-sm" style={{ color: '#6C767F' }}>Motif</span>
                <p className="font-medium" style={{ color: '#141A1F' }}>{selectedCreditNote.reason}</p>
              </div>

              {/* Original invoice */}
              {selectedCreditNote.original_invoice && (
                <div className="mb-6 p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                  <span className="text-sm" style={{ color: '#6C767F' }}>Facture d'origine</span>
                  <p className="font-medium" style={{ color: '#141A1F' }}>
                    {selectedCreditNote.original_invoice.number} - {formatCurrency(selectedCreditNote.original_invoice.total_ttc)}
                  </p>
                </div>
              )}

              {/* Lines */}
              {selectedCreditNote.lines && selectedCreditNote.lines.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2" style={{ color: '#141A1F' }}>Lignes</h3>
                  <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: '#F9FAFB' }}>
                          <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Description</th>
                          <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>Qte</th>
                          <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>P.U. HT</th>
                          <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>TVA</th>
                          <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>Total TTC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCreditNote.lines.map((line) => (
                          <tr key={line.id} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                            <td className="p-2" style={{ color: '#141A1F' }}>{line.description}</td>
                            <td className="p-2 text-right" style={{ color: '#141A1F' }}>{line.quantity}</td>
                            <td className="p-2 text-right" style={{ color: '#141A1F' }}>{formatCurrency(line.unit_price)}</td>
                            <td className="p-2 text-right" style={{ color: '#6C767F' }}>{line.vat_rate}%</td>
                            <td className="p-2 text-right font-medium" style={{ color: '#141A1F' }}>{formatCurrency(line.total_ttc)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Applications */}
              {selectedCreditNote.applications && selectedCreditNote.applications.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2" style={{ color: '#141A1F' }}>Imputations</h3>
                  <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: '#F9FAFB' }}>
                          <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Facture</th>
                          <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Date</th>
                          <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCreditNote.applications.map((app) => (
                          <tr key={app.id} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                            <td className="p-2" style={{ color: '#141A1F' }}>{app.invoice?.number || app.invoice_id}</td>
                            <td className="p-2" style={{ color: '#6C767F' }}>{formatDate(app.applied_at)}</td>
                            <td className="p-2 text-right font-medium" style={{ color: '#141A1F' }}>{formatCurrency(app.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
                {selectedCreditNote.status === 'draft' && (
                  <button
                    onClick={() => handleValidate(selectedCreditNote.id)}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: '#57534e' }}
                  >
                    {isSubmitting ? 'Validation...' : 'Valider l\'avoir'}
                  </button>
                )}
                {selectedCreditNote.status === 'validated' && (
                  <>
                    <button
                      onClick={() => {
                        setIsViewModalOpen(false)
                        openApplyModal(selectedCreditNote)
                      }}
                      className="px-4 py-2 border rounded-lg text-sm font-medium"
                      style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                    >
                      Imputer sur facture
                    </button>
                    <button
                      onClick={() => {
                        setIsViewModalOpen(false)
                        openRefundModal(selectedCreditNote)
                      }}
                      className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                      style={{ backgroundColor: '#57534e' }}
                    >
                      Rembourser
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium"
                  style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {isApplyModalOpen && selectedCreditNote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
              Imputer l'avoir sur une facture
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Facture a crediter
              </label>
              <select
                value={selectedInvoiceId}
                onChange={(e) => setSelectedInvoiceId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              >
                <option value="">Selectionner une facture...</option>
                {customerInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} - {formatCurrency(inv.total_ttc)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Montant a imputer
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={selectedCreditNote.total_ttc}
                value={applyAmount}
                onChange={(e) => setApplyAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              />
              <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
                Maximum: {formatCurrency(selectedCreditNote.total_ttc)}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleApply}
                disabled={isSubmitting || !selectedInvoiceId || applyAmount <= 0}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: '#57534e' }}
              >
                {isSubmitting ? 'Imputation...' : 'Imputer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {isRefundModalOpen && selectedCreditNote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
              Rembourser l'avoir
            </h3>

            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
              <p className="text-sm" style={{ color: '#6C767F' }}>Montant a rembourser</p>
              <p className="text-xl font-semibold" style={{ color: '#141A1F' }}>
                {formatCurrency(selectedCreditNote.total_ttc)}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Compte bancaire
              </label>
              <select
                value={selectedBankAccountId}
                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              >
                <option value="">Selectionner un compte...</option>
                {bankAccounts.map((acc: BankAccount) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} - {acc.iban || acc.account_number}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsRefundModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleRefund}
                disabled={isSubmitting || !selectedBankAccountId}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: '#57534e' }}
              >
                {isSubmitting ? 'Remboursement...' : 'Rembourser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Supprimer l'avoir ?</h3>
                <p className="text-sm" style={{ color: '#6C767F' }}>Cette action est irreversible.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium bg-red-600 hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
