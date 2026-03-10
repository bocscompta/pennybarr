import { useState, useEffect, useMemo } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { ThirdParty } from '../types/database'
import {
  getOverdueInvoices,
  getDunningHistory,
  recordDunning,
  generateDunningLetter,
  markAsDoubtfulDebt,
  createBadDebtProvision,
  markAsLitige,
  getDunningStats,
  sendBulkDunning,
  getSuggestedDunningLevel,
  exportDunningReport,
  DUNNING_LEVELS,
  type OverdueInvoice,
  type DunningHistory,
  type DunningStats,
  type DunningStatus
} from '../services/relancesService'

// ============ Helpers ============

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Get color based on delay days
const getDelayColor = (days: number): { bg: string; text: string; border: string } => {
  if (days === 0) {
    return { bg: '#F5F5F4', text: '#57534E', border: '#D6D3D1' }
  } else if (days <= 30) {
    return { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' }
  } else if (days <= 60) {
    return { bg: '#FFEDD5', text: '#C2410C', border: '#FDBA74' }
  } else if (days <= 90) {
    return { bg: '#FED7AA', text: '#9A3412', border: '#FB923C' }
  } else {
    return { bg: '#FECDD3', text: '#9F1239', border: '#FDA4AF' }
  }
}

// Get relance level badge
const getRelanceBadge = (level: number, status: DunningStatus) => {
  if (status === 'litige') {
    return { bg: '#FEE2E2', text: '#991B1B', label: 'Litige', icon: '!' }
  }
  if (status === 'creance_douteuse') {
    return { bg: '#E4E4E7', text: '#3F3F46', label: 'Creance douteuse (416)', icon: '$' }
  }
  if (status === 'provision') {
    return { bg: '#E0E7FF', text: '#3730A3', label: 'Provision constituee', icon: '%' }
  }
  switch (level) {
    case 0:
      return { bg: '#F5F5F4', text: '#57534E', label: 'Non relance', icon: '' }
    case 1:
      return { bg: '#FEF3C7', text: '#B45309', label: 'Rappel', icon: '1' }
    case 2:
      return { bg: '#FFEDD5', text: '#C2410C', label: 'Relance', icon: '2' }
    case 3:
      return { bg: '#FED7AA', text: '#9A3412', label: 'Mise en demeure', icon: '3' }
    case 4:
      return { bg: '#FECDD3', text: '#9F1239', label: 'Pre-contentieux', icon: '4' }
    default:
      return { bg: '#F5F5F4', text: '#57534E', label: 'Non relance', icon: '' }
  }
}

// Get method label
const getMethodLabel = (method: string) => {
  switch (method) {
    case 'email': return 'Email'
    case 'letter': return 'Courrier'
    case 'phone': return 'Telephone'
    case 'manual': return 'Manuel'
    default: return method
  }
}

interface RelancesPageProps {
  onNavigate?: (page: string) => void
}

export default function RelancesPage({ onNavigate: _onNavigate }: RelancesPageProps) {
  // State
  const [invoices, setInvoices] = useState<OverdueInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [stats, setStats] = useState<DunningStats | null>(null)

  // Filters
  const [customerFilter, setCustomerFilter] = useState<string>('')
  const [delayFilter, setDelayFilter] = useState<'all' | '0-30' | '30-60' | '60-90' | '90+'>('all')
  const [statusFilter, setStatusFilter] = useState<DunningStatus | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal state
  const [showRelanceModal, setShowRelanceModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<OverdueInvoice | null>(null)
  const [relanceLevel, setRelanceLevel] = useState<number>(1)
  const [relanceMethod, setRelanceMethod] = useState<'email' | 'letter' | 'phone' | 'manual'>('email')
  const [letterContent, setLetterContent] = useState('')
  const [relanceNotes, setRelanceNotes] = useState('')
  const [sendEmail, setSendEmail] = useState(false)

  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyData, setHistoryData] = useState<DunningHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState<'litige' | 'creance_douteuse' | 'provision' | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [provisionPercent, setProvisionPercent] = useState(50)

  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkLevel, setBulkLevel] = useState<number>(1)
  const [bulkMethod, setBulkMethod] = useState<'email' | 'letter' | 'phone' | 'manual'>('email')
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // Customers list for filter
  const [customers, setCustomers] = useState<ThirdParty[]>([])

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        // Fetch overdue invoices using service
        const overdueData = await getOverdueInvoices()
        setInvoices(overdueData)

        // Fetch stats
        const statsData = await getDunningStats()
        setStats(statsData)

        // Fetch customers for filter
        const { data: customerData } = await supabase
          .from('third_parties')
          .select('*')
          .eq('company_id', COMPANY_ID)
          .in('type', ['customer', 'both'])
          .order('name')

        setCustomers(customerData || [])
      } catch (err) {
        console.error('Error fetching relances data:', err)
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (customerFilter && inv.third_party_id !== customerFilter) return false

      if (delayFilter === '0-30' && inv.days_overdue > 30) return false
      if (delayFilter === '30-60' && (inv.days_overdue <= 30 || inv.days_overdue > 60)) return false
      if (delayFilter === '60-90' && (inv.days_overdue <= 60 || inv.days_overdue > 90)) return false
      if (delayFilter === '90+' && inv.days_overdue <= 90) return false

      if (statusFilter !== 'all' && inv.dunning_status !== statusFilter) return false

      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const customerName = inv.third_party?.name?.toLowerCase() || ''
        const invoiceNumber = inv.number.toLowerCase()
        if (!customerName.includes(search) && !invoiceNumber.includes(search)) return false
      }

      return true
    })
  }, [invoices, customerFilter, delayFilter, statusFilter, searchTerm])

  // Selection handlers
  const toggleInvoice = (id: string) => {
    setSelectedInvoices(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id))
    }
  }

  // Open relance modal
  const openRelanceModal = (invoice: OverdueInvoice) => {
    setSelectedInvoice(invoice)
    const suggestedLevel = getSuggestedDunningLevel(invoice.days_overdue)
    const nextLevel = Math.max(suggestedLevel, invoice.dunning_level + 1)
    setRelanceLevel(Math.min(4, nextLevel))
    setRelanceMethod('email')
    setRelanceNotes('')
    setSendEmail(invoice.third_party?.email ? true : false)

    // Generate letter content
    if (invoice.third_party) {
      const content = generateDunningLetter(
        invoice,
        Math.min(4, nextLevel),
        invoice.third_party,
        'Votre entreprise'
      )
      setLetterContent(content)
    }

    setShowRelanceModal(true)
  }

  // Handle relance action
  const handleRelance = async () => {
    if (!selectedInvoice) return

    try {
      await recordDunning(
        selectedInvoice.id,
        relanceLevel,
        relanceMethod,
        relanceNotes,
        letterContent,
        sendEmail
      )

      // Update local state
      setInvoices(prev =>
        prev.map(inv =>
          inv.id === selectedInvoice.id
            ? {
                ...inv,
                dunning_level: relanceLevel,
                dunning_status: `relance_${relanceLevel}` as DunningStatus,
                last_dunning_date: new Date().toISOString().split('T')[0]
              }
            : inv
        )
      )

      setShowRelanceModal(false)
      setSelectedInvoice(null)
    } catch (err) {
      console.error('Error recording relance:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors de la relance')
    }
  }

  // Open history modal
  const openHistoryModal = async (invoice: OverdueInvoice) => {
    setSelectedInvoice(invoice)
    setHistoryLoading(true)
    setShowHistoryModal(true)

    try {
      const history = await getDunningHistory(invoice.id)
      setHistoryData(history)
    } catch (err) {
      console.error('Error fetching history:', err)
      setHistoryData([])
    } finally {
      setHistoryLoading(false)
    }
  }

  // Handle mark as litige
  const handleMarkAsLitige = async () => {
    if (!selectedInvoice || !actionReason) return

    try {
      await markAsLitige(selectedInvoice.id, actionReason)

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === selectedInvoice.id
            ? { ...inv, dunning_status: 'litige' as DunningStatus }
            : inv
        )
      )

      setShowActionModal(false)
      setSelectedInvoice(null)
      setActionReason('')
    } catch (err) {
      console.error('Error marking as litige:', err)
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  // Handle mark as creance douteuse (compte 416)
  const handleMarkAsCreanceDouteuse = async () => {
    if (!selectedInvoice || !actionReason) return

    try {
      await markAsDoubtfulDebt(selectedInvoice.id, actionReason)

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === selectedInvoice.id
            ? { ...inv, dunning_status: 'creance_douteuse' as DunningStatus }
            : inv
        )
      )

      setShowActionModal(false)
      setSelectedInvoice(null)
      setActionReason('')
    } catch (err) {
      console.error('Error marking as creance douteuse:', err)
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  // Handle create provision
  const handleCreateProvision = async () => {
    if (!selectedInvoice) return

    try {
      await createBadDebtProvision(selectedInvoice.id, provisionPercent)

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === selectedInvoice.id
            ? { ...inv, dunning_status: 'provision' as DunningStatus }
            : inv
        )
      )

      setShowActionModal(false)
      setSelectedInvoice(null)
      setProvisionPercent(50)
    } catch (err) {
      console.error('Error creating provision:', err)
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  // Generate letter download
  const handleDownloadLetter = () => {
    if (!selectedInvoice) return

    const blob = new Blob([letterContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `relance-${selectedInvoice.number}-niveau${relanceLevel}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Bulk relance
  const handleBulkRelance = async () => {
    if (selectedInvoices.length === 0) return

    setBulkProcessing(true)
    try {
      const result = await sendBulkDunning(selectedInvoices, bulkLevel, bulkMethod)

      // Refresh data
      const overdueData = await getOverdueInvoices()
      setInvoices(overdueData)

      setShowBulkModal(false)
      setSelectedInvoices([])

      if (result.failed > 0) {
        setError(`${result.success} relances envoyees, ${result.failed} echecs`)
      }
    } catch (err) {
      console.error('Error bulk relance:', err)
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBulkProcessing(false)
    }
  }

  // Export report
  const handleExportReport = async () => {
    try {
      const csv = await exportDunningReport()
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `relances-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting report:', err)
      setError('Erreur export')
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p style={{ color: '#6C767F' }}>Chargement des relances...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>Relances clients</h1>
            <span className="text-sm px-2 py-1 rounded" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
              {stats?.totalInvoices || 0} facture{(stats?.totalInvoices || 0) > 1 ? 's' : ''} en retard
            </span>
          </div>

          <div className="flex items-center gap-3">
            {selectedInvoices.length > 0 && (
              <button
                onClick={() => setShowBulkModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#57534e' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                Relancer ({selectedInvoices.length})
              </button>
            )}
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium"
              style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {/* Stats cards */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="grid grid-cols-6 gap-4">
          {/* Total en retard */}
          <div className="p-4 rounded-xl border" style={{ borderColor: '#E4E5E7' }}>
            <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Total en retard</p>
            <p className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
              {formatCurrency(stats?.totalOverdue || 0)}
            </p>
          </div>

          {/* 0-30 jours */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#FEF3C7' }}>
            <p className="text-sm mb-1" style={{ color: '#B45309' }}>0-30 jours</p>
            <p className="text-xl font-semibold" style={{ color: '#B45309' }}>
              {formatCurrency(stats?.amount0to30 || 0)}
            </p>
            <p className="text-xs mt-1" style={{ color: '#B45309' }}>
              {stats?.count0to30 || 0} facture{(stats?.count0to30 || 0) > 1 ? 's' : ''}
            </p>
          </div>

          {/* 30-60 jours */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#FFEDD5' }}>
            <p className="text-sm mb-1" style={{ color: '#C2410C' }}>30-60 jours</p>
            <p className="text-xl font-semibold" style={{ color: '#C2410C' }}>
              {formatCurrency(stats?.amount30to60 || 0)}
            </p>
            <p className="text-xs mt-1" style={{ color: '#C2410C' }}>
              {stats?.count30to60 || 0} facture{(stats?.count30to60 || 0) > 1 ? 's' : ''}
            </p>
          </div>

          {/* 60-90 jours */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#FED7AA' }}>
            <p className="text-sm mb-1" style={{ color: '#9A3412' }}>60-90 jours</p>
            <p className="text-xl font-semibold" style={{ color: '#9A3412' }}>
              {formatCurrency(stats?.amount60to90 || 0)}
            </p>
            <p className="text-xs mt-1" style={{ color: '#9A3412' }}>
              {stats?.count60to90 || 0} facture{(stats?.count60to90 || 0) > 1 ? 's' : ''}
            </p>
          </div>

          {/* > 90 jours */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#FECDD3' }}>
            <p className="text-sm mb-1" style={{ color: '#9F1239' }}>&gt; 90 jours</p>
            <p className="text-xl font-semibold" style={{ color: '#9F1239' }}>
              {formatCurrency(stats?.amount90plus || 0)}
            </p>
            <p className="text-xs mt-1" style={{ color: '#9F1239' }}>
              {stats?.count90plus || 0} facture{(stats?.count90plus || 0) > 1 ? 's' : ''}
            </p>
          </div>

          {/* Taux de recouvrement */}
          <div className="p-4 rounded-xl border" style={{ borderColor: '#E4E5E7' }}>
            <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Taux recouvrement</p>
            <p className="text-2xl font-semibold" style={{ color: '#57534E' }}>
              {stats?.recoveryRate ? `${stats.recoveryRate}%` : '—'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#6C767F' }}>Exercice en cours</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Client ou n facture..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 border rounded-lg text-sm bg-white w-48"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          {/* Customer filter */}
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
            style={{ borderColor: '#D6D9DB' }}
          >
            <option value="">Tous les clients</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Delay filter */}
          <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: '#D6D9DB' }}>
            {[
              { value: 'all', label: 'Tous' },
              { value: '0-30', label: '0-30j' },
              { value: '30-60', label: '30-60j' },
              { value: '60-90', label: '60-90j' },
              { value: '90+', label: '>90j' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setDelayFilter(opt.value as typeof delayFilter)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  delayFilter === opt.value
                    ? 'bg-stone-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
            style={{ borderColor: '#D6D9DB' }}
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">Non relance</option>
            <option value="relance_1">Rappel</option>
            <option value="relance_2">Relance</option>
            <option value="relance_3">Mise en demeure</option>
            <option value="relance_4">Pre-contentieux</option>
            <option value="litige">Litige</option>
            <option value="creance_douteuse">Creance douteuse</option>
            <option value="provision">Provision</option>
          </select>

          <div className="flex-1" />

          <span className="text-sm" style={{ color: '#6C767F' }}>
            {filteredInvoices.length} facture{filteredInvoices.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-rose-700">{error}</p>
          <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[1200px]">
          {/* Table Header */}
          <div className="sticky top-0 bg-white border-b z-10" style={{ borderColor: '#E4E5E7' }}>
            <div className="grid grid-cols-12 gap-2 px-6 py-3">
              <div className="col-span-1">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={filteredInvoices.length > 0 && selectedInvoices.length === filteredInvoices.length}
                  onChange={toggleAll}
                />
              </div>
              <div className="col-span-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Client</div>
              <div className="col-span-1 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>N Facture</div>
              <div className="col-span-1 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Echeance</div>
              <div className="col-span-1 text-xs font-medium uppercase text-right" style={{ color: '#6C767F' }}>Montant</div>
              <div className="col-span-1 text-xs font-medium uppercase text-center" style={{ color: '#6C767F' }}>Retard</div>
              <div className="col-span-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Niveau</div>
              <div className="col-span-1 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Derniere action</div>
              <div className="col-span-2 text-xs font-medium uppercase text-right" style={{ color: '#6C767F' }}>Actions</div>
            </div>
          </div>

          {/* Table Body */}
          {filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="w-16 h-16 mb-4" style={{ color: '#D6D9DB' }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium" style={{ color: '#6C767F' }}>
                Aucune facture en retard
              </p>
              <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
                Tous les clients sont a jour de leurs paiements
              </p>
            </div>
          ) : (
            <div>
              {filteredInvoices.map((invoice) => {
                const delayColor = getDelayColor(invoice.days_overdue)
                const badge = getRelanceBadge(invoice.dunning_level, invoice.dunning_status)

                return (
                  <div
                    key={invoice.id}
                    className="grid grid-cols-12 gap-2 px-6 py-3 hover:bg-gray-50 border-t"
                    style={{ borderColor: '#F2F2F3' }}
                  >
                    <div className="col-span-1 flex items-center">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedInvoices.includes(invoice.id)}
                        onChange={() => toggleInvoice(invoice.id)}
                      />
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                        {invoice.third_party?.name || 'Client inconnu'}
                      </span>
                      {invoice.third_party?.email && (
                        <p className="text-xs truncate" style={{ color: '#6C767F' }}>{invoice.third_party.email}</p>
                      )}
                    </div>
                    <div className="col-span-1">
                      <span className="text-sm font-mono" style={{ color: '#141A1F' }}>{invoice.number}</span>
                    </div>
                    <div className="col-span-1">
                      <span className="text-sm" style={{ color: '#141A1F' }}>{formatDate(invoice.due_date || '')}</span>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-sm font-medium font-mono" style={{ color: '#141A1F' }}>
                        {formatCurrency(invoice.total_ttc)}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <span
                        className="text-sm font-medium px-2 py-0.5 rounded"
                        style={{ backgroundColor: delayColor.bg, color: delayColor.text }}
                      >
                        {invoice.days_overdue}j
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span
                        className="text-xs font-medium px-2 py-1 rounded inline-flex items-center gap-1"
                        style={{ backgroundColor: badge.bg, color: badge.text }}
                      >
                        {badge.icon && <span className="font-bold">{badge.icon}</span>}
                        {badge.label}
                      </span>
                    </div>
                    <div className="col-span-1">
                      {invoice.last_dunning_date ? (
                        <span className="text-xs" style={{ color: '#6C767F' }}>
                          {formatDate(invoice.last_dunning_date)}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>
                      )}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      {/* Quick relance buttons */}
                      {invoice.dunning_status !== 'litige' && invoice.dunning_status !== 'creance_douteuse' && (
                        <>
                          {[1, 2, 3, 4].map(level => (
                            <button
                              key={level}
                              onClick={() => {
                                setSelectedInvoice(invoice)
                                setRelanceLevel(level)
                                if (invoice.third_party) {
                                  setLetterContent(generateDunningLetter(invoice, level, invoice.third_party, 'Votre entreprise'))
                                }
                                setShowRelanceModal(true)
                              }}
                              className={`w-6 h-6 rounded text-xs font-bold ${
                                invoice.dunning_level >= level ? 'opacity-50' : ''
                              }`}
                              style={{
                                backgroundColor: level <= 2 ? '#FEF3C7' : level === 3 ? '#FFEDD5' : '#FECDD3',
                                color: level <= 2 ? '#B45309' : level === 3 ? '#C2410C' : '#9F1239'
                              }}
                              title={DUNNING_LEVELS.find(d => d.level === level)?.name}
                            >
                              {level}
                            </button>
                          ))}
                        </>
                      )}

                      {/* History button */}
                      <button
                        onClick={() => openHistoryModal(invoice)}
                        className="p-1.5 rounded hover:bg-gray-100 ml-1"
                        title="Historique"
                      >
                        <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>

                      {/* More actions dropdown */}
                      <div className="relative group">
                        <button className="p-1.5 rounded hover:bg-gray-100">
                          <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                          </svg>
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-56 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20" style={{ borderColor: '#E4E5E7' }}>
                          <button
                            onClick={() => openRelanceModal(invoice)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            style={{ color: '#141A1F' }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                            Generer une relance
                          </button>
                          <hr className="my-1" style={{ borderColor: '#E4E5E7' }} />
                          {invoice.dunning_status !== 'litige' && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice)
                                setActionType('litige')
                                setActionReason('')
                                setShowActionModal(true)
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              style={{ color: '#141A1F' }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                              </svg>
                              Marquer en litige
                            </button>
                          )}
                          {invoice.dunning_status !== 'creance_douteuse' && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice)
                                setActionType('creance_douteuse')
                                setActionReason('')
                                setShowActionModal(true)
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              style={{ color: '#141A1F' }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                              </svg>
                              Creance douteuse (416)
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice)
                              setActionType('provision')
                              setProvisionPercent(50)
                              setShowActionModal(true)
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            style={{ color: '#141A1F' }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Constituer provision
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Relance Modal */}
      {showRelanceModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                Relancer {selectedInvoice.third_party?.name}
              </h2>
              <button
                onClick={() => setShowRelanceModal(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
              {/* Invoice info */}
              <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span style={{ color: '#6C767F' }}>Facture</span>
                    <p className="font-medium" style={{ color: '#141A1F' }}>{selectedInvoice.number}</p>
                  </div>
                  <div>
                    <span style={{ color: '#6C767F' }}>Montant</span>
                    <p className="font-medium" style={{ color: '#141A1F' }}>{formatCurrency(selectedInvoice.total_ttc)}</p>
                  </div>
                  <div>
                    <span style={{ color: '#6C767F' }}>Retard</span>
                    <p className="font-medium" style={{ color: '#9F1239' }}>{selectedInvoice.days_overdue} jours</p>
                  </div>
                  <div>
                    <span style={{ color: '#6C767F' }}>Niveau actuel</span>
                    <p className="font-medium" style={{ color: '#141A1F' }}>{selectedInvoice.dunning_level}</p>
                  </div>
                </div>
              </div>

              {/* Relance level selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>Niveau de relance</label>
                <div className="flex gap-2">
                  {DUNNING_LEVELS.map(level => (
                    <button
                      key={level.level}
                      onClick={() => {
                        setRelanceLevel(level.level)
                        if (selectedInvoice.third_party) {
                          const content = generateDunningLetter(
                            selectedInvoice,
                            level.level,
                            selectedInvoice.third_party,
                            'Votre entreprise'
                          )
                          setLetterContent(content)
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex-1 ${
                        relanceLevel === level.level ? 'text-white' : 'border'
                      }`}
                      style={{
                        backgroundColor: relanceLevel === level.level ? '#57534e' : 'white',
                        borderColor: relanceLevel === level.level ? undefined : '#D6D9DB',
                        color: relanceLevel === level.level ? 'white' : '#141A1F',
                      }}
                    >
                      <div className="text-xs opacity-70">Niveau {level.level}</div>
                      <div>{level.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Method selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>Methode d'envoi</label>
                <div className="flex gap-2">
                  {(['email', 'letter', 'phone', 'manual'] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => setRelanceMethod(method)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        relanceMethod === method ? 'text-white' : 'border'
                      }`}
                      style={{
                        backgroundColor: relanceMethod === method ? '#57534e' : 'white',
                        borderColor: relanceMethod === method ? undefined : '#D6D9DB',
                        color: relanceMethod === method ? 'white' : '#141A1F',
                      }}
                    >
                      {getMethodLabel(method)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Letter content */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                  Contenu de la lettre
                </label>
                <textarea
                  value={letterContent}
                  onChange={(e) => setLetterContent(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>Notes internes</label>
                <textarea
                  value={relanceNotes}
                  onChange={(e) => setRelanceNotes(e.target.value)}
                  rows={2}
                  placeholder="Notes pour le suivi..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>

              {/* Email option */}
              {selectedInvoice.third_party?.email && relanceMethod === 'email' && (
                <div className="mb-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sendEmail"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="sendEmail" className="text-sm" style={{ color: '#141A1F' }}>
                    Envoyer par email a {selectedInvoice.third_party.email}
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={handleDownloadLetter}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Telecharger lettre
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRelanceModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium"
                  style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleRelance}
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: '#57534e' }}
                >
                  Enregistrer la relance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                Historique - {selectedInvoice.number}
              </h2>
              <button
                onClick={() => {
                  setShowHistoryModal(false)
                  setSelectedInvoice(null)
                }}
                className="p-1 rounded hover:bg-gray-100"
              >
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto mb-3" style={{ color: '#D6D9DB' }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p style={{ color: '#6C767F' }}>Aucune relance enregistree</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                  <div className="space-y-4">
                    {historyData.map((entry) => {
                      const levelInfo = DUNNING_LEVELS.find(d => d.level === entry.level)
                      return (
                        <div key={entry.id} className="relative pl-10">
                          {/* Timeline dot */}
                          <div
                            className="absolute left-2.5 w-3 h-3 rounded-full border-2 bg-white"
                            style={{
                              borderColor: entry.level >= 3 ? '#C2410C' : entry.level >= 2 ? '#B45309' : '#57534E'
                            }}
                          ></div>

                          <div className="p-3 border rounded-lg" style={{ borderColor: '#E4E5E7' }}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-xs font-medium px-2 py-0.5 rounded"
                                  style={{
                                    backgroundColor: entry.level >= 3 ? '#FFEDD5' : entry.level >= 2 ? '#FEF3C7' : '#F5F5F4',
                                    color: entry.level >= 3 ? '#C2410C' : entry.level >= 2 ? '#B45309' : '#57534E'
                                  }}
                                >
                                  Niveau {entry.level} - {levelInfo?.name || 'Relance'}
                                </span>
                                <span
                                  className="text-xs px-2 py-0.5 rounded"
                                  style={{ backgroundColor: '#F5F5F4', color: '#57534E' }}
                                >
                                  {getMethodLabel(entry.method)}
                                </span>
                              </div>
                              <span className="text-xs" style={{ color: '#6C767F' }}>{formatDate(entry.date)}</span>
                            </div>
                            {entry.notes && (
                              <p className="text-sm" style={{ color: '#6C767F' }}>{entry.notes}</p>
                            )}
                            {entry.email_sent && (
                              <p className="text-xs mt-1" style={{ color: '#57534E' }}>
                                Email envoye
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action confirmation modal (litige/creance douteuse/provision) */}
      {showActionModal && selectedInvoice && actionType && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: actionType === 'litige' ? '#FEF3C7' : actionType === 'provision' ? '#E0E7FF' : '#E4E4E7'
                }}
              >
                <svg
                  className="w-5 h-5"
                  style={{
                    color: actionType === 'litige' ? '#B45309' : actionType === 'provision' ? '#3730A3' : '#3F3F46'
                  }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  {actionType === 'litige' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  ) : actionType === 'provision' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  )}
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                  {actionType === 'litige' && 'Marquer comme litige ?'}
                  {actionType === 'creance_douteuse' && 'Passer en creance douteuse ?'}
                  {actionType === 'provision' && 'Constituer une provision ?'}
                </h3>
                <p className="text-sm" style={{ color: '#6C767F' }}>
                  Facture {selectedInvoice.number} - {formatCurrency(selectedInvoice.total_ttc)}
                </p>
              </div>
            </div>

            {actionType === 'creance_douteuse' && (
              <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#F9FAFB', color: '#6C767F' }}>
                Cette action generera une ecriture de transfert du compte 411 (Clients) vers le compte 416 (Clients douteux).
              </div>
            )}

            {actionType === 'provision' && (
              <div className="mb-4">
                <div className="p-3 rounded-lg text-sm mb-3" style={{ backgroundColor: '#F9FAFB', color: '#6C767F' }}>
                  Cette action generera une ecriture de dotation aux provisions:
                  <br />Debit 68174 (Dotation provision creances)
                  <br />Credit 491 (Provision depreciation clients)
                </div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                  Pourcentage de provision
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={provisionPercent}
                    onChange={(e) => setProvisionPercent(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-lg font-semibold w-16 text-right" style={{ color: '#141A1F' }}>
                    {provisionPercent}%
                  </span>
                </div>
                <p className="text-sm mt-2" style={{ color: '#6C767F' }}>
                  Montant HT a provisionner: {formatCurrency(selectedInvoice.total_ht * provisionPercent / 100)}
                </p>
              </div>
            )}

            {(actionType === 'litige' || actionType === 'creance_douteuse') && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                  Motif
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={3}
                  placeholder={actionType === 'litige' ? 'Contestation client, erreur facturation...' : 'Client defaillant, procedure collective...'}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowActionModal(false)
                  setSelectedInvoice(null)
                  setActionType(null)
                  setActionReason('')
                }}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (actionType === 'litige') handleMarkAsLitige()
                  else if (actionType === 'creance_douteuse') handleMarkAsCreanceDouteuse()
                  else if (actionType === 'provision') handleCreateProvision()
                }}
                disabled={(actionType !== 'provision' && !actionReason)}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: '#57534e' }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Relance Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
              Relance groupee ({selectedInvoices.length} factures)
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>Niveau de relance</label>
              <div className="grid grid-cols-2 gap-2">
                {DUNNING_LEVELS.map(level => (
                  <button
                    key={level.level}
                    onClick={() => setBulkLevel(level.level)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${
                      bulkLevel === level.level ? 'text-white' : 'border'
                    }`}
                    style={{
                      backgroundColor: bulkLevel === level.level ? '#57534e' : 'white',
                      borderColor: bulkLevel === level.level ? undefined : '#D6D9DB',
                      color: bulkLevel === level.level ? 'white' : '#141A1F',
                    }}
                  >
                    {level.level}. {level.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>Methode</label>
              <div className="flex gap-2">
                {(['email', 'letter', 'phone', 'manual'] as const).map(method => (
                  <button
                    key={method}
                    onClick={() => setBulkMethod(method)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex-1 ${
                      bulkMethod === method ? 'text-white' : 'border'
                    }`}
                    style={{
                      backgroundColor: bulkMethod === method ? '#57534e' : 'white',
                      borderColor: bulkMethod === method ? undefined : '#D6D9DB',
                      color: bulkMethod === method ? 'white' : '#141A1F',
                    }}
                  >
                    {getMethodLabel(method)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                disabled={bulkProcessing}
              >
                Annuler
              </button>
              <button
                onClick={handleBulkRelance}
                disabled={bulkProcessing}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: '#57534e' }}
              >
                {bulkProcessing && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                Envoyer les relances
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
