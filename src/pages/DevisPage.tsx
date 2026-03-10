import { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Plus,
  Search,
  Calendar,
  Send,
  Check,
  X,
  Receipt,
  Trash2,
  MoreVertical,
  ChevronDown,
  Download,
  Edit2,
  Eye,
  AlertCircle,
} from 'lucide-react'
import {
  listDevis,
  createDevis,
  updateDevis,
  deleteDevis,
  sendDevis,
  acceptDevis,
  rejectDevis,
  convertToInvoice,
  generateDevisNumber,
} from '../services/devisService'
import { listProducts } from '../services/produitsService'
import { useCustomers } from '../hooks/useSupabase'
import ThirdPartyPicker from '../components/ThirdPartyPicker'
import type { Devis, DevisStatus, DevisFormData, DevisLineFormData, Product, ThirdParty } from '../types/commercial'

// Format date for display
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

// Check if devis validity has expired
const isExpired = (devis: Devis): boolean => {
  if (devis.status !== 'draft' && devis.status !== 'sent') return false
  if (!devis.validity_date) return false
  const today = new Date().toISOString().split('T')[0]
  return devis.validity_date < today
}

// Get status badge configuration
const getStatusBadge = (devis: Devis) => {
  if (isExpired(devis)) {
    return { bg: '#FEF3C7', text: '#92400E', label: 'Expire' }
  }
  switch (devis.status) {
    case 'draft':
      return { bg: '#F3F4F6', text: '#374151', label: 'Brouillon' }
    case 'sent':
      return { bg: '#DBEAFE', text: '#1E40AF', label: 'Envoye' }
    case 'accepted':
      return { bg: '#D6D9DB', text: '#374151', label: 'Accepte' }
    case 'refused':
      return { bg: '#FEE2E2', text: '#991B1B', label: 'Refuse' }
    case 'invoiced':
      return { bg: '#D1D5DB', text: '#1F2937', label: 'Facture' }
    default:
      return { bg: '#F3F4F6', text: '#374151', label: devis.status }
  }
}

// VAT rates
const VAT_RATES = [
  { value: '20', label: '20%' },
  { value: '10', label: '10%' },
  { value: '5.5', label: '5,5%' },
  { value: '0', label: '0% (Exonere)' },
]

// Unit options
const UNIT_OPTIONS = [
  { value: 'unite', label: 'Unite' },
  { value: 'heure', label: 'Heure' },
  { value: 'jour', label: 'Jour' },
  { value: 'mois', label: 'Mois' },
  { value: 'forfait', label: 'Forfait' },
  { value: 'kg', label: 'Kilogramme' },
  { value: 'm', label: 'Metre' },
  { value: 'm2', label: 'Metre carre' },
]

// Initial line data
const initialLine: DevisLineFormData = {
  description: '',
  quantity: 1,
  unit: 'unite',
  unitPriceHT: 0,
  vatRate: '20',
}

// Initial form data
const getInitialFormData = (): DevisFormData => ({
  customerId: null,
  customerName: '',
  date: new Date().toISOString().split('T')[0],
  validityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  reference: '',
  notes: '',
  terms: '',
  paymentTerms: 'Paiement a 30 jours',
  discountPercent: 0,
  lines: [{ ...initialLine }],
})

interface DevisPageProps {
  onNavigate?: (page: string) => void
}

export default function DevisPage({ onNavigate }: DevisPageProps) {
  // State
  const [devisList, setDevisList] = useState<Devis[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [perPage, setPerPage] = useState(50)

  // Filters
  const [statusFilter, setStatusFilter] = useState<DevisStatus | 'all' | 'expired'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortField, setSortField] = useState<'date' | 'total_ttc'>('date')
  const [sortAsc, setSortAsc] = useState(false)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<DevisFormData>(getInitialFormData())
  const [selectedDevis, setSelectedDevis] = useState<Devis | null>(null)
  const [isViewMode, setIsViewMode] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [generatedNumber, setGeneratedNumber] = useState('')
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  // Hooks
  const { customers } = useCustomers()

  // Fetch devis and products
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [devisData, productsData] = await Promise.all([
        listDevis({
          status: statusFilter !== 'all' && statusFilter !== 'expired' ? statusFilter : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          searchTerm: searchTerm || undefined,
        }),
        listProducts({ isActive: true }),
      ])
      setDevisList(devisData)
      setProducts(productsData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [statusFilter, startDate, endDate, searchTerm])

  // Filter and sort devis
  const filteredDevis = useMemo(() => {
    let result = [...devisList]

    // Filter expired
    if (statusFilter === 'expired') {
      result = result.filter(d => isExpired(d))
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
  }, [devisList, statusFilter, sortField, sortAsc, perPage])

  // Toggle sort
  const toggleSort = (field: 'date' | 'total_ttc') => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  // Calculate line total
  const calculateLineTotal = (line: DevisLineFormData) => {
    const baseTotal = line.quantity * line.unitPriceHT
    const discountAmount = line.discountPercent ? (baseTotal * line.discountPercent) / 100 : 0
    const totalHT = baseTotal - discountAmount
    const vatRate = parseFloat(line.vatRate) || 0
    const totalVAT = (totalHT * vatRate) / 100
    const totalTTC = totalHT + totalVAT
    return { totalHT, totalVAT, totalTTC }
  }

  // Calculate form totals
  const formTotals = useMemo(() => {
    let totalHT = 0
    let totalVAT = 0
    let totalTTC = 0

    formData.lines.forEach(line => {
      const lineTotals = calculateLineTotal(line)
      totalHT += lineTotals.totalHT
      totalVAT += lineTotals.totalVAT
      totalTTC += lineTotals.totalTTC
    })

    // Apply global discount
    if (formData.discountPercent && formData.discountPercent > 0) {
      const discountAmount = (totalHT * formData.discountPercent) / 100
      totalHT -= discountAmount
      totalVAT = (totalHT * 0.2) // Simplified recalculation
      totalTTC = totalHT + totalVAT
    }

    return { totalHT, totalVAT, totalTTC }
  }, [formData.lines, formData.discountPercent])

  // Update form
  const updateForm = (updates: Partial<DevisFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  // Update line
  const updateLine = (index: number, updates: Partial<DevisLineFormData>) => {
    const newLines = [...formData.lines]
    newLines[index] = { ...newLines[index], ...updates }
    updateForm({ lines: newLines })
  }

  // Add line
  const addLine = () => {
    updateForm({ lines: [...formData.lines, { ...initialLine }] })
  }

  // Remove line
  const removeLine = (index: number) => {
    if (formData.lines.length <= 1) return
    const newLines = formData.lines.filter((_, i) => i !== index)
    updateForm({ lines: newLines })
  }

  // Select product for line
  const selectProductForLine = (index: number, product: Product) => {
    updateLine(index, {
      productId: product.id,
      description: product.name,
      unitPriceHT: product.sale_price_ht,
      vatRate: product.vat_rate,
    })
  }

  // Handle customer selection
  const handleCustomerSelect = (name: string, id: string | null, _thirdParty?: ThirdParty) => {
    updateForm({
      customerName: name,
      customerId: id,
    })
  }

  // Navigate to create quote page
  const openCreateModal = () => {
    if (onNavigate) {
      onNavigate('creer-devis')
    }
  }

  // Open view modal
  const openViewModal = (devis: Devis) => {
    setSelectedDevis(devis)
    setIsViewMode(true)
    setFormData({
      customerId: devis.customer_id,
      customerName: devis.customer?.name || '',
      date: devis.date,
      validityDate: devis.validity_date,
      reference: devis.reference || '',
      notes: devis.notes || '',
      terms: devis.terms || '',
      paymentTerms: devis.payment_terms || '',
      discountPercent: devis.discount_percent || 0,
      lines: devis.lines?.map(line => ({
        productId: line.product_id,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPriceHT: line.unit_price_ht,
        vatRate: line.vat_rate,
        discountPercent: line.discount_percent,
      })) || [{ ...initialLine }],
    })
    setIsModalOpen(true)
  }

  // Open edit modal
  const openEditModal = (devis: Devis) => {
    if (devis.status !== 'draft') {
      setError('Seuls les devis en brouillon peuvent etre modifies')
      return
    }
    setSelectedDevis(devis)
    setIsViewMode(false)
    setGeneratedNumber(devis.number)
    setFormData({
      customerId: devis.customer_id,
      customerName: devis.customer?.name || '',
      date: devis.date,
      validityDate: devis.validity_date,
      reference: devis.reference || '',
      notes: devis.notes || '',
      terms: devis.terms || '',
      paymentTerms: devis.payment_terms || '',
      discountPercent: devis.discount_percent || 0,
      lines: devis.lines?.map(line => ({
        productId: line.product_id,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPriceHT: line.unit_price_ht,
        vatRate: line.vat_rate,
        discountPercent: line.discount_percent,
      })) || [{ ...initialLine }],
    })
    setIsModalOpen(true)
  }

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.customerId && !formData.customerName) {
      setError('Veuillez selectionner un client')
      return
    }
    if (formData.lines.length === 0 || formData.lines.every(l => !l.description)) {
      setError('Veuillez ajouter au moins une ligne')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (selectedDevis) {
        // Update existing devis
        await updateDevis(selectedDevis.id, formData)
        setSuccessMessage('Devis mis a jour avec succes')
      } else {
        // Create new devis
        await createDevis(formData)
        setSuccessMessage('Devis cree avec succes')
      }
      setIsModalOpen(false)
      await fetchData()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde'
      setError(errorMessage)
      console.error('Error saving devis:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle send devis
  const handleSend = async (devisId: string) => {
    try {
      await sendDevis(devisId)
      setSuccessMessage('Devis marque comme envoye')
      await fetchData()
      setActiveDropdown(null)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'envoi'
      setError(errorMessage)
    }
  }

  // Handle accept devis
  const handleAccept = async (devisId: string) => {
    try {
      await acceptDevis(devisId)
      setSuccessMessage('Devis accepte')
      await fetchData()
      setActiveDropdown(null)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'acceptation'
      setError(errorMessage)
    }
  }

  // Handle reject devis
  const handleReject = async () => {
    if (!showRejectModal) return
    try {
      await rejectDevis(showRejectModal, rejectReason)
      setSuccessMessage('Devis refuse')
      setShowRejectModal(null)
      setRejectReason('')
      await fetchData()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du refus'
      setError(errorMessage)
    }
  }

  // Handle convert to invoice
  const handleConvertToInvoice = async (devisId: string) => {
    try {
      const invoice = await convertToInvoice(devisId)
      setSuccessMessage(`Facture ${invoice.number} creee avec succes`)
      await fetchData()
      setActiveDropdown(null)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la conversion'
      setError(errorMessage)
    }
  }

  // Handle delete devis
  const handleDelete = async (devisId: string) => {
    try {
      await deleteDevis(devisId)
      setSuccessMessage('Devis supprime')
      setShowDeleteConfirm(null)
      await fetchData()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la suppression'
      setError(errorMessage)
    }
  }

  // Export PDF (placeholder)
  const handleExportPDF = (devis: Devis) => {
    console.log('Export PDF for devis:', devis.number)
    setSuccessMessage(`Export PDF du devis ${devis.number} en cours...`)
    setActiveDropdown(null)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Loading state
  if (loading && devisList.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p style={{ color: '#6C767F' }}>Chargement des devis...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6" style={{ color: '#006666' }} />
          <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>Devis clients</h1>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm"
          style={{ backgroundColor: '#006666' }}
        >
          <Plus className="w-4 h-4" />
          Nouveau devis
        </button>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="mb-4 p-4 rounded-lg border" style={{ backgroundColor: '#F5F5F4', borderColor: '#D6D3D1' }}>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5" style={{ color: '#57534e' }} />
            <span className="text-sm" style={{ color: '#57534e' }}>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="ml-auto" style={{ color: '#78716c' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-4 rounded-lg border" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-800">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#6C767F' }} />
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
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: '#6C767F' }} />
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
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: 'all', label: 'Tous' },
            { value: 'draft', label: 'Brouillon' },
            { value: 'sent', label: 'Envoyes' },
            { value: 'accepted', label: 'Acceptes' },
            { value: 'refused', label: 'Refuses' },
            { value: 'invoiced', label: 'Factures' },
            { value: 'expired', label: 'Expires' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value as DevisStatus | 'all' | 'expired')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                statusFilter === filter.value ? 'text-white' : 'border bg-white'
              }`}
              style={{
                backgroundColor: statusFilter === filter.value ? '#006666' : undefined,
                borderColor: statusFilter === filter.value ? undefined : '#D6D9DB',
                color: statusFilter === filter.value ? 'white' : '#141A1F',
              }}
            >
              {filter.label}
            </button>
          ))}

          <div className="flex-1" />

          <span className="text-sm" style={{ color: '#6C767F' }}>
            {devisList.length} devis
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Numero</th>
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Client</th>
              <th
                className="text-left p-3 text-sm font-medium cursor-pointer hover:bg-gray-50"
                style={{ color: '#6C767F' }}
                onClick={() => toggleSort('date')}
              >
                <div className="flex items-center gap-1">
                  Date
                  <ChevronDown className="w-3 h-3" />
                </div>
              </th>
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Validite</th>
              <th
                className="text-right p-3 text-sm font-medium cursor-pointer hover:bg-gray-50"
                style={{ color: '#6C767F' }}
                onClick={() => toggleSort('total_ttc')}
              >
                <div className="flex items-center justify-end gap-1">
                  Montant TTC
                  <ChevronDown className="w-3 h-3" />
                </div>
              </th>
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Statut</th>
              <th className="w-20 p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredDevis.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-2" style={{ color: '#D6D9DB' }} />
                  <p style={{ color: '#6C767F' }}>Aucun devis trouve</p>
                </td>
              </tr>
            ) : (
              filteredDevis.map((devis) => {
                const badge = getStatusBadge(devis)
                const customerName = devis.customer?.name || 'Client inconnu'

                return (
                  <tr
                    key={devis.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    style={{ borderColor: '#F2F2F3' }}
                    onClick={() => openViewModal(devis)}
                  >
                    <td className="p-3 text-sm font-medium" style={{ color: '#141A1F' }}>{devis.number}</td>
                    <td className="p-3 text-sm" style={{ color: '#141A1F' }}>{customerName}</td>
                    <td className="p-3 text-sm" style={{ color: '#141A1F' }}>{formatDate(devis.date)}</td>
                    <td className="p-3 text-sm" style={{ color: isExpired(devis) ? '#92400E' : '#141A1F' }}>
                      {formatDate(devis.validity_date)}
                    </td>
                    <td className="p-3 text-sm text-right font-medium" style={{ color: '#141A1F' }}>
                      {formatCurrency(devis.total_ttc)}
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
                      <div className="relative">
                        <button
                          className="p-1 rounded hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveDropdown(activeDropdown === devis.id ? null : devis.id)
                          }}
                        >
                          <MoreVertical className="w-5 h-5" style={{ color: '#6C767F' }} />
                        </button>

                        {/* Dropdown menu */}
                        {activeDropdown === devis.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-10"
                            style={{ borderColor: '#E4E5E7' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => openViewModal(devis)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              style={{ color: '#141A1F' }}
                            >
                              <Eye className="w-4 h-4" />
                              Voir details
                            </button>

                            {devis.status === 'draft' && (
                              <>
                                <button
                                  onClick={() => {
                                    setActiveDropdown(null)
                                    openEditModal(devis)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  style={{ color: '#141A1F' }}
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Modifier
                                </button>
                                <button
                                  onClick={() => handleSend(devis.id)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  style={{ color: '#141A1F' }}
                                >
                                  <Send className="w-4 h-4" />
                                  Marquer envoye
                                </button>
                              </>
                            )}

                            {devis.status === 'sent' && (
                              <>
                                <button
                                  onClick={() => handleAccept(devis.id)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  style={{ color: '#141A1F' }}
                                >
                                  <Check className="w-4 h-4" />
                                  Marquer accepte
                                </button>
                                <button
                                  onClick={() => {
                                    setShowRejectModal(devis.id)
                                    setActiveDropdown(null)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  style={{ color: '#141A1F' }}
                                >
                                  <X className="w-4 h-4" />
                                  Marquer refuse
                                </button>
                              </>
                            )}

                            {devis.status === 'accepted' && (
                              <button
                                onClick={() => handleConvertToInvoice(devis.id)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                style={{ color: '#006666' }}
                              >
                                <Receipt className="w-4 h-4" />
                                Convertir en facture
                              </button>
                            )}

                            <button
                              onClick={() => handleExportPDF(devis)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              style={{ color: '#141A1F' }}
                            >
                              <Download className="w-4 h-4" />
                              Exporter PDF
                            </button>

                            {devis.status !== 'invoiced' && (
                              <>
                                <div className="border-t my-1" style={{ borderColor: '#E4E5E7' }}></div>
                                <button
                                  onClick={() => {
                                    setShowDeleteConfirm(devis.id)
                                    setActiveDropdown(null)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Supprimer
                                </button>
                              </>
                            )}
                          </div>
                        )}
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
                backgroundColor: perPage === num ? '#006666' : 'transparent',
                color: perPage === num ? 'white' : '#6C767F'
              }}
            >
              {num}
            </button>
          ))}
          <span className="text-sm ml-2" style={{ color: '#6C767F' }}>elements par page</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: '#6C767F' }}>
            1-{Math.min(perPage, devisList.length)} sur {devisList.length}
          </span>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                {isViewMode
                  ? `Devis ${selectedDevis?.number}`
                  : selectedDevis
                    ? `Modifier ${selectedDevis.number}`
                    : `Nouveau devis - ${generatedNumber}`
                }
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-5 h-5" style={{ color: '#6C767F' }} />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              <form onSubmit={handleSubmit}>
                {/* Header info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Customer */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Client *</label>
                    <ThirdPartyPicker
                      thirdParties={customers}
                      value={formData.customerName}
                      selectedId={formData.customerId}
                      type="customer"
                      onChange={handleCustomerSelect}
                      placeholder="Rechercher un client..."
                      disabled={isViewMode}
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date du devis *</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => updateForm({ date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                      disabled={isViewMode}
                      required
                    />
                  </div>

                  {/* Validity date */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date de validite *</label>
                    <input
                      type="date"
                      value={formData.validityDate}
                      onChange={(e) => updateForm({ validityDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                      disabled={isViewMode}
                      required
                    />
                  </div>

                  {/* Reference */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Reference client</label>
                    <input
                      type="text"
                      value={formData.reference}
                      onChange={(e) => updateForm({ reference: e.target.value })}
                      placeholder="Ref. commande..."
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                      disabled={isViewMode}
                    />
                  </div>

                  {/* Payment terms */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Conditions de paiement</label>
                    <input
                      type="text"
                      value={formData.paymentTerms}
                      onChange={(e) => updateForm({ paymentTerms: e.target.value })}
                      placeholder="Ex: Paiement a 30 jours"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                      disabled={isViewMode}
                    />
                  </div>
                </div>

                {/* Lines */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium" style={{ color: '#141A1F' }}>Lignes du devis</label>
                    {!isViewMode && (
                      <button
                        type="button"
                        onClick={addLine}
                        className="flex items-center gap-1 text-sm font-medium"
                        style={{ color: '#006666' }}
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter une ligne
                      </button>
                    )}
                  </div>

                  <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: '#F9FAFB' }}>
                          <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Description</th>
                          <th className="text-center p-2 font-medium w-20" style={{ color: '#6C767F' }}>Qte</th>
                          <th className="text-center p-2 font-medium w-24" style={{ color: '#6C767F' }}>Unite</th>
                          <th className="text-right p-2 font-medium w-28" style={{ color: '#6C767F' }}>Prix HT</th>
                          <th className="text-center p-2 font-medium w-20" style={{ color: '#6C767F' }}>TVA</th>
                          <th className="text-right p-2 font-medium w-28" style={{ color: '#6C767F' }}>Total HT</th>
                          {!isViewMode && <th className="w-10 p-2"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {formData.lines.map((line, index) => {
                          const lineTotals = calculateLineTotal(line)
                          return (
                            <tr key={index} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                              <td className="p-2">
                                {isViewMode ? (
                                  <span style={{ color: '#141A1F' }}>{line.description}</span>
                                ) : (
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={line.description}
                                      onChange={(e) => updateLine(index, { description: e.target.value })}
                                      placeholder="Description ou produit..."
                                      className="w-full px-2 py-1 border rounded text-sm"
                                      style={{ borderColor: '#D6D9DB' }}
                                      list={`products-${index}`}
                                    />
                                    <datalist id={`products-${index}`}>
                                      {products.map(p => (
                                        <option key={p.id} value={p.name} onClick={() => selectProductForLine(index, p)} />
                                      ))}
                                    </datalist>
                                  </div>
                                )}
                              </td>
                              <td className="p-2">
                                {isViewMode ? (
                                  <span className="text-center block" style={{ color: '#141A1F' }}>{line.quantity}</span>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={line.quantity}
                                    onChange={(e) => updateLine(index, { quantity: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-2 py-1 border rounded text-sm text-center"
                                    style={{ borderColor: '#D6D9DB' }}
                                  />
                                )}
                              </td>
                              <td className="p-2">
                                {isViewMode ? (
                                  <span className="text-center block" style={{ color: '#141A1F' }}>{line.unit}</span>
                                ) : (
                                  <select
                                    value={line.unit}
                                    onChange={(e) => updateLine(index, { unit: e.target.value })}
                                    className="w-full px-2 py-1 border rounded text-sm"
                                    style={{ borderColor: '#D6D9DB' }}
                                  >
                                    {UNIT_OPTIONS.map(u => (
                                      <option key={u.value} value={u.value}>{u.label}</option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td className="p-2">
                                {isViewMode ? (
                                  <span className="text-right block" style={{ color: '#141A1F' }}>{formatCurrency(line.unitPriceHT)}</span>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={line.unitPriceHT}
                                    onChange={(e) => updateLine(index, { unitPriceHT: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-2 py-1 border rounded text-sm text-right"
                                    style={{ borderColor: '#D6D9DB' }}
                                  />
                                )}
                              </td>
                              <td className="p-2">
                                {isViewMode ? (
                                  <span className="text-center block" style={{ color: '#141A1F' }}>{line.vatRate}%</span>
                                ) : (
                                  <select
                                    value={line.vatRate}
                                    onChange={(e) => updateLine(index, { vatRate: e.target.value })}
                                    className="w-full px-2 py-1 border rounded text-sm"
                                    style={{ borderColor: '#D6D9DB' }}
                                  >
                                    {VAT_RATES.map(r => (
                                      <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td className="p-2 text-right font-medium" style={{ color: '#141A1F' }}>
                                {formatCurrency(lineTotals.totalHT)}
                              </td>
                              {!isViewMode && (
                                <td className="p-2">
                                  <button
                                    type="button"
                                    onClick={() => removeLine(index)}
                                    disabled={formData.lines.length <= 1}
                                    className="p-1 rounded hover:bg-red-50 disabled:opacity-30"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => updateForm({ notes: e.target.value })}
                      placeholder="Notes internes ou pour le client..."
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                      style={{ borderColor: '#D6D9DB' }}
                      disabled={isViewMode}
                    />
                  </div>

                  {/* Calculated totals */}
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm" style={{ color: '#6C767F' }}>Total HT</span>
                      <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{formatCurrency(formTotals.totalHT)}</span>
                    </div>
                    {!isViewMode && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm" style={{ color: '#6C767F' }}>Remise globale (%)</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={formData.discountPercent || ''}
                          onChange={(e) => updateForm({ discountPercent: parseFloat(e.target.value) || 0 })}
                          className="w-20 px-2 py-1 border rounded text-sm text-right"
                          style={{ borderColor: '#D6D9DB' }}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm" style={{ color: '#6C767F' }}>TVA</span>
                      <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{formatCurrency(formTotals.totalVAT)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: '#E4E5E7' }}>
                      <span className="text-base font-semibold" style={{ color: '#141A1F' }}>Total TTC</span>
                      <span className="text-lg font-bold" style={{ color: '#006666' }}>{formatCurrency(formTotals.totalTTC)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {!isViewMode && (
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
                      disabled={isSubmitting || !formData.customerName || formData.lines.every(l => !l.description)}
                      className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                      style={{ backgroundColor: '#006666' }}
                    >
                      {isSubmitting ? 'Enregistrement...' : selectedDevis ? 'Mettre a jour' : 'Creer le devis'}
                    </button>
                  </div>
                )}

                {/* View mode actions */}
                {isViewMode && selectedDevis && (
                  <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
                    {selectedDevis.status === 'draft' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsModalOpen(false)
                            openEditModal(selectedDevis)
                          }}
                          className="px-4 py-2 border rounded-lg text-sm font-medium"
                          style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                        >
                          <Edit2 className="w-4 h-4 inline mr-1" />
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSend(selectedDevis.id)
                            setIsModalOpen(false)
                          }}
                          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                          style={{ backgroundColor: '#006666' }}
                        >
                          <Send className="w-4 h-4 inline mr-1" />
                          Envoyer
                        </button>
                      </>
                    )}
                    {selectedDevis.status === 'sent' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setShowRejectModal(selectedDevis.id)
                            setIsModalOpen(false)
                          }}
                          className="px-4 py-2 border rounded-lg text-sm font-medium text-red-600"
                          style={{ borderColor: '#FCA5A5' }}
                        >
                          Refuser
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleAccept(selectedDevis.id)
                            setIsModalOpen(false)
                          }}
                          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                          style={{ backgroundColor: '#006666' }}
                        >
                          Accepter
                        </button>
                      </>
                    )}
                    {selectedDevis.status === 'accepted' && (
                      <button
                        type="button"
                        onClick={() => {
                          handleConvertToInvoice(selectedDevis.id)
                          setIsModalOpen(false)
                        }}
                        className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                        style={{ backgroundColor: '#006666' }}
                      >
                        <Receipt className="w-4 h-4 inline mr-1" />
                        Convertir en facture
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
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Supprimer le devis ?</h3>
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

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                <X className="w-5 h-5" style={{ color: '#92400E' }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Refuser le devis ?</h3>
                <p className="text-sm" style={{ color: '#6C767F' }}>Vous pouvez ajouter un motif de refus.</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Motif de refus (optionnel)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: Prix trop eleve, delais non convenables..."
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(null)
                  setRejectReason('')
                }}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#92400E' }}
              >
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
