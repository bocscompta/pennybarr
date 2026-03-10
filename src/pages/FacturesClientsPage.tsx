import { useState, useEffect, useMemo } from 'react'
import {
  createCustomerInvoice,
  getCustomerInvoices,
  updateCustomerInvoiceStatus,
  previewSalesEntries,
  deleteCustomerInvoice,
  type CustomerInvoiceFormData,
  type InvoiceFilters,
  type InvoiceStatus,
  type PreviewSalesEntry
} from '../services/venteService'
// Credit note integration available via menu "Creer un avoir"
import { useCustomers, useChartOfAccounts } from '../hooks/useSupabase'
import ThirdPartyPicker from '../components/ThirdPartyPicker'
import AccountPicker from '../components/AccountPicker'
import type { Invoice, ThirdParty } from '../types/database'

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

// Check if invoice is overdue
const isOverdue = (invoice: Invoice): boolean => {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') return false
  if (!invoice.due_date) return false
  const today = new Date().toISOString().split('T')[0]
  return invoice.due_date < today
}

// Get status badge style
const getStatusBadge = (invoice: Invoice) => {
  if (isOverdue(invoice)) {
    return { bg: '#FEF3C7', text: '#92400E', label: 'En retard' }
  }
  switch (invoice.status) {
    case 'draft':
      return { bg: '#F3F4F6', text: '#374151', label: 'Brouillon' }
    case 'sent':
      return { bg: '#DBEAFE', text: '#1E40AF', label: 'Envoyee' }
    case 'paid':
      return { bg: '#D6D9DB', text: '#374151', label: 'Payee' }
    case 'cancelled':
      return { bg: '#FEE2E2', text: '#991B1B', label: 'Annulee' }
    default:
      return { bg: '#F3F4F6', text: '#374151', label: invoice.status }
  }
}

// VAT rates
const VAT_RATES = [
  { value: '20', label: '20%' },
  { value: '10', label: '10%' },
  { value: '5.5', label: '5,5%' },
  { value: '0', label: '0% (Exonere)' },
]

// Initial form state
const initialFormData: CustomerInvoiceFormData = {
  customerId: null,
  customerName: '',
  invoiceNumber: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  accountingCode: '706000',
  entryLabel: '',
  totalTTC: 0,
  totalHT: 0,
  totalVAT: 0,
  vatRate: '20',
  currency: 'EUR',
}

interface FacturesClientsPageProps {
  onNavigate?: (page: string) => void
}

export default function FacturesClientsPage({ onNavigate }: FacturesClientsPageProps) {
  // State
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [perPage, setPerPage] = useState(50)

  // Filters
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all' | 'overdue'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortField, setSortField] = useState<'date' | 'total_ttc'>('date')
  const [sortAsc, setSortAsc] = useState(false)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<CustomerInvoiceFormData>(initialFormData)
  const [previewEntries, setPreviewEntries] = useState<PreviewSalesEntry[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  // Hooks
  const { customers } = useCustomers()
  const { accounts } = useChartOfAccounts()

  // Fetch invoices
  const fetchInvoices = async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: InvoiceFilters = {}
      if (statusFilter !== 'all' && statusFilter !== 'overdue') {
        filters.status = statusFilter
      }
      if (startDate) filters.startDate = startDate
      if (endDate) filters.endDate = endDate
      if (searchTerm) filters.searchTerm = searchTerm

      const data = await getCustomerInvoices(filters)
      setInvoices(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
      console.error('Error fetching invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter, startDate, endDate, searchTerm])

  // Filter and sort invoices
  const filteredInvoices = useMemo(() => {
    let result = [...invoices]

    // Filter overdue
    if (statusFilter === 'overdue') {
      result = result.filter(inv => isOverdue(inv))
    }

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
  }, [invoices, statusFilter, sortField, sortAsc, perPage])

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
    if (selectedRows.length === filteredInvoices.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(filteredInvoices.map(f => f.id))
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

  // Calculate amounts from TTC
  const calculateAmounts = (ttc: number, vatRate: string) => {
    const rate = parseFloat(vatRate) / 100
    const ht = ttc / (1 + rate)
    const vat = ttc - ht
    return { ht: Math.round(ht * 100) / 100, vat: Math.round(vat * 100) / 100 }
  }

  // Update form and preview
  const updateForm = (updates: Partial<CustomerInvoiceFormData>) => {
    const newData = { ...formData, ...updates }

    // Recalculate amounts if TTC or VAT rate changes
    if ('totalTTC' in updates || 'vatRate' in updates) {
      const { ht, vat } = calculateAmounts(newData.totalTTC, newData.vatRate)
      newData.totalHT = ht
      newData.totalVAT = vat
    }

    // Generate default due date (30 days) if not set
    if ('invoiceDate' in updates && !newData.dueDate) {
      const dueDate = new Date(updates.invoiceDate as string)
      dueDate.setDate(dueDate.getDate() + 30)
      newData.dueDate = dueDate.toISOString().split('T')[0]
    }

    setFormData(newData)

    // Update preview entries
    if (newData.customerName && newData.totalTTC > 0) {
      previewSalesEntries(newData, newData.customerId || undefined)
        .then(entries => setPreviewEntries(entries))
        .catch(err => {
          console.error('Error previewing sales entries:', err)
          setPreviewEntries([])
        })
    } else {
      setPreviewEntries([])
    }
  }

  // Handle customer selection
  const handleCustomerSelect = (name: string, id: string | null, _thirdParty?: ThirdParty) => {
    updateForm({
      customerName: name,
      customerId: id,
    })
  }

  // Handle account selection
  const handleAccountSelect = (code: string) => {
    updateForm({ accountingCode: code })
  }

  // Generate invoice number
  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear()
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `FC${year}${random}`
  }

  // Open create modal
  const openCreateModal = () => {
    setFormData({
      ...initialFormData,
      invoiceNumber: generateInvoiceNumber(),
      invoiceDate: new Date().toISOString().split('T')[0],
    })
    setPreviewEntries([])
    setSelectedInvoice(null)
    setIsModalOpen(true)
  }

  // Open view modal
  const openViewModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setFormData({
      customerId: invoice.third_party_id || null,
      customerName: invoice.third_party?.name || '',
      invoiceNumber: invoice.number,
      invoiceDate: invoice.date,
      dueDate: invoice.due_date || '',
      accountingCode: '706000',
      entryLabel: '',
      totalTTC: invoice.total_ttc,
      totalHT: invoice.total_ht,
      totalVAT: invoice.total_vat,
      vatRate: invoice.total_ht > 0 ? String(Math.round(invoice.total_vat / invoice.total_ht * 100)) : '20',
      currency: invoice.currency,
    })
    setIsModalOpen(true)
  }

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.customerName) {
      setError('Veuillez selectionner un client')
      return
    }
    if (!formData.invoiceNumber) {
      setError('Veuillez saisir un numero de facture')
      return
    }
    if (formData.totalTTC <= 0) {
      setError('Le montant TTC doit etre superieur a 0')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await createCustomerInvoice(formData)
      setIsModalOpen(false)
      await fetchInvoices()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la creation'
      setError(errorMessage)
      console.error('Error creating invoice:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update status
  const handleStatusUpdate = async (invoiceId: string, status: InvoiceStatus) => {
    try {
      await updateCustomerInvoiceStatus(invoiceId, status)
      await fetchInvoices()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la mise a jour'
      setError(errorMessage)
      console.error('Error updating status:', err)
    }
  }

  // Delete invoice
  const handleDelete = async (invoiceId: string) => {
    try {
      await deleteCustomerInvoice(invoiceId)
      setShowDeleteConfirm(null)
      await fetchInvoices()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la suppression'
      setError(errorMessage)
      console.error('Error deleting invoice:', err)
    }
  }

  // Loading state
  if (loading && invoices.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p style={{ color: '#6C767F' }}>Chargement des factures clients...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>Factures clients</h1>
          <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#57534e' }}></span>
            Exercice 2024-2025
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <button
          onClick={() => onNavigate?.('creer-facture')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm"
          style={{ backgroundColor: '#57534e' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle facture
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
              placeholder="Numero/Client..."
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
            { value: 'all', label: 'Toutes' },
            { value: 'draft', label: 'Brouillon' },
            { value: 'sent', label: 'Envoyees' },
            { value: 'paid', label: 'Payees' },
            { value: 'overdue', label: 'En retard' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value as InvoiceStatus | 'all' | 'overdue')}
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
            {invoices.length} facture{invoices.length > 1 ? 's' : ''}
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
                  checked={filteredInvoices.length > 0 && selectedRows.length === filteredInvoices.length}
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
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Echeance</th>
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
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center">
                  <p style={{ color: '#6C767F' }}>Aucune facture client trouvee</p>
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => {
                const badge = getStatusBadge(invoice)
                const customerName = invoice.third_party?.name || customerMap.get(invoice.third_party_id || '') || 'Client inconnu'

                return (
                  <tr
                    key={invoice.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    style={{ borderColor: '#F2F2F3' }}
                    onClick={() => openViewModal(invoice)}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedRows.includes(invoice.id)}
                        onChange={() => toggleRow(invoice.id)}
                      />
                    </td>
                    <td className="p-3 text-sm font-medium" style={{ color: '#141A1F' }}>{invoice.number}</td>
                    <td className="p-3 text-sm" style={{ color: '#141A1F' }}>{customerName}</td>
                    <td className="p-3 text-sm" style={{ color: '#141A1F' }}>{formatDate(invoice.date)}</td>
                    <td className="p-3 text-sm" style={{ color: isOverdue(invoice) ? '#92400E' : '#141A1F' }}>
                      {invoice.due_date ? formatDate(invoice.due_date) : '-'}
                    </td>
                    <td className="p-3 text-sm text-right font-medium" style={{ color: '#141A1F' }}>
                      {formatCurrency(invoice.total_ttc)}
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
                            onClick={() => openViewModal(invoice)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            style={{ color: '#141A1F' }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Voir details
                          </button>
                          {invoice.status === 'draft' && (
                            <button
                              onClick={() => handleStatusUpdate(invoice.id, 'sent')}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              style={{ color: '#141A1F' }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                              </svg>
                              Marquer envoyee
                            </button>
                          )}
                          {(invoice.status === 'draft' || invoice.status === 'sent') && (
                            <button
                              onClick={() => handleStatusUpdate(invoice.id, 'paid')}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              style={{ color: '#141A1F' }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Marquer payee
                            </button>
                          )}
                          {(invoice.status === 'sent' || invoice.status === 'paid') && (
                            <button
                              onClick={() => {
                                // Navigate to avoirs page with invoice pre-selected
                                window.location.href = `/avoirs-clients?from_invoice=${invoice.id}`
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              style={{ color: '#141A1F' }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                              </svg>
                              Creer un avoir
                            </button>
                          )}
                          {invoice.status === 'draft' && (
                            <>
                              <div className="border-t my-1" style={{ borderColor: '#E4E5E7' }}></div>
                              <button
                                onClick={() => setShowDeleteConfirm(invoice.id)}
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
          <span className="text-sm" style={{ color: '#6C767F' }}>1-{Math.min(perPage, invoices.length)} sur {invoices.length}</span>
        </div>
      </div>

      {/* Create/View Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                {selectedInvoice ? `Facture ${selectedInvoice.number}` : 'Nouvelle facture client'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
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
                      disabled={!!selectedInvoice}
                    />
                  </div>

                  {/* Invoice number */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Numero de facture</label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => updateForm({ invoiceNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                      disabled={!!selectedInvoice}
                    />
                  </div>

                  {/* Invoice date */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date d'emission</label>
                    <input
                      type="date"
                      value={formData.invoiceDate}
                      onChange={(e) => updateForm({ invoiceDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                      disabled={!!selectedInvoice}
                    />
                  </div>

                  {/* Due date */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date d'echeance</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => updateForm({ dueDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                      disabled={!!selectedInvoice}
                    />
                  </div>

                  {/* Product account */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Compte produit</label>
                    <AccountPicker
                      accounts={accounts}
                      value={formData.accountingCode}
                      onChange={handleAccountSelect}
                      filterClass="7"
                      placeholder="Compte 7xxx..."
                      disabled={!!selectedInvoice}
                    />
                  </div>

                  {/* Amount TTC */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Montant TTC</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.totalTTC || ''}
                        onChange={(e) => updateForm({ totalTTC: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-lg text-sm pr-10"
                        style={{ borderColor: '#D6D9DB' }}
                        disabled={!!selectedInvoice}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6C767F' }}>EUR</span>
                    </div>
                  </div>

                  {/* VAT rate */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Taux TVA</label>
                    <select
                      value={formData.vatRate}
                      onChange={(e) => updateForm({ vatRate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                      disabled={!!selectedInvoice}
                    >
                      {VAT_RATES.map((rate) => (
                        <option key={rate.value} value={rate.value}>{rate.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Calculated amounts */}
                  <div className="col-span-2 grid grid-cols-3 gap-4 p-4 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                    <div>
                      <span className="text-sm" style={{ color: '#6C767F' }}>Montant HT</span>
                      <p className="text-lg font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(formData.totalHT)}</p>
                    </div>
                    <div>
                      <span className="text-sm" style={{ color: '#6C767F' }}>TVA</span>
                      <p className="text-lg font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(formData.totalVAT)}</p>
                    </div>
                    <div>
                      <span className="text-sm" style={{ color: '#6C767F' }}>Total TTC</span>
                      <p className="text-lg font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(formData.totalTTC)}</p>
                    </div>
                  </div>
                </div>

                {/* Preview entries */}
                {!selectedInvoice && previewEntries.length > 0 && (
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
                {!selectedInvoice && (
                  <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 border rounded-lg text-sm font-medium"
                      style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !formData.customerName || formData.totalTTC <= 0}
                      className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                      style={{ backgroundColor: '#57534e' }}
                    >
                      {isSubmitting ? 'Creation...' : 'Creer la facture'}
                    </button>
                  </div>
                )}

                {/* View mode actions */}
                {selectedInvoice && (
                  <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
                    {selectedInvoice.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => {
                          handleStatusUpdate(selectedInvoice.id, 'sent')
                          setIsModalOpen(false)
                        }}
                        className="px-4 py-2 border rounded-lg text-sm font-medium"
                        style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                      >
                        Marquer envoyee
                      </button>
                    )}
                    {(selectedInvoice.status === 'draft' || selectedInvoice.status === 'sent') && (
                      <button
                        type="button"
                        onClick={() => {
                          handleStatusUpdate(selectedInvoice.id, 'paid')
                          setIsModalOpen(false)
                        }}
                        className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                        style={{ backgroundColor: '#57534e' }}
                      >
                        Marquer payee
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 border rounded-lg text-sm font-medium"
                      style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                    >
                      Fermer
                    </button>
                  </div>
                )}
              </form>
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
                <h3 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Supprimer la facture ?</h3>
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
