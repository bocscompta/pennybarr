import { useState, useEffect, useMemo } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { exportToPDF, type ExportFilters } from '../services/exportService'

// ============ Types ============

interface AccountingEntry {
  id: string
  date: string
  account_code: string
  label: string
  debit: number
  credit: number
  journal: string
}

interface ChartOfAccount {
  code: string
  label: string
  type: string
}

interface AnalyticData {
  code: string
  label: string
  charges: number
  produits: number
  resultat: number
}

// Interfaces pour usage futur
// interface MonthlyData { month: string; monthLabel: string; charges: number; produits: number }
// interface BudgetData { code: string; label: string; budgetCharges: number; realiseCharges: number; ecartCharges: number; budgetProduits: number; realiseProduits: number; ecartProduits: number }

// ============ Constants ============

// Stone palette - anti-AI design
const COLORS = ['#78716c', '#a8a29e', '#d6d3d1', '#57534e', '#44403c', '#292524', '#e7e5e4', '#1c1917']

// Account class names
const CLASS_NAMES: Record<string, string> = {
  '60': 'Achats',
  '61': 'Services extérieurs',
  '62': 'Autres services extérieurs',
  '63': 'Impôts et taxes',
  '64': 'Charges de personnel',
  '65': 'Autres charges de gestion',
  '66': 'Charges financières',
  '67': 'Charges exceptionnelles',
  '68': 'Dotations aux amortissements',
  '69': 'Participation et impôts sur bénéfices',
  '70': 'Ventes de produits/services',
  '71': 'Production stockée',
  '72': 'Production immobilisée',
  '73': 'Produits nets partiels',
  '74': 'Subventions d\'exploitation',
  '75': 'Autres produits de gestion',
  '76': 'Produits financiers',
  '77': 'Produits exceptionnels',
  '78': 'Reprises sur amortissements',
  '79': 'Transferts de charges',
}

// ============ Helper Functions ============

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

const getMonthLabel = (monthStr: string) => {
  const [year, month] = monthStr.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

// ============ Component ============

interface RapportsAnalytiquesPageProps {
  onNavigate?: (page: string) => void
}

export default function RapportsAnalytiquesPage({ onNavigate: _onNavigate }: RapportsAnalytiquesPageProps) {
  // State
  const [entries, setEntries] = useState<AccountingEntry[]>([])
  const [_accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 11)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`
  })
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<'all' | 'charges' | 'produits'>('all')

  // Sorting
  const [sortColumn, setSortColumn] = useState<'code' | 'label' | 'charges' | 'produits' | 'resultat'>('code')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // View mode
  const [viewMode, setViewMode] = useState<'table' | 'charts'>('table')

  // ============ Data Fetching ============

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // Fetch accounting entries (class 6 and 7 only)
        const { data: entriesData, error: entriesError } = await supabase
          .from('accounting_entries')
          .select('id, date, account_code, label, debit, credit, journal')
          .eq('company_id', COMPANY_ID)
          .gte('date', startDate)
          .lte('date', endDate)
          .or('account_code.like.6%,account_code.like.7%')
          .order('date', { ascending: true })

        if (entriesError) {
          console.error('Error fetching entries:', entriesError)
          throw new Error(`Erreur chargement écritures: ${entriesError.message}`)
        }

        // Fetch chart of accounts
        const { data: accountsData, error: accountsError } = await supabase
          .from('chart_of_accounts')
          .select('code, label, type')
          .eq('company_id', COMPANY_ID)
          .or('code.like.6%,code.like.7%')
          .order('code')

        if (accountsError) {
          console.error('Error fetching accounts:', accountsError)
          throw new Error(`Erreur chargement comptes: ${accountsError.message}`)
        }

        setEntries(entriesData || [])
        setAccounts(accountsData || [])
      } catch (err) {
        console.error('Error in fetchData:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [startDate, endDate])

  // ============ Computed Data ============

  // Get unique analytic codes (first 2 digits of account codes)
  const analyticCodes = useMemo(() => {
    const codes = new Set<string>()
    entries.forEach(entry => {
      const code = entry.account_code.substring(0, 2)
      if (code.startsWith('6') || code.startsWith('7')) {
        codes.add(code)
      }
    })
    return Array.from(codes).sort()
  }, [entries])

  // Calculate data by analytic code
  const analyticData = useMemo(() => {
    const data: Record<string, { charges: number; produits: number }> = {}

    entries.forEach(entry => {
      const code = entry.account_code.substring(0, 2)

      // Apply code filter
      if (selectedCodes.length > 0 && !selectedCodes.includes(code)) {
        return
      }

      if (!data[code]) {
        data[code] = { charges: 0, produits: 0 }
      }

      const amount = (entry.debit || 0) - (entry.credit || 0)

      if (code.startsWith('6')) {
        // Charges: debit increases, credit decreases
        data[code].charges += amount
      } else if (code.startsWith('7')) {
        // Products: credit increases, debit decreases
        data[code].produits += -amount
      }
    })

    // Convert to array with labels
    const result: AnalyticData[] = Object.entries(data).map(([code, values]) => ({
      code,
      label: CLASS_NAMES[code] || `Classe ${code}`,
      charges: Math.max(0, values.charges),
      produits: Math.max(0, values.produits),
      resultat: values.produits - values.charges,
    }))

    // Apply type filter
    let filtered = result
    if (typeFilter === 'charges') {
      filtered = result.filter(d => d.code.startsWith('6'))
    } else if (typeFilter === 'produits') {
      filtered = result.filter(d => d.code.startsWith('7'))
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortColumn) {
        case 'code':
          comparison = a.code.localeCompare(b.code)
          break
        case 'label':
          comparison = a.label.localeCompare(b.label)
          break
        case 'charges':
          comparison = a.charges - b.charges
          break
        case 'produits':
          comparison = a.produits - b.produits
          break
        case 'resultat':
          comparison = a.resultat - b.resultat
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [entries, selectedCodes, typeFilter, sortColumn, sortDirection])

  // Calculate totals
  const totals = useMemo(() => {
    return analyticData.reduce(
      (acc, row) => ({
        charges: acc.charges + row.charges,
        produits: acc.produits + row.produits,
        resultat: acc.resultat + row.resultat,
      }),
      { charges: 0, produits: 0, resultat: 0 }
    )
  }, [analyticData])

  // Monthly data for evolution chart
  const monthlyData = useMemo(() => {
    const data: Record<string, { charges: number; produits: number }> = {}

    entries.forEach(entry => {
      const code = entry.account_code.substring(0, 2)

      // Apply code filter
      if (selectedCodes.length > 0 && !selectedCodes.includes(code)) {
        return
      }

      const month = entry.date.substring(0, 7) // YYYY-MM

      if (!data[month]) {
        data[month] = { charges: 0, produits: 0 }
      }

      const amount = (entry.debit || 0) - (entry.credit || 0)

      if (code.startsWith('6')) {
        data[month].charges += Math.max(0, amount)
      } else if (code.startsWith('7')) {
        data[month].produits += Math.max(0, -amount)
      }
    })

    // Convert to array and sort by month
    return Object.entries(data)
      .map(([month, values]) => ({
        month,
        monthLabel: getMonthLabel(month),
        ...values,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [entries, selectedCodes])

  // Pie chart data (charges breakdown)
  const pieData = useMemo(() => {
    return analyticData
      .filter(d => d.code.startsWith('6') && d.charges > 0)
      .map(d => ({
        name: d.label,
        value: d.charges,
      }))
      .sort((a, b) => b.value - a.value)
  }, [analyticData])

  // ============ Handlers ============

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const handleCodeToggle = (code: string) => {
    setSelectedCodes(prev => {
      if (prev.includes(code)) {
        return prev.filter(c => c !== code)
      } else {
        return [...prev, code]
      }
    })
  }

  const handleSelectAllCodes = () => {
    if (selectedCodes.length === analyticCodes.length) {
      setSelectedCodes([])
    } else {
      setSelectedCodes([...analyticCodes])
    }
  }

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      // Generate CSV content
      const headers = ['Code', 'Libelle', 'Charges', 'Produits', 'Resultat']
      const rows = analyticData.map(row => [
        row.code,
        `"${row.label}"`,
        formatNumber(row.charges),
        formatNumber(row.produits),
        formatNumber(row.resultat),
      ])

      // Add totals
      rows.push(['', 'TOTAL', formatNumber(totals.charges), formatNumber(totals.produits), formatNumber(totals.resultat)])

      const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\r\n')

      // Download
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `rapport_analytique_${startDate}_${endDate}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export CSV error:', err)
      throw new Error(`Erreur export CSV: ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
    } finally {
      setExporting(false)
    }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const filters: ExportFilters = {
        startDate,
        endDate,
      }
      await exportToPDF('balance', filters)
    } catch (err) {
      console.error('Export PDF error:', err)
    } finally {
      setExporting(false)
    }
  }

  // ============ Render ============

  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      )
    }
    return (
      <svg className="w-4 h-4 text-stone-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={sortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
        />
      </svg>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
              Rapports analytiques
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border rounded-lg overflow-hidden" style={{ borderColor: '#D6D9DB' }}>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-sm ${viewMode === 'table' ? 'bg-stone-600 text-white' : 'bg-white text-stone-600'}`}
              >
                Tableau
              </button>
              <button
                onClick={() => setViewMode('charts')}
                className={`px-3 py-2 text-sm ${viewMode === 'charts' ? 'bg-stone-600 text-white' : 'bg-white text-stone-600'}`}
              >
                Graphiques
              </button>
            </div>

            {/* Export buttons */}
            <button
              onClick={handleExportCSV}
              disabled={exporting || analyticData.length === 0}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm disabled:opacity-50"
              style={{ borderColor: '#78716c', color: '#78716c' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              CSV
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting || analyticData.length === 0}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm disabled:opacity-50"
              style={{ borderColor: '#78716c', color: '#78716c' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              PDF
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex flex-wrap items-center gap-4">
          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={{ color: '#6C767F' }}>
              Période
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
            <span className="text-sm" style={{ color: '#6C767F' }}>
              au
            </span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={{ color: '#6C767F' }}>
              Type
            </label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
              className="px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            >
              <option value="all">Tous</option>
              <option value="charges">Charges (6x)</option>
              <option value="produits">Produits (7x)</option>
            </select>
          </div>

          {/* Code filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={{ color: '#6C767F' }}>
              Codes
            </label>
            <div className="relative">
              <button
                onClick={handleSelectAllCodes}
                className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2"
                style={{ borderColor: '#D6D9DB' }}
              >
                {selectedCodes.length === 0
                  ? 'Tous les codes'
                  : selectedCodes.length === analyticCodes.length
                    ? 'Tous les codes'
                    : `${selectedCodes.length} code${selectedCodes.length > 1 ? 's' : ''}`}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Code pills */}
          {analyticCodes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {analyticCodes.map(code => (
                <button
                  key={code}
                  onClick={() => handleCodeToggle(code)}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                    selectedCodes.length === 0 || selectedCodes.includes(code)
                      ? 'bg-stone-100 border-stone-400 text-stone-700'
                      : 'bg-white border-stone-200 text-stone-400'
                  }`}
                >
                  {code} - {CLASS_NAMES[code] || `Classe ${code}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#78716c' }} />
          </div>
        ) : viewMode === 'table' ? (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
                <div className="text-sm font-medium" style={{ color: '#6C767F' }}>
                  Total Charges
                </div>
                <div className="text-2xl font-semibold mt-1" style={{ color: '#44403c' }}>
                  {formatCurrency(totals.charges)}
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
                <div className="text-sm font-medium" style={{ color: '#6C767F' }}>
                  Total Produits
                </div>
                <div className="text-2xl font-semibold mt-1" style={{ color: '#57534e' }}>
                  {formatCurrency(totals.produits)}
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
                <div className="text-sm font-medium" style={{ color: '#6C767F' }}>
                  Résultat
                </div>
                <div
                  className="text-2xl font-semibold mt-1"
                  style={{ color: totals.resultat >= 0 ? '#57534e' : '#b91c1c' }}
                >
                  {formatCurrency(totals.resultat)}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#F9FAFB' }}>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('code')}
                        className="flex items-center gap-1 text-xs font-medium uppercase"
                        style={{ color: '#6C767F' }}
                      >
                        Code
                        <SortIcon column="code" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('label')}
                        className="flex items-center gap-1 text-xs font-medium uppercase"
                        style={{ color: '#6C767F' }}
                      >
                        Libelle
                        <SortIcon column="label" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('charges')}
                        className="flex items-center gap-1 text-xs font-medium uppercase justify-end w-full"
                        style={{ color: '#6C767F' }}
                      >
                        Charges
                        <SortIcon column="charges" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('produits')}
                        className="flex items-center gap-1 text-xs font-medium uppercase justify-end w-full"
                        style={{ color: '#6C767F' }}
                      >
                        Produits
                        <SortIcon column="produits" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('resultat')}
                        className="flex items-center gap-1 text-xs font-medium uppercase justify-end w-full"
                        style={{ color: '#6C767F' }}
                      >
                        Resultat
                        <SortIcon column="resultat" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analyticData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#6C767F' }}>
                        Aucune donnee pour la periode selectionnee
                      </td>
                    </tr>
                  ) : (
                    <>
                      {analyticData.map(row => (
                        <tr
                          key={row.code}
                          className="border-b hover:bg-stone-50"
                          style={{ borderColor: '#F2F2F3' }}
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium" style={{ color: '#78716c' }}>
                              {row.code}
                            </span>
                          </td>
                          <td className="px-4 py-3" style={{ color: '#141A1F' }}>
                            {row.label}
                          </td>
                          <td className="px-4 py-3 text-right font-mono" style={{ color: row.charges > 0 ? '#44403c' : '#D6D9DB' }}>
                            {row.charges > 0 ? formatNumber(row.charges) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono" style={{ color: row.produits > 0 ? '#57534e' : '#D6D9DB' }}>
                            {row.produits > 0 ? formatNumber(row.produits) : '—'}
                          </td>
                          <td
                            className="px-4 py-3 text-right font-mono font-medium"
                            style={{ color: row.resultat >= 0 ? '#57534e' : '#b91c1c' }}
                          >
                            {formatNumber(row.resultat)}
                          </td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr className="bg-stone-50 border-t-2" style={{ borderColor: '#78716c' }}>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 font-semibold" style={{ color: '#141A1F' }}>
                          Total
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: '#44403c' }}>
                          {formatNumber(totals.charges)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: '#57534e' }}>
                          {formatNumber(totals.produits)}
                        </td>
                        <td
                          className="px-4 py-3 text-right font-mono font-bold"
                          style={{ color: totals.resultat >= 0 ? '#57534e' : '#b91c1c' }}
                        >
                          {formatNumber(totals.resultat)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Charts view */}
            <div className="grid grid-cols-2 gap-6">
              {/* Pie chart - Charges breakdown */}
              <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
                  Repartition des charges
                </h3>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatCurrency(value as number)}
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #E4E5E7', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center" style={{ color: '#6C767F' }}>
                    Aucune charge pour la periode
                  </div>
                )}
              </div>

              {/* Bar chart - Comparison */}
              <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
                  Charges vs Produits par categorie
                </h3>
                {analyticData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={analyticData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <XAxis type="number" tickFormatter={(value) => formatNumber(value as number)} />
                      <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) => formatCurrency(value as number)}
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #E4E5E7', borderRadius: '8px' }}
                      />
                      <Legend />
                      <Bar dataKey="charges" name="Charges" fill="#78716c" />
                      <Bar dataKey="produits" name="Produits" fill="#a8a29e" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center" style={{ color: '#6C767F' }}>
                    Aucune donnee pour la periode
                  </div>
                )}
              </div>
            </div>

            {/* Evolution chart */}
            <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
                Evolution mensuelle
              </h3>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="monthLabel" />
                    <YAxis tickFormatter={(value) => formatNumber(value as number)} />
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #E4E5E7', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="charges"
                      name="Charges"
                      stroke="#57534e"
                      strokeWidth={2}
                      dot={{ fill: '#57534e', strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="produits"
                      name="Produits"
                      stroke="#a8a29e"
                      strokeWidth={2}
                      dot={{ fill: '#a8a29e', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center" style={{ color: '#6C767F' }}>
                  Aucune donnee pour la periode
                </div>
              )}
            </div>

            {/* Budget comparison (placeholder - would need budget data) */}
            <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
                Budget vs Realise
              </h3>
              <div className="h-[200px] flex items-center justify-center flex-col gap-2" style={{ color: '#6C767F' }}>
                <svg className="w-12 h-12 text-stone-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <p className="text-sm">La comparaison budgetaire necessite des donnees de budget.</p>
                <p className="text-xs">Configurez vos budgets dans les parametres pour activer cette fonctionnalite.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
