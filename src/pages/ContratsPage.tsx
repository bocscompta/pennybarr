import { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Plus,
  Search,
  Play,
  Pause,
  XCircle,
  RefreshCw,
  Receipt,
  Trash2,
  MoreVertical,
  Edit2,
  Eye,
  AlertCircle,
  TrendingUp,
  CalendarClock,
} from 'lucide-react'
import {
  listContracts,
  createContract,
  updateContract,
  deleteContract,
  activateContract,
  suspendContract,
  resumeContract,
  terminateContract,
  generateInvoiceFromContract,
  getContractsExpiringSoon,
  renewContract,
  generateContractNumber,
  getContractStats,
  runAutoBilling,
} from '../services/contratsService'
import { listProducts } from '../services/produitsService'
import { useCustomers } from '../hooks/useSupabase'
import ThirdPartyPicker from '../components/ThirdPartyPicker'
import type {
  Contract,
  ContractStatus,
  ContractType,
  ContractFormData,
  ContractLineFormData,
  BillingFrequency,
  ContractStats,
  ExpiringContract,
} from '../types/contrats'
import type { Product, ThirdParty } from '../types/commercial'

// ============ Helper Functions ============

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

const getStatusBadge = (status: ContractStatus) => {
  switch (status) {
    case 'draft':
      return { bg: '#F3F4F6', text: '#374151', label: 'Brouillon' }
    case 'active':
      return { bg: '#D6D9DB', text: '#1F2937', label: 'Actif' }
    case 'suspended':
      return { bg: '#FEF3C7', text: '#92400E', label: 'Suspendu' }
    case 'terminated':
      return { bg: '#FEE2E2', text: '#991B1B', label: 'Resilie' }
    case 'expired':
      return { bg: '#F3F4F6', text: '#6B7280', label: 'Expire' }
    default:
      return { bg: '#F3F4F6', text: '#374151', label: status }
  }
}

const getTypeBadge = (type: ContractType) => {
  switch (type) {
    case 'subscription':
      return { bg: '#DBEAFE', text: '#1E40AF', label: 'Abonnement' }
    case 'service':
      return { bg: '#D1FAE5', text: '#065F46', label: 'Service' }
    case 'rental':
      return { bg: '#FEE2E2', text: '#991B1B', label: 'Location' }
    default:
      return { bg: '#F3F4F6', text: '#374151', label: type }
  }
}

const getFrequencyLabel = (frequency: BillingFrequency) => {
  switch (frequency) {
    case 'monthly':
      return 'Mensuel'
    case 'quarterly':
      return 'Trimestriel'
    case 'yearly':
      return 'Annuel'
    default:
      return frequency
  }
}

// ============ Constants ============

const VAT_RATES = [
  { value: '20', label: '20%' },
  { value: '10', label: '10%' },
  { value: '5.5', label: '5,5%' },
  { value: '0', label: '0% (Exonere)' },
]

const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: 'subscription', label: 'Abonnement' },
  { value: 'service', label: 'Service' },
  { value: 'rental', label: 'Location' },
]

const BILLING_FREQUENCIES: { value: BillingFrequency; label: string }[] = [
  { value: 'monthly', label: 'Mensuel' },
  { value: 'quarterly', label: 'Trimestriel' },
  { value: 'yearly', label: 'Annuel' },
]

const initialLine: ContractLineFormData = {
  description: '',
  quantity: 1,
  unitPrice: 0,
  vatRate: '20',
}

const getInitialFormData = (): ContractFormData => ({
  customerId: null,
  customerName: '',
  name: '',
  type: 'subscription',
  startDate: new Date().toISOString().split('T')[0],
  endDate: undefined,
  billingFrequency: 'monthly',
  billingDay: 1,
  autoRenew: true,
  renewalNoticeDays: 30,
  notes: '',
  lines: [{ ...initialLine }],
})

// ============ Component ============

interface ContratsPageProps {
  onNavigate?: (page: string) => void
}

export default function ContratsPage({ onNavigate: _onNavigate }: ContratsPageProps) {
  // State
  const [contracts, setContracts] = useState<Contract[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<ContractStats | null>(null)
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<ContractType | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<ContractFormData>(getInitialFormData())
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [isViewMode, setIsViewMode] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showTerminateModal, setShowTerminateModal] = useState<string | null>(null)
  const [terminateReason, setTerminateReason] = useState('')
  const [generatedNumber, setGeneratedNumber] = useState('')
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [showBillingResults, setShowBillingResults] = useState(false)
  const [billingResults, setBillingResults] = useState<{ success: number; failed: number } | null>(null)

  // Hooks
  const { customers, loading: customersLoading } = useCustomers()

  // Fetch data
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [contractsData, productsData, statsData, expiringData] = await Promise.all([
        listContracts({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
          searchTerm: searchTerm || undefined,
        }),
        listProducts({ isActive: true }),
        getContractStats(),
        getContractsExpiringSoon(60),
      ])
      setContracts(contractsData)
      setProducts(productsData)
      setStats(statsData)
      setExpiringContracts(expiringData)
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
  }, [statusFilter, typeFilter, searchTerm])

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Calculate line total
  const calculateLineTotal = (line: ContractLineFormData) => {
    const totalHT = line.quantity * line.unitPrice
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

    return { totalHT, totalVAT, totalTTC }
  }, [formData.lines])

  // Update form
  const updateForm = (updates: Partial<ContractFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  // Update line
  const updateLine = (index: number, updates: Partial<ContractLineFormData>) => {
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
      unitPrice: product.sale_price_ht,
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

  // Open create modal
  const openCreateModal = async () => {
    try {
      const number = await generateContractNumber()
      setGeneratedNumber(number)
    } catch (err) {
      console.error('Error generating contract number:', err)
      setGeneratedNumber('')
    }
    setSelectedContract(null)
    setIsViewMode(false)
    setFormData(getInitialFormData())
    setIsModalOpen(true)
  }

  // Open edit modal
  const openEditModal = (contract: Contract) => {
    setSelectedContract(contract)
    setIsViewMode(false)
    setGeneratedNumber(contract.number)
    setFormData({
      customerId: contract.customer_id,
      customerName: contract.customer?.name || '',
      name: contract.name,
      type: contract.type,
      startDate: contract.start_date,
      endDate: contract.end_date,
      billingFrequency: contract.billing_frequency,
      billingDay: contract.billing_day,
      autoRenew: contract.auto_renew,
      renewalNoticeDays: contract.renewal_notice_days,
      notes: contract.notes || '',
      lines: contract.lines?.map(line => ({
        productId: line.product_id || undefined,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        vatRate: line.vat_rate.toString(),
      })) || [{ ...initialLine }],
    })
    setIsModalOpen(true)
  }

  // Open view modal
  const openViewModal = (contract: Contract) => {
    setSelectedContract(contract)
    setIsViewMode(true)
    setGeneratedNumber(contract.number)
    setFormData({
      customerId: contract.customer_id,
      customerName: contract.customer?.name || '',
      name: contract.name,
      type: contract.type,
      startDate: contract.start_date,
      endDate: contract.end_date,
      billingFrequency: contract.billing_frequency,
      billingDay: contract.billing_day,
      autoRenew: contract.auto_renew,
      renewalNoticeDays: contract.renewal_notice_days,
      notes: contract.notes || '',
      lines: contract.lines?.map(line => ({
        productId: line.product_id || undefined,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        vatRate: line.vat_rate.toString(),
      })) || [{ ...initialLine }],
    })
    setIsModalOpen(true)
  }

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedContract(null)
    setIsViewMode(false)
    setFormData(getInitialFormData())
    setGeneratedNumber('')
  }

  // Submit form
  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      if (selectedContract) {
        await updateContract(selectedContract.id, formData)
        setSuccessMessage('Contrat modifie avec succes')
      } else {
        await createContract(formData)
        setSuccessMessage('Contrat cree avec succes')
      }
      closeModal()
      fetchData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete
  const handleDelete = async (contractId: string) => {
    try {
      await deleteContract(contractId)
      setSuccessMessage('Contrat supprime avec succes')
      setShowDeleteConfirm(null)
      fetchData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
    }
  }

  // Handle activate
  const handleActivate = async (contractId: string) => {
    try {
      await activateContract(contractId)
      setSuccessMessage('Contrat active avec succes')
      setActiveDropdown(null)
      fetchData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
    }
  }

  // Handle suspend
  const handleSuspend = async (contractId: string) => {
    try {
      await suspendContract(contractId)
      setSuccessMessage('Contrat suspendu avec succes')
      setActiveDropdown(null)
      fetchData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
    }
  }

  // Handle resume
  const handleResume = async (contractId: string) => {
    try {
      await resumeContract(contractId)
      setSuccessMessage('Contrat relance avec succes')
      setActiveDropdown(null)
      fetchData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
    }
  }

  // Handle terminate
  const handleTerminate = async () => {
    if (!showTerminateModal) return
    try {
      await terminateContract(showTerminateModal, terminateReason)
      setSuccessMessage('Contrat resilie avec succes')
      setShowTerminateModal(null)
      setTerminateReason('')
      fetchData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
    }
  }

  // Handle generate invoice
  const handleGenerateInvoice = async (contractId: string) => {
    try {
      const invoice = await generateInvoiceFromContract(contractId)
      setSuccessMessage(`Facture ${invoice.number} generee avec succes`)
      setActiveDropdown(null)
      fetchData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
    }
  }

  // Handle renew
  const handleRenew = async (contractId: string) => {
    try {
      await renewContract(contractId)
      setSuccessMessage('Contrat renouvele avec succes')
      setActiveDropdown(null)
      fetchData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
    }
  }

  // Handle auto billing
  const handleAutoBilling = async () => {
    try {
      const results = await runAutoBilling()
      setBillingResults({ success: results.totalSuccess, failed: results.totalFailed })
      setShowBillingResults(true)
      if (results.totalSuccess > 0) {
        setSuccessMessage(`${results.totalSuccess} facture(s) generee(s) avec succes`)
      }
      fetchData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null)
    if (activeDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [activeDropdown])

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
            Contrats & Abonnements
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
            Gerez vos contrats de services recurrents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAutoBilling}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium"
            style={{ borderColor: '#006666', color: '#006666' }}
          >
            <Receipt className="w-4 h-4" />
            Facturation auto
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#006666' }}
          >
            <Plus className="w-4 h-4" />
            Nouveau contrat
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                <FileText className="w-5 h-5" style={{ color: '#1E40AF' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#6C767F' }}>Total contrats</p>
                <p className="text-xl font-semibold" style={{ color: '#141A1F' }}>{stats.totalContracts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                <TrendingUp className="w-5 h-5" style={{ color: '#065F46' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#6C767F' }}>MRR</p>
                <p className="text-xl font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(stats.totalMRR)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                <CalendarClock className="w-5 h-5" style={{ color: '#92400E' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#6C767F' }}>A facturer (30j)</p>
                <p className="text-xl font-semibold" style={{ color: '#141A1F' }}>{stats.contractsDueSoon}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertCircle className="w-5 h-5" style={{ color: '#991B1B' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#6C767F' }}>Expirant (60j)</p>
                <p className="text-xl font-semibold" style={{ color: '#141A1F' }}>{stats.contractsExpiringSoon}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts for expiring contracts */}
      {expiringContracts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Contrats expirant bientot</p>
              <ul className="mt-2 space-y-1">
                {expiringContracts.slice(0, 3).map(({ contract, daysUntilExpiry }) => (
                  <li key={contract.id} className="text-sm text-amber-700">
                    {contract.number} - {contract.name} ({contract.customer?.name}) - expire dans {daysUntilExpiry} jour(s)
                  </li>
                ))}
                {expiringContracts.length > 3 && (
                  <li className="text-sm text-amber-600 font-medium">
                    + {expiringContracts.length - 3} autre(s) contrat(s)
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: '#6C767F' }} />
            <input
              type="text"
              placeholder="Rechercher un contrat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContractStatus | 'all')}
            className="px-4 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB' }}
          >
            <option value="all">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="active">Actif</option>
            <option value="suspended">Suspendu</option>
            <option value="terminated">Resilie</option>
            <option value="expired">Expire</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ContractType | 'all')}
            className="px-4 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB' }}
          >
            <option value="all">Tous les types</option>
            <option value="subscription">Abonnement</option>
            <option value="service">Service</option>
            <option value="rental">Location</option>
          </select>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
        {loading ? (
          <div className="p-8 text-center" style={{ color: '#6C767F' }}>
            Chargement...
          </div>
        ) : contracts.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: '#D6D9DB' }} />
            <p style={{ color: '#6C767F' }}>Aucun contrat trouve</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-sm font-medium"
              style={{ color: '#006666' }}
            >
              Creer un premier contrat
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFAFA' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#6C767F' }}>Numero</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#6C767F' }}>Nom</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#6C767F' }}>Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#6C767F' }}>Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#6C767F' }}>Frequence</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#6C767F' }}>Montant TTC</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#6C767F' }}>Prochaine fact.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#6C767F' }}>Statut</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#6C767F' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => {
                const statusBadge = getStatusBadge(contract.status)
                const typeBadge = getTypeBadge(contract.type)
                return (
                  <tr key={contract.id} className="border-b hover:bg-gray-50" style={{ borderColor: '#E4E5E7' }}>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium" style={{ color: '#006666' }}>{contract.number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: '#141A1F' }}>{contract.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: '#141A1F' }}>{contract.customer?.name || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ backgroundColor: typeBadge.bg, color: typeBadge.text }}
                      >
                        {typeBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: '#6C767F' }}>
                        {getFrequencyLabel(contract.billing_frequency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                        {formatCurrency(contract.total_ttc)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: '#6C767F' }}>
                        {formatDate(contract.next_billing_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ backgroundColor: statusBadge.bg, color: statusBadge.text }}
                      >
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openViewModal(contract)}
                          className="p-1.5 rounded hover:bg-gray-100"
                          title="Voir"
                        >
                          <Eye className="w-4 h-4" style={{ color: '#6C767F' }} />
                        </button>
                        {contract.status === 'draft' && (
                          <button
                            onClick={() => openEditModal(contract)}
                            className="p-1.5 rounded hover:bg-gray-100"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" style={{ color: '#6C767F' }} />
                          </button>
                        )}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveDropdown(activeDropdown === contract.id ? null : contract.id)
                            }}
                            className="p-1.5 rounded hover:bg-gray-100"
                          >
                            <MoreVertical className="w-4 h-4" style={{ color: '#6C767F' }} />
                          </button>
                          {activeDropdown === contract.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[160px]" style={{ borderColor: '#E4E5E7' }}>
                              {contract.status === 'draft' && (
                                <>
                                  <button
                                    onClick={() => handleActivate(contract.id)}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                    style={{ color: '#141A1F' }}
                                  >
                                    <Play className="w-4 h-4" />
                                    Activer
                                  </button>
                                  <button
                                    onClick={() => setShowDeleteConfirm(contract.id)}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Supprimer
                                  </button>
                                </>
                              )}
                              {contract.status === 'active' && (
                                <>
                                  <button
                                    onClick={() => handleGenerateInvoice(contract.id)}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                    style={{ color: '#141A1F' }}
                                  >
                                    <Receipt className="w-4 h-4" />
                                    Facturer maintenant
                                  </button>
                                  <button
                                    onClick={() => handleSuspend(contract.id)}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                    style={{ color: '#141A1F' }}
                                  >
                                    <Pause className="w-4 h-4" />
                                    Suspendre
                                  </button>
                                  <button
                                    onClick={() => setShowTerminateModal(contract.id)}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    Resilier
                                  </button>
                                </>
                              )}
                              {contract.status === 'suspended' && (
                                <>
                                  <button
                                    onClick={() => handleResume(contract.id)}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                    style={{ color: '#141A1F' }}
                                  >
                                    <Play className="w-4 h-4" />
                                    Relancer
                                  </button>
                                  <button
                                    onClick={() => setShowTerminateModal(contract.id)}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    Resilier
                                  </button>
                                </>
                              )}
                              {(contract.status === 'active' || contract.status === 'expired') && contract.end_date && (
                                <button
                                  onClick={() => handleRenew(contract.id)}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  style={{ color: '#141A1F' }}
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  Renouveler
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                    {isViewMode ? 'Details du contrat' : selectedContract ? 'Modifier le contrat' : 'Nouveau contrat'}
                  </h2>
                  {generatedNumber && (
                    <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                      N° {generatedNumber}
                    </p>
                  )}
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                  <XCircle className="w-5 h-5" style={{ color: '#6C767F' }} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                  Client *
                </label>
                <ThirdPartyPicker
                  thirdParties={customers}
                  type="customer"
                  value={formData.customerName}
                  selectedId={formData.customerId}
                  onChange={handleCustomerSelect}
                  disabled={isViewMode || customersLoading}
                />
              </div>

              {/* Contract Name */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                  Nom du contrat *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  disabled={isViewMode}
                  placeholder="Ex: Abonnement maintenance annuel"
                  className="w-full px-4 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>

              {/* Type and Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => updateForm({ type: e.target.value as ContractType })}
                    disabled={isViewMode}
                    className="w-full px-4 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                    style={{ borderColor: '#D6D9DB' }}
                  >
                    {CONTRACT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                    Date de debut *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => updateForm({ startDate: e.target.value })}
                    disabled={isViewMode}
                    className="w-full px-4 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={formData.endDate || ''}
                    onChange={(e) => updateForm({ endDate: e.target.value || undefined })}
                    disabled={isViewMode}
                    className="w-full px-4 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                  <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
                    Laisser vide pour duree indeterminee
                  </p>
                </div>
              </div>

              {/* Billing Settings */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                    Frequence *
                  </label>
                  <select
                    value={formData.billingFrequency}
                    onChange={(e) => updateForm({ billingFrequency: e.target.value as BillingFrequency })}
                    disabled={isViewMode}
                    className="w-full px-4 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                    style={{ borderColor: '#D6D9DB' }}
                  >
                    {BILLING_FREQUENCIES.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                    Jour de facturation *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={formData.billingDay}
                    onChange={(e) => updateForm({ billingDay: parseInt(e.target.value) || 1 })}
                    disabled={isViewMode}
                    className="w-full px-4 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                    Preavis resiliation (jours)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.renewalNoticeDays}
                    onChange={(e) => updateForm({ renewalNoticeDays: parseInt(e.target.value) || 0 })}
                    disabled={isViewMode}
                    className="w-full px-4 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
              </div>

              {/* Auto Renew */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoRenew"
                  checked={formData.autoRenew}
                  onChange={(e) => updateForm({ autoRenew: e.target.checked })}
                  disabled={isViewMode}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="autoRenew" className="text-sm" style={{ color: '#141A1F' }}>
                  Renouvellement automatique
                </label>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium" style={{ color: '#141A1F' }}>
                    Lignes du contrat
                  </label>
                  {!isViewMode && (
                    <button
                      onClick={addLine}
                      className="text-sm font-medium flex items-center gap-1"
                      style={{ color: '#006666' }}
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter une ligne
                    </button>
                  )}
                </div>
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#FAFAFA' }}>
                        <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: '#6C767F' }}>Description</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold w-20" style={{ color: '#6C767F' }}>Qte</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold w-28" style={{ color: '#6C767F' }}>P.U. HT</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold w-24" style={{ color: '#6C767F' }}>TVA</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold w-28" style={{ color: '#6C767F' }}>Total HT</th>
                        {!isViewMode && <th className="w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lines.map((line, index) => {
                        const lineTotals = calculateLineTotal(line)
                        return (
                          <tr key={index} className="border-t" style={{ borderColor: '#E4E5E7' }}>
                            <td className="px-3 py-2">
                              <div className="space-y-1">
                                {!isViewMode && products.length > 0 && (
                                  <select
                                    value={line.productId || ''}
                                    onChange={(e) => {
                                      const product = products.find(p => p.id === e.target.value)
                                      if (product) selectProductForLine(index, product)
                                      else updateLine(index, { productId: undefined })
                                    }}
                                    className="w-full px-2 py-1 border rounded text-xs"
                                    style={{ borderColor: '#D6D9DB' }}
                                  >
                                    <option value="">Choisir un produit...</option>
                                    {products.map(p => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                )}
                                <input
                                  type="text"
                                  value={line.description}
                                  onChange={(e) => updateLine(index, { description: e.target.value })}
                                  disabled={isViewMode}
                                  placeholder="Description"
                                  className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-50"
                                  style={{ borderColor: '#D6D9DB' }}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={(e) => updateLine(index, { quantity: parseFloat(e.target.value) || 1 })}
                                disabled={isViewMode}
                                className="w-full px-2 py-1 border rounded text-sm text-center disabled:bg-gray-50"
                                style={{ borderColor: '#D6D9DB' }}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.unitPrice}
                                onChange={(e) => updateLine(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                                disabled={isViewMode}
                                className="w-full px-2 py-1 border rounded text-sm text-right disabled:bg-gray-50"
                                style={{ borderColor: '#D6D9DB' }}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={line.vatRate}
                                onChange={(e) => updateLine(index, { vatRate: e.target.value })}
                                disabled={isViewMode}
                                className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-50"
                                style={{ borderColor: '#D6D9DB' }}
                              >
                                {VAT_RATES.map(r => (
                                  <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                                {formatCurrency(lineTotals.totalHT)}
                              </span>
                            </td>
                            {!isViewMode && (
                              <td className="px-3 py-2">
                                {formData.lines.length > 1 && (
                                  <button
                                    onClick={() => removeLine(index)}
                                    className="p-1 rounded hover:bg-gray-100"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFAFA' }}>
                        <td colSpan={isViewMode ? 4 : 5} className="px-3 py-2 text-right">
                          <div className="space-y-1">
                            <p className="text-sm" style={{ color: '#6C767F' }}>Total HT</p>
                            <p className="text-sm" style={{ color: '#6C767F' }}>TVA</p>
                            <p className="text-sm font-semibold" style={{ color: '#141A1F' }}>Total TTC</p>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="space-y-1">
                            <p className="text-sm" style={{ color: '#141A1F' }}>{formatCurrency(formTotals.totalHT)}</p>
                            <p className="text-sm" style={{ color: '#141A1F' }}>{formatCurrency(formTotals.totalVAT)}</p>
                            <p className="text-sm font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(formTotals.totalTTC)}</p>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => updateForm({ notes: e.target.value })}
                  disabled={isViewMode}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t flex items-center justify-end gap-3" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={closeModal}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                {isViewMode ? 'Fermer' : 'Annuler'}
              </button>
              {!isViewMode && (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: '#006666' }}
                >
                  {isSubmitting ? 'Enregistrement...' : selectedContract ? 'Modifier' : 'Creer'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
              Confirmer la suppression
            </h3>
            <p className="text-sm mb-6" style={{ color: '#6C767F' }}>
              Etes-vous sur de vouloir supprimer ce contrat ? Cette action est irreversible.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Modal */}
      {showTerminateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
              Resilier le contrat
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                Motif de resiliation (optionnel)
              </label>
              <textarea
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="Ex: Fin de collaboration, client change de prestataire..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTerminateModal(null)
                  setTerminateReason('')
                }}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleTerminate}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600"
              >
                Resilier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billing Results Modal */}
      {showBillingResults && billingResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
              Resultat de la facturation automatique
            </h3>
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#D1FAE5' }}>
                <span className="text-sm" style={{ color: '#065F46' }}>Factures generees</span>
                <span className="text-lg font-semibold" style={{ color: '#065F46' }}>{billingResults.success}</span>
              </div>
              {billingResults.failed > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
                  <span className="text-sm" style={{ color: '#991B1B' }}>Echecs</span>
                  <span className="text-lg font-semibold" style={{ color: '#991B1B' }}>{billingResults.failed}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowBillingResults(false)
                  setBillingResults(null)
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: '#006666' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
