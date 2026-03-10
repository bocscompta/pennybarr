import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import LettrageBadge from '../components/LettrageBadge'
import type { LettrageType } from '../types/database'
import { getLettrageColor } from '../utils/lettrageColors'
import { exportToCSV, exportToFEC, exportToPDF } from '../services/exportService'
import {
  Book,
  FileText,
  Search,
  Calendar,
  Download,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Settings,
  Trash2,
  AlertCircle,
} from 'lucide-react'

// ============ Types ============

interface AccountingEntry {
  id: string
  journal: string
  date: string
  piece_number: string | null
  label: string
  line_label: string | null
  account_code: string
  debit: number
  credit: number
  third_party_id: string | null
  lettrage_code: string | null
  lettrage_type: LettrageType | null
}

interface Journal {
  id: string
  code: string
  name: string
  type: string
}

interface Account {
  id: string
  code: string
  label: string
}

interface ThirdParty {
  id: string
  code: string
  name: string
}

interface FiscalYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  is_closed: boolean
}

interface ODEntryLine {
  id: string
  accountCode: string
  accountLabel: string
  debit: number
  credit: number
}

// ============ Constants ============

const JOURNAL_TYPE_MAP: Record<string, { color: string; bgColor: string; label: string }> = {
  'AC': { color: '#DC2626', bgColor: '#FEE2E2', label: 'Achats' },
  'ACH': { color: '#DC2626', bgColor: '#FEE2E2', label: 'Achats' },
  'HA': { color: '#DC2626', bgColor: '#FEE2E2', label: 'Achats' },
  'VE': { color: '#16A34A', bgColor: '#DCFCE7', label: 'Ventes' },
  'VT': { color: '#16A34A', bgColor: '#DCFCE7', label: 'Ventes' },
  'VTE': { color: '#16A34A', bgColor: '#DCFCE7', label: 'Ventes' },
  'BQ': { color: '#2563EB', bgColor: '#DBEAFE', label: 'Banque' },
  'BAN': { color: '#2563EB', bgColor: '#DBEAFE', label: 'Banque' },
  'OD': { color: '#D97706', bgColor: '#FEF3C7', label: 'OD' },
  'AN': { color: '#4F46E5', bgColor: '#E0E7FF', label: 'À-Nouveaux' },
  'RAN': { color: '#4F46E5', bgColor: '#E0E7FF', label: 'À-Nouveaux' },
  'CAI': { color: '#DB2777', bgColor: '#FCE7F3', label: 'Caisse' },
  'SAL': { color: '#7C3AED', bgColor: '#F3E8FF', label: 'Salaires' },
}

// ============ Helper Functions ============

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const getJournalStyle = (code: string) => {
  return JOURNAL_TYPE_MAP[code] || { color: '#6C767F', bgColor: '#F2F2F3', label: 'Autre' }
}

// ============ Sub-components ============

interface JournalSidebarProps {
  journals: Journal[]
  entries: AccountingEntry[]
  selectedJournal: string | null
  onSelectJournal: (code: string | null) => void
}

function JournalSidebar({ journals, entries, selectedJournal, onSelectJournal }: JournalSidebarProps) {
  // Count entries per journal
  const journalCounts = useMemo(() => {
    const counts: Record<string, { count: number; debit: number; credit: number }> = {}
    entries.forEach(entry => {
      if (!counts[entry.journal]) {
        counts[entry.journal] = { count: 0, debit: 0, credit: 0 }
      }
      counts[entry.journal].count += 1
      counts[entry.journal].debit += Number(entry.debit) || 0
      counts[entry.journal].credit += Number(entry.credit) || 0
    })
    return counts
  }, [entries])

  // Group journals by type
  const groupedJournals = useMemo(() => {
    const groups: Record<string, Journal[]> = {}
    journals.forEach(journal => {
      const type = getJournalStyle(journal.code).label
      if (!groups[type]) {
        groups[type] = []
      }
      groups[type].push(journal)
    })
    return groups
  }, [journals])

  const totalEntries = entries.length
  const totalDebit = entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0)
  const totalCredit = entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0)

  return (
    <div className="w-64 bg-white border-r flex flex-col" style={{ borderColor: '#E4E5E7' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: '#E4E5E7' }}>
        <h3 className="text-sm font-semibold" style={{ color: '#141A1F' }}>Journaux</h3>
      </div>

      {/* All journals option */}
      <button
        onClick={() => onSelectJournal(null)}
        className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors ${
          selectedJournal === null ? 'bg-[#E6F2F2] border-l-4 border-l-[#006666]' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F2F2F3' }}>
            <Book className="w-4 h-4" style={{ color: '#6C767F' }} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#141A1F' }}>Tous les journaux</p>
            <p className="text-xs" style={{ color: '#6C767F' }}>{totalEntries} écritures</p>
          </div>
        </div>
      </button>

      {/* Journal list */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedJournals).map(([type, typeJournals]) => (
          <div key={type} className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <div className="px-4 py-2 bg-gray-50">
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                {type}
              </span>
            </div>
            {typeJournals.map(journal => {
              const style = getJournalStyle(journal.code)
              const stats = journalCounts[journal.code] || { count: 0, debit: 0, credit: 0 }
              const isSelected = selectedJournal === journal.code

              return (
                <button
                  key={journal.id}
                  onClick={() => onSelectJournal(journal.code)}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors ${
                    isSelected ? 'bg-[#E6F2F2] border-l-4 border-l-[#006666]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="px-2 py-1 rounded text-xs font-bold"
                      style={{ backgroundColor: style.bgColor, color: style.color }}
                    >
                      {journal.code}
                    </span>
                    <div>
                      <p className="text-sm font-medium truncate max-w-28" style={{ color: '#141A1F' }}>
                        {journal.name}
                      </p>
                      <p className="text-xs" style={{ color: '#6C767F' }}>
                        {stats.count} écritures
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Totals footer */}
      <div className="border-t p-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span style={{ color: '#6C767F' }}>Total Débit</span>
            <span className="font-mono font-semibold" style={{ color: '#141A1F' }}>
              {formatNumber(totalDebit)} €
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: '#6C767F' }}>Total Crédit</span>
            <span className="font-mono font-semibold" style={{ color: '#141A1F' }}>
              {formatNumber(totalCredit)} €
            </span>
          </div>
          <div className="pt-2 border-t flex justify-between text-sm" style={{ borderColor: '#F2F2F3' }}>
            <span style={{ color: '#6C767F' }}>Solde</span>
            <span
              className="font-mono font-semibold"
              style={{ color: Math.abs(totalDebit - totalCredit) < 0.01 ? '#16A34A' : '#DC2626' }}
            >
              {formatNumber(totalDebit - totalCredit)} €
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ OD Entry Modal ============

interface ODEntryModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  onSave: (date: string, label: string, lines: ODEntryLine[]) => Promise<void>
}

function ODEntryModal({ isOpen, onClose, accounts, onSave }: ODEntryModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [label, setLabel] = useState('')
  const [lines, setLines] = useState<ODEntryLine[]>([
    { id: '1', accountCode: '', accountLabel: '', debit: 0, credit: 0 },
    { id: '2', accountCode: '', accountLabel: '', debit: 0, credit: 0 },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountSearch, setAccountSearch] = useState<Record<string, string>>({})

  // Calculate totals
  const totals = useMemo(() => {
    const debit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0)
    const credit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0)
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 }
  }, [lines])

  // Filter accounts based on search
  const getFilteredAccounts = useCallback((lineId: string) => {
    const search = accountSearch[lineId]?.toLowerCase() || ''
    if (!search) return accounts.slice(0, 20)
    return accounts.filter(a =>
      a.code.toLowerCase().includes(search) ||
      a.label.toLowerCase().includes(search)
    ).slice(0, 20)
  }, [accounts, accountSearch])

  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      { id: Date.now().toString(), accountCode: '', accountLabel: '', debit: 0, credit: 0 }
    ])
  }

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 2) return
    setLines(prev => prev.filter(l => l.id !== id))
  }

  const handleLineChange = (id: string, field: keyof ODEntryLine, value: string | number) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l
      if (field === 'accountCode') {
        const account = accounts.find(a => a.code === value)
        return { ...l, accountCode: value as string, accountLabel: account?.label || '' }
      }
      return { ...l, [field]: value }
    }))
  }

  const handleSave = async () => {
    setError(null)

    // Validation
    if (!date) {
      setError('La date est obligatoire')
      return
    }
    if (!label.trim()) {
      setError('Le libellé est obligatoire')
      return
    }
    const validLines = lines.filter(l => l.accountCode && (l.debit > 0 || l.credit > 0))
    if (validLines.length < 2) {
      setError('Au moins 2 lignes avec des montants sont nécessaires')
      return
    }
    if (!totals.balanced) {
      setError('L\'écriture doit être équilibrée (Débit = Crédit)')
      return
    }

    setSaving(true)
    try {
      await onSave(date, label, validLines)
      // Reset form
      setDate(new Date().toISOString().split('T')[0])
      setLabel('')
      setLines([
        { id: '1', accountCode: '', accountLabel: '', debit: 0, credit: 0 },
        { id: '2', accountCode: '', accountLabel: '', debit: 0, credit: 0 },
      ])
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
              <FileText className="w-5 h-5" style={{ color: '#D97706' }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
                Nouvelle écriture OD
              </h2>
              <p className="text-sm" style={{ color: '#6C767F' }}>
                Opérations Diverses
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" style={{ color: '#6C767F' }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEE2E2' }}>
              <AlertCircle className="w-5 h-5" style={{ color: '#DC2626' }} />
              <span className="text-sm" style={{ color: '#DC2626' }}>{error}</span>
            </div>
          )}

          {/* Date and Label */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                Date de l'écriture *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                Libellé *
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Régularisation charges..."
                className="w-full px-4 py-2.5 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>
          </div>

          {/* Entry lines */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium" style={{ color: '#141A1F' }}>
                Lignes d'écriture
              </label>
              <button
                onClick={handleAddLine}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg"
                style={{ color: '#006666' }}
              >
                <Plus className="w-4 h-4" />
                Ajouter une ligne
              </button>
            </div>

            <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                <div className="col-span-2">Compte</div>
                <div className="col-span-5">Libellé du compte</div>
                <div className="col-span-2 text-right">Débit</div>
                <div className="col-span-2 text-right">Crédit</div>
                <div className="col-span-1"></div>
              </div>

              {/* Lines */}
              {lines.map((line) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 px-4 py-2 border-t items-center" style={{ borderColor: '#F2F2F3' }}>
                  <div className="col-span-2 relative">
                    <input
                      type="text"
                      value={accountSearch[line.id] ?? line.accountCode}
                      onChange={(e) => {
                        setAccountSearch(prev => ({ ...prev, [line.id]: e.target.value }))
                        if (e.target.value.length >= 3) {
                          const match = accounts.find(a => a.code === e.target.value)
                          if (match) {
                            handleLineChange(line.id, 'accountCode', match.code)
                            setAccountSearch(prev => ({ ...prev, [line.id]: match.code }))
                          }
                        }
                      }}
                      onFocus={() => setAccountSearch(prev => ({ ...prev, [line.id]: line.accountCode }))}
                      onBlur={() => {
                        setTimeout(() => {
                          setAccountSearch(prev => {
                            const newState = { ...prev }
                            delete newState[line.id]
                            return newState
                          })
                        }, 200)
                      }}
                      placeholder="6xxx"
                      className="w-full px-3 py-1.5 border rounded text-sm font-mono"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                    {accountSearch[line.id] !== undefined && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto" style={{ borderColor: '#E4E5E7' }}>
                        {getFilteredAccounts(line.id).map(account => (
                          <button
                            key={account.id}
                            onClick={() => {
                              handleLineChange(line.id, 'accountCode', account.code)
                              setAccountSearch(prev => {
                                const newState = { ...prev }
                                delete newState[line.id]
                                return newState
                              })
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                          >
                            <span className="font-mono text-sm" style={{ color: '#006666' }}>{account.code}</span>
                            <span className="text-sm truncate" style={{ color: '#6C767F' }}>{account.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={line.accountLabel}
                      readOnly
                      placeholder="Sélectionnez un compte"
                      className="w-full px-3 py-1.5 border rounded text-sm bg-gray-50"
                      style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={line.debit || ''}
                      onChange={(e) => handleLineChange(line.id, 'debit', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-1.5 border rounded text-sm font-mono text-right"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={line.credit || ''}
                      onChange={(e) => handleLineChange(line.id, 'credit', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-1.5 border rounded text-sm font-mono text-right"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => handleRemoveLine(line.id)}
                      disabled={lines.length <= 2}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: '#DC2626' }} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Totals */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-t" style={{ borderColor: '#E4E5E7' }}>
                <div className="col-span-7 text-sm font-semibold" style={{ color: '#141A1F' }}>
                  Total
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-sm font-mono font-semibold" style={{ color: '#141A1F' }}>
                    {formatNumber(totals.debit)} €
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-sm font-mono font-semibold" style={{ color: '#141A1F' }}>
                    {formatNumber(totals.credit)} €
                  </span>
                </div>
                <div className="col-span-1"></div>
              </div>
            </div>
          </div>

          {/* Balance indicator */}
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            totals.balanced ? 'bg-green-50' : 'bg-red-50'
          }`}>
            {totals.balanced ? (
              <>
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium" style={{ color: '#16A34A' }}>
                  Écriture équilibrée
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5" style={{ color: '#DC2626' }} />
                <span className="text-sm font-medium" style={{ color: '#DC2626' }}>
                  Écart de {formatNumber(Math.abs(totals.debit - totals.credit))} € - L'écriture doit être équilibrée
                </span>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-sm font-medium"
            style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !totals.balanced}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#006666' }}
          >
            {saving ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enregistrement...
              </div>
            ) : (
              'Enregistrer l\'écriture'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ Main Component ============

interface JournauxPageProps {
  onNavigate?: (page: string) => void
}

export default function JournauxPage({ onNavigate }: JournauxPageProps) {
  // Data state
  const [entries, setEntries] = useState<AccountingEntry[]>([])
  const [journals, setJournals] = useState<Journal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([])
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<FiscalYear | null>(null)
  const [loading, setLoading] = useState(true)

  // Filter state
  const [selectedJournal, setSelectedJournal] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)

  // UI state
  const [showFiscalYearDropdown, setShowFiscalYearDropdown] = useState(false)
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [showODModal, setShowODModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  // Lookups
  const accountMap = useMemo(() => {
    const map: Record<string, Account> = {}
    accounts.forEach(a => { map[a.code] = a })
    return map
  }, [accounts])

  const thirdPartyMap = useMemo(() => {
    const map: Record<string, ThirdParty> = {}
    thirdParties.forEach(t => { map[t.id] = t })
    return map
  }, [thirdParties])

  // Fetch data
  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      try {
        const [fyRes, journalsRes, accountsRes, thirdPartiesRes] = await Promise.all([
          supabase.from('fiscal_years').select('*').order('start_date', { ascending: false }),
          supabase.from('journals').select('*').order('code'),
          supabase.from('chart_of_accounts').select('*').order('code'),
          supabase.from('third_parties').select('*'),
        ])

        if (journalsRes.data) setJournals(journalsRes.data)
        if (accountsRes.data) setAccounts(accountsRes.data)
        if (thirdPartiesRes.data) setThirdParties(thirdPartiesRes.data)

        if (fyRes.data && fyRes.data.length > 0) {
          setFiscalYears(fyRes.data)
          const current = fyRes.data.find(fy => fy.is_current) || fyRes.data[0]
          setSelectedFiscalYear(current)
          setStartDate(current.start_date)
          setEndDate(current.end_date)

          const { data: entriesData } = await supabase
            .from('accounting_entries')
            .select('*')
            .gte('date', current.start_date)
            .lte('date', current.end_date)
            .order('date', { ascending: false })

          if (entriesData) setEntries(entriesData)
        }
      } catch (err) {
        console.error('Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // Fetch entries when fiscal year changes
  const handleFiscalYearChange = async (fy: FiscalYear) => {
    setSelectedFiscalYear(fy)
    setShowFiscalYearDropdown(false)
    setStartDate(fy.start_date)
    setEndDate(fy.end_date)
    setLoading(true)
    try {
      const { data } = await supabase
        .from('accounting_entries')
        .select('*')
        .gte('date', fy.start_date)
        .lte('date', fy.end_date)
        .order('date', { ascending: false })

      if (data) setEntries(data)
    } catch (err) {
      console.error('Error fetching entries:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = [...entries]

    // Filter by journal
    if (selectedJournal) {
      result = result.filter(e => e.journal === selectedJournal)
    }

    // Filter by date range
    if (startDate) {
      result = result.filter(e => e.date >= startDate)
    }
    if (endDate) {
      result = result.filter(e => e.date <= endDate)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(e =>
        e.label.toLowerCase().includes(query) ||
        e.account_code.includes(query) ||
        e.piece_number?.toLowerCase().includes(query) ||
        accountMap[e.account_code]?.label.toLowerCase().includes(query)
      )
    }

    return result
  }, [entries, selectedJournal, startDate, endDate, searchQuery, accountMap])

  // Calculate totals
  const totals = useMemo(() => {
    const debit = filteredEntries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0)
    const credit = filteredEntries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0)
    return { debit, credit, balance: debit - credit }
  }, [filteredEntries])

  // Pagination
  const totalItems = filteredEntries.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Export handlers
  const handleExportCSV = async () => {
    setExporting(true)
    setShowExportDropdown(false)
    try {
      await exportToCSV('journal', {
        startDate: startDate || selectedFiscalYear?.start_date,
        endDate: endDate || selectedFiscalYear?.end_date,
        journal: selectedJournal || undefined,
      })
    } catch (error) {
      console.error('Erreur export CSV:', error)
      alert('Erreur lors de l\'export CSV: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
    } finally {
      setExporting(false)
    }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    setShowExportDropdown(false)
    try {
      await exportToPDF('journal', {
        startDate: startDate || selectedFiscalYear?.start_date,
        endDate: endDate || selectedFiscalYear?.end_date,
        journal: selectedJournal || undefined,
      })
    } catch (error) {
      console.error('Erreur export PDF:', error)
      alert('Erreur lors de l\'export PDF: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
    } finally {
      setExporting(false)
    }
  }

  const handleExportFEC = async () => {
    if (!selectedFiscalYear) return
    setExporting(true)
    setShowExportDropdown(false)
    try {
      await exportToFEC(selectedFiscalYear.start_date, selectedFiscalYear.end_date)
    } catch (error) {
      console.error('Erreur export FEC:', error)
      alert('Erreur lors de l\'export FEC: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
    } finally {
      setExporting(false)
    }
  }

  // Save OD entry
  const handleSaveODEntry = async (date: string, label: string, lines: ODEntryLine[]) => {
    // Generate piece number
    const year = new Date().getFullYear()
    const { data: lastPiece } = await supabase
      .from('accounting_entries')
      .select('piece_number')
      .like('piece_number', `OD${year}%`)
      .order('piece_number', { ascending: false })
      .limit(1)

    let nextNumber = 1
    if (lastPiece && lastPiece.length > 0 && lastPiece[0].piece_number) {
      const lastNum = parseInt(lastPiece[0].piece_number.slice(6), 10)
      if (!isNaN(lastNum)) nextNumber = lastNum + 1
    }
    const pieceNumber = `OD${year}${nextNumber.toString().padStart(6, '0')}`

    // Create entries
    const entriesToInsert = lines.map(line => ({
      journal: 'OD',
      date,
      piece_number: pieceNumber,
      label,
      account_code: line.accountCode,
      debit: line.debit || 0,
      credit: line.credit || 0,
      is_validated: false,
    }))

    const { data, error } = await supabase
      .from('accounting_entries')
      .insert(entriesToInsert)
      .select()

    if (error) {
      throw new Error(`Erreur création écriture OD: ${error.message}`)
    }

    // Refresh entries
    if (data) {
      setEntries(prev => [...data, ...prev])
    }
  }

  // Get selected journal info
  const selectedJournalInfo = selectedJournal
    ? journals.find(j => j.code === selectedJournal)
    : null
  const selectedJournalStyle = selectedJournal
    ? getJournalStyle(selectedJournal)
    : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
              {selectedJournal ? (
                <span className="flex items-center gap-2">
                  <span
                    className="px-2 py-1 rounded text-sm font-bold"
                    style={{ backgroundColor: selectedJournalStyle?.bgColor, color: selectedJournalStyle?.color }}
                  >
                    {selectedJournal}
                  </span>
                  {selectedJournalInfo?.name || 'Journal'}
                </span>
              ) : (
                'Journaux Comptables'
              )}
            </h1>

            {/* Fiscal Year Selector */}
            <div className="relative">
              <button
                onClick={() => setShowFiscalYearDropdown(!showFiscalYearDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm"
                style={{ borderColor: '#16A34A', color: '#16A34A' }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#16A34A' }} />
                {selectedFiscalYear?.name || 'Exercice'}
                <ChevronDown className={`w-4 h-4 transition-transform ${showFiscalYearDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showFiscalYearDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-[220px]" style={{ borderColor: '#E4E5E7' }}>
                  <div className="py-1">
                    {fiscalYears.map((fy) => (
                      <button
                        key={fy.id}
                        onClick={() => handleFiscalYearChange(fy)}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                          selectedFiscalYear?.id === fy.id ? 'bg-[#E6F2F2]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: fy.is_current ? '#16A34A' : fy.is_closed ? '#6C767F' : '#FFC107' }}
                          />
                          <span style={{ color: '#141A1F' }}>{fy.name}</span>
                        </div>
                        {fy.is_closed && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
                            Clôturé
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t px-4 py-2" style={{ borderColor: '#E4E5E7' }}>
                    <button
                      onClick={() => {
                        setShowFiscalYearDropdown(false)
                        onNavigate?.('parametres')
                      }}
                      className="text-sm font-medium flex items-center gap-2"
                      style={{ color: '#006666' }}
                    >
                      <Settings className="w-4 h-4" />
                      Gérer les exercices
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={exporting}
                className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm disabled:opacity-50"
                style={{ borderColor: '#006666', color: '#006666' }}
              >
                {exporting ? (
                  <div className="w-4 h-4 border-2 border-[#006666]/30 border-t-[#006666] rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Exporter
                <ChevronDown className="w-4 h-4" />
              </button>

              {showExportDropdown && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 border-b"
                    style={{ borderColor: '#F2F2F3', color: '#141A1F' }}
                  >
                    <span className="text-lg">📄</span>
                    <div className="text-left">
                      <div className="font-medium">PDF (.pdf)</div>
                      <div className="text-xs" style={{ color: '#6C767F' }}>Export imprimable</div>
                    </div>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 border-b"
                    style={{ borderColor: '#F2F2F3', color: '#141A1F' }}
                  >
                    <span className="text-lg">📊</span>
                    <div className="text-left">
                      <div className="font-medium">CSV (.csv)</div>
                      <div className="text-xs" style={{ color: '#6C767F' }}>Export tableur</div>
                    </div>
                  </button>
                  <button
                    onClick={handleExportFEC}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50"
                    style={{ color: '#141A1F' }}
                  >
                    <span className="text-lg">📋</span>
                    <div className="text-left">
                      <div className="font-medium">FEC (.txt)</div>
                      <div className="text-xs" style={{ color: '#6C767F' }}>Format fiscal DGFiP</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* New OD entry button */}
            <button
              onClick={() => setShowODModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#006666' }}
            >
              <Plus className="w-4 h-4" />
              Nouvelle écriture OD
            </button>
          </div>
        </div>
      </header>

      {/* Filters bar */}
      <div className="bg-white border-b px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6C767F' }} />
            <input
              type="text"
              placeholder="Rechercher par libellé, compte, pièce..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          {/* Date filter */}
          <div className="relative">
            <button
              onClick={() => setShowDateFilter(!showDateFilter)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${
                startDate || endDate ? 'bg-[#E6F2F2] border-[#006666]' : ''
              }`}
              style={{ borderColor: startDate || endDate ? '#006666' : '#D6D9DB', color: '#141A1F' }}
            >
              <Calendar className="w-4 h-4" style={{ color: '#6C767F' }} />
              Période
              {(startDate || endDate) && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#006666', color: 'white' }}>
                  1
                </span>
              )}
            </button>

            {showDateFilter && (
              <div className="absolute top-full left-0 mt-1 p-4 bg-white border rounded-lg shadow-lg z-50" style={{ borderColor: '#E4E5E7', minWidth: '300px' }}>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date début</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date fin</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => {
                        if (selectedFiscalYear) {
                          setStartDate(selectedFiscalYear.start_date)
                          setEndDate(selectedFiscalYear.end_date)
                        }
                        setCurrentPage(1)
                      }}
                      className="text-sm"
                      style={{ color: '#006666' }}
                    >
                      Exercice complet
                    </button>
                    <button
                      onClick={() => setShowDateFilter(false)}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg text-white"
                      style={{ backgroundColor: '#006666' }}
                    >
                      Appliquer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active filters display */}
          {(selectedJournal || searchQuery) && (
            <div className="flex items-center gap-2">
              {selectedJournal && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm" style={{ backgroundColor: '#E6F2F2' }}>
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-bold"
                    style={{ backgroundColor: selectedJournalStyle?.bgColor, color: selectedJournalStyle?.color }}
                  >
                    {selectedJournal}
                  </span>
                  <button onClick={() => setSelectedJournal(null)} className="ml-1">
                    <X className="w-3 h-3" style={{ color: '#6C767F' }} />
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm" style={{ backgroundColor: '#F2F2F3' }}>
                  "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="ml-1">
                    <X className="w-3 h-3" style={{ color: '#6C767F' }} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <JournalSidebar
          journals={journals}
          entries={entries}
          selectedJournal={selectedJournal}
          onSelectJournal={(code) => {
            setSelectedJournal(code)
            setCurrentPage(1)
          }}
        />

        {/* Entries table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#006666' }} />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#F2F2F3' }}>
                <Book className="w-8 h-8" style={{ color: '#6C767F' }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: '#141A1F' }}>
                Aucune écriture trouvée
              </h3>
              <p className="text-sm mb-4" style={{ color: '#6C767F' }}>
                {searchQuery
                  ? 'Essayez de modifier vos critères de recherche'
                  : 'Aucune écriture pour cette période et ce journal'}
              </p>
              {selectedJournal === 'OD' && (
                <button
                  onClick={() => setShowODModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: '#006666' }}
                >
                  <Plus className="w-4 h-4" />
                  Créer une écriture OD
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-max">
                  <thead className="sticky top-0 bg-white border-b z-10" style={{ borderColor: '#E4E5E7' }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        N° Pièce
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Compte
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Libellé
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Débit
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Crédit
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Lettrage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y" style={{ borderColor: '#F2F2F3' }}>
                    {paginatedEntries.map((entry) => {
                      const account = accountMap[entry.account_code]
                      const thirdParty = entry.third_party_id ? thirdPartyMap[entry.third_party_id] : null
                      const debit = Number(entry.debit) || 0
                      const credit = Number(entry.credit) || 0
                      const journalStyle = getJournalStyle(entry.journal)
                      const lettrageColor = entry.lettrage_code ? getLettrageColor(entry.lettrage_type || undefined) : null

                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-gray-50"
                          style={{ backgroundColor: lettrageColor?.row.bg || 'transparent' }}
                        >
                          <td className="px-4 py-3">
                            <span className="text-sm" style={{ color: '#141A1F' }}>
                              {formatDate(entry.date)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {!selectedJournal && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-xs font-bold"
                                  style={{ backgroundColor: journalStyle.bgColor, color: journalStyle.color }}
                                >
                                  {entry.journal}
                                </span>
                              )}
                              <span className="text-sm font-mono" style={{ color: '#6C767F' }}>
                                {entry.piece_number || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono font-medium" style={{ color: '#006666' }}>
                                {entry.account_code}
                              </span>
                              <span className="text-sm truncate max-w-32" style={{ color: '#6C767F' }}>
                                {account?.label || ''}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm truncate block max-w-64" style={{ color: '#141A1F' }}>
                              {thirdParty?.name || entry.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-mono" style={{ color: debit > 0 ? '#141A1F' : '#D6D9DB' }}>
                              {debit > 0 ? formatNumber(debit) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-mono" style={{ color: credit > 0 ? '#141A1F' : '#D6D9DB' }}>
                              {credit > 0 ? formatNumber(credit) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entry.lettrage_code && (
                              <LettrageBadge
                                code={entry.lettrage_code}
                                type={entry.lettrage_type || 'tiers'}
                                isComplete={true}
                                size="sm"
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals bar */}
              <div className="bg-gray-50 border-t px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-sm" style={{ color: '#6C767F' }}>Total Débit</span>
                      <p className="text-lg font-mono font-semibold" style={{ color: '#141A1F' }}>
                        {formatNumber(totals.debit)} €
                      </p>
                    </div>
                    <div>
                      <span className="text-sm" style={{ color: '#6C767F' }}>Total Crédit</span>
                      <p className="text-lg font-mono font-semibold" style={{ color: '#141A1F' }}>
                        {formatNumber(totals.credit)} €
                      </p>
                    </div>
                    <div className="pl-6 border-l" style={{ borderColor: '#E4E5E7' }}>
                      <span className="text-sm" style={{ color: '#6C767F' }}>Solde</span>
                      <p
                        className="text-lg font-mono font-semibold"
                        style={{ color: Math.abs(totals.balance) < 0.01 ? '#16A34A' : '#DC2626' }}
                      >
                        {formatNumber(totals.balance)} €
                        {Math.abs(totals.balance) < 0.01 && (
                          <span className="ml-2 text-xs font-normal">(équilibré)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm" style={{ color: '#6C767F' }}>
                    {totalItems} écriture{totalItems > 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Pagination */}
              <div className="bg-white border-t px-6 py-3 flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
                <div className="flex items-center gap-1">
                  {[25, 50, 100].map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        setItemsPerPage(n)
                        setCurrentPage(1)
                      }}
                      className={`px-2.5 py-1 rounded text-sm font-medium transition-colors ${
                        itemsPerPage === n ? 'text-white' : 'hover:bg-gray-100'
                      }`}
                      style={{
                        backgroundColor: itemsPerPage === n ? '#006666' : 'transparent',
                        color: itemsPerPage === n ? 'white' : '#6C767F'
                      }}
                    >
                      {n}
                    </button>
                  ))}
                  <span className="text-sm ml-2" style={{ color: '#6C767F' }}>par page</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm" style={{ color: '#6C767F' }}>
                    {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} sur {totalItems}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" style={{ color: '#6C767F' }} />
                    </button>
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
                      if (pageNum < 1 || pageNum > totalPages) return null
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                            currentPage === pageNum ? 'text-white' : 'hover:bg-gray-100'
                          }`}
                          style={{
                            backgroundColor: currentPage === pageNum ? '#006666' : 'transparent',
                            color: currentPage === pageNum ? 'white' : '#141A1F'
                          }}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" style={{ color: '#6C767F' }} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* OD Entry Modal */}
      <ODEntryModal
        isOpen={showODModal}
        onClose={() => setShowODModal(false)}
        accounts={accounts}
        onSave={handleSaveODEntry}
      />

      {/* Click outside handlers */}
      {(showFiscalYearDropdown || showExportDropdown || showDateFilter) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowFiscalYearDropdown(false)
            setShowExportDropdown(false)
            setShowDateFilter(false)
          }}
        />
      )}
    </div>
  )
}
