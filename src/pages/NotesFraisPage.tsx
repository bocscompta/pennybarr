import { useState, useEffect, useMemo } from 'react'
import type { ExpenseReport } from '../types/database'
import {
  getExpenseReports,
  getExpenseReportWithLines,
  createExpenseReport,
  addExpenseLine,
  deleteExpenseLine,
  submitForApproval,
  approveExpenseReport,
  rejectExpenseReport,
  markAsPaid,
  deleteExpenseReport,
  revertToDraft,
  uploadReceipt,
  type ExpenseReportLine,
  type CreateExpenseReportData,
} from '../services/notesFraisService'

// Format date from ISO string
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

// Status badge component
const StatusBadge = ({ status }: { status: ExpenseReport['status'] }) => {
  const configs: Record<ExpenseReport['status'], { label: string; bgColor: string; textColor: string; borderColor?: string }> = {
    draft: { label: 'Brouillon', bgColor: '#F5F5F5', textColor: '#6C767F', borderColor: '#D6D9DB' },
    submitted: { label: 'Soumise', bgColor: '#FEF3C7', textColor: '#92400E' },
    approved: { label: 'Approuvee', bgColor: '#DCFCE7', textColor: '#166534' },
    rejected: { label: 'Rejetee', bgColor: '#FEE2E2', textColor: '#991B1B' },
    paid: { label: 'Payee', bgColor: '#D4D4D8', textColor: '#3F3F46' },
  }
  const config = configs[status]
  return (
    <span
      className="px-2 py-1 rounded text-xs font-medium"
      style={{
        backgroundColor: config.bgColor,
        color: config.textColor,
        border: config.borderColor ? `1px solid ${config.borderColor}` : undefined,
      }}
    >
      {config.label}
    </span>
  )
}

// Category options
const CATEGORY_OPTIONS = [
  { value: 'transport', label: 'Transport' },
  { value: 'repas', label: 'Repas' },
  { value: 'hebergement', label: 'Hebergement' },
  { value: 'fournitures', label: 'Fournitures' },
  { value: 'entretien', label: 'Entretien' },
  { value: 'reception', label: 'Reception' },
  { value: 'autre', label: 'Autre' },
]

// VAT rate options
const VAT_RATE_OPTIONS = [
  { value: '20', label: '20%' },
  { value: '10', label: '10%' },
  { value: '5.5', label: '5,5%' },
  { value: '0', label: '0%' },
]

// Empty line template
const createEmptyLine = (): Omit<ExpenseReportLine, 'id' | 'expense_report_id' | 'created_at'> => ({
  date: new Date().toISOString().split('T')[0],
  description: '',
  category: 'autre',
  amount_ht: 0,
  amount_vat: 0,
  amount_ttc: 0,
  vat_rate: '20',
  accounting_code: '',
  receipt_url: undefined,
})

interface NotesFraisPageProps {
  onNavigate?: (page: string) => void
}

export default function NotesFraisPage({ onNavigate: _onNavigate }: NotesFraisPageProps) {
  // List state
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [filterCollaborator, _setFilterCollaborator] = useState<string>('')

  // Selected report for detail view
  const [selectedReport, setSelectedReport] = useState<ExpenseReport | null>(null)
  const [selectedLines, setSelectedLines] = useState<ExpenseReportLine[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newReportDate, setNewReportDate] = useState(new Date().toISOString().split('T')[0])
  const [newReportNotes, setNewReportNotes] = useState('')
  const [newLines, setNewLines] = useState<Omit<ExpenseReportLine, 'id' | 'expense_report_id' | 'created_at'>[]>([createEmptyLine()])
  const [creating, setCreating] = useState(false)

  // Add line modal state
  const [showAddLineModal, setShowAddLineModal] = useState(false)
  const [newLine, setNewLine] = useState<Omit<ExpenseReportLine, 'id' | 'expense_report_id' | 'created_at'>>(createEmptyLine())
  const [addingLine, setAddingLine] = useState(false)

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // Pay modal state
  const [showPayModal, setShowPayModal] = useState(false)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [bankAccountCode, setBankAccountCode] = useState('512000')

  // Action loading states
  const [actionLoading, setActionLoading] = useState(false)

  // Load expense reports
  const loadReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: { status?: string; startDate?: string; endDate?: string; userId?: string } = {}
      if (filterStatus) filters.status = filterStatus
      if (filterStartDate) filters.startDate = filterStartDate
      if (filterEndDate) filters.endDate = filterEndDate
      if (filterCollaborator) filters.userId = filterCollaborator

      const data = await getExpenseReports(filters)
      setReports(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error loading expense reports:', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  // Load report detail
  const loadReportDetail = async (reportId: string) => {
    setLoadingDetail(true)
    try {
      const { report, lines } = await getExpenseReportWithLines(reportId)
      setSelectedReport(report)
      setSelectedLines(lines)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error loading report detail:', message)
      setError(message)
    } finally {
      setLoadingDetail(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadReports()
  }, [filterStatus, filterStartDate, filterEndDate, filterCollaborator])

  // Calculate totals
  const totalGlobal = useMemo(() => {
    return reports.reduce((sum, r) => sum + Number(r.total_amount), 0)
  }, [reports])

  const totalByStatus = useMemo(() => {
    const result: Record<string, number> = {}
    reports.forEach((r) => {
      result[r.status] = (result[r.status] || 0) + Number(r.total_amount)
    })
    return result
  }, [reports])

  // Calculate line totals when creating
  const calculateLineTotals = (line: Omit<ExpenseReportLine, 'id' | 'expense_report_id' | 'created_at'>, field: 'ttc' | 'ht') => {
    const vatRate = parseFloat(line.vat_rate) / 100
    if (field === 'ttc') {
      const ht = line.amount_ttc / (1 + vatRate)
      return {
        ...line,
        amount_ht: Math.round(ht * 100) / 100,
        amount_vat: Math.round((line.amount_ttc - ht) * 100) / 100,
      }
    } else {
      const ttc = line.amount_ht * (1 + vatRate)
      return {
        ...line,
        amount_ttc: Math.round(ttc * 100) / 100,
        amount_vat: Math.round((ttc - line.amount_ht) * 100) / 100,
      }
    }
  }

  // Handle create expense report
  const handleCreate = async () => {
    setCreating(true)
    try {
      const validLines = newLines.filter((l) => l.description && l.amount_ttc > 0)
      if (validLines.length === 0) {
        throw new Error('Au moins une ligne valide est requise')
      }

      const data: CreateExpenseReportData = {
        date: newReportDate,
        notes: newReportNotes || undefined,
        lines: validLines.map((l) => ({
          ...l,
          accounting_code: '',  // Resolved from DB by service
        })),
      }

      await createExpenseReport(data)
      setShowCreateModal(false)
      setNewReportDate(new Date().toISOString().split('T')[0])
      setNewReportNotes('')
      setNewLines([createEmptyLine()])
      await loadReports()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error creating expense report:', message)
      setError(message)
    } finally {
      setCreating(false)
    }
  }

  // Handle add line to existing report
  const handleAddLine = async () => {
    if (!selectedReport) return
    setAddingLine(true)
    try {
      await addExpenseLine(selectedReport.id, {
        ...newLine,
        accounting_code: '',  // Resolved from DB by service
      })
      setShowAddLineModal(false)
      setNewLine(createEmptyLine())
      await loadReportDetail(selectedReport.id)
      await loadReports()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error adding line:', message)
      setError(message)
    } finally {
      setAddingLine(false)
    }
  }

  // Handle delete line
  const handleDeleteLine = async (lineId: string) => {
    if (!selectedReport) return
    if (!window.confirm('Supprimer cette ligne ?')) return
    setActionLoading(true)
    try {
      await deleteExpenseLine(lineId)
      await loadReportDetail(selectedReport.id)
      await loadReports()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error deleting line:', message)
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle submit for approval
  const handleSubmit = async () => {
    if (!selectedReport) return
    setActionLoading(true)
    try {
      await submitForApproval(selectedReport.id)
      await loadReportDetail(selectedReport.id)
      await loadReports()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error submitting:', message)
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle approve
  const handleApprove = async () => {
    if (!selectedReport) return
    setActionLoading(true)
    try {
      // Using a placeholder approver ID for now
      await approveExpenseReport(selectedReport.id, 'admin-user')
      await loadReportDetail(selectedReport.id)
      await loadReports()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error approving:', message)
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle reject
  const handleReject = async () => {
    if (!selectedReport || !rejectReason.trim()) return
    setActionLoading(true)
    try {
      await rejectExpenseReport(selectedReport.id, rejectReason)
      setShowRejectModal(false)
      setRejectReason('')
      await loadReportDetail(selectedReport.id)
      await loadReports()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error rejecting:', message)
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle pay
  const handlePay = async () => {
    if (!selectedReport) return
    setActionLoading(true)
    try {
      await markAsPaid(selectedReport.id, paymentDate, bankAccountCode)
      setShowPayModal(false)
      await loadReportDetail(selectedReport.id)
      await loadReports()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error marking as paid:', message)
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle delete report
  const handleDelete = async () => {
    if (!selectedReport) return
    if (!window.confirm('Supprimer cette note de frais ?')) return
    setActionLoading(true)
    try {
      await deleteExpenseReport(selectedReport.id)
      setSelectedReport(null)
      setSelectedLines([])
      await loadReports()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error deleting:', message)
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle revert to draft
  const handleRevertToDraft = async () => {
    if (!selectedReport) return
    setActionLoading(true)
    try {
      await revertToDraft(selectedReport.id)
      await loadReportDetail(selectedReport.id)
      await loadReports()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error reverting:', message)
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle receipt upload (reserved for future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleReceiptUpload = async (file: File, lineIndex: number) => {
    if (!selectedReport) return
    try {
      const url = await uploadReceipt(file, selectedReport.id, lineIndex)
      console.log('Receipt uploaded:', url)
      // Refresh to show updated receipt
      await loadReportDetail(selectedReport.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error uploading receipt:', message)
      setError(message)
    }
  }
  // Suppress TypeScript unused warning - function reserved for future receipt upload UI
  void handleReceiptUpload

  // Loading state
  if (loading && reports.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p style={{ color: '#6C767F' }}>Chargement des notes de frais...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && reports.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="bg-white rounded-xl p-8 border text-center max-w-md" style={{ borderColor: '#E4E5E7' }}>
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="font-semibold mb-2" style={{ color: '#141A1F' }}>Erreur de chargement</h3>
          <p className="text-sm mb-4" style={{ color: '#6C767F' }}>{error}</p>
          <button
            onClick={() => loadReports()}
            className="px-4 py-2 rounded-lg text-white font-medium text-sm"
            style={{ backgroundColor: '#006666' }}
          >
            Reessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>Notes de frais</h1>
          <span className="text-sm px-2 py-1 rounded" style={{ backgroundColor: '#E4E5E7', color: '#6C767F' }}>
            {reports.length} note{reports.length > 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm"
          style={{ backgroundColor: '#006666' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle note de frais
        </button>
      </div>

      {/* Error banner */}
      {error && reports.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: '#6C767F' }}>Statut:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white"
            style={{ borderColor: '#D6D9DB' }}
          >
            <option value="">Tous</option>
            <option value="draft">Brouillon</option>
            <option value="submitted">Soumise</option>
            <option value="approved">Approuvee</option>
            <option value="rejected">Rejetee</option>
            <option value="paid">Payee</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: '#6C767F' }}>Du:</label>
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white"
            style={{ borderColor: '#D6D9DB' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: '#6C767F' }}>Au:</label>
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white"
            style={{ borderColor: '#D6D9DB' }}
          />
        </div>
        {(filterStatus || filterStartDate || filterEndDate) && (
          <button
            onClick={() => {
              setFilterStatus('')
              setFilterStartDate('')
              setFilterEndDate('')
            }}
            className="px-3 py-1.5 text-sm rounded-lg border"
            style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
          >
            Reinitialiser
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E5E7' }}>
          <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Total</p>
          <p className="text-xl font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(totalGlobal)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E5E7' }}>
          <p className="text-sm mb-1" style={{ color: '#6C767F' }}>En attente</p>
          <p className="text-xl font-semibold" style={{ color: '#92400E' }}>
            {formatCurrency((totalByStatus['submitted'] || 0) + (totalByStatus['draft'] || 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E5E7' }}>
          <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Approuvees</p>
          <p className="text-xl font-semibold" style={{ color: '#166534' }}>
            {formatCurrency(totalByStatus['approved'] || 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E5E7' }}>
          <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Payees</p>
          <p className="text-xl font-semibold" style={{ color: '#3F3F46' }}>
            {formatCurrency(totalByStatus['paid'] || 0)}
          </p>
        </div>
      </div>

      {/* Main content: List + Detail */}
      <div className="flex gap-6">
        {/* Reports list */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
            {reports.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#D6D9DB' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="font-medium mb-1" style={{ color: '#141A1F' }}>Aucune note de frais</p>
                <p className="text-sm" style={{ color: '#6C767F' }}>Creez votre premiere note de frais</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#F2F2F3' }}>
                {reports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => loadReportDetail(report.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedReport?.id === report.id ? 'bg-gray-50 border-l-4' : ''
                    }`}
                    style={{
                      borderLeftColor: selectedReport?.id === report.id ? '#006666' : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium" style={{ color: '#141A1F' }}>{report.number}</span>
                      <StatusBadge status={report.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: '#6C767F' }}>{formatDate(report.date)}</span>
                      <span className="font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(report.total_amount)}</span>
                    </div>
                    {report.notes && (
                      <p className="text-sm mt-2 truncate" style={{ color: '#6C767F' }}>{report.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedReport && (
          <div className="w-[500px] bg-white rounded-xl border" style={{ borderColor: '#E4E5E7' }}>
            {loadingDetail ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-semibold text-lg" style={{ color: '#141A1F' }}>{selectedReport.number}</h2>
                    <button
                      onClick={() => {
                        setSelectedReport(null)
                        setSelectedLines([])
                      }}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={selectedReport.status} />
                    <span className="text-sm" style={{ color: '#6C767F' }}>{formatDate(selectedReport.date)}</span>
                  </div>
                </div>

                {/* Lines table */}
                <div className="p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sm" style={{ color: '#141A1F' }}>Lignes de frais ({selectedLines.length})</h3>
                    {selectedReport.status === 'draft' && (
                      <button
                        onClick={() => setShowAddLineModal(true)}
                        className="text-sm px-2 py-1 rounded"
                        style={{ color: '#006666' }}
                      >
                        + Ajouter
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {selectedLines.length === 0 ? (
                      <p className="text-sm text-center py-4" style={{ color: '#6C767F' }}>Aucune ligne</p>
                    ) : (
                      selectedLines.map((line) => (
                        <div key={line.id} className="p-3 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <p className="font-medium text-sm" style={{ color: '#141A1F' }}>{line.description}</p>
                              <p className="text-xs" style={{ color: '#6C767F' }}>
                                {formatDate(line.date)} - {CATEGORY_OPTIONS.find((c) => c.value === line.category)?.label || line.category}
                              </p>
                            </div>
                            {selectedReport.status === 'draft' && (
                              <button
                                onClick={() => handleDeleteLine(line.id!)}
                                className="p-1 rounded hover:bg-gray-100"
                                disabled={actionLoading}
                              >
                                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span style={{ color: '#6C767F' }}>HT: {formatCurrency(line.amount_ht)} | TVA: {formatCurrency(line.amount_vat)}</span>
                            <span className="font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(line.amount_ttc)}</span>
                          </div>
                          {line.receipt_url && (
                            <a
                              href={line.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs mt-1 inline-block"
                              style={{ color: '#006666' }}
                            >
                              Voir justificatif
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm" style={{ color: '#6C767F' }}>Total HT</span>
                    <span className="text-sm" style={{ color: '#141A1F' }}>
                      {formatCurrency(selectedLines.reduce((s, l) => s + Number(l.amount_ht), 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm" style={{ color: '#6C767F' }}>Total TVA</span>
                    <span className="text-sm" style={{ color: '#141A1F' }}>
                      {formatCurrency(selectedReport.total_vat)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: '#E4E5E7' }}>
                    <span className="font-medium" style={{ color: '#141A1F' }}>Total TTC</span>
                    <span className="font-semibold text-lg" style={{ color: '#141A1F' }}>
                      {formatCurrency(selectedReport.total_amount)}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {selectedReport.notes && (
                  <div className="p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
                    <h3 className="font-medium text-sm mb-2" style={{ color: '#141A1F' }}>Notes</h3>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#6C767F' }}>{selectedReport.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedReport.status === 'draft' && (
                      <>
                        <button
                          onClick={handleSubmit}
                          disabled={actionLoading || selectedLines.length === 0}
                          className="flex-1 px-3 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                          style={{ backgroundColor: '#006666' }}
                        >
                          Soumettre
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={actionLoading}
                          className="px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-50"
                          style={{ borderColor: '#D6D9DB', color: '#991B1B' }}
                        >
                          Supprimer
                        </button>
                      </>
                    )}
                    {selectedReport.status === 'submitted' && (
                      <>
                        <button
                          onClick={handleApprove}
                          disabled={actionLoading}
                          className="flex-1 px-3 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                          style={{ backgroundColor: '#166534' }}
                        >
                          Approuver
                        </button>
                        <button
                          onClick={() => setShowRejectModal(true)}
                          disabled={actionLoading}
                          className="px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-50"
                          style={{ borderColor: '#D6D9DB', color: '#991B1B' }}
                        >
                          Rejeter
                        </button>
                      </>
                    )}
                    {selectedReport.status === 'approved' && (
                      <button
                        onClick={() => setShowPayModal(true)}
                        disabled={actionLoading}
                        className="flex-1 px-3 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                        style={{ backgroundColor: '#006666' }}
                      >
                        Marquer comme payee
                      </button>
                    )}
                    {selectedReport.status === 'rejected' && (
                      <button
                        onClick={handleRevertToDraft}
                        disabled={actionLoading}
                        className="flex-1 px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-50"
                        style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                      >
                        Remettre en brouillon
                      </button>
                    )}
                    {selectedReport.status === 'paid' && (
                      <p className="text-sm w-full text-center py-2" style={{ color: '#6C767F' }}>
                        Payee le {formatDate(selectedReport.paid_at || '')}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="font-semibold text-lg" style={{ color: '#141A1F' }}>Nouvelle note de frais</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded hover:bg-gray-100">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date</label>
                  <input
                    type="date"
                    value={newReportDate}
                    onChange={(e) => setNewReportDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Notes</label>
                  <input
                    type="text"
                    value={newReportNotes}
                    onChange={(e) => setNewReportNotes(e.target.value)}
                    placeholder="Notes optionnelles..."
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm" style={{ color: '#141A1F' }}>Lignes de frais</h3>
                  <button
                    onClick={() => setNewLines([...newLines, createEmptyLine()])}
                    className="text-sm px-2 py-1 rounded"
                    style={{ color: '#006666' }}
                  >
                    + Ajouter une ligne
                  </button>
                </div>
                <div className="space-y-3">
                  {newLines.map((line, idx) => (
                    <div key={idx} className="p-3 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <div>
                          <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Date</label>
                          <input
                            type="date"
                            value={line.date}
                            onChange={(e) => {
                              const updated = [...newLines]
                              updated[idx] = { ...line, date: e.target.value }
                              setNewLines(updated)
                            }}
                            className="w-full px-2 py-1 border rounded text-sm"
                            style={{ borderColor: '#D6D9DB' }}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Description</label>
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => {
                              const updated = [...newLines]
                              updated[idx] = { ...line, description: e.target.value }
                              setNewLines(updated)
                            }}
                            placeholder="Description..."
                            className="w-full px-2 py-1 border rounded text-sm"
                            style={{ borderColor: '#D6D9DB' }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Categorie</label>
                          <select
                            value={line.category}
                            onChange={(e) => {
                              const updated = [...newLines]
                              updated[idx] = { ...line, category: e.target.value }
                              setNewLines(updated)
                            }}
                            className="w-full px-2 py-1 border rounded text-sm"
                            style={{ borderColor: '#D6D9DB' }}
                          >
                            {CATEGORY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 items-end">
                        <div>
                          <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>TVA</label>
                          <select
                            value={line.vat_rate}
                            onChange={(e) => {
                              const updated = [...newLines]
                              const newRate = e.target.value
                              updated[idx] = calculateLineTotals({ ...line, vat_rate: newRate }, 'ttc')
                              setNewLines(updated)
                            }}
                            className="w-full px-2 py-1 border rounded text-sm"
                            style={{ borderColor: '#D6D9DB' }}
                          >
                            {VAT_RATE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Montant TTC</label>
                          <input
                            type="number"
                            step="0.01"
                            value={line.amount_ttc || ''}
                            onChange={(e) => {
                              const updated = [...newLines]
                              const newTtc = parseFloat(e.target.value) || 0
                              updated[idx] = calculateLineTotals({ ...line, amount_ttc: newTtc }, 'ttc')
                              setNewLines(updated)
                            }}
                            placeholder="0.00"
                            className="w-full px-2 py-1 border rounded text-sm"
                            style={{ borderColor: '#D6D9DB' }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>HT</label>
                          <input
                            type="number"
                            step="0.01"
                            value={line.amount_ht || ''}
                            readOnly
                            className="w-full px-2 py-1 border rounded text-sm bg-gray-50"
                            style={{ borderColor: '#D6D9DB' }}
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          {newLines.length > 1 && (
                            <button
                              onClick={() => setNewLines(newLines.filter((_, i) => i !== idx))}
                              className="p-1 rounded hover:bg-gray-100"
                            >
                              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg" style={{ backgroundColor: '#F5F5F5' }}>
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: '#141A1F' }}>Total TTC</span>
                  <span className="font-semibold text-lg" style={{ color: '#141A1F' }}>
                    {formatCurrency(newLines.reduce((s, l) => s + l.amount_ttc, 0))}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end gap-3" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || newLines.every((l) => !l.description || l.amount_ttc <= 0)}
                className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                style={{ backgroundColor: '#006666' }}
              >
                {creating ? 'Creation...' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Line Modal */}
      {showAddLineModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="font-semibold" style={{ color: '#141A1F' }}>Ajouter une ligne</h2>
              <button onClick={() => setShowAddLineModal(false)} className="p-1 rounded hover:bg-gray-100">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date</label>
                  <input
                    type="date"
                    value={newLine.date}
                    onChange={(e) => setNewLine({ ...newLine, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Categorie</label>
                  <select
                    value={newLine.category}
                    onChange={(e) => setNewLine({ ...newLine, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Description</label>
                <input
                  type="text"
                  value={newLine.description}
                  onChange={(e) => setNewLine({ ...newLine, description: e.target.value })}
                  placeholder="Description de la depense..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>TVA</label>
                  <select
                    value={newLine.vat_rate}
                    onChange={(e) => {
                      const updated = calculateLineTotals({ ...newLine, vat_rate: e.target.value }, 'ttc')
                      setNewLine(updated)
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  >
                    {VAT_RATE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Montant TTC</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newLine.amount_ttc || ''}
                    onChange={(e) => {
                      const updated = calculateLineTotals({ ...newLine, amount_ttc: parseFloat(e.target.value) || 0 }, 'ttc')
                      setNewLine(updated)
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>HT</label>
                  <input
                    type="number"
                    value={newLine.amount_ht || ''}
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end gap-3" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={() => setShowAddLineModal(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleAddLine}
                disabled={addingLine || !newLine.description || newLine.amount_ttc <= 0}
                className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                style={{ backgroundColor: '#006666' }}
              >
                {addingLine ? 'Ajout...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="font-semibold" style={{ color: '#141A1F' }}>Rejeter la note de frais</h2>
              <button onClick={() => setShowRejectModal(false)} className="p-1 rounded hover:bg-gray-100">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>Motif du rejet</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Indiquez le motif du rejet..."
                rows={4}
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>
            <div className="p-4 border-t flex items-center justify-end gap-3" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                style={{ backgroundColor: '#991B1B' }}
              >
                {actionLoading ? 'Rejet...' : 'Rejeter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {showPayModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="font-semibold" style={{ color: '#141A1F' }}>Marquer comme payee</h2>
              <button onClick={() => setShowPayModal(false)} className="p-1 rounded hover:bg-gray-100">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date de paiement</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Compte bancaire</label>
                <select
                  value={bankAccountCode}
                  onChange={(e) => setBankAccountCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                >
                  <option value="512000">512000 - Banque</option>
                  <option value="512100">512100 - Banque principale</option>
                  <option value="512200">512200 - Banque secondaire</option>
                </select>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#F5F5F5' }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#6C767F' }}>Montant a rembourser</span>
                  <span className="font-semibold" style={{ color: '#141A1F' }}>
                    {formatCurrency(selectedReport.total_amount)}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end gap-3" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={() => setShowPayModal(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={handlePay}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                style={{ backgroundColor: '#006666' }}
              >
                {actionLoading ? 'Enregistrement...' : 'Confirmer le paiement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
