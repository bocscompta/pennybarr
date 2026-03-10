/**
 * Page de Lettrage Manuel des Ecritures Comptables
 *
 * Permet de lettrer manuellement les ecritures des comptes tiers (401xxx, 411xxx)
 * pour rapprocher factures et paiements.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'
import LettrageBadge from '../components/LettrageBadge'
import type { AccountingEntry } from '../types/database'
import {
  generateNextLettrageCode,
  canLetterEntries,
  determineLettrageType,
} from '../utils/lettrageColors'
import {
  Link2,
  Unlink,
  ChevronDown,
  Search,
  Calendar,
  Download,
  Wand2,
  Check,
  AlertCircle,
  RefreshCw,
  FileText,
  TrendingUp,
} from 'lucide-react'

// ============ Types ============

interface ChartOfAccount {
  id: string
  code: string
  label: string
  type: string
}

interface LettrageStats {
  totalEntries: number
  letteredEntries: number
  unletteredEntries: number
  unletteredAmount: number
  percentLettered: number
}

interface AutoMatchSuggestion {
  entries: AccountingEntry[]
  totalDebit: number
  totalCredit: number
}

// ============ Helpers ============

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ============ Components ============

// Account Selector
function AccountSelector({
  accounts,
  selectedCode,
  onSelect,
  loading,
}: {
  accounts: ChartOfAccount[]
  selectedCode: string | null
  onSelect: (code: string) => void
  loading: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const selected = accounts.find((a) => a.code === selectedCode)

  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts
    const term = searchTerm.toLowerCase()
    return accounts.filter(
      (a) => a.code.toLowerCase().includes(term) || a.label.toLowerCase().includes(term)
    )
  }, [accounts, searchTerm])

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors min-w-[350px] disabled:opacity-50"
      >
        <FileText className="w-4 h-4 text-gray-400" />
        <span className="flex-1 text-left text-sm">
          {selected ? `${selected.code} - ${selected.label}` : 'Selectionner un compte a lettrer'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un compte..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          {/* Account List */}
          <div className="overflow-y-auto max-h-60">
            {filteredAccounts.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">Aucun compte trouve</div>
            ) : (
              filteredAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => {
                    onSelect(account.code)
                    setIsOpen(false)
                    setSearchTerm('')
                  }}
                  className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                    account.code === selectedCode ? 'bg-stone-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{account.code}</span>
                      <span className="text-sm text-gray-500 ml-2">{account.label}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Period Filter
function PeriodFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: {
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-400" />
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
      />
      <span className="text-gray-400">au</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
      />
    </div>
  )
}

// Stats Card
function StatsCard({ stats }: { stats: LettrageStats }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Statistiques du compte
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-2xl font-semibold text-gray-900">{stats.percentLettered.toFixed(1)}%</div>
          <div className="text-xs text-gray-500">Lettre</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-gray-900">{stats.unletteredEntries}</div>
          <div className="text-xs text-gray-500">Ecritures non lettrees</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-amber-600">{formatCurrency(stats.unletteredAmount)}</div>
          <div className="text-xs text-gray-500">Montant non lettre</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-stone-600">{stats.letteredEntries}</div>
          <div className="text-xs text-gray-500">Ecritures lettrees</div>
        </div>
      </div>
    </div>
  )
}

// Entry Row
function EntryRow({
  entry,
  selected,
  onToggle,
  showLettrageCode,
}: {
  entry: AccountingEntry
  selected: boolean
  onToggle: () => void
  showLettrageCode: boolean
}) {
  const isDebit = (entry.debit || 0) > 0
  const hasLettrage = !!entry.lettrage_code

  return (
    <div
      onClick={onToggle}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
        selected
          ? 'bg-stone-50 border-stone-300 shadow-sm'
          : hasLettrage
          ? 'bg-gray-50 border-gray-200 hover:border-gray-300'
          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {/* Checkbox */}
      <div
        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          selected ? 'bg-stone-600 border-stone-600' : 'border-gray-300'
        }`}
      >
        {selected && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Date */}
      <div className="w-24 text-sm text-gray-600">{formatDate(entry.date)}</div>

      {/* Piece Number */}
      <div className="w-28 text-sm font-mono text-gray-500">{entry.piece_number || '-'}</div>

      {/* Label */}
      <div className="flex-1 text-sm text-gray-900 truncate">{entry.label}</div>

      {/* Debit */}
      <div className="w-28 text-right text-sm font-medium">
        {isDebit ? (
          <span className="text-gray-700">{formatNumber(entry.debit || 0)}</span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </div>

      {/* Credit */}
      <div className="w-28 text-right text-sm font-medium">
        {!isDebit ? (
          <span className="text-stone-600">{formatNumber(entry.credit || 0)}</span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </div>

      {/* Lettrage Code */}
      {showLettrageCode && (
        <div className="w-16 flex justify-center">
          {entry.lettrage_code ? (
            <LettrageBadge
              code={entry.lettrage_code}
              type={entry.lettrage_type || 'tiers'}
              size="sm"
            />
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
        </div>
      )}
    </div>
  )
}

// Selection Summary
function SelectionSummary({
  entries,
  onLetter,
  onUnletter,
  loading,
}: {
  entries: AccountingEntry[]
  onLetter: () => void
  onUnletter: () => void
  loading: boolean
}) {
  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0)
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0)
  const difference = totalDebit - totalCredit
  const isBalanced = Math.abs(difference) < 0.01

  // Check if all selected entries have the same lettrage code (for unlettrage)
  const lettrageCodes = [...new Set(entries.filter((e) => e.lettrage_code).map((e) => e.lettrage_code))]
  const canUnletter = lettrageCodes.length === 1 && entries.every((e) => e.lettrage_code === lettrageCodes[0])

  if (entries.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <div className="text-gray-400 mb-2">
          <Link2 className="w-8 h-8 mx-auto" />
        </div>
        <p className="text-sm text-gray-500">
          Selectionnez des ecritures pour les lettrer
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Les ecritures doivent etre equilibrees (debit = credit)
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Selection ({entries.length} ecritures)
      </h3>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total Debits</span>
          <span className="font-medium text-gray-700">{formatCurrency(totalDebit)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total Credits</span>
          <span className="font-medium text-stone-600">{formatCurrency(totalCredit)}</span>
        </div>
        <div className="border-t border-gray-200 pt-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Ecart</span>
            <span
              className={`font-semibold ${
                isBalanced ? 'text-stone-600' : 'text-amber-600'
              }`}
            >
              {formatCurrency(Math.abs(difference))}
            </span>
          </div>
        </div>
      </div>

      {!isBalanced && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Les ecritures ne sont pas equilibrees. L'ecart doit etre de 0 pour pouvoir lettrer.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onLetter}
          disabled={!isBalanced || entries.length < 2 || loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-600 text-white rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Link2 className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">Lettrer</span>
        </button>

        {canUnletter && (
          <button
            onClick={onUnletter}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <Unlink className="w-4 h-4" />
            <span className="text-sm font-medium">Delettrer</span>
          </button>
        )}
      </div>
    </div>
  )
}

// Auto Match Suggestions
function AutoMatchSuggestions({
  suggestions,
  onApply,
  loading,
}: {
  suggestions: AutoMatchSuggestion[]
  onApply: (entries: AccountingEntry[]) => void
  loading: boolean
}) {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-amber-800 mb-3 flex items-center gap-2">
        <Wand2 className="w-4 h-4" />
        Suggestions de lettrage automatique ({suggestions.length})
      </h3>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {suggestions.slice(0, 5).map((suggestion, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2 bg-white rounded border border-amber-100"
          >
            <div className="text-sm">
              <span className="text-gray-600">{suggestion.entries.length} ecritures</span>
              <span className="text-gray-400 mx-2">-</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(suggestion.totalDebit)}
              </span>
            </div>
            <button
              onClick={() => onApply(suggestion.entries)}
              disabled={loading}
              className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded hover:bg-amber-200 transition-colors disabled:opacity-50"
            >
              Selectionner
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ Main Component ============

interface LettragePageProps {
  onNavigate?: (page: string) => void
}

export default function LettragePage({ onNavigate: _onNavigate }: LettragePageProps) {
  // State
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [selectedAccountCode, setSelectedAccountCode] = useState<string | null>(null)
  const [entries, setEntries] = useState<AccountingEntry[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [loadingAction, setLoadingAction] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showLettered, setShowLettered] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Load accounts (401xxx and 411xxx)
  useEffect(() => {
    async function loadAccounts() {
      setLoading(true)
      try {
        const { data, error: fetchError } = await supabase
          .from('chart_of_accounts')
          .select('id, code, label, type')
          .eq('company_id', COMPANY_ID)
          .eq('is_active', true)
          .or('code.like.401%,code.like.411%')
          .order('code')

        if (fetchError) {
          throw new Error(`Erreur lors du chargement des comptes: ${fetchError.message}`)
        }

        setAccounts(data || [])
      } catch (err) {
        console.error('Error loading accounts:', err)
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    loadAccounts()
  }, [])

  // Load entries for selected account
  useEffect(() => {
    if (!selectedAccountCode) {
      setEntries([])
      return
    }

    async function loadEntries() {
      setLoadingEntries(true)
      setError(null)
      try {
        let query = supabase
          .from('accounting_entries')
          .select('*')
          .eq('company_id', COMPANY_ID)
          .eq('account_code', selectedAccountCode)
          .order('date', { ascending: true })

        // Apply date filters
        if (startDate) {
          query = query.gte('date', startDate)
        }
        if (endDate) {
          query = query.lte('date', endDate)
        }

        // Filter lettered entries if needed
        if (!showLettered) {
          query = query.is('lettrage_code', null)
        }

        const { data, error: fetchError } = await query

        if (fetchError) {
          throw new Error(`Erreur lors du chargement des ecritures: ${fetchError.message}`)
        }

        setEntries(data || [])
        setSelectedIds(new Set()) // Clear selection when changing account
      } catch (err) {
        console.error('Error loading entries:', err)
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoadingEntries(false)
      }
    }

    loadEntries()
  }, [selectedAccountCode, startDate, endDate, showLettered])

  // Calculate stats
  const stats = useMemo<LettrageStats>(() => {
    const letteredEntries = entries.filter((e) => e.lettrage_code)
    const unletteredEntries = entries.filter((e) => !e.lettrage_code)
    const unletteredAmount = unletteredEntries.reduce(
      (sum, e) => sum + Math.abs((e.debit || 0) - (e.credit || 0)),
      0
    )

    return {
      totalEntries: entries.length,
      letteredEntries: letteredEntries.length,
      unletteredEntries: unletteredEntries.length,
      unletteredAmount,
      percentLettered: entries.length > 0 ? (letteredEntries.length / entries.length) * 100 : 0,
    }
  }, [entries])

  // Get selected entries
  const selectedEntries = useMemo(() => {
    return entries.filter((e) => selectedIds.has(e.id))
  }, [entries, selectedIds])

  // Generate auto-match suggestions
  const autoMatchSuggestions = useMemo<AutoMatchSuggestion[]>(() => {
    const unletteredEntries = entries.filter((e) => !e.lettrage_code)
    const suggestions: AutoMatchSuggestion[] = []

    // Find exact matches between debits and credits
    const debits = unletteredEntries.filter((e) => (e.debit || 0) > 0)
    const credits = unletteredEntries.filter((e) => (e.credit || 0) > 0)

    // Simple 1-to-1 matches
    for (const debit of debits) {
      const debitAmount = debit.debit || 0
      const matchingCredit = credits.find(
        (c) => Math.abs((c.credit || 0) - debitAmount) < 0.01 && !suggestions.some((s) => s.entries.includes(c))
      )

      if (matchingCredit) {
        suggestions.push({
          entries: [debit, matchingCredit],
          totalDebit: debitAmount,
          totalCredit: matchingCredit.credit || 0,
        })
      }
    }

    return suggestions.slice(0, 10)
  }, [entries])

  // Toggle entry selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Select all unlettered entries
  const selectAllUnlettered = useCallback(() => {
    const unletteredIds = entries.filter((e) => !e.lettrage_code).map((e) => e.id)
    setSelectedIds(new Set(unletteredIds))
  }, [entries])

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Letter selected entries
  const letterEntries = useCallback(async () => {
    if (selectedEntries.length < 2) return
    if (!canLetterEntries(selectedEntries)) {
      setError('Les ecritures selectionnees ne peuvent pas etre lettrees (verifiez l\'equilibre)')
      return
    }

    setLoadingAction(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Get existing lettrage codes for this account
      const { data: existingCodes, error: codesError } = await supabase
        .from('accounting_entries')
        .select('lettrage_code')
        .eq('company_id', COMPANY_ID)
        .eq('account_code', selectedAccountCode)
        .not('lettrage_code', 'is', null)

      if (codesError) {
        throw new Error(`Erreur lors de la recuperation des codes: ${codesError.message}`)
      }

      const codes = (existingCodes || [])
        .map((e) => e.lettrage_code)
        .filter((c): c is string => !!c)
      const uniqueCodes = [...new Set(codes)]
      const nextCode = generateNextLettrageCode(uniqueCodes)
      const lettrageType = determineLettrageType(selectedAccountCode!, '', '')
      const now = new Date().toISOString()

      // Update entries with lettrage
      const { error: updateError } = await supabase
        .from('accounting_entries')
        .update({
          lettrage_code: nextCode,
          lettrage_date: now,
          lettrage_type: lettrageType,
        })
        .in(
          'id',
          selectedEntries.map((e) => e.id)
        )

      if (updateError) {
        throw new Error(`Erreur lors du lettrage: ${updateError.message}`)
      }

      // Update local state
      setEntries((prev) =>
        prev.map((e) =>
          selectedIds.has(e.id)
            ? { ...e, lettrage_code: nextCode, lettrage_date: now, lettrage_type: lettrageType }
            : e
        )
      )
      setSelectedIds(new Set())
      setSuccessMessage(`${selectedEntries.length} ecritures lettrees avec le code ${nextCode}`)
    } catch (err) {
      console.error('Error lettering entries:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors du lettrage')
    } finally {
      setLoadingAction(false)
    }
  }, [selectedEntries, selectedAccountCode, selectedIds])

  // Unletter selected entries
  const unletterEntries = useCallback(async () => {
    if (selectedEntries.length === 0) return

    const lettrageCodes = [...new Set(selectedEntries.filter((e) => e.lettrage_code).map((e) => e.lettrage_code))]
    if (lettrageCodes.length !== 1) {
      setError('Selectionnez des ecritures avec le meme code lettrage pour delettrer')
      return
    }

    setLoadingAction(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Find all entries with this lettrage code
      const lettrageCode = lettrageCodes[0]
      const { data: allWithCode, error: findError } = await supabase
        .from('accounting_entries')
        .select('id')
        .eq('company_id', COMPANY_ID)
        .eq('lettrage_code', lettrageCode)

      if (findError) {
        throw new Error(`Erreur lors de la recherche: ${findError.message}`)
      }

      const idsToUnletter = (allWithCode || []).map((e) => e.id)

      // Remove lettrage
      const { error: updateError } = await supabase
        .from('accounting_entries')
        .update({
          lettrage_code: null,
          lettrage_date: null,
          lettrage_type: null,
        })
        .in('id', idsToUnletter)

      if (updateError) {
        throw new Error(`Erreur lors du delettrage: ${updateError.message}`)
      }

      // Update local state
      const idsSet = new Set(idsToUnletter)
      setEntries((prev) =>
        prev.map((e) =>
          idsSet.has(e.id)
            ? { ...e, lettrage_code: undefined, lettrage_date: undefined, lettrage_type: undefined }
            : e
        )
      )
      setSelectedIds(new Set())
      setSuccessMessage(`Code ${lettrageCode} supprime de ${idsToUnletter.length} ecritures`)
    } catch (err) {
      console.error('Error unlettering entries:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors du delettrage')
    } finally {
      setLoadingAction(false)
    }
  }, [selectedEntries])

  // Apply auto-match suggestion
  const applyAutoMatch = useCallback((suggestionEntries: AccountingEntry[]) => {
    setSelectedIds(new Set(suggestionEntries.map((e) => e.id)))
  }, [])

  // Export unlettered entries
  const exportUnlettered = useCallback(() => {
    const unlettered = entries.filter((e) => !e.lettrage_code)
    if (unlettered.length === 0) return

    const csvContent = [
      ['Date', 'N Piece', 'Libelle', 'Debit', 'Credit'].join(';'),
      ...unlettered.map((e) =>
        [
          formatDate(e.date),
          e.piece_number || '',
          e.label,
          formatNumber(e.debit || 0),
          formatNumber(e.credit || 0),
        ].join(';')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ecritures_non_lettrees_${selectedAccountCode}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [entries, selectedAccountCode])

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000)
      return () => clearTimeout(timer)
    }
  }, [error])

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Lettrage manuel</h1>
            <p className="text-sm text-gray-500 mt-1">
              Rapprochez les factures et les paiements sur les comptes tiers
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedAccountCode && (
              <button
                onClick={exportUnlettered}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exporter non lettres
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <AccountSelector
            accounts={accounts}
            selectedCode={selectedAccountCode}
            onSelect={setSelectedAccountCode}
            loading={loading}
          />

          <PeriodFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showLettered}
              onChange={(e) => setShowLettered(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-stone-600 focus:ring-stone-400"
            />
            Afficher les ecritures deja lettrees
          </label>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mx-6 mt-4 p-4 bg-stone-50 border border-stone-200 rounded-lg flex items-start gap-3">
          <Check className="w-5 h-5 text-stone-600 flex-shrink-0" />
          <p className="text-sm text-stone-700">{successMessage}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex gap-6 p-6 min-h-0 overflow-hidden">
        {/* Left: Entries List */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedAccountCode && (
            <>
              {/* Stats */}
              <StatsCard stats={stats} />

              {/* Actions Bar */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {selectedIds.size} selectionne(s) sur {entries.length} ecritures
                  </span>
                  <button
                    onClick={selectAllUnlettered}
                    className="text-sm text-stone-600 hover:text-stone-700"
                  >
                    Selectionner non lettres
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={clearSelection}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Effacer selection
                    </button>
                  )}
                </div>
              </div>

              {/* Table Header */}
              <div className="flex items-center gap-3 px-3 py-2 bg-gray-100 rounded-t-lg border border-gray-200 border-b-0 text-xs font-medium text-gray-500 uppercase">
                <div className="w-5" />
                <div className="w-24">Date</div>
                <div className="w-28">N Piece</div>
                <div className="flex-1">Libelle</div>
                <div className="w-28 text-right">Debit</div>
                <div className="w-28 text-right">Credit</div>
                {showLettered && <div className="w-16 text-center">Lettrage</div>}
              </div>

              {/* Entries */}
              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-b-lg bg-white">
                {loadingEntries ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                  </div>
                ) : entries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <FileText className="w-12 h-12 mb-2" />
                    <p>Aucune ecriture trouvee</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 p-2 space-y-1">
                    {entries.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        selected={selectedIds.has(entry.id)}
                        onToggle={() => toggleSelection(entry.id)}
                        showLettrageCode={showLettered}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!selectedAccountCode && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <FileText className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium text-gray-500">Selectionnez un compte a lettrer</p>
              <p className="text-sm mt-2">Comptes fournisseurs (401) ou clients (411)</p>
            </div>
          )}
        </div>

        {/* Right: Selection Summary & Auto-Match */}
        <div className="w-80 flex-shrink-0 space-y-4">
          <SelectionSummary
            entries={selectedEntries}
            onLetter={letterEntries}
            onUnletter={unletterEntries}
            loading={loadingAction}
          />

          {autoMatchSuggestions.length > 0 && (
            <AutoMatchSuggestions
              suggestions={autoMatchSuggestions}
              onApply={applyAutoMatch}
              loading={loadingAction}
            />
          )}
        </div>
      </div>
    </div>
  )
}
