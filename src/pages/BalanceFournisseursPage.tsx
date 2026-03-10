import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'

interface AccountingEntry {
  id: string
  account_code: string
  debit: number
  credit: number
  date: string
}

interface DetailedEntry {
  id: string
  date: string
  journal: string
  piece_number: string | null
  label: string
  debit: number
  credit: number
  lettrage_code: string | null
  runningBalance?: number
}

interface ChartOfAccount {
  id: string
  code: string
  label: string
}

interface BalanceRow {
  code: string
  label: string
  entryCount: number
  debit: number
  credit: number
  solde: number
  soldeN1: number | null
  soldeN2: number | null
  variationN1Percent: number | null
  variationN1Euro: number | null
  variationN2Percent: number | null
  variationN2Euro: number | null
}

// Format number with French locale
const formatNumber = (value: number | null): string => {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

// Format date for display (DD/MM/YYYY)
const formatDateShort = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Get lettrage badge color - exact Pennylane colors
const getLettrageColor = (code: string | null): { bg: string; text: string } => {
  if (!code) return { bg: 'transparent', text: '#9CA3AF' }
  const letter = code.charAt(0).toUpperCase()
  const colors: Record<string, { bg: string; text: string }> = {
    'A': { bg: '#14B8A6', text: 'white' },
    'B': { bg: '#3B82F6', text: 'white' },
    'C': { bg: '#8B5CF6', text: 'white' },
    'D': { bg: '#F59E0B', text: 'white' },
    'E': { bg: '#EF4444', text: 'white' },
    'F': { bg: '#EC4899', text: 'white' },
    'G': { bg: '#10B981', text: 'white' },
    'H': { bg: '#6366F1', text: 'white' },
  }
  return colors[letter] || { bg: '#9CA3AF', text: 'white' }
}

// Calculate variation percentage (Pennylane formula)
const calculateVariationPercent = (current: number, previous: number | null): number | null => {
  if (previous === null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

interface BalanceFournisseursPageProps {
  onNavigate?: (page: string) => void
}

export default function BalanceFournisseursPage({ onNavigate: _onNavigate }: BalanceFournisseursPageProps) {
  // Main data state
  const [entriesN, setEntriesN] = useState<AccountingEntry[]>([])
  const [entriesN1, setEntriesN1] = useState<AccountingEntry[]>([])
  const [entriesN2, setEntriesN2] = useState<AccountingEntry[]>([])
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [pageSize, setPageSize] = useState(9999) // ∞ by default like screenshot
  const [currentPage, setCurrentPage] = useState(1)

  // Fiscal year filter
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear])
  const [showExerciceDropdown, setShowExerciceDropdown] = useState(false)
  const [hoveredExercice, setHoveredExercice] = useState<string | null>(null)

  // Selected period state (for month selection) - must be declared before exerciceLabel
  const [selectedPeriod, setSelectedPeriod] = useState<{ month: number; year: number } | null>(null)
  const [periodLabel, setPeriodLabel] = useState<string | null>(null)

  // Month names in French
  const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

  // Generate exercise options
  const exerciceOptions = useMemo(() => {
    const options: { value: string; label: string; year: number }[] = []
    for (let year = currentYear + 2; year >= 2024; year--) {
      if (year === 2024 || year === 2025) {
        if (year === 2024) {
          options.push({ value: '2024-2025', label: 'Exercice 2024-2025', year: 2024 })
        }
      } else {
        options.push({ value: `${year}`, label: `Exercice ${year}`, year })
      }
    }
    return options
  }, [currentYear])

  // Get months for an exercise
  const getExerciceMonths = useCallback((exerciceValue: string) => {
    const option = exerciceOptions.find(o => o.value === exerciceValue)
    if (!option) return []

    const months: { label: string; month: number; year: number }[] = []
    if (exerciceValue === '2024-2025') {
      // April 2024 to December 2025
      for (let m = 4; m <= 12; m++) {
        months.push({ label: `${MONTHS_FR[m - 1].charAt(0).toUpperCase() + MONTHS_FR[m - 1].slice(1)} 2024`, month: m, year: 2024 })
      }
      for (let m = 1; m <= 12; m++) {
        months.push({ label: `${MONTHS_FR[m - 1].charAt(0).toUpperCase() + MONTHS_FR[m - 1].slice(1)} 2025`, month: m, year: 2025 })
      }
    } else {
      for (let m = 1; m <= 12; m++) {
        months.push({ label: `${MONTHS_FR[m - 1].charAt(0).toUpperCase() + MONTHS_FR[m - 1].slice(1)} ${option.year}`, month: m, year: option.year })
      }
    }
    return months
  }, [exerciceOptions])

  // Current exercise label
  const exerciceLabel = useMemo(() => {
    if (periodLabel) {
      return periodLabel
    }
    if (selectedYear === 2024 || selectedYear === 2025) {
      return 'Exercice 2024-2025'
    }
    return `Exercice ${selectedYear}`
  }, [selectedYear, periodLabel])

  // Column visibility with toggles (matching screenshot)
  const [visibleColumns, setVisibleColumns] = useState({
    code: false, // "Numéro de compte" - off by default in screenshot
    label: true, // "Nom du compte"
    debit: true,
    credit: true,
    soldeN: true,
    soldeN1: true,
    soldeN2: true,
    variationN1Percent: true,
    variationN1Euro: true,
    variationN2Percent: true,
    variationN2Euro: true,
  })
  const [showPersonnaliser, setShowPersonnaliser] = useState(false)
  const [tempVisibleColumns, setTempVisibleColumns] = useState(visibleColumns)

  // Detail view state
  const [selectedSupplier, setSelectedSupplier] = useState<BalanceRow | null>(null)
  const [detailedEntries, setDetailedEntries] = useState<DetailedEntry[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [detailSearchQuery, setDetailSearchQuery] = useState('')
  const [detailPageSize, setDetailPageSize] = useState(300)
  const [detailCurrentPage, setDetailCurrentPage] = useState(1)
  const [filterExercicesOuverts, setFilterExercicesOuverts] = useState(false)

  // Date ranges for N, N-1, N-2 based on fiscal year
  const dateRanges = useMemo(() => {
    // If a specific month is selected
    if (selectedPeriod) {
      const { month, year } = selectedPeriod
      const lastDay = new Date(year, month, 0).getDate()
      return {
        n: { start: `${year}-${String(month).padStart(2, '0')}-01`, end: `${year}-${String(month).padStart(2, '0')}-${lastDay}` },
        n1: { start: `${year - 1}-${String(month).padStart(2, '0')}-01`, end: `${year - 1}-${String(month).padStart(2, '0')}-${new Date(year - 1, month, 0).getDate()}` },
        n2: { start: `${year - 2}-${String(month).padStart(2, '0')}-01`, end: `${year - 2}-${String(month).padStart(2, '0')}-${new Date(year - 2, month, 0).getDate()}` },
      }
    }

    // Exercice 2024-2025: April 30, 2024 to December 31, 2025
    if (selectedYear === 2024 || selectedYear === 2025) {
      return {
        n: { start: '2024-04-30', end: '2025-12-31' },
        n1: { start: '2023-04-30', end: '2024-04-29' },
        n2: { start: '2022-04-30', end: '2023-04-29' },
      }
    }

    // Standard calendar year for other years
    return {
      n: { start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31` },
      n1: { start: `${selectedYear - 1}-01-01`, end: `${selectedYear - 1}-12-31` },
      n2: { start: `${selectedYear - 2}-01-01`, end: `${selectedYear - 2}-12-31` },
    }
  }, [selectedYear, selectedPeriod])

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch available years
      const { data: yearsData } = await supabase
        .from('accounting_entries')
        .select('date')
        .eq('company_id', COMPANY_ID)
        .like('account_code', '401%')

      if (yearsData) {
        const years = [...new Set(yearsData.map(e => new Date(e.date).getFullYear()))].sort((a, b) => b - a)
        if (years.length > 0) setAvailableYears(years)
      }

      // Fetch entries for N
      const { data: dataN } = await supabase
        .from('accounting_entries')
        .select('id, account_code, debit, credit, date')
        .eq('company_id', COMPANY_ID)
        .like('account_code', '401%')
        .gte('date', dateRanges.n.start)
        .lte('date', dateRanges.n.end)

      // Fetch entries for N-1
      const { data: dataN1 } = await supabase
        .from('accounting_entries')
        .select('id, account_code, debit, credit, date')
        .eq('company_id', COMPANY_ID)
        .like('account_code', '401%')
        .gte('date', dateRanges.n1.start)
        .lte('date', dateRanges.n1.end)

      // Fetch entries for N-2
      const { data: dataN2 } = await supabase
        .from('accounting_entries')
        .select('id, account_code, debit, credit, date')
        .eq('company_id', COMPANY_ID)
        .like('account_code', '401%')
        .gte('date', dateRanges.n2.start)
        .lte('date', dateRanges.n2.end)

      // Fetch chart of accounts
      const { data: accountsData } = await supabase
        .from('chart_of_accounts')
        .select('id, code, label')
        .eq('company_id', COMPANY_ID)
        .like('code', '401%')

      setEntriesN(dataN || [])
      setEntriesN1(dataN1 || [])
      setEntriesN2(dataN2 || [])
      setAccounts(accountsData || [])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }, [dateRanges])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch supplier details
  const fetchSupplierDetails = useCallback(async (accountCode: string) => {
    setLoadingDetails(true)
    setDetailCurrentPage(1)
    try {
      let query = supabase
        .from('accounting_entries')
        .select('id, date, journal, piece_number, label, debit, credit, lettrage_code')
        .eq('company_id', COMPANY_ID)
        .eq('account_code', accountCode)
        .order('date', { ascending: true })
        .order('id', { ascending: true })

      if (filterExercicesOuverts) {
        query = query.gte('date', dateRanges.n.start).lte('date', dateRanges.n.end)
      }

      const { data, error } = await query
      if (error) throw error

      if (data) {
        let runningBalance = 0
        const entriesWithBalance: DetailedEntry[] = data.map(entry => {
          runningBalance += (Number(entry.debit) || 0) - (Number(entry.credit) || 0)
          return {
            ...entry,
            debit: Number(entry.debit) || 0,
            credit: Number(entry.credit) || 0,
            runningBalance
          }
        })
        setDetailedEntries(entriesWithBalance)
      }
    } catch (err) {
      console.error('Error fetching supplier details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }, [filterExercicesOuverts, dateRanges])

  // Refetch details when filter changes
  useEffect(() => {
    if (selectedSupplier) {
      fetchSupplierDetails(selectedSupplier.code)
    }
  }, [filterExercicesOuverts, selectedSupplier, fetchSupplierDetails])

  // Helper to aggregate entries by account
  const aggregateByAccount = (entries: AccountingEntry[]) => {
    const map = new Map<string, { debit: number; credit: number; count: number }>()
    entries.forEach(e => {
      const existing = map.get(e.account_code) || { debit: 0, credit: 0, count: 0 }
      map.set(e.account_code, {
        debit: existing.debit + (Number(e.debit) || 0),
        credit: existing.credit + (Number(e.credit) || 0),
        count: existing.count + 1,
      })
    })
    return map
  }

  // Calculate balance rows with N, N-1, N-2
  const balanceRows = useMemo((): BalanceRow[] => {
    const mapN = aggregateByAccount(entriesN)
    const mapN1 = aggregateByAccount(entriesN1)
    const mapN2 = aggregateByAccount(entriesN2)

    // Get all unique account codes
    const allCodes = new Set([...mapN.keys(), ...mapN1.keys(), ...mapN2.keys()])

    const rows: BalanceRow[] = []
    allCodes.forEach(code => {
      const dataN = mapN.get(code)
      const dataN1 = mapN1.get(code)
      const dataN2 = mapN2.get(code)

      const account = accounts.find(a => a.code === code)

      const solde = dataN ? dataN.debit - dataN.credit : 0
      const soldeN1 = dataN1 ? dataN1.debit - dataN1.credit : null
      const soldeN2 = dataN2 ? dataN2.debit - dataN2.credit : null

      rows.push({
        code,
        label: account?.label || code,
        entryCount: dataN?.count || 0,
        debit: dataN?.debit || 0,
        credit: dataN?.credit || 0,
        solde,
        soldeN1,
        soldeN2,
        variationN1Percent: calculateVariationPercent(solde, soldeN1),
        variationN1Euro: soldeN1 !== null ? solde - soldeN1 : null,
        variationN2Percent: soldeN1 !== null && soldeN2 !== null ? calculateVariationPercent(soldeN1, soldeN2) : null,
        variationN2Euro: soldeN1 !== null && soldeN2 !== null ? soldeN1 - soldeN2 : null,
      })
    })

    // Filter by search
    let filtered = rows
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = rows.filter(r => r.code.includes(q) || r.label.toLowerCase().includes(q))
    }

    // Sort by label
    filtered.sort((a, b) => a.label.localeCompare(b.label))

    return filtered
  }, [entriesN, entriesN1, entriesN2, accounts, searchQuery])

  // Pagination
  const totalPages = Math.ceil(balanceRows.length / pageSize)
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return balanceRows.slice(start, start + pageSize)
  }, [balanceRows, currentPage, pageSize])

  // Totals
  const totals = useMemo(() => {
    return balanceRows.reduce((acc, row) => ({
      debit: acc.debit + row.debit,
      credit: acc.credit + row.credit,
      solde: acc.solde + row.solde,
      soldeN1: acc.soldeN1 + (row.soldeN1 || 0),
      soldeN2: acc.soldeN2 + (row.soldeN2 || 0),
      variationN1Euro: acc.variationN1Euro + (row.variationN1Euro || 0),
      variationN2Euro: acc.variationN2Euro + (row.variationN2Euro || 0),
    }), { debit: 0, credit: 0, solde: 0, soldeN1: 0, soldeN2: 0, variationN1Euro: 0, variationN2Euro: 0 })
  }, [balanceRows])

  // Column count
  const columnCount = Object.values(visibleColumns).filter(Boolean).length

  // Open personnaliser panel
  const openPersonnaliser = () => {
    setTempVisibleColumns({ ...visibleColumns })
    setShowPersonnaliser(true)
  }

  // Apply column changes
  const applyColumnChanges = () => {
    setVisibleColumns(tempVisibleColumns)
    setShowPersonnaliser(false)
  }

  // Reset columns
  const resetColumns = () => {
    const defaultColumns = {
      code: false,
      label: true,
      debit: true,
      credit: true,
      soldeN: true,
      soldeN1: true,
      soldeN2: true,
      variationN1Percent: true,
      variationN1Euro: true,
      variationN2Percent: true,
      variationN2Euro: true,
    }
    setTempVisibleColumns(defaultColumns)
  }

  // Paginated detailed entries
  const paginatedDetailedEntries = useMemo(() => {
    let filtered = detailedEntries
    if (detailSearchQuery) {
      const q = detailSearchQuery.toLowerCase()
      filtered = detailedEntries.filter(e =>
        e.label.toLowerCase().includes(q) ||
        (e.piece_number && e.piece_number.toLowerCase().includes(q))
      )
    }
    const start = (detailCurrentPage - 1) * detailPageSize
    return filtered.slice(start, start + detailPageSize)
  }, [detailedEntries, detailSearchQuery, detailCurrentPage, detailPageSize])

  // Extract libellé de pièce from label
  const extractPieceLabel = (label: string): string => {
    if (label.includes('Facture')) return 'Fact...'
    if (label.includes('PAIEMENT')) return 'PAIE...'
    return label.substring(0, 8) + '...'
  }

  // Toggle switch component
  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-[#006666]' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
              Balance fournisseurs
            </h1>
            <span className="px-2 py-1 text-xs rounded" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
              Provisoire
            </span>

            {/* Exercise selector with dropdown */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  // Navigate to previous month or year
                  if (selectedPeriod) {
                    const newMonth = selectedPeriod.month - 1
                    if (newMonth < 1) {
                      setSelectedPeriod({ month: 12, year: selectedPeriod.year - 1 })
                      setPeriodLabel(`${MONTHS_FR[11].charAt(0).toUpperCase() + MONTHS_FR[11].slice(1)} ${selectedPeriod.year - 1}`)
                      setSelectedYear(selectedPeriod.year - 1)
                    } else {
                      setSelectedPeriod({ month: newMonth, year: selectedPeriod.year })
                      setPeriodLabel(`${MONTHS_FR[newMonth - 1].charAt(0).toUpperCase() + MONTHS_FR[newMonth - 1].slice(1)} ${selectedPeriod.year}`)
                    }
                  } else {
                    setSelectedYear(y => Math.max(2024, y - 1))
                  }
                }}
                className="p-1.5 border rounded-lg hover:bg-gray-50 transition-colors"
                style={{ borderColor: '#E4E5E7', color: '#006666' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowExerciceDropdown(!showExerciceDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: '#006666', color: 'white' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {exerciceLabel}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Exercise Dropdown */}
                {showExerciceDropdown && (
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-xl border z-50" style={{ borderColor: '#E4E5E7', minWidth: hoveredExercice ? '380px' : '200px' }}>
                    <div className="flex">
                      <div className="py-2" style={{ minWidth: '200px' }}>
                        {exerciceOptions.map(option => (
                          <div
                            key={option.value}
                            onMouseEnter={() => setHoveredExercice(option.value)}
                          >
                            <button
                              onClick={() => {
                                setSelectedYear(option.year)
                                setSelectedPeriod(null)
                                setPeriodLabel(null)
                                setShowExerciceDropdown(false)
                                setHoveredExercice(null)
                              }}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                              style={{
                                color: selectedYear === option.year && !periodLabel ? '#006666' : '#141A1F',
                                backgroundColor: hoveredExercice === option.value ? '#F0F7F7' : 'transparent'
                              }}
                            >
                              <span>{option.label}</span>
                              <svg className="w-4 h-4" style={{ color: '#9CA3AF' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        ))}

                        <div className="border-t my-2" style={{ borderColor: '#E4E5E7' }} />

                        <button
                          onMouseEnter={() => setHoveredExercice(null)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                          style={{ color: '#141A1F' }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Dates personnalisées
                        </button>

                        <div className="border-t my-2" style={{ borderColor: '#E4E5E7' }} />

                        <button
                          onMouseEnter={() => setHoveredExercice(null)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                          style={{ color: '#141A1F' }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Paramètres
                        </button>
                      </div>

                      {/* Months submenu */}
                      {hoveredExercice && (
                        <div
                          className="border-l py-2 overflow-y-auto"
                          style={{ borderColor: '#E4E5E7', minWidth: '160px', maxHeight: '350px' }}
                          onMouseLeave={() => setHoveredExercice(null)}
                        >
                          <button
                            onClick={() => {
                              const option = exerciceOptions.find(o => o.value === hoveredExercice)
                              if (option) setSelectedYear(option.year)
                              setSelectedPeriod(null)
                              setPeriodLabel(null)
                              setShowExerciceDropdown(false)
                              setHoveredExercice(null)
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors font-medium"
                            style={{ color: '#141A1F' }}
                          >
                            Exercice complet
                          </button>
                          {getExerciceMonths(hoveredExercice).map((month, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedYear(month.year)
                                setSelectedPeriod({ month: month.month, year: month.year })
                                setPeriodLabel(month.label)
                                setShowExerciceDropdown(false)
                                setHoveredExercice(null)
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                              style={{ color: '#141A1F' }}
                            >
                              {month.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  // Navigate to next month or year
                  if (selectedPeriod) {
                    const newMonth = selectedPeriod.month + 1
                    if (newMonth > 12) {
                      setSelectedPeriod({ month: 1, year: selectedPeriod.year + 1 })
                      setPeriodLabel(`${MONTHS_FR[0].charAt(0).toUpperCase() + MONTHS_FR[0].slice(1)} ${selectedPeriod.year + 1}`)
                      setSelectedYear(selectedPeriod.year + 1)
                    } else {
                      setSelectedPeriod({ month: newMonth, year: selectedPeriod.year })
                      setPeriodLabel(`${MONTHS_FR[newMonth - 1].charAt(0).toUpperCase() + MONTHS_FR[newMonth - 1].slice(1)} ${selectedPeriod.year}`)
                    }
                  } else {
                    setSelectedYear(y => Math.min(currentYear + 2, y + 1))
                  }
                }}
                className="p-1.5 border rounded-lg hover:bg-gray-50 transition-colors"
                style={{ borderColor: '#E4E5E7', color: '#006666' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Result */}
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: '#6C767F' }}>Résultat :</span>
              <strong style={{ color: totals.solde < 0 ? '#DC2626' : '#059669' }}>{formatNumber(totals.solde)} €</strong>
              <button className="p-1 hover:bg-gray-100 rounded" onClick={fetchData}>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Détecter des anomalies button */}
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#E6F2F2', color: '#006666' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Détecter des anomalies
            </button>
          </div>
        </div>
      </header>

      {/* Breadcrumb when supplier selected */}
      {selectedSupplier && (
        <div className="bg-white border-b px-6 py-2" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => {
                setSelectedSupplier(null)
                setDetailedEntries([])
              }}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Par compte
            </button>
            <span className="text-gray-400">{'>'}</span>
            <span style={{ color: '#141A1F' }} className="font-medium">
              {selectedSupplier.code} - {selectedSupplier.label} ({detailedEntries.length})
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Supplier List (shown when supplier selected) */}
        {selectedSupplier && (
          <div className="w-72 border-r bg-white overflow-y-auto flex-shrink-0" style={{ borderColor: '#E4E5E7' }}>
            <div className="p-3 border-b" style={{ borderColor: '#E4E5E7' }}>
              <div className="relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher un compte..."
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
                  style={{ borderColor: '#D6D9DB' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div>
              {balanceRows.map((row) => (
                <button
                  key={row.code}
                  onClick={() => {
                    setSelectedSupplier(row)
                    fetchSupplierDetails(row.code)
                  }}
                  className={`w-full text-left px-4 py-2.5 border-b hover:bg-gray-50 ${
                    selectedSupplier?.code === row.code ? 'bg-[#E6F2F2]' : ''
                  }`}
                  style={{ borderColor: '#F2F2F3' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono" style={{ color: '#6C767F' }}>{row.code}</div>
                      <div className="text-sm font-medium truncate" style={{ color: '#141A1F' }}>{row.label}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-mono" style={{ color: row.solde < 0 ? '#DC2626' : row.solde > 0 ? '#059669' : '#9CA3AF' }}>
                        {formatNumber(row.solde)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Right Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedSupplier ? (
            /* Detail View */
            <>
              {/* Detail Filters Bar */}
              <div className="bg-white border-b px-4 py-3" style={{ borderColor: '#E4E5E7' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-shrink-0" style={{ width: '200px' }}>
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Libellé, n° facture..."
                      className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg"
                      style={{ borderColor: '#D6D9DB' }}
                      value={detailSearchQuery}
                      onChange={(e) => setDetailSearchQuery(e.target.value)}
                    />
                  </div>

                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>Date</button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>Journaux</button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>Lettrage</button>

                  {filterExercicesOuverts ? (
                    <button
                      onClick={() => setFilterExercicesOuverts(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg"
                      style={{ backgroundColor: '#E6F2F2', color: '#006666' }}
                    >
                      Exercices ouverts
                      <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={() => setFilterExercicesOuverts(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                      style={{ borderColor: '#D6D9DB' }}
                    >
                      Exercices ouverts
                    </button>
                  )}

                  <div className="flex-1" />

                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Exporter
                  </button>
                </div>
              </div>

              {/* Detail Table */}
              <div className="flex-1 overflow-auto bg-white">
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#006666' }} />
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="sticky top-0 bg-white border-b z-10" style={{ borderColor: '#E4E5E7' }}>
                      <tr>
                        <th className="w-10 px-3 py-3">
                          <input type="checkbox" className="rounded" style={{ accentColor: '#006666' }} />
                        </th>
                        <th className="text-left px-3 py-3 text-xs font-medium uppercase whitespace-nowrap" style={{ color: '#6C767F' }}>Date</th>
                        <th className="text-left px-3 py-3 text-xs font-medium uppercase whitespace-nowrap" style={{ color: '#6C767F' }}>Jour.</th>
                        <th className="text-left px-3 py-3 text-xs font-medium uppercase whitespace-nowrap" style={{ color: '#6C767F' }}>Libellé de pièce</th>
                        <th className="text-left px-3 py-3 text-xs font-medium uppercase whitespace-nowrap" style={{ color: '#6C767F' }}>Libellé de ligne</th>
                        <th className="text-left px-3 py-3 text-xs font-medium uppercase whitespace-nowrap" style={{ color: '#6C767F' }}>N° facture</th>
                        <th className="text-center px-3 py-3 text-xs font-medium uppercase whitespace-nowrap" style={{ color: '#6C767F' }}>Let.</th>
                        <th className="text-right px-3 py-3 text-xs font-medium uppercase whitespace-nowrap" style={{ color: '#6C767F' }}>Débit</th>
                        <th className="text-right px-3 py-3 text-xs font-medium uppercase whitespace-nowrap" style={{ color: '#6C767F' }}>Crédit</th>
                        <th className="text-right px-3 py-3 text-xs font-medium uppercase whitespace-nowrap" style={{ color: '#6C767F' }}>Solde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDetailedEntries.map((entry) => {
                        const lettrageColors = getLettrageColor(entry.lettrage_code)
                        const isFacture = entry.label.toLowerCase().includes('facture')

                        return (
                          <tr key={entry.id} className="border-b hover:bg-gray-50" style={{ borderColor: '#F2F2F3' }}>
                            <td className="px-3 py-2.5">
                              <input type="checkbox" className="rounded" style={{ accentColor: '#006666' }} />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                {isFacture && (
                                  <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                                    </svg>
                                  </span>
                                )}
                                <span className="text-sm" style={{ color: '#141A1F' }}>
                                  {formatDateShort(entry.date)}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className="text-xs font-medium px-2 py-0.5 rounded"
                                style={{ backgroundColor: '#E6F2F2', color: '#006666' }}
                              >
                                {entry.journal?.includes('6791427') ? 'HA' : entry.journal?.includes('6791436') ? 'BQ1' : entry.journal?.replace('J', '').substring(0, 3) || '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-sm" style={{ color: '#141A1F' }}>
                                {extractPieceLabel(entry.label)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-sm max-w-[150px] truncate" style={{ color: '#141A1F' }}></td>
                            <td className="px-3 py-2.5 text-sm font-mono" style={{ color: '#6B7280' }}>
                              {entry.piece_number?.substring(0, 8) || '—'}...
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {entry.lettrage_code ? (
                                <span
                                  className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold"
                                  style={{ backgroundColor: lettrageColors.bg, color: lettrageColors.text }}
                                >
                                  {entry.lettrage_code.charAt(0)}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right text-sm font-mono" style={{ color: '#141A1F' }}>
                              {entry.debit > 0 ? formatNumber(entry.debit) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-sm font-mono" style={{ color: '#141A1F' }}>
                              {entry.credit > 0 ? formatNumber(entry.credit) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-sm font-mono" style={{
                              color: (entry.runningBalance || 0) < 0 ? '#DC2626' : (entry.runningBalance || 0) > 0 ? '#059669' : '#6B7280'
                            }}>
                              {formatNumber(entry.runningBalance || 0)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer with totals */}
              <div className="bg-white border-t" style={{ borderColor: '#E4E5E7' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                      {detailedEntries.length} Total sur la période sélectionnée
                    </span>
                    <span className="text-sm font-mono font-bold" style={{
                      color: (detailedEntries[detailedEntries.length - 1]?.runningBalance || 0) < 0 ? '#DC2626' : '#059669'
                    }}>
                      {formatNumber(detailedEntries[detailedEntries.length - 1]?.runningBalance || 0)} €
                    </span>
                  </div>
                </div>

                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[50, 100, 300].map((size) => (
                      <button
                        key={size}
                        onClick={() => setDetailPageSize(size)}
                        className={`px-3 py-1.5 text-sm rounded ${detailPageSize === size ? 'bg-[#006666] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {size}
                      </button>
                    ))}
                    <button
                      onClick={() => setDetailPageSize(9999)}
                      className={`px-3 py-1.5 text-sm rounded ${detailPageSize === 9999 ? 'bg-[#006666] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      ∞
                    </button>
                    <span className="text-sm text-gray-500 ml-2">éléments par page</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>1-{detailedEntries.length} sur {detailedEntries.length}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Main Table View */
            <div className="flex flex-col h-full">
              {/* Filters Row */}
              <div className="bg-white border-b px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                    Par compte ▾
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                    Période complète ▾
                  </button>

                  <div className="flex-1" />

                  {/* Export button */}
                  <button className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Exporter
                  </button>

                  {/* Personnaliser button */}
                  <button
                    onClick={openPersonnaliser}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                    style={{ borderColor: '#D6D9DB' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                    </svg>
                    Personnaliser
                  </button>
                </div>
              </div>

              {/* Second Filters Row */}
              <div className="bg-white border-b px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
                <div className="flex items-center gap-3">
                  <div className="relative" style={{ width: '200px' }}>
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Nom du compte..."
                      className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg"
                      style={{ borderColor: '#D6D9DB' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
                    </svg>
                    Comptes
                  </button>

                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0" />
                    </svg>
                    Lettrage du compte
                  </button>

                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0" />
                    </svg>
                    Débit
                  </button>

                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0" />
                    </svg>
                    Crédit
                  </button>

                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0" />
                    </svg>
                    Solde
                  </button>

                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0" />
                    </svg>
                    Solde N-1
                  </button>

                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0" />
                    </svg>
                    Plus d'options
                    <span className="px-1.5 py-0.5 text-xs rounded-full" style={{ backgroundColor: '#E6F2F2', color: '#006666' }}>1</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Table with optional side panel */}
              <div className="flex-1 flex overflow-hidden">
                {/* Table */}
                <div className="flex-1 overflow-auto bg-white">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#006666' }} />
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="sticky top-0 bg-white border-b z-10" style={{ borderColor: '#E4E5E7' }}>
                        <tr>
                          <th className="w-10 px-4 py-3">
                            <input type="checkbox" className="rounded" style={{ accentColor: '#006666' }} />
                          </th>
                          {visibleColumns.label && (
                            <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                              Libellé du compte
                            </th>
                          )}
                          {visibleColumns.debit && <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Débit</th>}
                          {visibleColumns.credit && <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Crédit</th>}
                          {visibleColumns.soldeN && <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Solde</th>}
                          {visibleColumns.soldeN1 && <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Solde N-1</th>}
                          {visibleColumns.soldeN2 && <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Solde N-2</th>}
                          {visibleColumns.variationN1Percent && <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Var. N / N-1 (%)</th>}
                          {visibleColumns.variationN1Euro && <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Var. N / N-1 (€)</th>}
                          {visibleColumns.variationN2Percent && <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Var. N-1 / N-2 (%)</th>}
                          {visibleColumns.variationN2Euro && <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Var. N-1 / N-2 (€)</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.map((row) => (
                          <tr
                            key={row.code}
                            className="border-b hover:bg-gray-50 cursor-pointer"
                            style={{ borderColor: '#F2F2F3' }}
                            onClick={() => {
                              setSelectedSupplier(row)
                              fetchSupplierDetails(row.code)
                            }}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                onClick={(e) => e.stopPropagation()}
                                className="rounded"
                                style={{ accentColor: '#006666' }}
                              />
                            </td>
                            {visibleColumns.label && (
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{row.label}</span>
                                  <span className="px-1.5 py-0.5 text-xs rounded" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                                    {row.entryCount}
                                  </span>
                                </div>
                              </td>
                            )}
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
                            {visibleColumns.soldeN && (
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-mono font-medium" style={{ color: row.solde === 0 ? '#9CA3AF' : row.solde < 0 ? '#DC2626' : '#059669' }}>
                                  {row.solde === 0 ? '—' : formatNumber(row.solde)}
                                </span>
                              </td>
                            )}
                            {visibleColumns.soldeN1 && (
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-mono" style={{ color: row.soldeN1 === null || row.soldeN1 === 0 ? '#9CA3AF' : row.soldeN1 < 0 ? '#DC2626' : '#059669' }}>
                                  {row.soldeN1 === null || row.soldeN1 === 0 ? '—' : formatNumber(row.soldeN1)}
                                </span>
                              </td>
                            )}
                            {visibleColumns.soldeN2 && (
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-mono" style={{ color: row.soldeN2 === null || row.soldeN2 === 0 ? '#9CA3AF' : row.soldeN2 < 0 ? '#DC2626' : '#059669' }}>
                                  {row.soldeN2 === null || row.soldeN2 === 0 ? '—' : formatNumber(row.soldeN2)}
                                </span>
                              </td>
                            )}
                            {visibleColumns.variationN1Percent && (
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-mono" style={{
                                  color: row.variationN1Percent === null ? '#9CA3AF' : row.variationN1Percent > 0 ? '#059669' : row.variationN1Percent < 0 ? '#DC2626' : '#9CA3AF'
                                }}>
                                  {row.variationN1Percent !== null ? `${row.variationN1Percent >= 0 ? '+' : ''}${formatNumber(row.variationN1Percent)}%` : '—'}
                                </span>
                              </td>
                            )}
                            {visibleColumns.variationN1Euro && (
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-mono" style={{
                                  color: row.variationN1Euro === null ? '#9CA3AF' : row.variationN1Euro > 0 ? '#059669' : row.variationN1Euro < 0 ? '#DC2626' : '#9CA3AF'
                                }}>
                                  {row.variationN1Euro !== null ? formatNumber(row.variationN1Euro) : '—'}
                                </span>
                              </td>
                            )}
                            {visibleColumns.variationN2Percent && (
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-mono" style={{
                                  color: row.variationN2Percent === null ? '#9CA3AF' : row.variationN2Percent > 0 ? '#059669' : row.variationN2Percent < 0 ? '#DC2626' : '#9CA3AF'
                                }}>
                                  {row.variationN2Percent !== null ? `${row.variationN2Percent >= 0 ? '+' : ''}${formatNumber(row.variationN2Percent)}%` : '—'}
                                </span>
                              </td>
                            )}
                            {visibleColumns.variationN2Euro && (
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-mono" style={{
                                  color: row.variationN2Euro === null ? '#9CA3AF' : row.variationN2Euro > 0 ? '#059669' : row.variationN2Euro < 0 ? '#DC2626' : '#9CA3AF'
                                }}>
                                  {row.variationN2Euro !== null ? formatNumber(row.variationN2Euro) : '—'}
                                </span>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Personnaliser Panel */}
                {showPersonnaliser && (
                  <div className="w-80 bg-white border-l flex flex-col overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                    <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
                      <h3 className="text-base font-semibold" style={{ color: '#141A1F' }}>Personnaliser l'affichage</h3>
                      <button onClick={resetColumns} className="text-sm" style={{ color: '#006666' }}>Réinit.</button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      {/* Colonnes section */}
                      <div className="px-4 py-3 border-b" style={{ borderColor: '#E4E5E7' }}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: '#141A1F' }}>Colonnes</span>
                            <span className="px-1.5 py-0.5 text-xs rounded" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                              {columnCount}
                            </span>
                          </div>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        <div className="space-y-3">
                          {[
                            { key: 'code', label: 'Numéro de compte' },
                            { key: 'label', label: 'Nom du compte' },
                            { key: 'debit', label: 'Débit' },
                            { key: 'credit', label: 'Crédit' },
                            { key: 'soldeN', label: 'Solde N' },
                            { key: 'soldeN1', label: 'Solde N-1' },
                            { key: 'soldeN2', label: 'Solde N-2' },
                            { key: 'variationN1Percent', label: 'Variation N / N-1 (%)' },
                            { key: 'variationN1Euro', label: 'Variation N / N-1 (€)' },
                            { key: 'variationN2Percent', label: 'Variation N-1 / N-2 (%)' },
                            { key: 'variationN2Euro', label: 'Variation N-1 / N-2 (€)' },
                          ].map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <ToggleSwitch
                                  checked={tempVisibleColumns[key as keyof typeof tempVisibleColumns]}
                                  onChange={() => setTempVisibleColumns(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                                />
                                <span className="text-sm" style={{ color: '#141A1F' }}>{label}</span>
                              </div>
                              <svg className="w-4 h-4 text-gray-300 cursor-grab" fill="none" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M8 6a2 2 0 11-4 0 2 2 0 014 0zM8 12a2 2 0 11-4 0 2 2 0 014 0zM8 18a2 2 0 11-4 0 2 2 0 014 0zM14 6a2 2 0 11-4 0 2 2 0 014 0zM14 12a2 2 0 11-4 0 2 2 0 014 0zM14 18a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Fixées section */}
                      <div className="px-4 py-3 border-b" style={{ borderColor: '#E4E5E7' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: '#141A1F' }}>Fixées</span>
                            <span className="px-1.5 py-0.5 text-xs rounded" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>1</span>
                          </div>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Selection section */}
                      <div className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: '#141A1F' }}>Selection</span>
                      </div>
                    </div>

                    {/* Footer buttons */}
                    <div className="px-4 py-3 border-t flex items-center gap-3" style={{ borderColor: '#E4E5E7' }}>
                      <button
                        onClick={() => setShowPersonnaliser(false)}
                        className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50"
                        style={{ borderColor: '#D6D9DB' }}
                      >
                        Annuler
                      </button>
                      <button
                        onClick={applyColumnChanges}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg"
                        style={{ backgroundColor: '#006666' }}
                      >
                        Appliquer
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with totals */}
              <div className="bg-white border-t" style={{ borderColor: '#E4E5E7' }}>
                {/* Totals row */}
                <div className="px-6 py-3 border-b flex items-center" style={{ borderColor: '#F2F2F3' }}>
                  <div className="w-10 px-4" />
                  {visibleColumns.label && <div className="flex-1 px-4" />}
                  {visibleColumns.debit && <div className="px-4 text-right" style={{ minWidth: '100px' }} />}
                  {visibleColumns.credit && <div className="px-4 text-right" style={{ minWidth: '100px' }} />}
                  {visibleColumns.soldeN && (
                    <div className="px-4 text-right" style={{ minWidth: '100px' }}>
                      <span className="text-sm font-mono font-bold" style={{ color: totals.solde < 0 ? '#DC2626' : '#059669' }}>
                        {formatNumber(totals.solde)} €
                      </span>
                    </div>
                  )}
                  {visibleColumns.soldeN1 && (
                    <div className="px-4 text-right" style={{ minWidth: '100px' }}>
                      <span className="text-sm font-mono font-bold" style={{ color: totals.soldeN1 < 0 ? '#DC2626' : '#059669' }}>
                        {formatNumber(totals.soldeN1)} €
                      </span>
                    </div>
                  )}
                  {visibleColumns.soldeN2 && (
                    <div className="px-4 text-right" style={{ minWidth: '100px' }}>
                      <span className="text-sm font-mono font-bold" style={{ color: totals.soldeN2 < 0 ? '#DC2626' : '#9CA3AF' }}>
                        {formatNumber(totals.soldeN2)} €
                      </span>
                    </div>
                  )}
                  {visibleColumns.variationN1Percent && <div className="px-4 text-right" style={{ minWidth: '100px' }} />}
                  {visibleColumns.variationN1Euro && <div className="px-4 text-right" style={{ minWidth: '100px' }} />}
                  {visibleColumns.variationN2Percent && <div className="px-4 text-right" style={{ minWidth: '100px' }} />}
                  {visibleColumns.variationN2Euro && <div className="px-4 text-right" style={{ minWidth: '100px' }} />}
                </div>

                {/* Pagination */}
                <div className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setPageSize(9999); setCurrentPage(1) }}
                      className={`px-3 py-1.5 text-sm rounded ${pageSize === 9999 ? 'bg-[#006666] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      ∞
                    </button>
                    {[50, 100, 300].map(size => (
                      <button
                        key={size}
                        onClick={() => { setPageSize(size); setCurrentPage(1) }}
                        className={`px-3 py-1.5 text-sm rounded ${pageSize === size ? 'bg-[#006666] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {size}
                      </button>
                    ))}
                    <span className="text-sm text-gray-500 ml-2">éléments par page</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: '#6C767F' }}>
                      {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, balanceRows.length)} sur {balanceRows.length}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <span className="px-3 py-1 text-sm bg-[#006666] text-white rounded min-w-[2rem] text-center">{currentPage}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
