import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'

interface AccountingEntry {
  id: string
  account_code: string
  debit: number
  credit: number
  date: string
}

interface ChartOfAccount {
  id: string
  code: string
  label: string
  type: string
}

interface BalanceRow {
  code: string
  label: string
  entryCount: number
  debit: number
  credit: number
  solde: number
  soldeN1: number | null
  variation: number | null
}

// Format number with French locale
const formatNumber = (value: number | null): string => {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

// Format number with color (green positive, red negative)
const formatNumberWithColor = (value: number | null): { text: string; color: string } => {
  if (value === null || value === undefined) return { text: '—', color: '#9CA3AF' }
  const text = formatNumber(value)
  if (value > 0) return { text, color: '#059669' }
  if (value < 0) return { text, color: '#DC2626' }
  return { text: '—', color: '#9CA3AF' }
}

// Icons
const ChevronDownIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
)

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
)

const SettingsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
  </svg>
)

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
)

const TableIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
  </svg>
)

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
)

const WarningIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
)

interface BalanceGeneralePageProps {
  onNavigate?: (page: string) => void
}

export default function BalanceGeneralePage({ onNavigate: _onNavigate }: BalanceGeneralePageProps) {
  const [entries, setEntries] = useState<AccountingEntry[]>([])
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<'code' | 'label' | 'debit' | 'credit' | 'solde'>('code')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    comptes: true,
    lettrage: false,
    debit: true,
    credit: true,
    solde: true,
  })

  // Exercise/Period selection
  const [showExerciceDropdown, setShowExerciceDropdown] = useState(false)
  const [hoveredExercice, setHoveredExercice] = useState<string | null>(null)
  const [selectedExercice, setSelectedExercice] = useState('2026')
  const [selectedPeriod, setSelectedPeriod] = useState<'full' | 'month'>('month')
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = January
  const [selectedYear, setSelectedYear] = useState(2026) // Year for multi-year exercises
  const [showCustomDates, setShowCustomDates] = useState(false)

  // French month names
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ]

  // Define available exercises with their month ranges
  interface ExerciceType {
    id: string
    label: string
    year: number
    isMultiYear?: boolean
    startMonth?: number // 0-indexed, for multi-year (e.g., April = 3)
    endYear?: number
  }

  const exercices: ExerciceType[] = [
    { id: '2028', label: 'Exercice 2028', year: 2028 },
    { id: '2027', label: 'Exercice 2027', year: 2027 },
    { id: '2026', label: 'Exercice 2026', year: 2026 },
    { id: '2025', label: 'Exercice 2025', year: 2025 },
    { id: '2024-2025', label: 'Exercice 2024-2025', year: 2024, isMultiYear: true, startMonth: 3, endYear: 2025 },
  ]

  // Generate months for an exercise
  const getExerciceMonths = (exercice: ExerciceType): { month: number; year: number; label: string }[] => {
    const months: { month: number; year: number; label: string }[] = []

    if (exercice.isMultiYear && exercice.endYear) {
      // Multi-year exercise: from startMonth of year to December of endYear
      const startMonth = exercice.startMonth || 0
      // First year months
      for (let m = startMonth; m < 12; m++) {
        months.push({ month: m, year: exercice.year, label: `${monthNames[m]} ${exercice.year}` })
      }
      // Second year months (January to December)
      for (let m = 0; m < 12; m++) {
        months.push({ month: m, year: exercice.endYear, label: `${monthNames[m]} ${exercice.endYear}` })
      }
    } else {
      // Single year exercise: January to December
      for (let m = 0; m < 12; m++) {
        months.push({ month: m, year: exercice.year, label: `${monthNames[m]} ${exercice.year}` })
      }
    }

    return months
  }

  const [startDate, setStartDate] = useState('2026-01-01')
  const [endDate, setEndDate] = useState('2026-01-31')

  // Get display label for current selection
  const getPeriodLabel = () => {
    if (selectedPeriod === 'full') {
      return `Exercice ${selectedExercice}`
    }
    return `${monthNames[selectedMonth]} ${selectedYear}`
  }

  // Handle exercise complete selection
  const handleExerciceComplete = (exerciceId: string) => {
    setSelectedExercice(exerciceId)
    setSelectedPeriod('full')
    const exercice = exercices.find(e => e.id === exerciceId)
    if (exercice) {
      if (exercice.isMultiYear && exercice.endYear) {
        const startMonth = exercice.startMonth || 0
        setStartDate(`${exercice.year}-${String(startMonth + 1).padStart(2, '0')}-01`)
        setEndDate(`${exercice.endYear}-12-31`)
      } else {
        setStartDate(`${exercice.year}-01-01`)
        setEndDate(`${exercice.year}-12-31`)
      }
    }
    setShowExerciceDropdown(false)
    setHoveredExercice(null)
  }

  // Handle month selection
  const handleMonthSelect = (exerciceId: string, monthIndex: number, year: number) => {
    setSelectedExercice(exerciceId)
    setSelectedPeriod('month')
    setSelectedMonth(monthIndex)
    setSelectedYear(year)

    const month = String(monthIndex + 1).padStart(2, '0')
    const lastDay = new Date(year, monthIndex + 1, 0).getDate()

    setStartDate(`${year}-${month}-01`)
    setEndDate(`${year}-${month}-${lastDay}`)
    setShowExerciceDropdown(false)
    setHoveredExercice(null)
  }

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const PAGE_SIZE = 1000
      let allEntries: AccountingEntry[] = []
      let page = 0
      let hasMore = true

      while (hasMore) {
        const from = page * PAGE_SIZE
        const to = from + PAGE_SIZE - 1

        const { data, error } = await supabase
          .from('accounting_entries')
          .select('id, account_code, debit, credit, date')
          .eq('company_id', COMPANY_ID)
          .gte('date', startDate)
          .lte('date', endDate)
          .range(from, to)

        if (error) throw error
        if (!data || data.length === 0) {
          hasMore = false
        } else {
          allEntries = allEntries.concat(data)
          hasMore = data.length === PAGE_SIZE
          page++
        }
      }

      setEntries(allEntries)

      const { data: accountsData } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', COMPANY_ID)
        .order('code')

      if (accountsData) setAccounts(accountsData)
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Calculate balance rows
  const balanceRows = useMemo((): BalanceRow[] => {
    // Group entries by account
    const accountData: Record<string, { debit: number; credit: number; count: number }> = {}

    entries.forEach(entry => {
      const code = entry.account_code
      if (!accountData[code]) {
        accountData[code] = { debit: 0, credit: 0, count: 0 }
      }
      accountData[code].debit += Number(entry.debit) || 0
      accountData[code].credit += Number(entry.credit) || 0
      accountData[code].count += 1
    })

    // Build rows
    const rows: BalanceRow[] = []

    Object.entries(accountData).forEach(([code, data]) => {
      const account = accounts.find(a => a.code === code)
      const solde = data.debit - data.credit

      // Filter by search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const label = account?.label || ''
        if (!code.toLowerCase().includes(query) && !label.toLowerCase().includes(query)) {
          return
        }
      }

      rows.push({
        code,
        label: account?.label || `Compte ${code}`,
        entryCount: data.count,
        debit: data.debit,
        credit: data.credit,
        solde,
        soldeN1: null, // TODO: Load previous year data
        variation: null,
      })
    })

    // Sort
    rows.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'code':
          comparison = a.code.localeCompare(b.code)
          break
        case 'label':
          comparison = a.label.localeCompare(b.label)
          break
        case 'debit':
          comparison = a.debit - b.debit
          break
        case 'credit':
          comparison = a.credit - b.credit
          break
        case 'solde':
          comparison = a.solde - b.solde
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return rows
  }, [entries, accounts, searchQuery, sortField, sortDirection])

  // Calculate result (Produits - Charges = classes 7 - classes 6)
  const resultat = useMemo(() => {
    let produits = 0
    let charges = 0

    balanceRows.forEach(row => {
      if (row.code.startsWith('7')) {
        produits += row.credit - row.debit // Produits: crédit - débit
      } else if (row.code.startsWith('6')) {
        charges += row.debit - row.credit // Charges: débit - crédit
      }
    })

    return produits - charges
  }, [balanceRows])

  // Grand totals
  const totals = useMemo(() => {
    return balanceRows.reduce((acc, row) => ({
      debit: acc.debit + row.debit,
      credit: acc.credit + row.credit,
    }), { debit: 0, credit: 0 })
  }, [balanceRows])

  // Pagination
  const totalPages = Math.ceil(balanceRows.length / pageSize)
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return balanceRows.slice(start, start + pageSize)
  }, [balanceRows, currentPage, pageSize])

  // Handle sort
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Toggle row selection
  const toggleRowSelection = (code: string) => {
    const newSet = new Set(selectedRows)
    if (newSet.has(code)) {
      newSet.delete(code)
    } else {
      newSet.add(code)
    }
    setSelectedRows(newSet)
  }

  // Column toggle button
  const ColumnToggle = ({ label, field, active }: { label: string; field: keyof typeof visibleColumns; active: boolean }) => (
    <button
      onClick={() => setVisibleColumns(prev => ({ ...prev, [field]: !prev[field] }))}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
        active ? 'bg-[#E6F2F2] border-[#006666] text-[#006666]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
      }`}
    >
      <TableIcon />
      {label}
    </button>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>Balance générale</h1>
            <span className="px-2 py-0.5 text-xs font-medium rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
              Provisoire
            </span>

            {/* Navigation arrows */}
            <button className="p-1.5 border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {/* Exercise/Period Selector with Cascading Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExerciceDropdown(!showExerciceDropdown)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                {getPeriodLabel()}
                <ChevronDownIcon className="w-4 h-4" />
              </button>

              {showExerciceDropdown && (
                <>
                  {/* Backdrop to close dropdown when clicking outside */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setShowExerciceDropdown(false)
                      setHoveredExercice(null)
                    }}
                  />

                  {/* Main Dropdown menu */}
                  <div className="absolute left-0 mt-2 w-52 bg-white rounded-lg shadow-xl border z-50" style={{ borderColor: '#E4E5E7' }}>
                    {exercices.map((exercice) => (
                      <div
                        key={exercice.id}
                        className="relative"
                        onMouseEnter={() => setHoveredExercice(exercice.id)}
                        onMouseLeave={() => setHoveredExercice(null)}
                      >
                        <button
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-[#E6F5F0] transition-colors ${
                            hoveredExercice === exercice.id ? 'bg-[#E6F5F0]' : ''
                          }`}
                          style={{
                            color: '#141A1F',
                            borderBottom: '1px solid #F2F2F3'
                          }}
                        >
                          <span>{exercice.label}</span>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>

                        {/* Submenu with months */}
                        {hoveredExercice === exercice.id && (
                          <div
                            className="absolute left-full top-0 ml-1 w-48 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto"
                            style={{ borderColor: '#E4E5E7' }}
                            onMouseEnter={() => setHoveredExercice(exercice.id)}
                          >
                            {/* Exercice complet option */}
                            <button
                              onClick={() => handleExerciceComplete(exercice.id)}
                              className="w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors font-medium"
                              style={{ color: '#141A1F', borderBottom: '1px solid #F2F2F3' }}
                            >
                              Exercice complet
                            </button>

                            {/* Month options */}
                            {getExerciceMonths(exercice).map((monthData, index) => {
                              const isSelected = selectedExercice === exercice.id &&
                                selectedPeriod === 'month' &&
                                selectedMonth === monthData.month &&
                                selectedYear === monthData.year
                              return (
                                <button
                                  key={`${monthData.year}-${monthData.month}`}
                                  onClick={() => handleMonthSelect(exercice.id, monthData.month, monthData.year)}
                                  className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                                    isSelected ? 'bg-[#059669] text-white' : 'hover:bg-gray-50'
                                  }`}
                                  style={{ color: isSelected ? '#FFFFFF' : '#141A1F' }}
                                >
                                  {monthData.label}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Separator */}
                    <div className="border-t" style={{ borderColor: '#E4E5E7' }} />

                    {/* Custom dates option */}
                    <button
                      onClick={() => {
                        setShowCustomDates(true)
                        setShowExerciceDropdown(false)
                        setHoveredExercice(null)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                      style={{ color: '#141A1F', borderBottom: '1px solid #F2F2F3' }}
                    >
                      <CalendarIcon />
                      <span>Dates personnalisées</span>
                    </button>

                    {/* Settings option */}
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors rounded-b-lg"
                      style={{ color: '#141A1F' }}
                    >
                      <SettingsIcon />
                      <span>Paramètres</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={fetchData}
              className="p-1.5 border rounded-lg hover:bg-gray-50"
              style={{ borderColor: '#D6D9DB' }}
              title="Rafraîchir"
            >
              <RefreshIcon />
            </button>
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#141A1F' }}>
              Résultat : <span style={{ color: resultat >= 0 ? '#059669' : '#DC2626' }}>{formatNumber(resultat)} €</span>
            </div>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: '#FCD34D', backgroundColor: '#FFFBEB', color: '#92400E' }}
          >
            <WarningIcon />
            Afficher les anomalies
          </button>
        </div>
      </header>

      {/* Filters Row 1 */}
      <div className="bg-white border-b px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB' }}>
            Par compte
            <ChevronDownIcon className="w-3 h-3" />
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB' }}>
            <CalendarIcon />
            Période complète
            <ChevronDownIcon className="w-3 h-3" />
          </button>

          <div className="flex-1" />

          <div className="relative">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            >
              <DownloadIcon />
              Exporter
              <ChevronDownIcon className="w-3 h-3" />
            </button>
            {showExportDropdown && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
                <button className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 border-b" style={{ borderColor: '#F2F2F3' }}>
                  <span>📕</span> PDF (.pdf)
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 border-b" style={{ borderColor: '#F2F2F3' }}>
                  <span>📄</span> Excel (.xlsx)
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50">
                  <span>📄</span> CSV (.csv)
                </button>
              </div>
            )}
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB' }}>
            <SettingsIcon />
            Personnaliser
          </button>
        </div>
      </div>

      {/* Filters Row 2 - Search & Column Toggles */}
      <div className="bg-white border-b px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative w-64">
            <SearchIcon />
            <input
              type="text"
              placeholder="Nom du compte..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon />
            </div>
          </div>

          {/* Column toggles */}
          <div className="flex items-center gap-2">
            <ColumnToggle label="Comptes" field="comptes" active={visibleColumns.comptes} />
            <ColumnToggle label="Lettrage du compte" field="lettrage" active={visibleColumns.lettrage} />
            <ColumnToggle label="Débit" field="debit" active={visibleColumns.debit} />
            <ColumnToggle label="Crédit" field="credit" active={visibleColumns.credit} />
            <ColumnToggle label="Solde" field="solde" active={visibleColumns.solde} />
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
              <SettingsIcon />
              Plus d'options
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#006666' }} />
          </div>
        ) : (
          <table className="w-full min-w-[1000px]">
            <thead className="sticky top-0 bg-white border-b z-10" style={{ borderColor: '#E4E5E7' }}>
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" className="rounded" style={{ accentColor: '#006666' }} />
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-medium uppercase cursor-pointer hover:bg-gray-50"
                  style={{ color: '#6C767F' }}
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center gap-1">
                    N° de compte
                    {sortField === 'code' && (
                      <ChevronDownIcon className={`w-3 h-3 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-medium uppercase cursor-pointer hover:bg-gray-50"
                  style={{ color: '#6C767F' }}
                  onClick={() => handleSort('label')}
                >
                  Libellé du compte
                </th>
                {visibleColumns.debit && (
                  <th
                    className="text-right px-4 py-3 text-xs font-medium uppercase cursor-pointer hover:bg-gray-50"
                    style={{ color: '#6C767F' }}
                    onClick={() => handleSort('debit')}
                  >
                    Débit
                  </th>
                )}
                {visibleColumns.credit && (
                  <th
                    className="text-right px-4 py-3 text-xs font-medium uppercase cursor-pointer hover:bg-gray-50"
                    style={{ color: '#6C767F' }}
                    onClick={() => handleSort('credit')}
                  >
                    Crédit
                  </th>
                )}
                {visibleColumns.solde && (
                  <th
                    className="text-right px-4 py-3 text-xs font-medium uppercase cursor-pointer hover:bg-gray-50"
                    style={{ color: '#6C767F' }}
                    onClick={() => handleSort('solde')}
                  >
                    Solde
                  </th>
                )}
                <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                  Solde N-1
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                  Var. N / N-1 (€)
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => {
                const soldeStyle = formatNumberWithColor(row.solde)
                const variationStyle = formatNumberWithColor(row.variation)

                return (
                  <tr
                    key={row.code}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    style={{ borderColor: '#F2F2F3' }}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.code)}
                        onChange={() => toggleRowSelection(row.code)}
                        className="rounded"
                        style={{ accentColor: '#006666' }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{row.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: '#141A1F' }}>{row.label}</span>
                        <span
                          className="px-1.5 py-0.5 text-xs rounded"
                          style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                        >
                          {row.entryCount}
                        </span>
                      </div>
                    </td>
                    {visibleColumns.debit && (
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-mono" style={{ color: row.debit > 0 ? '#141A1F' : '#9CA3AF' }}>
                          {row.debit > 0 ? formatNumber(row.debit) : '—'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.credit && (
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-mono" style={{ color: row.credit > 0 ? '#141A1F' : '#9CA3AF' }}>
                          {row.credit > 0 ? formatNumber(row.credit) : '—'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.solde && (
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-mono font-medium" style={{ color: soldeStyle.color }}>
                          {row.solde !== 0 ? formatNumber(row.solde) : '—'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono" style={{ color: '#9CA3AF' }}>—</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono" style={{ color: variationStyle.color }}>
                        {row.variation !== null ? formatNumber(row.variation) : '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Footer totals */}
            <tfoot className="sticky bottom-0 bg-white border-t-2" style={{ borderColor: '#E4E5E7' }}>
              <tr>
                <td className="px-4 py-3" colSpan={3}>
                  <span className="text-sm font-semibold" style={{ color: '#141A1F' }}>Total</span>
                </td>
                {visibleColumns.debit && (
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono font-bold" style={{ color: '#141A1F' }}>
                      {formatNumber(totals.debit)}
                    </span>
                  </td>
                )}
                {visibleColumns.credit && (
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono font-bold" style={{ color: '#141A1F' }}>
                      {formatNumber(totals.credit)}
                    </span>
                  </td>
                )}
                {visibleColumns.solde && (
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono font-bold" style={{ color: '#006666' }}>
                      0,00 €
                    </span>
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-mono" style={{ color: '#9CA3AF' }}>—</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-mono" style={{ color: '#9CA3AF' }}>0,00 €</span>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="bg-white border-t px-6 py-3 flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded hover:bg-gray-100">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          {[50, 100, 300].map(size => (
            <button
              key={size}
              onClick={() => { setPageSize(size); setCurrentPage(1) }}
              className={`px-3 py-1 text-sm rounded ${pageSize === size ? 'bg-[#006666] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {size}
            </button>
          ))}
          <button
            onClick={() => { setPageSize(balanceRows.length); setCurrentPage(1) }}
            className={`px-3 py-1 text-sm rounded ${pageSize === balanceRows.length ? 'bg-[#006666] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            ∞
          </button>
          <span className="text-sm text-gray-500 ml-2">éléments par page</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, balanceRows.length)} sur {balanceRows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="px-3 py-1 text-sm bg-gray-100 rounded min-w-[2rem] text-center">
              {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
