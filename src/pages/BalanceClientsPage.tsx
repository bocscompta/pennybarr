import { useState, useEffect, useMemo } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'
import { getCustomerBalance, type BalanceEntry, type BalanceFilters } from '../services/balanceService'
import {
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  Filter,
  X,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react'

// Types
interface ThirdParty {
  id: string
  name: string
  code?: string
}

interface AccountingEntryRow {
  id: string
  date: string
  journal: string
  piece_number: string
  label: string
  debit: number
  credit: number
}

// Format number
const formatNumber = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Format date
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

interface BalanceClientsPageProps {
  onNavigate?: (page: string) => void
}

export default function BalanceClientsPage({ onNavigate: _onNavigate }: BalanceClientsPageProps) {
  // State
  const [balanceEntries, setBalanceEntries] = useState<BalanceEntry[]>([])
  const [customers, setCustomers] = useState<ThirdParty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Drill-down state
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null)
  const [accountEntries, setAccountEntries] = useState<AccountingEntryRow[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  // Export dropdown
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Fetch customers for filter dropdown
  useEffect(() => {
    async function fetchCustomers() {
      const { data, error } = await supabase
        .from('third_parties')
        .select('id, name, code')
        .eq('company_id', COMPANY_ID)
        .in('type', ['customer', 'both'])
        .order('name')

      if (!error && data) {
        setCustomers(data)
      }
    }
    fetchCustomers()
  }, [])

  // Fetch balance data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        const filters: BalanceFilters = {}
        if (startDate) filters.startDate = startDate
        if (endDate) filters.endDate = endDate
        if (selectedCustomerId) filters.customerId = selectedCustomerId

        const data = await getCustomerBalance(filters)
        setBalanceEntries(data)
      } catch (err) {
        console.error('Error fetching customer balance:', err)
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des donnees')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [startDate, endDate, selectedCustomerId])

  // Filter by search
  const filteredEntries = useMemo(() => {
    if (!searchQuery) return balanceEntries

    const query = searchQuery.toLowerCase()
    return balanceEntries.filter(
      entry =>
        entry.accountCode.toLowerCase().includes(query) ||
        entry.thirdPartyName.toLowerCase().includes(query)
    )
  }, [balanceEntries, searchQuery])

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage)
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredEntries.slice(start, start + itemsPerPage)
  }, [filteredEntries, currentPage])

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, startDate, endDate, selectedCustomerId])

  // Calculate totals
  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => ({
        debit: acc.debit + entry.debit,
        credit: acc.credit + entry.credit,
        balance: acc.balance + entry.balance,
      }),
      { debit: 0, credit: 0, balance: 0 }
    )
  }, [filteredEntries])

  // Fetch entries for drill-down
  const fetchAccountEntries = async (accountCode: string) => {
    if (expandedAccount === accountCode) {
      setExpandedAccount(null)
      setAccountEntries([])
      return
    }

    setLoadingEntries(true)
    setExpandedAccount(accountCode)

    try {
      let query = supabase
        .from('accounting_entries')
        .select('id, date, journal, piece_number, label, debit, credit')
        .eq('company_id', COMPANY_ID)
        .eq('account_code', accountCode)
        .order('date', { ascending: true })
        .order('piece_number', { ascending: true })

      if (startDate) query = query.gte('date', startDate)
      if (endDate) query = query.lte('date', endDate)

      const { data, error } = await query

      if (error) {
        throw new Error(error.message)
      }

      setAccountEntries(data || [])
    } catch (err) {
      console.error('Error fetching account entries:', err)
      setAccountEntries([])
    } finally {
      setLoadingEntries(false)
    }
  }

  // Export to PDF
  const handleExportPDF = async () => {
    setExporting(true)
    setShowExportDropdown(false)

    try {
      // Dynamic imports for code splitting
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 15

      // Header
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Balance Clients', margin, 20)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')

      let periodText = 'Toutes periodes'
      if (startDate && endDate) {
        periodText = `Du ${formatDate(startDate)} au ${formatDate(endDate)}`
      } else if (startDate) {
        periodText = `A partir du ${formatDate(startDate)}`
      } else if (endDate) {
        periodText = `Jusqu'au ${formatDate(endDate)}`
      }
      doc.text(periodText, margin, 28)

      // Date d'edition
      const today = new Date().toLocaleDateString('fr-FR')
      doc.setFontSize(8)
      doc.text(`Edition le ${today}`, pageWidth - margin - 30, 20)

      // Table
      const tableData = filteredEntries.map(entry => [
        entry.accountCode,
        entry.thirdPartyName,
        formatNumber(entry.debit),
        formatNumber(entry.credit),
        formatNumber(entry.balance),
      ])

      // Add totals row
      tableData.push([
        '',
        'TOTAL',
        formatNumber(totals.debit),
        formatNumber(totals.credit),
        formatNumber(totals.balance),
      ])

      autoTable(doc, {
        startY: 40,
        head: [['Code compte', 'Nom client', 'Debit', 'Credit', 'Solde']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 70 },
          2: { halign: 'right', cellWidth: 30 },
          3: { halign: 'right', cellWidth: 30 },
          4: { halign: 'right', cellWidth: 30 },
        },
        didParseCell: data => {
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      const filename = `balance_clients_${startDate || 'all'}_${endDate || 'all'}.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('Erreur export PDF:', err)
      alert("Erreur lors de l'export PDF: " + (err instanceof Error ? err.message : 'Erreur inconnue'))
    } finally {
      setExporting(false)
    }
  }

  // Export to CSV
  const handleExportCSV = async () => {
    setExporting(true)
    setShowExportDropdown(false)

    try {
      const headers = ['Code compte', 'Nom client', 'Debit', 'Credit', 'Solde']
      const rows = filteredEntries.map(entry => [
        entry.accountCode,
        `"${entry.thirdPartyName}"`,
        formatNumber(entry.debit),
        formatNumber(entry.credit),
        formatNumber(entry.balance),
      ])

      // Add totals
      rows.push(['', 'TOTAL', formatNumber(totals.debit), formatNumber(totals.credit), formatNumber(totals.balance)])

      const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\r\n')

      // BOM for Excel UTF-8 compatibility
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `balance_clients_${startDate || 'all'}_${endDate || 'all'}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur export CSV:', err)
      alert("Erreur lors de l'export CSV: " + (err instanceof Error ? err.message : 'Erreur inconnue'))
    } finally {
      setExporting(false)
    }
  }

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('')
    setStartDate('')
    setEndDate('')
    setSelectedCustomerId('')
  }

  const hasActiveFilters = searchQuery || startDate || endDate || selectedCustomerId

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#E6F2F2' }}
              >
                <Users className="w-5 h-5" style={{ color: '#006666' }} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
                  Balance Clients
                </h1>
                <p className="text-sm" style={{ color: '#6C767F' }}>
                  Comptes auxiliaires 411xxx
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={exporting || filteredEntries.length === 0}
                className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm disabled:opacity-50 transition-colors hover:bg-gray-50"
                style={{ borderColor: '#006666', color: '#006666' }}
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Exporter
                <ChevronDown className="w-4 h-4" />
              </button>
              {showExportDropdown && (
                <div
                  className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-50"
                  style={{ borderColor: '#E4E5E7' }}
                >
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 border-b"
                    style={{ borderColor: '#F2F2F3', color: '#141A1F' }}
                  >
                    <FileText className="w-4 h-4 text-red-500" />
                    PDF (.pdf)
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50"
                    style={{ color: '#141A1F' }}
                  >
                    <FileText className="w-4 h-4 text-green-600" />
                    CSV (.csv)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Filters bar */}
      <div className="bg-white border-b px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6C767F' }} />
            <input
              type="text"
              placeholder="Rechercher par code ou nom..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006666]/20 focus:border-[#006666]"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          {/* Toggle filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
              hasActiveFilters ? 'bg-[#E6F2F2] border-[#006666]' : 'hover:bg-gray-50'
            }`}
            style={{ borderColor: hasActiveFilters ? '#006666' : '#D6D9DB', color: '#141A1F' }}
          >
            <Filter className="w-4 h-4" />
            Filtres
            {hasActiveFilters && (
              <span
                className="w-5 h-5 rounded-full text-xs flex items-center justify-center text-white"
                style={{ backgroundColor: '#006666' }}
              >
                {[searchQuery, startDate, endDate, selectedCustomerId].filter(Boolean).length}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1 text-sm hover:bg-gray-100 rounded"
              style={{ color: '#6C767F' }}
            >
              <X className="w-3 h-3" />
              Effacer
            </button>
          )}

          <div className="flex-1" />

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm" style={{ color: '#6C767F' }}>
            <span>{filteredEntries.length} client{filteredEntries.length > 1 ? 's' : ''}</span>
            <span className="text-xs">|</span>
            <span>
              Solde total:{' '}
              <span className="font-semibold" style={{ color: totals.balance >= 0 ? '#006666' : '#DC2626' }}>
                {formatNumber(totals.balance)} EUR
              </span>
            </span>
          </div>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t flex items-center gap-4" style={{ borderColor: '#F2F2F3' }}>
            {/* Date range */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: '#6C767F' }} />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#006666]/20 focus:border-[#006666]"
                style={{ borderColor: '#D6D9DB' }}
              />
              <span className="text-sm" style={{ color: '#6C767F' }}>
                au
              </span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#006666]/20 focus:border-[#006666]"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>

            {/* Customer filter */}
            <select
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-[#006666]/20 focus:border-[#006666]"
              style={{ borderColor: '#D6D9DB' }}
            >
              <option value="">Tous les clients</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.code ? `${customer.code} - ` : ''}
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[900px]">
          {/* Table header */}
          <div className="sticky top-0 bg-white border-b z-10" style={{ borderColor: '#E4E5E7' }}>
            <div className="grid grid-cols-12 gap-4 px-6 py-3">
              <div className="col-span-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                Code compte
              </div>
              <div className="col-span-4 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                Nom client
              </div>
              <div className="col-span-2 text-xs font-medium uppercase text-right" style={{ color: '#6C767F' }}>
                Debit
              </div>
              <div className="col-span-2 text-xs font-medium uppercase text-right" style={{ color: '#6C767F' }}>
                Credit
              </div>
              <div className="col-span-2 text-xs font-medium uppercase text-right" style={{ color: '#6C767F' }}>
                Solde
              </div>
            </div>
          </div>

          {/* Table body */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#006666' }} />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <p className="text-sm" style={{ color: '#DC2626' }}>
                {error}
              </p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Users className="w-12 h-12" style={{ color: '#D6D9DB' }} />
              <p className="text-sm" style={{ color: '#6C767F' }}>
                Aucun compte client avec solde
              </p>
            </div>
          ) : (
            <div>
              {paginatedEntries.map(entry => (
                <div key={entry.accountCode}>
                  {/* Main row */}
                  <button
                    onClick={() => fetchAccountEntries(entry.accountCode)}
                    className="w-full grid grid-cols-12 gap-4 px-6 py-3 hover:bg-gray-50 border-b transition-colors text-left"
                    style={{ borderColor: '#F2F2F3' }}
                  >
                    <div className="col-span-2 flex items-center gap-2">
                      {expandedAccount === entry.accountCode ? (
                        <ChevronDown className="w-4 h-4" style={{ color: '#6C767F' }} />
                      ) : (
                        <ChevronRight className="w-4 h-4" style={{ color: '#6C767F' }} />
                      )}
                      <span className="text-sm font-medium" style={{ color: '#006666' }}>
                        {entry.accountCode}
                      </span>
                    </div>
                    <div className="col-span-4">
                      <span className="text-sm" style={{ color: '#141A1F' }}>
                        {entry.thirdPartyName}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span
                        className="text-sm font-mono flex items-center justify-end gap-1"
                        style={{ color: entry.debit > 0 ? '#141A1F' : '#D6D9DB' }}
                      >
                        {entry.debit > 0 && <ArrowUpRight className="w-3 h-3 text-green-600" />}
                        {entry.debit > 0 ? formatNumber(entry.debit) : '—'}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span
                        className="text-sm font-mono flex items-center justify-end gap-1"
                        style={{ color: entry.credit > 0 ? '#141A1F' : '#D6D9DB' }}
                      >
                        {entry.credit > 0 && <ArrowDownLeft className="w-3 h-3 text-red-500" />}
                        {entry.credit > 0 ? formatNumber(entry.credit) : '—'}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span
                        className="text-sm font-mono font-semibold"
                        style={{ color: entry.balance >= 0 ? '#006666' : '#DC2626' }}
                      >
                        {formatNumber(entry.balance)}
                      </span>
                    </div>
                  </button>

                  {/* Expanded entries (drill-down) */}
                  {expandedAccount === entry.accountCode && (
                    <div className="bg-gray-50 border-b" style={{ borderColor: '#E4E5E7' }}>
                      {loadingEntries ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#006666' }} />
                        </div>
                      ) : accountEntries.length === 0 ? (
                        <div className="px-6 py-4 text-sm" style={{ color: '#6C767F' }}>
                          Aucune ecriture pour ce compte
                        </div>
                      ) : (
                        <div className="px-6 py-2">
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ color: '#6C767F' }}>
                                <th className="text-left py-2 font-medium">Date</th>
                                <th className="text-left py-2 font-medium">Journal</th>
                                <th className="text-left py-2 font-medium">Piece</th>
                                <th className="text-left py-2 font-medium">Libelle</th>
                                <th className="text-right py-2 font-medium">Debit</th>
                                <th className="text-right py-2 font-medium">Credit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {accountEntries.map(ae => (
                                <tr
                                  key={ae.id}
                                  className="border-t hover:bg-white transition-colors"
                                  style={{ borderColor: '#E4E5E7' }}
                                >
                                  <td className="py-2" style={{ color: '#141A1F' }}>
                                    {formatDate(ae.date)}
                                  </td>
                                  <td className="py-2">
                                    <span
                                      className="px-2 py-0.5 rounded text-xs font-medium"
                                      style={{ backgroundColor: '#E6F2F2', color: '#006666' }}
                                    >
                                      {ae.journal}
                                    </span>
                                  </td>
                                  <td className="py-2" style={{ color: '#6C767F' }}>
                                    {ae.piece_number || '—'}
                                  </td>
                                  <td className="py-2" style={{ color: '#141A1F' }}>
                                    {ae.label}
                                  </td>
                                  <td className="py-2 text-right font-mono" style={{ color: '#141A1F' }}>
                                    {ae.debit > 0 ? formatNumber(ae.debit) : '—'}
                                  </td>
                                  <td className="py-2 text-right font-mono" style={{ color: '#141A1F' }}>
                                    {ae.credit > 0 ? formatNumber(ae.credit) : '—'}
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
              ))}

              {/* Total footer */}
              <div className="sticky bottom-0 bg-white border-t-2" style={{ borderColor: '#006666' }}>
                <div className="grid grid-cols-12 gap-4 px-6 py-4">
                  <div className="col-span-2" />
                  <div className="col-span-4">
                    <span className="font-semibold" style={{ color: '#141A1F' }}>
                      Total general
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="font-bold" style={{ color: '#141A1F' }}>
                      {formatNumber(totals.debit)}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="font-bold" style={{ color: '#141A1F' }}>
                      {formatNumber(totals.credit)}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="font-bold" style={{ color: totals.balance >= 0 ? '#006666' : '#DC2626' }}>
                      {formatNumber(totals.balance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white border-t px-6 py-3 flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
          <div className="text-sm" style={{ color: '#6C767F' }}>
            Page {currentPage} sur {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#D6D9DB' }}
            >
              Precedent
            </button>
            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'text-white'
                        : 'hover:bg-gray-100'
                    }`}
                    style={{
                      backgroundColor: currentPage === pageNum ? '#006666' : 'transparent',
                      color: currentPage === pageNum ? 'white' : '#141A1F',
                    }}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#D6D9DB' }}
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close export dropdown */}
      {showExportDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
      )}
    </div>
  )
}
