import { useState, useMemo, useEffect, useRef } from 'react'
import { useBankAccounts, useAllBankTransactions, useTransactionCategories, useThirdParties, useChartOfAccounts, useSuggestedReconciliationStats, useSuggestedReconciliationIds } from '../hooks/useSupabase'
import { updateBankTransaction } from '../services/supabaseService'
import type { BankTransaction, TransactionCategory, BankAccount, ThirdParty, InvoiceFormData, ChartOfAccount } from '../types/database'
import { processInvoiceOCRDirect, type ExtractedInvoiceData } from '../services/invoiceOCRService'
import { createSupplierInvoice, saveInvoiceDraft, loadInvoiceDraft, clearInvoiceDraft, uploadInvoiceDocument, saveAnalyticalAssignments } from '../services/invoiceService'
import {
  generateInvoiceEntries,
  generatePaymentEntries,
  previewInvoiceEntries,
  previewPaymentEntries,
  previewRTEntries,
  calculateEntryTotals,
  type PreviewEntry,
  getJournalAchats,
  getJournalBanque,
  getJournalRT,
} from '../services/accountingService'
import { getExchangeRate } from '../services/exchangeRateService'
import {
  reconcileInvoiceWithTransaction,
  suggestInvoicesForTransaction,
  smartAutoReconcile,
  type InvoiceSuggestion
} from '../services/reconciliationService'
import AccountPicker from '../components/AccountPicker'
import ThirdPartyPicker from '../components/ThirdPartyPicker'
import InvoiceSearchModal from '../components/InvoiceSearchModal'
import { suggestCounterpartAccount } from '../services/accountClassificationService'
import { Search, XCircle, CheckCircle, Send, Loader2, Plus } from 'lucide-react'

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

// Format date from ISO string
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Format date for display in filters
const formatDateShort = (date: Date) => {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface DisplayTransaction {
  id: string
  date: string
  dateRaw: string
  libelle: string
  montant: number
  categorie: string | null
  categoryId: string | null
  statut: string
  comments: string | null
  bankAccountId: string
  original: BankTransaction
}

// Filter Types
type StatusFilter = 'all' | 'non_justifiee' | 'justifiee' | 'archivee'
type AmountFilter = 'all' | 'encaissements' | 'decaissements'

interface DatePreset {
  label: string
  sublabel?: string
  getRange: () => { start: Date; end: Date }
}

// Column configuration
interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  fixed?: boolean
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'statut', label: 'Statut', visible: true },
  { id: 'date', label: 'Date', visible: true },
  { id: 'libelle', label: 'Libellé', visible: true },
  { id: 'montant', label: 'Montant', visible: true },
  { id: 'categories', label: 'Catégories', visible: true },
  { id: 'type', label: 'Type', visible: true },
  { id: 'tiers', label: 'Tiers', visible: false },
  { id: 'codeAnalytique', label: 'Code analytiques', visible: false },
  { id: 'justificatif', label: 'Justificatif', visible: false },
]

const FIXED_COLUMNS = [
  { id: 'compteBancaire', label: 'Compte bancaire' },
  { id: 'actions', label: 'Actions' },
]

// ============ Filter Dropdown Components ============

// Status Filter Dropdown
function StatusFilterDropdown({
  value,
  onChange,
  onClose,
}: {
  value: StatusFilter[]
  onChange: (value: StatusFilter[]) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const options: { value: StatusFilter; label: string }[] = [
    { value: 'non_justifiee', label: 'Non justifiée' },
    { value: 'justifiee', label: 'Justifiée' },
    { value: 'archivee', label: 'Archivée' },
  ]

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))

  const toggleOption = (opt: StatusFilter) => {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt))
    } else {
      onChange([...value, opt])
    }
  }

  const toggleAll = () => {
    if (value.length === options.length) {
      onChange([])
    } else {
      onChange(options.map(o => o.value))
    }
  }

  return (
    <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
      <div className="p-3 border-b" style={{ borderColor: '#E4E5E7' }}>
        <input
          type="text"
          placeholder="Entrez un nom de statut"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-lg"
          style={{ borderColor: '#D6D9DB' }}
        />
      </div>
      <div className="p-2">
        <label className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={value.length === options.length}
            onChange={toggleAll}
            className="rounded"
          />
          <span className="text-sm" style={{ color: '#141A1F' }}>Tout sélectionner</span>
        </label>
        {filtered.map((opt) => (
          <label key={opt.value} className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={value.includes(opt.value)}
              onChange={() => toggleOption(opt.value)}
              className="rounded"
            />
            <span className="text-sm" style={{ color: '#141A1F' }}>{opt.label}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 p-3 border-t" style={{ borderColor: '#E4E5E7' }}>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg"
          style={{ borderColor: '#006666', color: '#006666' }}
        >
          Annuler
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ backgroundColor: '#006666' }}
        >
          Appliquer
        </button>
      </div>
    </div>
  )
}

// Date Filter Dropdown
function DateFilterDropdown({
  startDate,
  endDate,
  onChange,
  onClose,
}: {
  startDate: Date | null
  endDate: Date | null
  onChange: (start: Date | null, end: Date | null) => void
  onClose: () => void
}) {
  const [viewMonth, setViewMonth] = useState(new Date())
  const [isCustom, setIsCustom] = useState(false)

  const presets: DatePreset[] = [
    {
      label: 'Exercice courant',
      sublabel: `01/01/${new Date().getFullYear()} - 31/12/${new Date().getFullYear()}`,
      getRange: () => ({ start: new Date(new Date().getFullYear(), 0, 1), end: new Date(new Date().getFullYear(), 11, 31) }),
    },
    {
      label: 'Exercice précédent',
      sublabel: `01/01/${new Date().getFullYear() - 1} - 31/12/${new Date().getFullYear() - 1}`,
      getRange: () => ({ start: new Date(new Date().getFullYear() - 1, 0, 1), end: new Date(new Date().getFullYear() - 1, 11, 31) }),
    },
    {
      label: 'Mois en cours',
      getRange: () => ({ start: new Date(new Date().getFullYear(), new Date().getMonth(), 1), end: new Date() }),
    },
    {
      label: '7 derniers jours',
      getRange: () => {
        const end = new Date()
        const start = new Date()
        start.setDate(start.getDate() - 7)
        return { start, end }
      },
    },
    {
      label: 'Mois dernier',
      getRange: () => {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const end = new Date(now.getFullYear(), now.getMonth(), 0)
        return { start, end }
      },
    },
    {
      label: 'Année en cours',
      getRange: () => ({ start: new Date(new Date().getFullYear(), 0, 1), end: new Date() }),
    },
    {
      label: 'Année dernière',
      getRange: () => ({ start: new Date(new Date().getFullYear() - 1, 0, 1), end: new Date(new Date().getFullYear() - 1, 11, 31) }),
    },
  ]

  // Helper to compare dates (ignoring time)
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate()
  }

  // Detect which preset matches current dates
  const getSelectedPreset = (): string | null => {
    if (!startDate || !endDate || isCustom) return isCustom ? 'custom' : null

    for (const preset of presets) {
      const range = preset.getRange()
      if (isSameDay(range.start, startDate) && isSameDay(range.end, endDate)) {
        return preset.label
      }
    }
    return 'custom'
  }

  const selectedPreset = getSelectedPreset()

  const selectPreset = (preset: DatePreset) => {
    setIsCustom(false)
    const range = preset.getRange()
    onChange(range.start, range.end)
  }

  const handleCustomDate = () => {
    setIsCustom(true)
  }

  // Generate calendar days
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []

    // Add empty slots for days before first day of month
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // Monday = 0
    for (let i = 0; i < startDay; i++) {
      days.push(null)
    }

    // Add days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }

    return days
  }

  const days = getDaysInMonth(viewMonth)
  const weekDays = ['LU', 'MA', 'ME', 'JE', 'VE', 'SA', 'DI']

  const isInRange = (date: Date) => {
    if (!startDate || !endDate) return false
    return date >= startDate && date <= endDate
  }

  const isStart = (date: Date) => startDate && date.toDateString() === startDate.toDateString()
  const isEnd = (date: Date) => endDate && date.toDateString() === endDate.toDateString()

  return (
    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7', width: '520px' }}>
      <div className="flex">
        {/* Presets */}
        <div className="w-48 border-r p-3" style={{ borderColor: '#E4E5E7' }}>
          <div className="mb-3 px-2 py-1 text-sm rounded" style={{ backgroundColor: '#F2F2F3', color: '#141A1F' }}>
            {startDate && endDate ? `${formatDateShort(startDate)} - ${formatDateShort(endDate)}` : 'Sélectionner une période'}
          </div>
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => selectPreset(preset)}
              className={`w-full text-left px-3 py-2.5 text-sm rounded-lg mb-1 transition-all ${
                selectedPreset === preset.label
                  ? 'bg-blue-50 border-2 border-blue-500'
                  : 'hover:bg-gray-50 border-2 border-transparent'
              }`}
            >
              <div className="font-medium" style={{ color: '#141A1F' }}>{preset.label}</div>
              {preset.sublabel && <div className="text-xs mt-0.5" style={{ color: '#6C767F' }}>{preset.sublabel}</div>}
            </button>
          ))}
          <button
            onClick={handleCustomDate}
            className={`w-full text-left px-3 py-2.5 text-sm rounded-lg mt-2 transition-all ${
              selectedPreset === 'custom'
                ? 'bg-blue-50 border-2 border-blue-500'
                : 'hover:bg-gray-50 border-2 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPreset === 'custom' ? 'border-[#006666]' : 'border-gray-300'}`}>
                {selectedPreset === 'custom' && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#006666' }} />}
              </div>
              <span className="font-medium" style={{ color: '#141A1F' }}>Date personnalisée</span>
            </div>
            <div className="text-xs ml-6 mt-0.5" style={{ color: '#006666' }}>Ouvrir le calendrier de sélection</div>
          </button>
        </div>

        {/* Calendar */}
        <div className="flex-1 p-3">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1))} className="p-1 hover:bg-gray-100 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <select
                value={viewMonth.getMonth()}
                onChange={(e) => setViewMonth(new Date(viewMonth.getFullYear(), parseInt(e.target.value)))}
                className="px-2 py-1 border rounded text-sm"
                style={{ borderColor: '#D6D9DB' }}
              >
                {['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'].map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={viewMonth.getFullYear()}
                onChange={(e) => setViewMonth(new Date(parseInt(e.target.value), viewMonth.getMonth()))}
                className="px-2 py-1 border rounded text-sm"
                style={{ borderColor: '#D6D9DB' }}
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1))} className="p-1 hover:bg-gray-100 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((d) => (
              <div key={d} className="text-center text-xs font-medium py-1" style={{ color: '#6C767F' }}>{d}</div>
            ))}
            {days.map((date, i) => (
              <button
                key={i}
                disabled={!date}
                onClick={() => {
                  if (!date) return
                  setIsCustom(true)
                  if (!startDate || (startDate && endDate)) {
                    onChange(date, null)
                  } else {
                    if (date < startDate) {
                      onChange(date, startDate)
                    } else {
                      onChange(startDate, date)
                    }
                  }
                }}
                className={`text-center text-sm py-2 rounded-lg ${
                  date && isInRange(date) ? 'bg-[#D9EFEB]' : ''
                } ${
                  date && (isStart(date) || isEnd(date)) ? 'bg-[#006666] text-white' : ''
                } ${date ? 'hover:bg-gray-100' : ''}`}
                style={{ color: date ? (isStart(date) || isEnd(date) ? 'white' : '#141A1F') : 'transparent' }}
              >
                {date?.getDate() || ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-3 border-t" style={{ borderColor: '#E4E5E7' }}>
        <button
          onClick={() => { onChange(null, null); onClose() }}
          className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg"
          style={{ borderColor: '#006666', color: '#006666' }}
        >
          Annuler
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ backgroundColor: '#006666' }}
        >
          Appliquer
        </button>
      </div>
    </div>
  )
}

// Amount Filter Dropdown
function AmountFilterDropdown({
  value,
  minAmount,
  maxAmount,
  useAbsolute,
  onChange,
  onClose,
}: {
  value: AmountFilter
  minAmount: string
  maxAmount: string
  useAbsolute: boolean
  onChange: (filter: AmountFilter, min: string, max: string, absolute: boolean) => void
  onClose: () => void
}) {
  const [localMin, setLocalMin] = useState(minAmount)
  const [localMax] = useState(maxAmount)
  const [localAbsolute, setLocalAbsolute] = useState(useAbsolute)
  const [localFilter, setLocalFilter] = useState(value)

  return (
    <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
      <div className="p-3">
        <input
          type="text"
          placeholder="Entrez un montant"
          value={localMin}
          onChange={(e) => setLocalMin(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-lg mb-3"
          style={{ borderColor: '#D6D9DB' }}
        />
        <label className="flex items-center gap-2 mb-4">
          <div
            onClick={() => setLocalAbsolute(!localAbsolute)}
            className={`w-10 h-5 rounded-full cursor-pointer transition-colors ${localAbsolute ? 'bg-[#006666]' : 'bg-gray-300'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${localAbsolute ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm" style={{ color: '#141A1F' }}>Valeur absolue</span>
        </label>

        <div className="text-xs font-medium mb-2" style={{ color: '#6C767F' }}>FILTRES RAPIDES</div>
        <label className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded cursor-pointer">
          <input
            type="radio"
            name="amountFilter"
            checked={localFilter === 'encaissements'}
            onChange={() => setLocalFilter('encaissements')}
            className="text-[#006666]"
          />
          <span className="text-sm" style={{ color: '#141A1F' }}>Encaissements</span>
        </label>
        <label className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded cursor-pointer">
          <input
            type="radio"
            name="amountFilter"
            checked={localFilter === 'decaissements'}
            onChange={() => setLocalFilter('decaissements')}
            className="text-[#006666]"
          />
          <span className="text-sm" style={{ color: '#141A1F' }}>Décaissements</span>
        </label>

        <button className="text-sm font-medium mt-3" style={{ color: '#006666' }}>+ Plus de filtres</button>
      </div>

      <div className="flex gap-2 p-3 border-t" style={{ borderColor: '#E4E5E7' }}>
        <button
          onClick={() => { onChange('all', '', '', true); onClose() }}
          className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg"
          style={{ borderColor: '#006666', color: '#006666' }}
        >
          Annuler
        </button>
        <button
          onClick={() => { onChange(localFilter, localMin, localMax, localAbsolute); onClose() }}
          className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ backgroundColor: '#006666' }}
        >
          Appliquer
        </button>
      </div>
    </div>
  )
}

// Category Filter Dropdown
function CategoryFilterDropdown({
  categories,
  selectedIds,
  onChange,
  onClose,
}: {
  categories: TransactionCategory[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'and' | 'or'>('or')

  const expenseCategories = categories.filter(c => c.type === 'expense')
  const incomeCategories = categories.filter(c => c.type === 'income')

  const filteredExpense = expenseCategories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  const filteredIncome = incomeCategories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  const toggleCategory = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(i => i !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-hidden flex flex-col" style={{ borderColor: '#E4E5E7' }}>
      <div className="p-3 border-b" style={{ borderColor: '#E4E5E7' }}>
        <input
          type="text"
          placeholder="Rechercher un libellé analytique"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-lg"
          style={{ borderColor: '#D6D9DB' }}
        />
      </div>

      <div className="p-3 border-b flex items-center gap-4" style={{ borderColor: '#E4E5E7' }}>
        <label className="flex items-center gap-2 cursor-pointer">
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${mode === 'and' ? 'border-[#006666]' : 'border-gray-300'}`}>
            {mode === 'and' && <div className="w-2 h-2 rounded-full bg-[#006666]" />}
          </div>
          <span className="text-sm" style={{ color: '#141A1F' }} onClick={() => setMode('and')}>Et</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${mode === 'or' ? 'border-[#006666]' : 'border-gray-300'}`}>
            {mode === 'or' && <div className="w-2 h-2 rounded-full bg-[#006666]" />}
          </div>
          <span className="text-sm" style={{ color: '#141A1F' }} onClick={() => setMode('or')}>Ou</span>
        </label>
      </div>
      <div className="text-xs px-3 py-1" style={{ color: '#6C767F' }}>
        Écritures ayant {mode === 'and' ? 'toutes' : 'au moins une'} les catégories sélectionnées
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <label className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={selectedIds.includes('uncategorized')}
            onChange={() => toggleCategory('uncategorized')}
            className="rounded"
          />
          <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
            Non catégorisé
          </span>
        </label>

        {filteredExpense.length > 0 && (
          <>
            <div className="text-xs font-medium px-2 py-2" style={{ color: '#6C767F' }}>TYPES DE DÉPENSES / REVENUS</div>
            {filteredExpense.map((cat) => (
              <label key={cat.id} className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                  className="rounded"
                />
                <span
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  {cat.name}
                </span>
              </label>
            ))}
          </>
        )}

        {filteredIncome.length > 0 && (
          <>
            {filteredIncome.map((cat) => (
              <label key={cat.id} className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                  className="rounded"
                />
                <span
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  {cat.name}
                </span>
              </label>
            ))}
          </>
        )}
      </div>

      <div className="flex gap-2 p-3 border-t" style={{ borderColor: '#E4E5E7' }}>
        <button
          onClick={() => { onChange([]); onClose() }}
          className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg"
          style={{ borderColor: '#006666', color: '#006666' }}
        >
          Annuler
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ backgroundColor: '#006666' }}
        >
          Appliquer
        </button>
      </div>
    </div>
  )
}

// Bank Account Filter Dropdown
function BankAccountFilterDropdown({
  accounts,
  selectedIds,
  onChange,
  onClose,
}: {
  accounts: BankAccount[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.bank_name?.toLowerCase() || '').includes(search.toLowerCase())
  )

  const toggleAccount = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(i => i !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const toggleAll = () => {
    if (selectedIds.length === accounts.length) {
      onChange([])
    } else {
      onChange(accounts.map(a => a.id))
    }
  }

  return (
    <div className="absolute top-full right-0 mt-1 w-80 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
      <div className="p-3 border-b" style={{ borderColor: '#E4E5E7' }}>
        <input
          type="text"
          placeholder="Entrez un nom de compte ou un établissement"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-lg"
          style={{ borderColor: '#D6D9DB' }}
        />
      </div>

      <div className="p-2">
        <button onClick={toggleAll} className="w-full text-left px-2 py-2 text-sm hover:bg-gray-50 rounded" style={{ color: '#141A1F' }}>
          Tout sélectionner
        </button>

        {filtered.map((account) => (
          <label key={account.id} className="flex items-center gap-3 px-2 py-3 hover:bg-gray-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.includes(account.id)}
              onChange={() => toggleAccount(account.id)}
              className="rounded"
            />
            <div className="w-6 h-4 rounded flex items-center justify-center" style={{ backgroundColor: '#F2F2F3' }}>
              <span className="text-xs font-bold" style={{ color: '#6C767F' }}>
                {account.bank_name?.slice(0, 2).toUpperCase() || 'BK'}
              </span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: '#141A1F' }}>
                {account.bank_name} - {account.name}
              </div>
              <div className="text-sm" style={{ color: '#6C767F' }}>
                {formatCurrency(account.current_balance)}
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="flex gap-2 p-3 border-t" style={{ borderColor: '#E4E5E7' }}>
        <button
          onClick={() => { onChange([]); onClose() }}
          className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg"
          style={{ borderColor: '#006666', color: '#006666' }}
        >
          Annuler
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ backgroundColor: '#006666' }}
        >
          Appliquer
        </button>
      </div>
    </div>
  )
}

// ============ Customize Columns Popup ============
function CustomizeColumnsPopup({
  columns,
  onChange,
  onClose,
}: {
  columns: ColumnConfig[]
  onChange: (columns: ColumnConfig[]) => void
  onClose: () => void
}) {
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns)
  const [showColumns, setShowColumns] = useState(true)
  const [showFixed, setShowFixed] = useState(true)

  const toggleColumn = (id: string) => {
    setLocalColumns(prev =>
      prev.map(col => col.id === id ? { ...col, visible: !col.visible } : col)
    )
  }

  const handleReset = () => {
    setLocalColumns(DEFAULT_COLUMNS)
  }

  const handleApply = () => {
    onChange(localColumns)
    onClose()
  }

  const visibleCount = localColumns.filter(c => c.visible).length

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popup */}
      <div
        className="absolute top-full right-0 mt-1 w-80 bg-white rounded-lg shadow-xl border z-50"
        style={{ borderColor: '#E4E5E7' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h3 className="font-medium" style={{ color: '#141A1F' }}>Personnaliser l'affichage</h3>
          <button onClick={handleReset} className="text-sm font-medium" style={{ color: '#006666' }}>
            Réinit.
          </button>
        </div>

        {/* Columns section */}
        <div className="border-b" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={() => setShowColumns(!showColumns)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium" style={{ color: '#141A1F' }}>Colonnes</span>
              <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>{visibleCount}</span>
            </div>
            <svg
              className={`w-5 h-5 transition-transform ${showColumns ? '' : '-rotate-90'}`}
              style={{ color: '#6C767F' }}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {showColumns && (
            <div className="px-4 pb-4 space-y-1">
              {localColumns.map((col) => (
                <div key={col.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleColumn(col.id)}
                      className={`w-10 h-5 rounded-full transition-colors ${col.visible ? 'bg-[#006666]' : 'bg-gray-300'}`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${col.visible ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`}
                      />
                    </button>
                    <span className="text-sm" style={{ color: '#141A1F' }}>{col.label}</span>
                  </div>
                  {/* Drag handle */}
                  <div className="cursor-grab" style={{ color: '#D6D9DB' }}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.5" />
                      <circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" />
                      <circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fixed columns section */}
        <div className="border-b" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={() => setShowFixed(!showFixed)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium" style={{ color: '#141A1F' }}>Fixées</span>
              <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>{FIXED_COLUMNS.length}</span>
            </div>
            <svg
              className={`w-5 h-5 transition-transform ${showFixed ? '' : '-rotate-90'}`}
              style={{ color: '#6C767F' }}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {showFixed && (
            <div className="px-4 pb-4 space-y-2">
              {FIXED_COLUMNS.map((col) => (
                <div key={col.id} className="py-2">
                  <span className="text-sm" style={{ color: '#141A1F' }}>{col.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 p-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg"
            style={{ borderColor: '#006666', color: '#006666' }}
          >
            Annuler
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: '#006666' }}
          >
            Appliquer
          </button>
        </div>
      </div>
    </>
  )
}

// ============ Analytical Codes Popup (inline on row) ============
function AnalyticalCodesPopup({
  transaction,
  categories,
  position,
  onClose,
  onUpdate,
}: {
  transaction: DisplayTransaction
  categories: TransactionCategory[]
  position: { top: number; left: number }
  onClose: () => void
  onUpdate: (id: string, updates: Partial<BankTransaction>) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(
    categories.find(c => c.id === transaction.categoryId) || null
  )
  const [isSaving, setIsSaving] = useState(false)

  const expenseCategories = categories.filter(c => c.type === 'expense')
  const incomeCategories = categories.filter(c => c.type === 'income')

  const filteredExpense = expenseCategories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  const filteredIncome = incomeCategories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  // Count categories without analytical codes
  const categoriesWithoutCodes = categories.filter(c => !c.default_accounting_code).length

  const handleCategorySelect = async (category: TransactionCategory) => {
    setSelectedCategory(category)
    setShowDropdown(false)
    setSearch('')
    setIsSaving(true)
    try {
      await onUpdate(transaction.id, {
        category_id: category.id,
        category: category.name,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCategoryRemove = async () => {
    setSelectedCategory(null)
    setIsSaving(true)
    try {
      await onUpdate(transaction.id, {
        category_id: undefined,
        category: undefined,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popup */}
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border w-80"
        style={{
          top: position.top,
          left: position.left,
          borderColor: '#E4E5E7',
          transform: 'translateX(-100%)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h3 className="font-medium" style={{ color: '#141A1F' }}>Ajoutez des codes analytiques</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Catégories analytiques dropdown */}
          <div className="mb-4">
            <label className="block text-sm mb-2" style={{ color: '#6C767F' }}>Catégories analytiques</label>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB', color: search ? '#141A1F' : '#6C767F' }}
              >
                <input
                  type="text"
                  placeholder="Rechercher une catégorie"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true) }}
                  onClick={(e) => { e.stopPropagation(); setShowDropdown(true) }}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: '#141A1F' }}
                />
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto" style={{ borderColor: '#D6D9DB' }}>
                  {filteredExpense.length > 0 && (
                    <div className="p-2">
                      <p className="text-xs font-medium px-2 py-1" style={{ color: '#6C767F' }}>Types de dépenses / revenus</p>
                      {filteredExpense.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleCategorySelect(cat)}
                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100"
                        >
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                          >
                            {cat.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredIncome.length > 0 && (
                    <div className="p-2 border-t" style={{ borderColor: '#E4E5E7' }}>
                      {filteredIncome.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleCategorySelect(cat)}
                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100"
                        >
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                          >
                            {cat.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredExpense.length === 0 && filteredIncome.length === 0 && (
                    <div className="p-4 text-center text-sm" style={{ color: '#6C767F' }}>
                      Aucune catégorie trouvée
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Types de dépenses / revenus - Selected categories */}
          <div className="mb-4">
            <label className="block text-sm mb-2" style={{ color: '#6C767F' }}>Types de dépenses / revenus</label>
            {selectedCategory ? (
              <div className="flex flex-wrap gap-2">
                <span
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{ backgroundColor: `${selectedCategory.color}20`, color: selectedCategory.color }}
                >
                  {selectedCategory.name}
                  <button
                    onClick={handleCategoryRemove}
                    className="ml-1 hover:opacity-70"
                    disabled={isSaving}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: '#9CA3AF' }}>Aucune catégorie sélectionnée</p>
            )}
          </div>

          {/* Warning message */}
          {categoriesWithoutCodes > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg mb-4" style={{ backgroundColor: '#FEF3C7' }}>
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm" style={{ color: '#92400E' }}>
                {categoriesWithoutCodes} catégorie(s) sans code analytique
              </p>
            </div>
          )}

          {/* Saving indicator */}
          {isSaving && (
            <div className="flex items-center gap-2 text-sm mb-4" style={{ color: '#006666' }}>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: '#006666' }} />
              Enregistrement...
            </div>
          )}

          {/* Links */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: '#E4E5E7' }}>
            <a href="#" className="flex items-center gap-2 text-sm font-medium" style={{ color: '#006666' }}>
              Configurer les catégories
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
            <a href="#" className="flex items-center gap-2 text-sm font-medium" style={{ color: '#006666' }}>
              Créer des règles de catégorisation
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

// ============ Third Party Assign Popup (inline on row) ============
function ThirdPartyAssignPopup({
  transaction,
  thirdParties,
  position,
  onClose,
  onUpdate,
}: {
  transaction: DisplayTransaction
  thirdParties: ThirdParty[]
  position: { top: number; left: number }
  onClose: () => void
  onUpdate: (id: string, updates: Partial<BankTransaction>) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [thirdPartyType, setThirdPartyType] = useState<'supplier' | 'customer'>('supplier')
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const [selectedThirdParty, setSelectedThirdParty] = useState<ThirdParty | null>(
    thirdParties.find(tp => tp.id === transaction.original.third_party_id) || null
  )
  const [isSaving, setIsSaving] = useState(false)

  // Get thirdParty name from raw_data (Pennylane import)
  const rawData = transaction.original.raw_data as Record<string, unknown> | undefined
  const pennylaneThirdParty = rawData?.thirdParty as string | undefined

  // Filter third parties based on selected type
  const filteredThirdParties = thirdParties.filter(tp =>
    (tp.type === thirdPartyType || tp.type === 'both') &&
    tp.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleThirdPartySelect = async (thirdParty: ThirdParty) => {
    setSelectedThirdParty(thirdParty)
    setShowDropdown(false)
    setSearch('')
    setIsSaving(true)
    try {
      await onUpdate(transaction.id, {
        third_party_id: thirdParty.id,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleThirdPartyRemove = async () => {
    setSelectedThirdParty(null)
    setIsSaving(true)
    try {
      await onUpdate(transaction.id, {
        third_party_id: undefined,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popup */}
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border w-80"
        style={{
          top: position.top,
          left: position.left,
          borderColor: '#E4E5E7',
          transform: 'translateX(-100%)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h3 className="font-medium" style={{ color: '#141A1F' }}>Fournisseur / Client</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Pennylane suggestion */}
          {pennylaneThirdParty && !selectedThirdParty && (
            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: '#F0F9FF' }}>
              <p className="text-xs font-medium mb-1" style={{ color: '#6C767F' }}>Suggestion Pennylane</p>
              <p className="text-sm font-medium" style={{ color: '#141A1F' }}>{pennylaneThirdParty}</p>
            </div>
          )}

          {/* Type dropdown */}
          <div className="mb-4">
            <label className="block text-sm mb-2" style={{ color: '#6C767F' }}>Type</label>
            <div className="relative">
              <button
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                {thirdPartyType === 'supplier' ? 'Fournisseur' : 'Client'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {showTypeDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50" style={{ borderColor: '#D6D9DB' }}>
                  <button
                    onClick={() => { setThirdPartyType('supplier'); setShowTypeDropdown(false) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                    style={{ color: '#141A1F' }}
                  >
                    Fournisseur
                  </button>
                  <button
                    onClick={() => { setThirdPartyType('customer'); setShowTypeDropdown(false) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                    style={{ color: '#141A1F' }}
                  >
                    Client
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Third party selection */}
          <div className="mb-4">
            <label className="block text-sm mb-2" style={{ color: '#6C767F' }}>
              {thirdPartyType === 'supplier' ? 'Fournisseur' : 'Client'}
            </label>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB', color: search ? '#141A1F' : '#6C767F' }}
              >
                <input
                  type="text"
                  placeholder={`Rechercher un ${thirdPartyType === 'supplier' ? 'fournisseur' : 'client'}`}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true) }}
                  onClick={(e) => { e.stopPropagation(); setShowDropdown(true) }}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: '#141A1F' }}
                />
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto" style={{ borderColor: '#D6D9DB' }}>
                  {filteredThirdParties.length > 0 ? (
                    <div className="p-2">
                      {filteredThirdParties.map((tp) => (
                        <button
                          key={tp.id}
                          onClick={() => handleThirdPartySelect(tp)}
                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100"
                          style={{ color: '#141A1F' }}
                        >
                          {tp.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm" style={{ color: '#6C767F' }}>
                      Aucun {thirdPartyType === 'supplier' ? 'fournisseur' : 'client'} trouvé
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selected third party */}
          {selectedThirdParty && (
            <div className="mb-4">
              <label className="block text-sm mb-2" style={{ color: '#6C767F' }}>Sélectionné</label>
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: '#F2F2F3' }}>
                <span className="flex-1 text-sm font-medium" style={{ color: '#141A1F' }}>
                  {selectedThirdParty.name}
                </span>
                <button
                  onClick={handleThirdPartyRemove}
                  className="hover:opacity-70"
                  disabled={isSaving}
                >
                  <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Saving indicator */}
          {isSaving && (
            <div className="flex items-center gap-2 text-sm mb-4" style={{ color: '#006666' }}>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: '#006666' }} />
              Enregistrement...
            </div>
          )}

          {/* Links */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: '#E4E5E7' }}>
            <a href="#" className="flex items-center gap-2 text-sm font-medium" style={{ color: '#006666' }}>
              Créer un nouveau {thirdPartyType === 'supplier' ? 'fournisseur' : 'client'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

// ============ Category Assignment Popup (inline on row) ============
function CategoryAssignPopup({
  transaction,
  categories,
  position,
  onClose,
  onUpdate,
}: {
  transaction: DisplayTransaction
  categories: TransactionCategory[]
  position: { top: number; left: number }
  onClose: () => void
  onUpdate: (id: string, updates: Partial<BankTransaction>) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(
    categories.find(c => c.id === transaction.categoryId) || null
  )
  const [isSaving, setIsSaving] = useState(false)

  const expenseCategories = categories.filter(c => c.type === 'expense')
  const incomeCategories = categories.filter(c => c.type === 'income')

  const filteredExpense = expenseCategories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  const filteredIncome = incomeCategories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  const handleCategorySelect = async (category: TransactionCategory) => {
    setSelectedCategory(category)
    setShowDropdown(false)
    setSearch('')
    setIsSaving(true)
    try {
      await onUpdate(transaction.id, {
        category_id: category.id,
        category: category.name,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCategoryRemove = async () => {
    setSelectedCategory(null)
    setIsSaving(true)
    try {
      await onUpdate(transaction.id, {
        category_id: undefined,
        category: undefined,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popup */}
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border w-80"
        style={{
          top: position.top,
          left: position.left,
          borderColor: '#E4E5E7',
          transform: 'translateX(-100%)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h3 className="font-medium" style={{ color: '#141A1F' }}>Ajoutez des catégories analytiques</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Catégories analytiques dropdown */}
          <div className="mb-4">
            <label className="block text-sm mb-2" style={{ color: '#6C767F' }}>Catégories analytiques</label>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB', color: search ? '#141A1F' : '#6C767F' }}
              >
                <input
                  type="text"
                  placeholder="Rechercher une catégorie"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true) }}
                  onClick={(e) => { e.stopPropagation(); setShowDropdown(true) }}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: '#141A1F' }}
                />
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto" style={{ borderColor: '#D6D9DB' }}>
                  {filteredExpense.length > 0 && (
                    <div className="p-2">
                      <p className="text-xs font-medium px-2 py-1" style={{ color: '#6C767F' }}>Types de dépenses</p>
                      {filteredExpense.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleCategorySelect(cat)}
                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 flex items-center gap-2"
                        >
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#6B7280' }} />
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredIncome.length > 0 && (
                    <div className="p-2 border-t" style={{ borderColor: '#E4E5E7' }}>
                      <p className="text-xs font-medium px-2 py-1" style={{ color: '#6C767F' }}>Types de revenus</p>
                      {filteredIncome.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleCategorySelect(cat)}
                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 flex items-center gap-2"
                        >
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#22C55E' }} />
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredExpense.length === 0 && filteredIncome.length === 0 && (
                    <div className="p-4 text-center text-sm" style={{ color: '#6C767F' }}>
                      Aucune catégorie trouvée
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Types de dépenses / revenus - Selected category */}
          <div className="mb-4">
            <label className="block text-sm mb-2" style={{ color: '#6C767F' }}>Types de dépenses / revenus</label>
            {selectedCategory ? (
              <div className="flex flex-wrap gap-2">
                <span
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{ backgroundColor: `${selectedCategory.color}20`, color: selectedCategory.color }}
                >
                  {selectedCategory.name}
                  <button
                    onClick={handleCategoryRemove}
                    className="ml-1 hover:opacity-70"
                    disabled={isSaving}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: '#9CA3AF' }}>Aucune catégorie sélectionnée</p>
            )}
          </div>

          {/* Saving indicator */}
          {isSaving && (
            <div className="flex items-center gap-2 text-sm mb-4" style={{ color: '#006666' }}>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: '#006666' }} />
              Enregistrement...
            </div>
          )}

          {/* Links */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: '#E4E5E7' }}>
            <a href="#" className="flex items-center gap-2 text-sm font-medium" style={{ color: '#006666' }}>
              Configurer les catégories
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
            <a href="#" className="flex items-center gap-2 text-sm font-medium" style={{ color: '#006666' }}>
              Créer des règles de catégorisation
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

// ============ Transaction Detail Panel ============
function TransactionDetailPanel({
  transaction,
  categories,
  thirdParties,
  chartOfAccounts,
  bankAccount,
  onClose,
  onUpdate,
  onNext,
  onRefresh,
}: {
  transaction: DisplayTransaction
  categories: TransactionCategory[]
  thirdParties: ThirdParty[]
  chartOfAccounts: ChartOfAccount[]
  bankAccount?: BankAccount
  onClose: () => void
  onUpdate: (id: string, updates: Partial<BankTransaction>) => Promise<void>
  onNext: () => void
  onRefresh: () => void
}) {
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showThirdPartyForm, setShowThirdPartyForm] = useState(false)
  const [thirdPartyType, setThirdPartyType] = useState<'supplier' | 'customer'>('supplier')
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const [showThirdPartySelect, setShowThirdPartySelect] = useState(false)
  const [pendingThirdParty, setPendingThirdParty] = useState<ThirdParty | null>(null)
  const [thirdPartySearchQuery, setThirdPartySearchQuery] = useState('')
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(
    categories.find(c => c.id === transaction.categoryId) || null
  )
  const [selectedThirdParty, setSelectedThirdParty] = useState<ThirdParty | null>(
    thirdParties.find(tp => tp.id === transaction.original.third_party_id) || null
  )
  const [comments, setComments] = useState(transaction.comments || '')
  const [newComment, setNewComment] = useState('')

  // Parse comments as JSON array or convert legacy string to array
  const parsedComments = useMemo(() => {
    if (!comments) return []
    try {
      const parsed = JSON.parse(comments)
      if (Array.isArray(parsed)) return parsed
      // If it's not an array, treat it as legacy single comment
      return [{ author: 'Utilisateur', authorInitials: 'U', date: new Date().toISOString(), text: comments }]
    } catch {
      // Legacy format: plain string
      if (comments.trim()) {
        return [{ author: 'Utilisateur', authorInitials: 'U', date: new Date().toISOString(), text: comments }]
      }
      return []
    }
  }, [comments])
  const [isSaving, setIsSaving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null)
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isProcessingOCR, setIsProcessingOCR] = useState(false)
  const [ocrData, setOcrData] = useState<ExtractedInvoiceData | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSavingInvoice, setIsSavingInvoice] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Analytical codes state for distribution
  const [analyticalCodes, setAnalyticalCodes] = useState<{
    id: string
    categoryId: string
    categoryName: string
    percentage: number
    accountCode?: string
  }[]>([])
  const [showAnalyticalDropdown, setShowAnalyticalDropdown] = useState(false)
  const [analyticalDisplayMode, setAnalyticalDisplayMode] = useState<'percent' | 'amount'>('percent')

  // Invoice suggestions state
  const [invoiceSuggestions, setInvoiceSuggestions] = useState<InvoiceSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set())
  const [expandedSuggestionId, setExpandedSuggestionId] = useState<string | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<{ url: string; label: string } | null>(null)

  // Justificatif menu state
  const [showJustificatifMenu, setShowJustificatifMenu] = useState(false)
  const justificatifMenuRef = useRef<HTMLDivElement>(null)
  const [showInvoiceSearchModal, setShowInvoiceSearchModal] = useState(false)
  const [isJustificatifOptional, setIsJustificatifOptional] = useState(
    (transaction.original.raw_data as Record<string, unknown>)?.justificatif_optional === true
  )
  const [isJustificatifLost, setIsJustificatifLost] = useState(
    (transaction.original.raw_data as Record<string, unknown>)?.justificatif_lost === true
  )
  const [showJustificatifHelpModal, setShowJustificatifHelpModal] = useState(false)

  // Note: analyticalExpenseCategories removed - was unused, can be re-added for future feature

  // Calculate total percentage
  const totalAnalyticalPercentage = useMemo(() =>
    analyticalCodes.reduce((sum, code) => sum + code.percentage, 0),
    [analyticalCodes]
  )

  /**
   * Détecte la devise et le montant en devise depuis le libellé bancaire.
   * Ex: "PAIEMENT CB 2201 25,00 USD ANTHROPIC" → { currency: 'USD', amount: 25.00 }
   * Ex: "PAIEMENT CB 150,00 EUR" → { currency: 'EUR', amount: 150.00 }
   */
  const detectCurrencyFromLabel = (label: string): { currency: string; amount: number | null } => {
    // Pattern: montant suivi de devise (25,00 USD / 25.00 USD)
    const match = label.match(/(\d[\d\s]*[.,]\d{2})\s*(USD|GBP|CHF|CAD|AUD|JPY|SEK|NOK|DKK|PLN|CZK)/i)
    if (match) {
      const amountStr = match[1].replace(/\s/g, '').replace(',', '.')
      return { currency: match[2].toUpperCase(), amount: parseFloat(amountStr) }
    }
    return { currency: 'EUR', amount: null }
  }

  // Calculate HT and TVA from TTC
  const calculateFromTTC = (ttc: number, vatRateStr: string) => {
    const isAutoliq = vatRateStr.startsWith('autoliq-')

    if (isAutoliq) {
      // En autoliquidation: TTC = HT (le fournisseur étranger ne facture pas de TVA)
      // TVA = 0 sur la facture. La TVA autoliquidée est calculée séparément
      // dans les écritures comptables sur le montant HT converti en EUR.
      return { ht: ttc, vat: 0 }
    }

    // TVA normale: TTC = HT + TVA → HT = TTC / (1 + taux)
    const rate = parseFloat(vatRateStr) / 100
    const ht = ttc / (1 + rate)
    const vat = ttc - ht
    return { ht: Math.round(ht * 100) / 100, vat: Math.round(vat * 100) / 100 }
  }

  // Detect currency from transaction label
  const detectedCurrency = useMemo(() => detectCurrencyFromLabel(transaction.libelle), [transaction.libelle])

  // Initial TTC: use detected foreign amount if available, otherwise bank EUR amount
  const initialTTC = detectedCurrency.amount ?? Math.abs(transaction.montant)
  const initialAmounts = calculateFromTTC(initialTTC, 'autoliq-20')
  const initialCurrency = detectedCurrency.currency

  // Invoice form data (controlled)
  const [invoiceData, setInvoiceData] = useState<InvoiceFormData>(() => ({
    thirdPartyType: 'supplier',
    thirdPartyId: null,
    thirdPartyName: '',
    invoiceNumber: '',
    invoiceDate: transaction.dateRaw.split('T')[0], // Use transaction date
    dueDate: '',
    accountingCode: '',
    entryLabel: '',
    totalTTC: initialTTC,
    totalHT: initialAmounts.ht,
    totalVAT: initialAmounts.vat,
    vatRate: 'autoliq-20',
    currency: initialCurrency,
    hasCCA: false,
    hasFNP: false,
  }))

  // Preview entries state (generated dynamically from form data)
  const [invoiceEntries, setInvoiceEntries] = useState<PreviewEntry[]>([])
  const [paymentEntries, setPaymentEntries] = useState<PreviewEntry[]>([])
  const [rtEntries, setRtEntries] = useState<PreviewEntry[]>([])
  const [isLoadingRate, setIsLoadingRate] = useState(false)

  // Auto-fetch exchange rate when currency or date changes (only if not already set)
  useEffect(() => {
    if (invoiceData.currency !== 'EUR' && invoiceData.invoiceDate) {
      // Always fetch to ensure we have the right rate for this date
      setIsLoadingRate(true)
      getExchangeRate(invoiceData.currency, 'EUR', invoiceData.invoiceDate)
        .then(rate => {
          console.log(`[ExchangeRate] Fetched ${invoiceData.currency}→EUR: ${rate}`)
          setInvoiceData(prev => ({ ...prev, exchangeRate: rate }))
        })
        .catch(err => {
          console.error('Failed to fetch exchange rate:', err)
        })
        .finally(() => setIsLoadingRate(false))
    } else if (invoiceData.currency === 'EUR') {
      setInvoiceData(prev => {
        if (prev.exchangeRate !== undefined) {
          return { ...prev, exchangeRate: undefined }
        }
        return prev
      })
    }
  }, [invoiceData.currency, invoiceData.invoiceDate])

  // Generate preview entries when form data changes
  useEffect(() => {
    // Only generate if we have minimum required data
    if (invoiceData.totalTTC > 0 && invoiceData.thirdPartyName && invoiceData.accountingCode && chartOfAccounts.length > 0) {
      // Generate invoice entries (HA)
      const invEntries = previewInvoiceEntries(
        invoiceData,
        invoiceData.thirdPartyId || undefined,
        chartOfAccounts
      )
      setInvoiceEntries(invEntries)

      // Generate payment entries (BQ) with bank transaction amount for exchange rate diff
      const bankTransactionAmountEUR = Math.abs(transaction.montant)
      const txDate = transaction.dateRaw.split('T')[0]
      const payEntries = previewPaymentEntries(
        invoiceData,
        transaction.libelle,
        bankAccount?.name || 'CIC',
        invoiceData.thirdPartyId || undefined,
        invoiceData.currency !== 'EUR' ? bankTransactionAmountEUR : undefined,
        txDate,
        chartOfAccounts
      )
      setPaymentEntries(payEntries)

      // Generate RT entries (TVA recovery on receipts) if autoliquidated
      const rtEntriesPreview = previewRTEntries(invoiceData, chartOfAccounts, txDate, transaction.libelle)
      setRtEntries(rtEntriesPreview)
    } else {
      setInvoiceEntries([])
      setPaymentEntries([])
      setRtEntries([])
    }
  }, [
    invoiceData.totalTTC,
    invoiceData.totalHT,
    invoiceData.totalVAT,
    invoiceData.vatRate,
    invoiceData.accountingCode,
    invoiceData.thirdPartyName,
    invoiceData.thirdPartyId,
    invoiceData.invoiceNumber,
    invoiceData.invoiceDate,
    invoiceData.entryLabel,
    invoiceData.currency,
    invoiceData.exchangeRate,
    chartOfAccounts,
    bankAccount,
    transaction.libelle,
    transaction.montant,
  ])

  // Reset form when transaction changes - and load existing draft if any
  useEffect(() => {
    const loadDraftOrReset = async () => {
      const detected = detectCurrencyFromLabel(transaction.libelle)
      const ttc = detected.amount ?? Math.abs(transaction.montant)
      const amounts = calculateFromTTC(ttc, 'autoliq-20')

      // Reset basic state
      setOcrData(null)
      setOcrError(null)
      setSaveError(null)
      setShowInvoiceDetail(false)
      setAnalyticalCodes([])
      setShowAnalyticalDropdown(false)

      // Try to load existing draft
      try {
        const { draftData, documentUrl } = await loadInvoiceDraft(transaction.id)

        if (draftData) {
          console.log('📂 Loading existing draft for transaction', transaction.id)
          // Always override currency from transaction label detection
          // (drafts saved before multi-currency support may have EUR hardcoded)
          const draftCurrency = detected.currency !== 'EUR' ? detected.currency : draftData.currency
          const draftTTC = detected.amount ?? draftData.totalTTC
          const draftAmounts = calculateFromTTC(draftTTC, draftData.vatRate)
          // Update entry label with correct currency symbol
          const currencySymbol = draftCurrency === 'EUR' ? '€' : draftCurrency
          const updatedLabel = draftData.entryLabel
            ? draftData.entryLabel.replace(/\d+[.,]\d{2}\s*[€$£]?$/, `${draftTTC.toFixed(2).replace('.', ',')} ${currencySymbol}`)
            : draftData.entryLabel

          setInvoiceData({
            ...draftData,
            currency: draftCurrency,
            totalTTC: draftTTC,
            totalHT: draftAmounts.ht,
            totalVAT: draftAmounts.vat,
            entryLabel: updatedLabel || draftData.entryLabel,
            // Reset exchangeRate so the auto-fetch effect triggers
            exchangeRate: draftCurrency !== 'EUR' ? draftData.exchangeRate : undefined,
            // Reset accountingCode so auto-classification re-runs with latest rules
            accountingCode: '',
          })
          // Restore analytical codes from draft
          if (draftData.analyticalCodes && draftData.analyticalCodes.length > 0) {
            setAnalyticalCodes(draftData.analyticalCodes)
          }
          if (documentUrl) {
            setUploadedFileUrl(documentUrl)
            setUploadedFile(null)
          } else {
            setUploadedFile(null)
            setUploadedFileUrl(null)
          }
          return // Draft loaded, don't reset to defaults
        }
      } catch (error) {
        console.warn('Could not load draft, using defaults:', error)
      }

      // No draft found, use defaults
      setInvoiceData({
        thirdPartyType: 'supplier',
        thirdPartyId: null,
        thirdPartyName: '',
        invoiceNumber: '',
        invoiceDate: transaction.dateRaw.split('T')[0],
        dueDate: '',
        accountingCode: '',
        entryLabel: '',
        totalTTC: ttc,
        totalHT: amounts.ht,
        totalVAT: amounts.vat,
        vatRate: 'autoliq-20',
        currency: detected.currency,
        hasCCA: false,
        hasFNP: false,
      })
      setUploadedFile(null)
      setUploadedFileUrl(null)
    }

    loadDraftOrReset()
  }, [transaction.id])

  // Sync analyticalCodes into invoiceData whenever they change
  useEffect(() => {
    setInvoiceData(prev => ({
      ...prev,
      analyticalCodes: analyticalCodes.length > 0 ? analyticalCodes : undefined,
    }))
  }, [analyticalCodes])

  // Auto-save draft with debounce (1.5s) whenever invoiceData changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (transaction.id && invoiceData.thirdPartyName) {
        saveInvoiceDraft(transaction.id, invoiceData, uploadedFileUrl || undefined)
          .catch(err => console.warn('Auto-save draft failed:', err))
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [invoiceData, transaction.id, uploadedFileUrl])

  // Sync invoiceData when ocrData changes
  useEffect(() => {
    if (ocrData) {
      const ttc = ocrData.totalTTC || Math.abs(transaction.montant)
      // In autoliquidation: HT = TTC, VAT = 0 on the invoice
      const isAutoliq = invoiceData.vatRate.startsWith('autoliq-')
      const ht = isAutoliq ? ttc : (ocrData.totalHT || ttc * 0.833)
      const vat = isAutoliq ? 0 : (ocrData.totalTVA || ttc * 0.167)

      // Currency: OCR > already detected > EUR
      const currency = ocrData.currency || invoiceData.currency
      const currencySymbol = currency === 'EUR' ? '€' : currency

      setInvoiceData(prev => ({
        ...prev,
        thirdPartyName: ocrData.vendorName?.toUpperCase() || prev.thirdPartyName,
        invoiceNumber: ocrData.invoiceNumber || prev.invoiceNumber,
        invoiceDate: ocrData.invoiceDate || prev.invoiceDate,
        dueDate: ocrData.dueDate || prev.dueDate,
        totalTTC: ttc,
        totalHT: ht,
        totalVAT: vat,
        currency,
        entryLabel: `Facture ${ocrData.vendorName?.toUpperCase() || 'FOURNISSEUR'} - ${ocrData.invoiceNumber || ''} - ${ttc.toFixed(2).replace('.', ',')} ${currencySymbol}`,
      }))
    }
  }, [ocrData, transaction.montant])

  // Auto-classify counterpart account when supplier name changes
  useEffect(() => {
    const name = invoiceData.thirdPartyName
    if (!name || name.trim().length < 2) return
    // Don't override if user already picked a counterpart
    if (invoiceData.accountingCode) return

    const timer = setTimeout(async () => {
      try {
        console.log('[TransactionsPage] Classification pour:', name)
        const suggestion = await suggestCounterpartAccount(name, invoiceData.entryLabel)
        if (suggestion) {
          console.log('[TransactionsPage] Suggestion:', suggestion.code, suggestion.label)
          setInvoiceData(prev => {
            // Only set if still empty (user may have picked one in the meantime)
            if (prev.accountingCode) return prev
            return { ...prev, accountingCode: suggestion.code }
          })
        }
      } catch (err) {
        console.warn('[TransactionsPage] Classification error:', err)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [invoiceData.thirdPartyName, invoiceData.entryLabel])

  // Get thirdParty name from raw_data (Pennylane import)
  const rawData = transaction.original.raw_data as Record<string, unknown> | undefined
  const pennylaneThirdParty = rawData?.thirdParty as string | undefined

  useEffect(() => {
    setSelectedCategory(categories.find(c => c.id === transaction.categoryId) || null)
    setSelectedThirdParty(thirdParties.find(tp => tp.id === transaction.original.third_party_id) || null)
    setComments(transaction.comments || '')
    setIsJustificatifOptional((transaction.original.raw_data as Record<string, unknown>)?.justificatif_optional === true)
    setIsJustificatifLost((transaction.original.raw_data as Record<string, unknown>)?.justificatif_lost === true)
  }, [transaction.id, transaction.categoryId, transaction.original.third_party_id, transaction.comments, transaction.original.raw_data, categories, thirdParties])

  // Sync selectedThirdParty to invoiceData
  useEffect(() => {
    if (selectedThirdParty) {
      setInvoiceData(prev => ({
        ...prev,
        thirdPartyId: selectedThirdParty.id,
        thirdPartyName: selectedThirdParty.name,
        thirdPartyType: selectedThirdParty.type === 'customer' ? 'customer' : 'supplier',
      }))
    }
  }, [selectedThirdParty])

  // Close justificatif menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (justificatifMenuRef.current && !justificatifMenuRef.current.contains(e.target as Node)) {
        setShowJustificatifMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load invoice suggestions when transaction changes and not yet reconciled
  useEffect(() => {
    const loadSuggestions = async () => {
      // Only load if transaction is not reconciled and no file uploaded
      if (transaction.original.is_reconciled || uploadedFile || uploadedFileUrl) {
        setInvoiceSuggestions([])
        return
      }

      setIsLoadingSuggestions(true)
      setDismissedSuggestionIds(new Set())
      try {
        const suggestions = await suggestInvoicesForTransaction(transaction.original)
        setInvoiceSuggestions(suggestions)
      } catch (error) {
        console.error('Error loading invoice suggestions:', error)
        setInvoiceSuggestions([])
      } finally {
        setIsLoadingSuggestions(false)
      }
    }

    loadSuggestions()
  }, [transaction.id, transaction.original.is_reconciled, uploadedFile, uploadedFileUrl])

  // Handle accepting a suggested invoice reconciliation
  const handleAcceptSuggestion = async (suggestion: InvoiceSuggestion) => {
    setIsSaving(true)
    try {
      await onUpdate(transaction.id, {
        linked_invoice_id: suggestion.invoice.id,
        is_reconciled: true,
        reconciled_at: new Date().toISOString(),
      })
      onRefresh()
    } finally {
      setIsSaving(false)
    }
  }

  // Dismiss a suggestion
  const handleDismissSuggestion = (invoiceId: string) => {
    setDismissedSuggestionIds(prev => new Set([...prev, invoiceId]))
  }

  const handleCategorySelect = async (category: TransactionCategory | null) => {
    setSelectedCategory(category)
    setShowCategoryDropdown(false)
    setIsSaving(true)
    try {
      await onUpdate(transaction.id, {
        category_id: category?.id || undefined,
        category: category?.name || undefined,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleThirdPartySave = async () => {
    setIsSaving(true)
    try {
      await onUpdate(transaction.id, {
        third_party_id: pendingThirdParty?.id || undefined,
      })
      setSelectedThirdParty(pendingThirdParty)
      // Sync with invoiceData
      if (pendingThirdParty) {
        setInvoiceData(prev => ({
          ...prev,
          thirdPartyId: pendingThirdParty.id,
          thirdPartyName: pendingThirdParty.name,
          thirdPartyType: pendingThirdParty.type === 'customer' ? 'customer' : 'supplier',
        }))
      }
      setShowThirdPartyForm(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleThirdPartyCancel = () => {
    setPendingThirdParty(selectedThirdParty)
    setShowThirdPartyForm(false)
    setShowTypeDropdown(false)
    setShowThirdPartySelect(false)
  }

  const openThirdPartyForm = () => {
    setPendingThirdParty(selectedThirdParty)
    setThirdPartyType(selectedThirdParty?.type === 'customer' ? 'customer' : 'supplier')
    setShowThirdPartyForm(true)
  }

  // Filter third parties based on selected type and search query
  const filteredThirdParties = useMemo(() => {
    const search = thirdPartySearchQuery.toLowerCase().trim()
    const filtered = thirdParties.filter(tp =>
      (tp.type === thirdPartyType || tp.type === 'both') &&
      tp.name.toLowerCase().includes(search)
    )

    // Si recherche non vide et pas de match exact
    if (search && !filtered.some(tp => tp.name.toLowerCase() === search)) {
      return [
        {
          id: '__CREATE__',
          name: thirdPartySearchQuery,
          type: thirdPartyType,
          isCreateOption: true
        } as any,
        ...filtered
      ]
    }
    return filtered
  }, [thirdParties, thirdPartyType, thirdPartySearchQuery])

  const handleCommentsSend = async () => {
    if (!newComment.trim()) return
    setIsSaving(true)
    try {
      // Create new comment object
      const newCommentObj = {
        author: 'Utilisateur', // TODO: Get from auth context
        authorInitials: 'NC',
        date: new Date().toISOString(),
        text: newComment.trim()
      }
      // Append to existing comments
      const updatedComments = [...parsedComments, newCommentObj]
      const commentsJson = JSON.stringify(updatedComments)
      console.log('Saving comments:', commentsJson)
      await onUpdate(transaction.id, { comments: commentsJson })
      setNewComment('') // Clear input after save
      setComments(commentsJson)
      console.log('Comment saved successfully')
    } catch (error) {
      console.error('Error saving comment:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteComment = async (indexToDelete: number) => {
    setIsSaving(true)
    try {
      const updatedComments = parsedComments.filter((_, index) => index !== indexToDelete)
      const commentsJson = updatedComments.length > 0 ? JSON.stringify(updatedComments) : ''
      await onUpdate(transaction.id, { comments: commentsJson || null })
      setComments(commentsJson)
    } catch (error) {
      console.error('Error deleting comment:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Justificatif menu handlers
  const handleJustificatifAction = (action: 'search' | 'lost' | 'cancel_lost' | 'optional' | 'cancel_optional') => {
    console.log('🔍 Action justificatif:', action)
    setShowJustificatifMenu(false)
    switch(action) {
      case 'search':
        console.log('📄 Ouverture modal recherche factures')
        setShowInvoiceSearchModal(true)
        break
      case 'lost':
        setIsJustificatifLost(true)
        setIsJustificatifOptional(false) // Reset optional if setting lost
        const currentRawDataLost = transaction.original.raw_data as Record<string, unknown> || {}
        onUpdate(transaction.id, {
          raw_data: { ...currentRawDataLost, justificatif_lost: true, justificatif_optional: false }
        })
        break
      case 'cancel_lost':
        setIsJustificatifLost(false)
        const currentRawDataCancelLost = transaction.original.raw_data as Record<string, unknown> || {}
        onUpdate(transaction.id, {
          raw_data: { ...currentRawDataCancelLost, justificatif_lost: false }
        })
        break
      case 'optional':
        setIsJustificatifOptional(true)
        setIsJustificatifLost(false) // Reset lost if setting optional
        // Save to database
        const currentRawData = transaction.original.raw_data as Record<string, unknown> || {}
        onUpdate(transaction.id, {
          raw_data: { ...currentRawData, justificatif_optional: true, justificatif_lost: false }
        })
        break
      case 'cancel_optional':
        setIsJustificatifOptional(false)
        // Save to database
        const currentRawDataCancel = transaction.original.raw_data as Record<string, unknown> || {}
        onUpdate(transaction.id, {
          raw_data: { ...currentRawDataCancel, justificatif_optional: false }
        })
        break
    }
  }

  // Handler pour le rapprochement de factures
  const handleReconcileInvoices = async (invoiceIds: string[]) => {
    console.log('Rapprochement des factures:', invoiceIds, 'avec transaction:', transaction.id)
    // TODO: Implémenter le rapprochement réel
    // await reconcileInvoiceWithTransaction(invoiceIds[0], transaction.id)
  }

  // Handler pour créer un nouveau tiers
  const handleCreateNewThirdParty = (name: string) => {
    // TODO: Implémenter la création de tiers inline
    console.log('Créer nouveau tiers:', name, 'type:', thirdPartyType)
    // Pour l'instant, on crée un objet temporaire
    const newThirdParty: ThirdParty = {
      id: `temp-${Date.now()}`,
      name: name,
      type: thirdPartyType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      company_slug: '' // À remplir lors de la sauvegarde
    }
    setPendingThirdParty(newThirdParty)
    setShowThirdPartySelect(false)
    setThirdPartySearchQuery('')
  }

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleFileUpload = async (file: File) => {
    // Check if it's a valid file type (PDF, image)
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      alert('Type de fichier non supporté. Utilisez PDF, JPEG, PNG ou GIF.')
      return
    }

    // Cleanup previous blob URL
    if (uploadedFileUrl && uploadedFileUrl.startsWith('blob:')) {
      URL.revokeObjectURL(uploadedFileUrl)
    }

    // Show local preview while uploading
    const localUrl = URL.createObjectURL(file)
    setUploadedFile(file)
    setUploadedFileUrl(localUrl)
    setOcrError(null)
    setOcrData(null)

    // Upload to Supabase Storage first
    let storedUrl: string | null = null
    try {
      console.log('📤 Uploading document to Storage...')
      storedUrl = await uploadInvoiceDocument(file, transaction.id)
      setUploadedFileUrl(storedUrl) // Replace blob URL with permanent URL
      URL.revokeObjectURL(localUrl) // Cleanup blob URL
      console.log('✅ Document uploaded:', storedUrl)
    } catch (uploadError) {
      console.error('❌ Upload failed:', uploadError)
      // Continue with OCR even if upload fails, keep blob URL
    }

    // Lancer l'OCR automatiquement via Edge Function
    setIsProcessingOCR(true)
    try {
      console.log('🔍 Démarrage OCR via Edge Function...')
      const result = await processInvoiceOCRDirect(file)
      if (result.success && result.data) {
        console.log('✅ OCR réussi:', result.data)
        setOcrData(result.data)

        // Auto-save draft with OCR data
        const ttc = result.data.totalTTC || Math.abs(transaction.montant)
        const isAutoliq = invoiceData.vatRate.startsWith('autoliq-')
        const ht = isAutoliq ? ttc : (result.data.totalHT || ttc * 0.833)
        const vat = isAutoliq ? 0 : (result.data.totalTVA || ttc * 0.167)
        const currency = result.data.currency || invoiceData.currency
        const currencySymbol = currency === 'EUR' ? '€' : currency

        const draftData: InvoiceFormData = {
          ...invoiceData,
          thirdPartyName: result.data.vendorName?.toUpperCase() || invoiceData.thirdPartyName,
          invoiceNumber: result.data.invoiceNumber || invoiceData.invoiceNumber,
          invoiceDate: result.data.invoiceDate || invoiceData.invoiceDate,
          dueDate: result.data.dueDate || invoiceData.dueDate,
          totalTTC: ttc,
          totalHT: ht,
          totalVAT: vat,
          currency,
          entryLabel: `Facture ${result.data.vendorName?.toUpperCase() || 'FOURNISSEUR'} - ${result.data.invoiceNumber || ''} - ${ttc.toFixed(2).replace('.', ',')} ${currencySymbol}`,
        }

        // Save draft to database
        await saveInvoiceDraft(transaction.id, draftData, storedUrl || undefined)
        console.log('💾 Draft auto-saved with OCR data')
      } else {
        console.error('❌ OCR échoué:', result.error)
        setOcrError(result.error || 'Erreur OCR inconnue')

        // Still save draft with document URL even if OCR fails
        if (storedUrl) {
          await saveInvoiceDraft(transaction.id, invoiceData, storedUrl)
          console.log('💾 Draft saved with document (OCR failed)')
        }
      }
    } catch (error) {
      console.error('❌ Erreur OCR:', error)
      setOcrError(error instanceof Error ? error.message : 'Erreur OCR')

      // Still save draft with document URL even if OCR fails
      if (storedUrl) {
        try {
          await saveInvoiceDraft(transaction.id, invoiceData, storedUrl)
          console.log('💾 Draft saved with document (OCR error)')
        } catch (saveError) {
          console.error('❌ Could not save draft:', saveError)
        }
      }
    } finally {
      setIsProcessingOCR(false)
    }
  }

  const handleRemoveFile = async () => {
    // Only revoke blob URLs (not Supabase Storage URLs)
    if (uploadedFileUrl && uploadedFileUrl.startsWith('blob:')) {
      URL.revokeObjectURL(uploadedFileUrl)
    }
    setUploadedFile(null)
    setUploadedFileUrl(null)
    setOcrData(null)
    setOcrError(null)

    // Clear draft from database
    try {
      await clearInvoiceDraft(transaction.id)
      console.log('🗑️ Draft cleared')
    } catch (error) {
      console.error('Error clearing draft:', error)
    }

    // Reset invoice data to defaults
    const detected = detectCurrencyFromLabel(transaction.libelle)
    const ttc = detected.amount ?? Math.abs(transaction.montant)
    const amounts = calculateFromTTC(ttc, 'autoliq-20')
    setInvoiceData({
      thirdPartyType: 'supplier',
      thirdPartyId: null,
      thirdPartyName: '',
      invoiceNumber: '',
      invoiceDate: transaction.dateRaw.split('T')[0],
      dueDate: '',
      accountingCode: '',
      entryLabel: '',
      totalTTC: ttc,
      totalHT: amounts.ht,
      totalVAT: amounts.vat,
      vatRate: 'autoliq-20',
      currency: detected.currency,
      hasCCA: false,
      hasFNP: false,
    })
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  // Update invoice form field
  const updateInvoiceField = <K extends keyof InvoiceFormData>(
    field: K,
    value: InvoiceFormData[K]
  ) => {
    setInvoiceData(prev => {
      const updated = { ...prev, [field]: value }

      // Recalculate HT/VAT when vatRate or TTC changes
      if (field === 'vatRate' || field === 'totalTTC') {
        const vatRateStr = field === 'vatRate' ? (value as string) : prev.vatRate
        const ttc = field === 'totalTTC' ? (value as number) : prev.totalTTC
        const recalculated = calculateFromTTC(ttc, vatRateStr)
        updated.totalHT = recalculated.ht
        updated.totalVAT = recalculated.vat
      }

      return updated
    })
  }

  // Parse French number format (1 234,56) to number
  const parseAmount = (value: string): number => {
    const cleaned = value.replace(/\s/g, '').replace(',', '.')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }

  // Format number to French display (1 234,56)
  const formatAmount = (value: number): string => {
    return value.toFixed(2).replace('.', ',')
  }

  // Handle save invoice (create + accounting entries + reconciliation)
  const handleSaveInvoice = async (validate: boolean = false) => {
    setSaveError(null)
    setIsSavingInvoice(true)

    try {
      // Validate required fields
      if (!invoiceData.thirdPartyName.trim()) {
        throw new Error('Le nom du fournisseur est requis')
      }
      if (!invoiceData.invoiceNumber.trim()) {
        throw new Error('Le numéro de facture est requis')
      }
      if (!invoiceData.invoiceDate) {
        throw new Error('La date de facture est requise')
      }
      if (invoiceData.totalTTC <= 0) {
        throw new Error('Le montant TTC doit être supérieur à 0')
      }
      if (!invoiceData.accountingCode.trim()) {
        throw new Error('Le compte de contrepartie est requis')
      }

      console.log('💾 Creating invoice...', invoiceData)

      // 1. Create invoice in database
      const invoice = await createSupplierInvoice(
        invoiceData,
        transaction.id,
        uploadedFileUrl || undefined
      )
      console.log('✅ Invoice created:', invoice.id)

      // 1b. Save analytical assignments if any
      if (analyticalCodes.length > 0) {
        await saveAnalyticalAssignments(invoice.id, invoice.company_id, invoiceData.totalTTC, analyticalCodes)
        console.log('✅ Analytical assignments saved:', analyticalCodes.length)
      }

      // 2. Generate accounting entries for invoice
      const invoiceEntries = await generateInvoiceEntries(invoice, invoiceData, chartOfAccounts)
      console.log('✅ Invoice entries created:', invoiceEntries.length)

      // 3. Generate payment entries (with exchange rate diff if multi-currency)
      const bankTransactionAmountEUR = invoiceData.currency !== 'EUR' ? Math.abs(transaction.montant) : undefined
      const txDate = transaction.dateRaw.split('T')[0]
      const paymentEntries = await generatePaymentEntries(
        invoice,
        transaction.id,
        bankAccount?.name || 'CIC',
        bankTransactionAmountEUR,
        invoiceData,
        txDate,
        chartOfAccounts
      )
      console.log('✅ Payment entries created:', paymentEntries.length)

      // 4. Reconcile invoice with transaction (+ RT entries if autoliquidated)
      await reconcileInvoiceWithTransaction(invoice.id, transaction.id, invoiceData, txDate, transaction.libelle, chartOfAccounts)
      console.log('✅ Transaction reconciled')

      // 5. Update transaction to mark as reconciled
      await onUpdate(transaction.id, {
        is_reconciled: true,
        reconciled_at: new Date().toISOString(),
        linked_invoice_id: invoice.id,
      })

      // 6. Clear the draft since invoice is now saved
      await clearInvoiceDraft(transaction.id)
      console.log('🗑️ Draft cleared after successful save')

      // 7. Refresh data
      onRefresh()

      // 8. Close panel if validating
      if (validate) {
        onClose()
      }

      // Show success
      console.log('✅ Invoice saved successfully!')

    } catch (error) {
      console.error('❌ Error saving invoice:', error)
      setSaveError(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde')
    } finally {
      setIsSavingInvoice(false)
    }
  }

  // Category dropdown
  const expenseCategories = categories.filter(c => c.type === 'expense')
  const incomeCategories = categories.filter(c => c.type === 'income')

  // Suggest categories based on transaction label
  const suggestedCategories = categories.filter(cat => {
    const label = transaction.libelle.toLowerCase()
    const catName = cat.name.toLowerCase()
    return label.includes(catName) || catName.includes(label.split(' ')[0])
  }).slice(0, 3)

  return (
    <div className="fixed top-0 right-0 w-[420px] bg-white border-l flex flex-col h-full z-50 shadow-xl" style={{ borderColor: '#E4E5E7' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#141A1F' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Écran principal
          </button>
          <button onClick={onNext} className="flex items-center gap-1.5 text-sm" style={{ color: '#6C767F' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
            Suivant
          </button>
        </div>
        <div className="flex items-center gap-1">
          {isSaving && <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: '#006666' }} />}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 py-1 min-w-[160px]" style={{ borderColor: '#E4E5E7' }}>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50" style={{ color: '#141A1F' }}>
                  Dupliquer
                </button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50" style={{ color: '#141A1F' }}>
                  Exporter
                </button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600">
                  Supprimer
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Amount */}
        <div className="mb-2">
          <p className="text-3xl font-bold" style={{ color: transaction.montant < 0 ? '#141A1F' : '#2E7D32' }}>
            {formatCurrency(transaction.montant)}
          </p>
        </div>

        {/* Label & Date */}
        <div className="mb-4">
          <p className="font-medium text-base" style={{ color: '#141A1F' }}>{transaction.libelle}</p>
          <p className="text-sm" style={{ color: '#6C767F' }}>{transaction.date}</p>
        </div>

        {/* Bank Account */}
        {bankAccount && (
          <div className="flex items-center gap-3 mb-5 pb-5 border-b" style={{ borderColor: '#E4E5E7' }}>
            <div className="w-8 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
              {bankAccount.bank_name?.slice(0, 3).toUpperCase() || 'BNK'}
            </div>
            <p className="text-sm" style={{ color: '#141A1F' }}>{bankAccount.name}</p>
          </div>
        )}

        {/* Fournisseur / Client */}
        <div className="mb-5 pb-5 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-medium" style={{ color: '#141A1F' }}>Fournisseur / Client</p>
            {!showThirdPartyForm && (
              <button
                onClick={openThirdPartyForm}
                className="p-1 hover:bg-gray-100 rounded"
                style={{ color: '#006666' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
            )}
          </div>

          {/* Display mode - show current third party */}
          {!showThirdPartyForm && (
            <>
              {selectedThirdParty ? (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-700">
                      {selectedThirdParty.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#141A1F' }}>{selectedThirdParty.name}</p>
                    <p className="text-xs" style={{ color: '#6C767F' }}>
                      {selectedThirdParty.type === 'supplier' ? 'Fournisseur' : selectedThirdParty.type === 'customer' ? 'Client' : 'Client & Fournisseur'}
                    </p>
                  </div>
                </div>
              ) : pennylaneThirdParty ? (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <p className="text-xs font-medium text-amber-800">Import Pennylane</p>
                  </div>
                  <p className="text-sm" style={{ color: '#141A1F' }}>{pennylaneThirdParty}</p>
                </div>
              ) : (
                <p className="text-sm" style={{ color: '#6C767F' }}>Aucun tiers associé</p>
              )}
            </>
          )}

          {/* Edit mode - Pennylane-style form */}
          {showThirdPartyForm && (
            <div className="space-y-3">
              {/* Type and Third Party selection row */}
              <div className="flex gap-2">
                {/* Type dropdown (Fournisseur / Client) */}
                <div className="relative">
                  <button
                    onClick={() => { setShowTypeDropdown(!showTypeDropdown); setShowThirdPartySelect(false) }}
                    className="flex items-center gap-2 px-3 py-2 border-2 rounded-lg text-sm font-medium whitespace-nowrap"
                    style={{ borderColor: '#006666', color: '#006666' }}
                  >
                    {thirdPartyType === 'supplier' ? 'Fournisseur' : 'Client'}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {showTypeDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 py-1 min-w-[120px]" style={{ borderColor: '#E4E5E7' }}>
                      <button
                        onClick={() => { setThirdPartyType('supplier'); setShowTypeDropdown(false); setPendingThirdParty(null) }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${thirdPartyType === 'supplier' ? 'font-medium' : ''}`}
                        style={{ color: '#141A1F' }}
                      >
                        Fournisseur
                      </button>
                      <button
                        onClick={() => { setThirdPartyType('customer'); setShowTypeDropdown(false); setPendingThirdParty(null) }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${thirdPartyType === 'customer' ? 'font-medium' : ''}`}
                        style={{ color: '#141A1F' }}
                      >
                        Client
                      </button>
                    </div>
                  )}
                </div>

                {/* Third party select dropdown */}
                <div className="relative flex-1">
                  <button
                    onClick={() => {
                      setShowThirdPartySelect(!showThirdPartySelect)
                      setShowTypeDropdown(false)
                      if (!showThirdPartySelect) {
                        setThirdPartySearchQuery('')
                      }
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: pendingThirdParty ? '#006666' : '#D6D9DB', color: pendingThirdParty ? '#141A1F' : '#6C767F' }}
                  >
                    <span className="truncate">{pendingThirdParty?.name || 'Choisir...'}</span>
                    <svg className="w-4 h-4 flex-shrink-0 ml-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {showThirdPartySelect && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50" style={{ borderColor: '#E4E5E7' }}>
                      {/* Champ de recherche */}
                      <div className="p-2 border-b" style={{ borderColor: '#E4E5E7' }}>
                        <input
                          type="text"
                          value={thirdPartySearchQuery}
                          onChange={(e) => setThirdPartySearchQuery(e.target.value)}
                          placeholder="Rechercher..."
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          style={{ borderColor: '#D6D9DB' }}
                          autoFocus
                        />
                      </div>
                      {/* Liste des résultats */}
                      <div className="max-h-48 overflow-y-auto">
                        {filteredThirdParties.length > 0 ? (
                          filteredThirdParties.map((tp) => (
                            <button
                              key={tp.id}
                              onClick={() => {
                                if ((tp as any).isCreateOption) {
                                  handleCreateNewThirdParty(tp.name)
                                } else {
                                  setPendingThirdParty(tp)
                                  setShowThirdPartySelect(false)
                                  setThirdPartySearchQuery('')
                                }
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${pendingThirdParty?.id === tp.id ? 'bg-gray-100 font-medium' : ''}`}
                              style={{ color: '#141A1F' }}
                            >
                              {(tp as any).isCreateOption ? (
                                <div className="flex items-center gap-2">
                                  <Plus size={16} style={{ color: '#006666' }} />
                                  <span style={{ color: '#006666', fontWeight: 500 }}>
                                    Créer "{tp.name}"
                                  </span>
                                </div>
                              ) : (
                                <span>{tp.name}</span>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-3 text-center">
                            <p className="text-sm" style={{ color: '#6C767F' }}>
                              Aucun {thirdPartyType === 'supplier' ? 'fournisseur' : 'client'} trouvé
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleThirdPartyCancel}
                  className="flex-1 px-4 py-2 text-sm font-medium border-2 rounded-lg"
                  style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleThirdPartySave}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
                  style={{ backgroundColor: '#006666' }}
                >
                  {isSaving ? 'Enregistrement...' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Justificatif */}
        <div className="mb-5 pb-5 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-medium" style={{ color: '#141A1F' }}>Justificatif</p>
            <div className="relative" ref={justificatifMenuRef}>
              <button
                onClick={() => setShowJustificatifMenu(!showJustificatifMenu)}
                className="p-1 hover:bg-gray-100 rounded"
                style={{ color: '#006666' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              </button>

              {showJustificatifMenu && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg border shadow-lg z-10" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={() => handleJustificatifAction('search')}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 border-b"
                    style={{ borderColor: '#E4E5E7' }}
                  >
                    <Search size={16} style={{ color: '#6C767F' }} />
                    <span style={{ color: '#141A1F' }}>Chercher une facture importée</span>
                  </button>
                  <button
                    onClick={() => handleJustificatifAction(isJustificatifLost ? 'cancel_lost' : 'lost')}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 border-b"
                    style={{ borderColor: '#E4E5E7' }}
                  >
                    <XCircle size={16} style={{ color: '#6C767F' }} />
                    <span style={{ color: '#141A1F' }}>
                      {isJustificatifLost ? (
                        <>Annuler "Marquer comme <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#F3F4F6', color: '#374151' }}>Perdu</span>"</>
                      ) : (
                        'Marquer comme Perdu'
                      )}
                    </span>
                  </button>
                  <button
                    onClick={() => handleJustificatifAction(isJustificatifOptional ? 'cancel_optional' : 'optional')}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
                  >
                    <CheckCircle size={16} style={{ color: '#6C767F' }} />
                    <span style={{ color: '#141A1F' }}>
                      {isJustificatifOptional ? (
                        <>Annuler "Marquer comme <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#E0F2F1', color: '#006666' }}>Facultatif</span>"</>
                      ) : (
                        'Marquer comme Facultatif'
                      )}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Suggestions - Pennylane-style */}
          {(() => {
            const visibleSuggestions = invoiceSuggestions.filter(s => !dismissedSuggestionIds.has(s.invoice.id))
            if (visibleSuggestions.length === 0 && !isLoadingSuggestions) return null
            return (
              <div className="mb-3">
                {/* Badge "N suggestion(s) de facture" */}
                <div className="rounded-lg px-3 py-2 mb-2 flex items-center gap-2" style={{ backgroundColor: '#E8F5E9' }}>
                  <svg className="w-4 h-4" style={{ color: '#2E7D32' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                  <span className="text-sm font-medium" style={{ color: '#2E7D32' }}>
                    {isLoadingSuggestions ? 'Recherche de factures...' : `${visibleSuggestions.length} suggestion${visibleSuggestions.length > 1 ? 's' : ''} de facture`}
                  </span>
                </div>

                {/* Suggestion cards */}
                {visibleSuggestions.map((suggestion) => (
                  <div key={suggestion.invoice.id} className="border rounded-xl p-3 mb-2" style={{ borderColor: '#006666' }}>
                    <div
                      className="flex items-start gap-3 cursor-pointer group"
                      onClick={() => setExpandedSuggestionId(expandedSuggestionId === suggestion.invoice.id ? null : suggestion.invoice.id)}
                    >
                      {/* Miniature */}
                      <div className="w-10 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 border transition-colors group-hover:bg-gray-200 group-hover:border-gray-300" style={{ borderColor: '#E4E5E7' }}>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium group-hover:underline" style={{ color: '#006666' }}>
                          Facture {suggestion.invoice.third_party?.name || suggestion.invoice.number}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#6C767F' }}>
                          émise le {new Date(suggestion.invoice.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-sm font-semibold mt-1" style={{ color: '#141A1F' }}>
                          {suggestion.invoice.total_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                        </p>
                      </div>
                      {/* Eye + Chevron */}
                      <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                        {suggestion.invoice.pdf_url && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewInvoice({
                                url: suggestion.invoice.pdf_url!,
                                label: `Facture ${suggestion.invoice.third_party?.name || suggestion.invoice.number}`,
                              })
                            }}
                            className="p-1 rounded-md transition-colors hover:bg-gray-100"
                            title="Voir la facture"
                          >
                            <svg className="w-4 h-4" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        )}
                        <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${expandedSuggestionId === suggestion.invoice.id ? 'rotate-180' : ''}`} style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {expandedSuggestionId === suggestion.invoice.id && (
                      <div className="mt-3 pt-3 border-t text-xs space-y-1.5" style={{ borderColor: '#E4E5E7', color: '#6C767F' }}>
                        <div className="flex justify-between">
                          <span>N° facture</span>
                          <span className="font-medium" style={{ color: '#141A1F' }}>{suggestion.invoice.number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tiers</span>
                          <span className="font-medium" style={{ color: '#141A1F' }}>{suggestion.invoice.third_party?.name || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Montant HT</span>
                          <span className="font-medium" style={{ color: '#141A1F' }}>{suggestion.invoice.total_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                        </div>
                        <div className="flex justify-between">
                          <span>TVA</span>
                          <span className="font-medium" style={{ color: '#141A1F' }}>{suggestion.invoice.total_vat.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Montant TTC</span>
                          <span className="font-semibold" style={{ color: '#141A1F' }}>{suggestion.invoice.total_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                        </div>
                        {suggestion.invoice.due_date && (
                          <div className="flex justify-between">
                            <span>Echéance</span>
                            <span className="font-medium" style={{ color: '#141A1F' }}>{new Date(suggestion.invoice.due_date).toLocaleDateString('fr-FR')}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Statut</span>
                          <span className="font-medium" style={{ color: '#141A1F' }}>
                            {suggestion.invoice.status === 'paid' ? 'Payée' : suggestion.invoice.status === 'sent' ? 'Envoyée' : suggestion.invoice.status === 'draft' ? 'Brouillon' : suggestion.invoice.status === 'cancelled' ? 'Annulée' : suggestion.invoice.status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Score</span>
                          <span className="font-medium" style={{ color: '#141A1F' }}>{suggestion.score}/100 — {suggestion.reason}</span>
                        </div>
                        {suggestion.invoice.pdf_url && (
                          <a
                            href={suggestion.invoice.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100"
                            style={{ color: '#006666', border: '1px solid #006666' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                            Voir le PDF
                          </a>
                        )}
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleDismissSuggestion(suggestion.invoice.id)}
                        className="flex-1 px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors hover:bg-gray-50"
                        style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                      >
                        Rejeter
                      </button>
                      <button
                        onClick={() => handleAcceptSuggestion(suggestion)}
                        disabled={isSaving}
                        className="flex-1 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
                        style={{ backgroundColor: '#006666' }}
                      >
                        {isSaving ? 'Rapprochement...' : 'Rapprocher'}
                      </button>
                    </div>
                  </div>
                ))}

                <p className="text-center text-sm my-3" style={{ color: '#6C767F' }}>ou</p>
              </div>
            )
          })()}

          {/* Info box when justificatif is marked as optional */}
          {isJustificatifOptional && (
            <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#FFF8E1' }}>
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#141A1F' }}>Facultatif</p>
                  <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                    Le justificatif a été marqué comme facultatif par vous ou votre comptable. Vous pouvez toujours en ajouter un.
                  </p>
                  <button
                    onClick={() => setShowJustificatifHelpModal(true)}
                    className="text-sm mt-2 inline-block hover:underline"
                    style={{ color: '#006666' }}
                  >
                    Qu'est-ce qu'un justificatif facultatif ?
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Info box when justificatif is marked as lost */}
          {isJustificatifLost && (
            <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#F3F4F6' }}>
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#6B7280' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#141A1F' }}>Perdu</p>
                  <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                    Sans justificatif vous ne récupérerez pas de TVA.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Dropzone - show if no file and no draft document URL */}
          {!uploadedFile && !uploadedFileUrl ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center gap-4">
                {/* Illustration */}
                <div className="relative">
                  <div className="w-16 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-medium" style={{ color: '#141A1F' }}>Déposez ici</p>
                  <p className="text-sm" style={{ color: '#6C767F' }}>
                    ou{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="font-medium"
                      style={{ color: '#006666' }}
                    >
                      + Ajouter
                    </button>
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          ) : (
            <>
              {/* Carte de la facture - Cliquable pour ouvrir le détail */}
              <div
                onClick={() => setShowInvoiceDetail(true)}
                className="border rounded-xl p-3 flex items-start gap-3 cursor-pointer hover:bg-gray-50 hover:border-teal-500 transition-all group"
                style={{ borderColor: ocrData ? '#10B981' : isProcessingOCR ? '#F59E0B' : '#E4E5E7' }}
              >
                {/* Miniature du document */}
                <div className="w-12 h-14 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 border relative" style={{ borderColor: '#E4E5E7' }}>
                  {/* Check if PDF by file type or URL extension */}
                  {(uploadedFile?.type === 'application/pdf' || uploadedFileUrl?.toLowerCase().endsWith('.pdf')) ? (
                    <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h6v6h6v10H6z"/>
                      <path d="M8 12h8v2H8zm0 3h8v2H8z"/>
                    </svg>
                  ) : uploadedFileUrl ? (
                    <img src={uploadedFileUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  )}
                  {/* Indicateur OCR en cours */}
                  {isProcessingOCR && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <svg className="w-5 h-5 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Infos de la facture */}
                <div className="flex-1 min-w-0">
                  {/* Ligne 1: Titre + Icône statut */}
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium leading-tight" style={{ color: '#141A1F' }}>
                      Facture {invoiceData.thirdPartyName || ocrData?.vendorName?.toUpperCase() || (uploadedFile?.name ? uploadedFile.name.replace(/\.[^/.]+$/, "").toUpperCase() : 'FOURNISSEUR')}
                      {(invoiceData.invoiceNumber || ocrData?.invoiceNumber) && ` - ${invoiceData.invoiceNumber || ocrData?.invoiceNumber}`}
                    </p>
                    {/* Icône statut inline */}
                    {isProcessingOCR ? (
                      <svg className="w-4 h-4 animate-spin text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                    ) : ocrData ? (
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : ocrError ? (
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    ) : null}
                    {/* Indicateur brouillon sauvegardé */}
                    {uploadedFileUrl && !uploadedFileUrl.startsWith('blob:') && !isProcessingOCR && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-stone-100 text-stone-600 flex-shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Brouillon
                      </span>
                    )}
                  </div>

                  {/* Ligne 2: Date */}
                  <p className="text-xs mt-0.5" style={{ color: '#6C767F' }}>
                    {(invoiceData.invoiceDate || ocrData?.invoiceDate)
                      ? `émise le ${new Date(invoiceData.invoiceDate || ocrData?.invoiceDate || '').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : `ajoutée le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    }
                  </p>

                  {/* Ligne 3: Montant + Bouton Détacher */}
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-semibold" style={{ color: '#141A1F' }}>
                      {(invoiceData.totalTTC > 0 ? invoiceData.totalTTC : (ocrData?.totalTTC || Math.abs(transaction.montant)))
                        .toLocaleString('fr-FR', { minimumFractionDigits: 2 })
                      } €
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                      className="p-1 hover:bg-rose-50 rounded transition-all"
                      title="Détacher"
                    >
                      <svg className="w-4 h-4 text-rose-400 hover:text-rose-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.181 8.68a4.503 4.503 0 011.903 6.405m-9.768-2.782L3.56 14.06a4.5 4.5 0 006.364 6.364l3.536-3.536m-6.364-6.364l3.536-3.536a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Zone d'ajout supplémentaire */}
              <div className="mt-3 flex items-center justify-center gap-2 text-sm" style={{ color: '#6C767F' }}>
                <span
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`${isDragging ? 'text-teal-600 font-medium' : ''}`}
                >
                  Déposez ici
                </span>
                <span>ou</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="font-medium"
                  style={{ color: '#006666' }}
                >
                  + Ajouter
                </button>
              </div>
            </>
          )}

          <p className="text-center text-sm my-3" style={{ color: '#6C767F' }}>ou</p>

          <button
            onClick={() => setShowInvoiceSearchModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Chercher une facture importée
          </button>
        </div>

        {/* Catégorisation */}
        <div className="mb-5 pb-5 border-b" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
            className="w-full flex items-center justify-between mb-3"
          >
            <p className="font-medium" style={{ color: '#141A1F' }}>Catégorisation</p>
            <svg
              className={`w-5 h-5 transition-transform ${isCategoryExpanded ? '' : '-rotate-90'}`}
              style={{ color: '#6C767F' }}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {isCategoryExpanded && (
            <div>
              <p className="text-sm mb-2" style={{ color: '#6C767F' }}>Associez à vos catégories</p>

              <div className="relative mb-3">
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2.5 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                >
                  <span>Rechercher une catégorie</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {showCategoryDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto" style={{ borderColor: '#D6D9DB' }}>
                    {expenseCategories.length > 0 && (
                      <div className="p-2">
                        <p className="text-xs font-medium px-2 py-1" style={{ color: '#6C767F' }}>Types de dépenses</p>
                        {expenseCategories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => handleCategorySelect(cat)}
                            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 flex items-center gap-2"
                          >
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#6B7280' }} />
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {incomeCategories.length > 0 && (
                      <div className="p-2 border-t" style={{ borderColor: '#E4E5E7' }}>
                        <p className="text-xs font-medium px-2 py-1" style={{ color: '#6C767F' }}>Types de revenus</p>
                        {incomeCategories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => handleCategorySelect(cat)}
                            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 flex items-center gap-2"
                          >
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#22C55E' }} />
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedCategory && (
                <div className="flex flex-wrap gap-2 mb-3">
                  <span
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
                    style={{ backgroundColor: `${selectedCategory.color}20`, color: selectedCategory.color }}
                  >
                    {selectedCategory.name}
                    <button onClick={() => handleCategorySelect(null)} className="ml-1 hover:opacity-70">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                </div>
              )}

              {/* Suggestions */}
              {!selectedCategory && suggestedCategories.length > 0 && (
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                  </svg>
                  {suggestedCategories.length} suggestion{suggestedCategories.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Commentaires */}
        <div>
          <p className="font-medium mb-3" style={{ color: '#141A1F' }}>
            Commentaires{parsedComments.length > 0 && ` (${parsedComments.length})`}
          </p>

          {/* Liste des commentaires existants */}
          {parsedComments.length > 0 && (
            <div className="space-y-3 mb-4">
              {parsedComments.map((comment, index) => (
                <div key={index} className="flex gap-3">
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium text-white flex-shrink-0"
                    style={{ backgroundColor: '#3B82F6' }}
                  >
                    {comment.authorInitials || comment.author?.slice(0, 2).toUpperCase() || 'U'}
                  </div>
                  {/* Comment content */}
                  <div className="flex-1 rounded-lg p-3" style={{ backgroundColor: '#E0F2F1' }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm" style={{ color: '#141A1F' }}>
                          {comment.author || 'Utilisateur'}
                        </span>
                        <span className="text-xs" style={{ color: '#6C767F' }}>
                          le {new Date(comment.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(index)}
                        disabled={isSaving}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        title="Supprimer le commentaire"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-sm" style={{ color: '#141A1F' }}>{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Champ pour nouveau commentaire */}
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Laisser une note ou notifier @quelqu'un..."
            className="w-full p-3 border rounded-lg text-sm resize-none"
            style={{ borderColor: '#D6D9DB', minHeight: '80px' }}
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleCommentsSend}
              disabled={isSaving || !newComment.trim()}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#006666' }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Envoyer
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Split-Screen Pennylane Style */}
      {showInvoiceDetail && uploadedFileUrl && (
        <div className="fixed inset-0 z-[100] flex">
          {/* Left Panel - PDF/Image Preview (50%) */}
          <div className="w-1/2 flex flex-col" style={{ backgroundColor: '#1a1a1a' }}>
            {/* PDF Toolbar Top */}
            <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: '#2d2d2d' }}>
              <div className="flex items-center gap-3">
                <span className="text-sm text-white/90">1 / 1</span>
                <div className="flex items-center gap-1">
                  <button className="px-2 py-0.5 rounded hover:bg-white/10 text-white/70 text-sm">−</button>
                  <span className="text-sm text-white/70 px-1">73%</span>
                  <button className="px-2 py-0.5 rounded hover:bg-white/10 text-white/70 text-sm">+</button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded hover:bg-white/10">
                  <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </button>
                <button className="p-1.5 rounded hover:bg-white/10">
                  <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* PDF takes full remaining height */}
            <div className="flex-1">
              {/* Check if PDF by file extension or file type */}
              {(uploadedFile?.type === 'application/pdf' || uploadedFileUrl.toLowerCase().endsWith('.pdf')) ? (
                <iframe
                  src={`${uploadedFileUrl}#navpanes=0&scrollbar=0&view=FitH`}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img
                    src={uploadedFileUrl}
                    alt="Document preview"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Invoice Form (50%) */}
          <div className="w-1/2 bg-white flex flex-col">
            {/* Header Pennylane Style */}
            <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium" style={{ color: '#141A1F' }}>Facture 1 / 1</span>
                <div className="flex items-center gap-0.5">
                  <button className="p-1 rounded hover:bg-gray-100">
                    <svg className="w-4 h-4" style={{ color: '#9CA3AF' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                  </button>
                  <button className="p-1 rounded hover:bg-gray-100">
                    <svg className="w-4 h-4" style={{ color: '#9CA3AF' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-xs rounded border hover:bg-gray-50" style={{ borderColor: '#E4E5E7', color: '#6C767F' }}>
                  Raccourcis
                </button>
                <button className="px-3 py-1.5 text-xs rounded border hover:bg-gray-50" style={{ borderColor: '#E4E5E7', color: '#6C767F' }}>
                  Vue double page
                </button>
                <button
                  onClick={() => handleSaveInvoice(false)}
                  disabled={isSavingInvoice}
                  className="px-3 py-1.5 text-xs rounded border hover:bg-gray-50 disabled:opacity-50"
                  style={{ borderColor: '#E4E5E7', color: '#6C767F' }}
                >
                  {isSavingInvoice ? 'Enregistrement...' : 'Sauvegarder'}
                </button>
                <button
                  onClick={() => handleSaveInvoice(true)}
                  disabled={isSavingInvoice}
                  className="px-3 py-1.5 text-xs rounded text-white flex items-center gap-1 disabled:opacity-50"
                  style={{ backgroundColor: '#22C55E' }}
                >
                  {isSavingInvoice ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                  Valider
                </button>
                <button
                  onClick={() => setShowInvoiceDetail(false)}
                  className="p-1.5 rounded hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form Content - Scrollable */}
            <div className="flex-1 overflow-auto">
              <div className="p-4">
                {/* Section Informations */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-base font-semibold" style={{ color: '#141A1F' }}>Informations</h2>
                    <div className="flex gap-1 text-xs">
                      <button className="px-2 py-1 rounded" style={{ backgroundColor: '#F3F4F6', color: '#6C767F' }}>Pré-traitée</button>
                      <button className="px-2 py-1 rounded hover:bg-gray-100" style={{ color: '#6C767F' }}>Import client</button>
                    </div>
                  </div>
                  <div className="flex gap-1 text-xs">
                    <button className="px-2 py-1 rounded hover:bg-gray-100" style={{ color: '#6C767F' }}>Avoir</button>
                    <button className="px-2 py-1 rounded font-medium" style={{ color: '#141A1F' }}>Facture</button>
                  </div>
                </div>

                {/* Statut OCR */}
                {isProcessingOCR && (
                  <div className="mb-4 p-2.5 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEF3C7', border: '1px solid #F59E0B' }}>
                    <svg className="w-4 h-4 animate-spin" style={{ color: '#F59E0B' }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs font-medium" style={{ color: '#92400E' }}>Analyse OCR en cours...</span>
                  </div>
                )}

                {/* Row 1: Type de tiers + Tiers */}
                <div className="mb-3">
                  <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Tiers</label>
                  <ThirdPartyPicker
                    thirdParties={thirdParties}
                    value={invoiceData.thirdPartyName}
                    selectedId={invoiceData.thirdPartyId}
                    type={invoiceData.thirdPartyType}
                    onChange={(name, id, tp) => {
                      setInvoiceData(prev => ({
                        ...prev,
                        thirdPartyName: name,
                        thirdPartyId: id,
                        thirdPartyType: tp?.type === 'customer' ? 'customer' : 'supplier',
                      }))
                    }}
                    onTypeChange={(type) => updateInvoiceField('thirdPartyType', type)}
                    placeholder="Rechercher un tiers..."
                  />
                </div>

                {/* Row 2: Numéro de facture + Émission + Échéance */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Numéro de facture</label>
                    <div className="flex">
                      <input
                        type="text"
                        value={invoiceData.invoiceNumber}
                        onChange={(e) => updateInvoiceField('invoiceNumber', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 border rounded-l text-sm"
                        style={{ borderColor: '#D6D9DB' }}
                      />
                      <button className="px-2 border border-l-0 rounded-r hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                        <svg className="w-4 h-4" style={{ color: '#7C3AED' }} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Émission</label>
                    <div className="flex">
                      <span className="px-2 py-1.5 border rounded-l bg-gray-50 text-sm" style={{ borderColor: '#D6D9DB' }}>
                        <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                      </span>
                      <input
                        type="date"
                        value={invoiceData.invoiceDate}
                        onChange={(e) => updateInvoiceField('invoiceDate', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 border border-l-0 text-sm"
                        style={{ borderColor: '#D6D9DB' }}
                      />
                      <button className="px-2 border border-l-0 rounded-r hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                        <svg className="w-4 h-4" style={{ color: '#7C3AED' }} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Échéance</label>
                    <div className="flex">
                      <span className="px-2 py-1.5 border rounded-l bg-gray-50 text-sm" style={{ borderColor: '#D6D9DB' }}>
                        <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                      </span>
                      <input
                        type="date"
                        value={invoiceData.dueDate}
                        onChange={(e) => updateInvoiceField('dueDate', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 border border-l-0 rounded-r text-sm"
                        style={{ borderColor: '#D6D9DB' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: Contrepartie + Libellé de l'écriture */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Contrepartie</label>
                    <AccountPicker
                      accounts={chartOfAccounts}
                      value={invoiceData.accountingCode}
                      onChange={(code) => updateInvoiceField('accountingCode', code)}
                      placeholder="Rechercher un compte (6xxx)..."
                      filterClass="6"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 flex items-center gap-1" style={{ color: '#6C767F' }}>
                      Libellé de l'écriture
                      <svg className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                    </label>
                    <input
                      type="text"
                      value={invoiceData.entryLabel}
                      onChange={(e) => updateInvoiceField('entryLabel', e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                </div>

                {/* Row 4: Montants */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Total TTC</label>
                    <div className="flex">
                      <input
                        type="text"
                        value={formatAmount(invoiceData.totalTTC)}
                        onChange={(e) => updateInvoiceField('totalTTC', parseAmount(e.target.value))}
                        className="w-full px-2.5 py-1.5 border rounded-l text-sm"
                        style={{ borderColor: '#D6D9DB' }}
                      />
                      <button className="px-1.5 border border-l-0 hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                        <svg className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </button>
                      <select
                        value={invoiceData.currency}
                        onChange={(e) => updateInvoiceField('currency', e.target.value)}
                        className="px-1.5 py-1.5 border border-l-0 rounded-r text-xs"
                        style={{ borderColor: '#D6D9DB' }}
                      >
                        <option value="EUR">€</option>
                        <option value="USD">$</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Montant HT</label>
                    <div className="flex">
                      <input
                        type="text"
                        value={formatAmount(invoiceData.totalHT)}
                        onChange={(e) => updateInvoiceField('totalHT', parseAmount(e.target.value))}
                        className="w-full px-2.5 py-1.5 border rounded-l text-sm"
                        style={{ borderColor: '#D6D9DB' }}
                      />
                      <button className="px-1.5 border border-l-0 hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                        <svg className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </button>
                      <select className="px-1.5 py-1.5 border border-l-0 rounded-r text-xs" style={{ borderColor: '#D6D9DB' }}>
                        <option>€</option>
                        <option>$</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Montant TVA</label>
                    <div className="flex">
                      <input
                        type="text"
                        value={formatAmount(invoiceData.totalVAT)}
                        onChange={(e) => updateInvoiceField('totalVAT', parseAmount(e.target.value))}
                        className="w-full px-2.5 py-1.5 border rounded-l text-sm"
                        style={{ borderColor: '#D6D9DB' }}
                      />
                      <button className="px-1.5 border border-l-0 hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                        <svg className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </button>
                      <select className="px-1.5 py-1.5 border border-l-0 rounded-r text-xs" style={{ borderColor: '#D6D9DB' }}>
                        <option>€</option>
                        <option>$</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Taux TVA</label>
                    <div className="flex">
                      <select
                        value={invoiceData.vatRate}
                        onChange={(e) => updateInvoiceField('vatRate', e.target.value)}
                        className="w-full px-2.5 py-1.5 border rounded-l text-sm"
                        style={{ borderColor: '#D6D9DB' }}
                      >
                        <option value="autoliq-20">Autoliquidé 20%</option>
                        <option value="autoliq-10">Autoliquidé 10%</option>
                        <option value="20">20%</option>
                        <option value="10">10%</option>
                        <option value="5.5">5,5%</option>
                        <option value="0">0%</option>
                      </select>
                      <button className="px-2 border border-l-0 rounded-r hover:bg-gray-50" style={{ borderColor: '#D6D9DB' }}>
                        <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 5: Taux de change (affiché si devise != EUR) */}
                {invoiceData.currency !== 'EUR' && (
                  <div className="mb-4 p-3 rounded-lg border" style={{ borderColor: '#E4E5E7', backgroundColor: '#FFFBEB' }}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium" style={{ color: '#92400E' }}>
                        Taux de change {invoiceData.currency} → EUR
                      </h3>
                      {isLoadingRate && (
                        <span className="text-xs" style={{ color: '#6C767F' }}>Chargement taux BCE...</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Taux BCE</label>
                        <input
                          type="text"
                          value={invoiceData.exchangeRate ? invoiceData.exchangeRate.toFixed(6) : ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value.replace(',', '.'))
                            if (!isNaN(val) && val > 0) {
                              updateInvoiceField('exchangeRate', val)
                            }
                          }}
                          className="w-full px-2.5 py-1.5 border rounded text-sm"
                          style={{ borderColor: '#D6D9DB' }}
                          placeholder="ex: 0.8508"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>HT en EUR</label>
                        <div className="px-2.5 py-1.5 border rounded text-sm" style={{ borderColor: '#D6D9DB', backgroundColor: '#F9FAFB', color: '#141A1F' }}>
                          {invoiceData.exchangeRate
                            ? (invoiceData.totalHT * invoiceData.exchangeRate).toFixed(2).replace('.', ',') + ' €'
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>TVA autoliq. EUR</label>
                        <div className="px-2.5 py-1.5 border rounded text-sm" style={{ borderColor: '#D6D9DB', backgroundColor: '#F9FAFB', color: '#141A1F' }}>
                          {invoiceData.exchangeRate && invoiceData.vatRate.startsWith('autoliq-')
                            ? (invoiceData.totalHT * invoiceData.exchangeRate * parseFloat(invoiceData.vatRate.replace('autoliq-', '')) / 100).toFixed(2).replace('.', ',') + ' €'
                            : '—'}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs mt-2" style={{ color: '#6C767F' }}>
                      Source: Banque Centrale Européenne au {invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate).toLocaleDateString('fr-FR') : '—'}
                    </p>
                  </div>
                )}

                {/* Options d'imputation et de cut-offs */}
                <div className="mb-4 p-3 rounded-lg border" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFAFA' }}>
                  <h3 className="text-sm font-medium mb-3" style={{ color: '#141A1F' }}>Options d'imputation et de cut-offs</h3>
                  <label className="flex items-center gap-2 mb-3 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-sm" style={{ color: '#6C767F' }}>Définir une imputation</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={invoiceData.hasCCA}
                        onChange={(e) => updateInvoiceField('hasCCA', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm" style={{ color: '#6C767F' }}>CCA</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={invoiceData.hasFNP}
                        onChange={(e) => updateInvoiceField('hasFNP', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm" style={{ color: '#6C767F' }}>FNP</span>
                    </label>
                  </div>
                </div>

                {/* Error message */}
                {saveError && (
                  <div className="mb-4 p-2.5 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEE2E2', border: '1px solid #EF4444' }}>
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span className="text-xs font-medium text-red-700">{saveError}</span>
                  </div>
                )}

                {/* Links */}
                <div className="flex items-center justify-end gap-3 mb-6">
                  <button className="text-sm hover:underline" style={{ color: '#7C3AED' }}>Voir les montants en euros</button>
                  <button className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50" style={{ borderColor: '#7C3AED', color: '#7C3AED' }}>
                    + Ventiler la facture
                  </button>
                </div>

                {/* Section Réconciliation */}
                <div className="mb-6">
                  <h2 className="text-base font-semibold mb-3" style={{ color: '#141A1F' }}>Réconciliation</h2>
                  <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>Mode de règlement</label>
                  <select
                    value={invoiceData.paymentMethod || ''}
                    onChange={(e) => setInvoiceData(prev => ({ ...prev, paymentMethod: e.target.value || undefined }))}
                    className="w-full px-2.5 py-1.5 border rounded text-sm mb-3"
                    style={{ borderColor: '#D6D9DB' }}
                  >
                    <option value="">Non spécifié</option>
                    <option value="virement">Virement bancaire</option>
                    <option value="cheque">Chèque</option>
                    <option value="cb">Carte bancaire</option>
                    <option value="prelevement">Prélèvement</option>
                  </select>
                  <div className="p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#D1FAE5' }}>
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium" style={{ color: '#065F46' }}>Tout est réconcilié</span>
                  </div>
                </div>

                {/* Section Transactions */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-semibold" style={{ color: '#141A1F' }}>Transactions</h2>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>1 transaction réconciliée</span>
                  </div>
                  <div className="border rounded-lg p-3" style={{ borderColor: '#E4E5E7' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#141A1F' }}>{transaction.libelle}</p>
                        <p className="text-xs" style={{ color: '#6C767F' }}>Datée du {new Date(transaction.date).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: transaction.montant < 0 ? '#DC2626' : '#059669' }}>
                          {transaction.montant < 0 ? '-' : ''}{Math.abs(transaction.montant).toFixed(2).replace('.', ',')} €
                        </span>
                        <button className="p-1 rounded hover:bg-gray-100">
                          <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                        </button>
                        <button className="p-1 rounded hover:bg-rose-50">
                          <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.181 8.68a4.503 4.503 0 011.903 6.405m-9.768-2.782L3.56 14.06a4.5 4.5 0 006.364 6.364l3.536-3.536m-6.364-6.364l3.536-3.536a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <button className="w-full mt-2 py-2 text-sm rounded border hover:bg-gray-50" style={{ borderColor: '#7C3AED', color: '#7C3AED' }}>
                    Voir plus de transactions
                  </button>
                </div>

                {/* Section Écritures */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold" style={{ color: '#141A1F' }}>Écritures</h2>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1.5 text-xs rounded border hover:bg-gray-50" style={{ borderColor: '#D6D9DB', color: '#6C767F' }}>
                        Re-générer les écritures
                      </button>
                      <button
                        onClick={() => handleSaveInvoice(false)}
                        disabled={isSavingInvoice}
                        className="px-3 py-1.5 text-xs rounded text-white disabled:opacity-50"
                        style={{ backgroundColor: '#7C3AED' }}
                      >
                        {isSavingInvoice ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>

                  {/* Écriture 1 - Facture (dynamique) */}
                  {invoiceEntries.length > 0 && (
                    <div className="border rounded-lg mb-3" style={{ borderColor: '#E4E5E7' }}>
                      <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#F9FAFB' }}>
                        <div className="flex items-center gap-3">
                          <button className="p-0.5 rounded hover:bg-gray-200">
                            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <span className="px-2 py-0.5 text-xs font-medium rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>{journalAchats}</span>
                          <span className="text-sm" style={{ color: '#6C767F' }}>{new Date(invoiceData.invoiceDate || transaction.date).toLocaleDateString('fr-FR')}</span>
                          <span className="text-sm font-mono" style={{ color: '#6C767F' }}>{invoiceEntries[0]?.pieceNumber || 'PREVIEW'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#E0E7FF', color: '#4338CA' }}>Facture</span>
                          <button className="p-1 rounded hover:bg-gray-200">
                            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </button>
                          <button className="p-1 rounded hover:bg-gray-200">
                            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="p-3 text-sm" style={{ backgroundColor: '#FFFBEB' }}>
                        {invoiceData.entryLabel || `Facture ${invoiceData.thirdPartyName || 'FOURNISSEUR'} - ${invoiceData.invoiceNumber || 'N/A'} - ${invoiceData.totalTTC.toFixed(2).replace('.', ',')} ${invoiceData.currency === 'EUR' ? '€' : invoiceData.currency}`}
                      </div>
                      {/* Lignes d'écriture dynamiques */}
                      <div className="divide-y" style={{ borderColor: '#E4E5E7' }}>
                        {invoiceEntries.map((entry) => (
                          <div key={entry.id} className="flex items-center px-3 py-2 text-sm hover:bg-gray-50">
                            <div className="flex-1">
                              <span style={{ color: '#6C767F' }}>{entry.accountCode} - {entry.accountLabel.length > 25 ? entry.accountLabel.slice(0, 25) + '...' : entry.accountLabel}</span>
                              {entry.isAutoliquidation && (
                                <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>Autoliq.</span>
                              )}
                            </div>
                            {entry.lettrageCode ? (
                              <span
                                className="px-1 py-0.5 text-xs rounded mr-8"
                                style={{
                                  backgroundColor: entry.lettrageType === 'tiers' ? '#D1FAE5' : entry.lettrageType === 'autoliquidation' ? '#FEF3C7' : '#FCE7F3',
                                  color: entry.lettrageType === 'tiers' ? '#065F46' : entry.lettrageType === 'autoliquidation' ? '#92400E' : '#9D174D'
                                }}
                              >
                                {entry.lettrageCode}
                              </span>
                            ) : (
                              <span className="w-8 mr-8"></span>
                            )}
                            <span className="w-16 text-right" style={{ color: entry.debit > 0 ? '#141A1F' : '#6C767F' }}>
                              {entry.debit > 0 ? entry.debit.toFixed(2).replace('.', ',') : '0,00'}
                            </span>
                            <span className="w-16 text-right" style={{ color: entry.credit > 0 ? '#141A1F' : '#6C767F' }}>
                              {entry.credit > 0 ? entry.credit.toFixed(2).replace('.', ',') : '0,00'}
                            </span>
                            <div className="flex items-center gap-1 ml-3">
                              <button className="p-1 rounded hover:bg-gray-200">
                                <svg className="w-3.5 h-3.5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                              </button>
                              <button className="p-1 rounded hover:bg-gray-200">
                                <svg className="w-3.5 h-3.5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                        {/* Total row */}
                        <div className="flex items-center px-3 py-2 text-sm font-medium" style={{ backgroundColor: '#F9FAFB' }}>
                          <div className="flex-1">
                            <span style={{ color: '#141A1F' }}>Total</span>
                          </div>
                          <span className="w-8 mr-8"></span>
                          <span className="w-16 text-right" style={{ color: '#141A1F' }}>
                            {calculateEntryTotals(invoiceEntries).debit.toFixed(2).replace('.', ',')}
                          </span>
                          <span className="w-16 text-right" style={{ color: '#141A1F' }}>
                            {calculateEntryTotals(invoiceEntries).credit.toFixed(2).replace('.', ',')}
                          </span>
                          <div className="w-16 ml-3"></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Écriture 2 - Transaction bancaire (dynamique) */}
                  {paymentEntries.length > 0 && (
                    <div className="border rounded-lg mb-3" style={{ borderColor: '#E4E5E7' }}>
                      <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#F9FAFB' }}>
                        <div className="flex items-center gap-3">
                          <button className="p-0.5 rounded hover:bg-gray-200">
                            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <span className="px-2 py-0.5 text-xs font-medium rounded" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>{journalBanque}</span>
                          <span className="text-sm" style={{ color: '#6C767F' }}>{new Date(transaction.date).toLocaleDateString('fr-FR')}</span>
                          <span className="text-sm font-mono" style={{ color: '#6C767F' }}>{paymentEntries[0]?.pieceNumber || 'PREVIEW'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F3F4F6', color: '#6C767F' }}>Transaction bancaire</span>
                          <button className="p-1 rounded hover:bg-gray-200">
                            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </button>
                          <button className="p-1 rounded hover:bg-gray-200">
                            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="p-3 text-sm" style={{ backgroundColor: '#F0F9FF' }}>
                        {transaction.libelle}
                      </div>
                      <div className="divide-y" style={{ borderColor: '#E4E5E7' }}>
                        {paymentEntries.map((entry) => (
                          <div key={entry.id} className="flex items-center px-3 py-2 text-sm hover:bg-gray-50">
                            <div className="flex-1">
                              <span style={{ color: '#6C767F' }}>{entry.accountCode} - {entry.accountLabel.length > 25 ? entry.accountLabel.slice(0, 25) + '...' : entry.accountLabel}</span>
                            </div>
                            {entry.lettrageCode ? (
                              <span
                                className="px-1 py-0.5 text-xs rounded mr-8"
                                style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
                              >
                                {entry.lettrageCode}
                              </span>
                            ) : (
                              <span className="w-8 mr-8"></span>
                            )}
                            <span className="w-16 text-right" style={{ color: entry.debit > 0 ? '#141A1F' : '#6C767F' }}>
                              {entry.debit > 0 ? entry.debit.toFixed(2).replace('.', ',') : '0,00'}
                            </span>
                            <span className="w-16 text-right" style={{ color: entry.credit > 0 ? '#141A1F' : '#6C767F' }}>
                              {entry.credit > 0 ? entry.credit.toFixed(2).replace('.', ',') : '0,00'}
                            </span>
                            <div className="flex items-center gap-1 ml-3">
                              <button className="p-1 rounded hover:bg-gray-200">
                                <svg className="w-3.5 h-3.5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                              </button>
                              <button className="p-1 rounded hover:bg-gray-200">
                                <svg className="w-3.5 h-3.5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center px-3 py-2 text-sm font-medium" style={{ backgroundColor: '#F9FAFB' }}>
                          <div className="flex-1">
                            <span style={{ color: '#141A1F' }}>Total</span>
                          </div>
                          <span className="w-8 mr-8"></span>
                          <span className="w-16 text-right" style={{ color: '#141A1F' }}>
                            {calculateEntryTotals(paymentEntries).debit.toFixed(2).replace('.', ',')}
                          </span>
                          <span className="w-16 text-right" style={{ color: '#141A1F' }}>
                            {calculateEntryTotals(paymentEntries).credit.toFixed(2).replace('.', ',')}
                          </span>
                          <div className="w-16 ml-3"></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Écriture 3 - RT (Récupération TVA encaissements) si autoliquidation */}
                  {rtEntries.length > 0 && (
                    <div className="border rounded-lg mb-3" style={{ borderColor: '#E4E5E7' }}>
                      <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#F9FAFB' }}>
                        <div className="flex items-center gap-3">
                          <button className="p-0.5 rounded hover:bg-gray-200">
                            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <span className="px-2 py-0.5 text-xs font-medium rounded" style={{ backgroundColor: '#FCE7F3', color: '#9D174D' }}>{journalRT}</span>
                          <span className="text-sm" style={{ color: '#6C767F' }}>{new Date(transaction.date).toLocaleDateString('fr-FR')}</span>
                          <span className="text-sm font-mono" style={{ color: '#6C767F' }}>{rtEntries[0]?.pieceNumber || 'PREVIEW'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#FCE7F3', color: '#9D174D' }}>Récup. TVA encaissements</span>
                        </div>
                      </div>
                      <div className="p-3 text-sm" style={{ backgroundColor: '#FDF2F8' }}>
                        {transaction.libelle}
                      </div>
                      <div className="divide-y" style={{ borderColor: '#E4E5E7' }}>
                        {rtEntries.map((entry) => (
                          <div key={entry.id} className="flex items-center px-3 py-2 text-sm hover:bg-gray-50">
                            <div className="flex-1">
                              <span style={{ color: '#6C767F' }}>{entry.accountCode} - {entry.accountLabel.length > 30 ? entry.accountLabel.slice(0, 30) + '...' : entry.accountLabel}</span>
                            </div>
                            <span
                              className="px-1 py-0.5 text-xs rounded mr-8"
                              style={{ backgroundColor: '#FCE7F3', color: '#9D174D' }}
                            >
                              TVA
                            </span>
                            <span className="w-16 text-right" style={{ color: entry.debit > 0 ? '#141A1F' : '#6C767F' }}>
                              {entry.debit > 0 ? entry.debit.toFixed(2).replace('.', ',') : '0,00'}
                            </span>
                            <span className="w-16 text-right" style={{ color: entry.credit > 0 ? '#141A1F' : '#6C767F' }}>
                              {entry.credit > 0 ? entry.credit.toFixed(2).replace('.', ',') : '0,00'}
                            </span>
                            <div className="w-16 ml-3"></div>
                          </div>
                        ))}
                        <div className="flex items-center px-3 py-2 text-sm font-medium" style={{ backgroundColor: '#F9FAFB' }}>
                          <div className="flex-1">
                            <span style={{ color: '#141A1F' }}>Total</span>
                          </div>
                          <span className="w-8 mr-8"></span>
                          <span className="w-16 text-right" style={{ color: '#141A1F' }}>
                            {calculateEntryTotals(rtEntries).debit.toFixed(2).replace('.', ',')}
                          </span>
                          <span className="w-16 text-right" style={{ color: '#141A1F' }}>
                            {calculateEntryTotals(rtEntries).credit.toFixed(2).replace('.', ',')}
                          </span>
                          <div className="w-16 ml-3"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section Analytiques de la pièce */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold" style={{ color: '#141A1F' }}>Analytiques de la pièce</h2>
                    <button className="text-sm hover:underline" style={{ color: '#006666' }}>Configurer les catégories</button>
                  </div>

                  {/* Dropdown pour ajouter un code analytique */}
                  <div className="mb-3 relative">
                    <button
                      onClick={() => setShowAnalyticalDropdown(!showAnalyticalDropdown)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 border rounded text-sm"
                      style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                    >
                      <span>Rechercher une catégorie analytique...</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>

                    {/* Dropdown menu */}
                    {showAnalyticalDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-64 overflow-auto" style={{ borderColor: '#E4E5E7' }}>
                        {expenseCategories.length === 0 ? (
                          <div className="p-3 text-sm text-center" style={{ color: '#6C767F' }}>
                            Aucune catégorie disponible
                          </div>
                        ) : (
                          expenseCategories
                            .filter(cat => !analyticalCodes.some(ac => ac.categoryId === cat.id))
                            .map(cat => (
                              <button
                                key={cat.id}
                                onClick={() => {
                                  const newCode = {
                                    id: `anal-${Date.now()}`,
                                    categoryId: cat.id,
                                    categoryName: cat.name,
                                    percentage: analyticalCodes.length === 0 ? 100 : 0,
                                    accountCode: cat.default_accounting_code,
                                  }
                                  setAnalyticalCodes([...analyticalCodes, newCode])
                                  setShowAnalyticalDropdown(false)
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                                style={{ color: '#141A1F' }}
                              >
                                <span>{cat.name}</span>
                                {cat.default_accounting_code && (
                                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F3F4F6', color: '#6C767F' }}>
                                    {cat.default_accounting_code}
                                  </span>
                                )}
                              </button>
                            ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Montant total et switch % / € */}
                  <div className="flex items-center justify-between mb-3 text-sm">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                      <span style={{ color: '#6C767F' }}>
                        Montant total à répartir : {(ocrData?.totalTTC || Math.abs(transaction.montant)).toFixed(2).replace('.', ',')} €
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                      <button
                        onClick={() => setAnalyticalDisplayMode('percent')}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          analyticalDisplayMode === 'percent' ? 'bg-white shadow-sm' : ''
                        }`}
                        style={{ color: analyticalDisplayMode === 'percent' ? '#141A1F' : '#6C767F' }}
                      >
                        %
                      </button>
                      <button
                        onClick={() => setAnalyticalDisplayMode('amount')}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          analyticalDisplayMode === 'amount' ? 'bg-white shadow-sm' : ''
                        }`}
                        style={{ color: analyticalDisplayMode === 'amount' ? '#141A1F' : '#6C767F' }}
                      >
                        €
                      </button>
                    </div>
                  </div>

                  {/* Liste des codes analytiques */}
                  {analyticalCodes.length > 0 && (
                    <div className="space-y-2">
                      {analyticalCodes.map((code) => {
                        const totalAmount = ocrData?.totalTTC || Math.abs(transaction.montant)
                        const codeAmount = (totalAmount * code.percentage) / 100

                        return (
                          <div key={code.id} className="p-3 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
                            <div className="flex items-center gap-2">
                              {/* Category name badge */}
                              <span
                                className="px-2 py-1 text-xs rounded flex-shrink-0 max-w-[120px] truncate"
                                style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}
                                title={code.categoryName}
                              >
                                {code.categoryName}
                              </span>

                              {/* Account code if exists */}
                              {code.accountCode && (
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F3F4F6', color: '#6C767F' }}>
                                  {code.accountCode}
                                </span>
                              )}

                              {/* Progress bar */}
                              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E5E7EB' }}>
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${code.percentage}%`,
                                    backgroundColor: code.percentage === 100 ? '#10B981' : '#3B82F6'
                                  }}
                                />
                              </div>

                              {/* Percentage input */}
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={code.percentage}
                                onChange={(e) => {
                                  const newPercentage = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                                  setAnalyticalCodes(codes =>
                                    codes.map(c =>
                                      c.id === code.id ? { ...c, percentage: newPercentage } : c
                                    )
                                  )
                                }}
                                className="w-16 px-2 py-1 text-sm text-right border rounded"
                                style={{ borderColor: '#D6D9DB' }}
                              />

                              {/* Display unit */}
                              <span className="text-sm w-16 text-right" style={{ color: '#141A1F' }}>
                                {analyticalDisplayMode === 'percent'
                                  ? `${code.percentage.toFixed(0)} %`
                                  : `${codeAmount.toFixed(2)} €`
                                }
                              </span>

                              {/* Delete button */}
                              <button
                                onClick={() => setAnalyticalCodes(codes => codes.filter(c => c.id !== code.id))}
                                className="p-1 rounded hover:bg-red-50"
                              >
                                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {/* Total percentage indicator */}
                      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: '#E4E5E7' }}>
                        <span className="text-sm font-medium" style={{ color: '#6C767F' }}>Total réparti</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              totalAnalyticalPercentage === 100 ? 'text-green-600' :
                              totalAnalyticalPercentage > 100 ? 'text-red-600' : 'text-amber-600'
                            }`}
                          >
                            {totalAnalyticalPercentage.toFixed(0)} %
                          </span>
                          {totalAnalyticalPercentage === 100 ? (
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : totalAnalyticalPercentage > 100 ? (
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {analyticalCodes.length === 0 && (
                    <div className="p-4 rounded-lg border-2 border-dashed text-center" style={{ borderColor: '#E4E5E7' }}>
                      <svg className="w-8 h-8 mx-auto mb-2" style={{ color: '#D6D9DB' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                      </svg>
                      <p className="text-sm" style={{ color: '#6C767F' }}>
                        Aucun code analytique assigné
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                        Utilisez le menu ci-dessus pour répartir cette transaction
                      </p>
                    </div>
                  )}

                  {/* Bouton d'ajout rapide */}
                  {analyticalCodes.length > 0 && (
                    <button
                      onClick={() => setShowAnalyticalDropdown(true)}
                      className="mt-3 flex items-center gap-1 text-sm hover:underline"
                      style={{ color: '#006666' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Ajouter un code analytique
                    </button>
                  )}
                </div>

                {/* Section Activité */}
                <div className="mb-6">
                  <h2 className="text-base font-semibold mb-3" style={{ color: '#141A1F' }}>Activité</h2>

                  <div className="space-y-4">
                    {/* Activité Pennylane */}
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F3F4F6' }}>
                        <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: '#141A1F' }}>Pennybarr a modifié une facture</p>
                        <ul className="mt-1 space-y-0.5">
                          <li className="text-xs flex items-center gap-1.5" style={{ color: '#6C767F' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FCD34D' }}></span>
                            Total TTC modifié de 0 vers {(ocrData?.totalTTC || Math.abs(transaction.montant)).toFixed(2)}
                          </li>
                          <li className="text-xs flex items-center gap-1.5" style={{ color: '#6C767F' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FCD34D' }}></span>
                            Fournisseur vers {ocrData?.vendorName?.toUpperCase() || 'FOURNISSEUR'}
                          </li>
                          <li className="text-xs flex items-center gap-1.5" style={{ color: '#6C767F' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FCD34D' }}></span>
                            Date vers {ocrData?.invoiceDate ? new Date(ocrData.invoiceDate).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}
                          </li>
                          <li className="text-xs flex items-center gap-1.5" style={{ color: '#6C767F' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FCD34D' }}></span>
                            Numéro de facture vers {ocrData?.invoiceNumber || 'N/A'}
                          </li>
                        </ul>
                        <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>il y a moins d'une minute</p>
                      </div>
                    </div>

                    {/* Activité utilisateur */}
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-medium" style={{ backgroundColor: '#F97316' }}>
                        NC
                      </div>
                      <div className="flex-1">
                        <p className="text-sm" style={{ color: '#141A1F' }}>
                          <span className="font-medium">Utilisateur</span>
                          <span style={{ color: '#6C767F' }}> a importé une facture</span>
                        </p>
                        <p className="text-xs" style={{ color: '#7C3AED' }}>Import client (Transactions)</p>
                        <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>il y a moins d'une minute</p>
                      </div>
                    </div>
                  </div>

                  <button className="mt-3 text-sm flex items-center gap-1 hover:underline" style={{ color: '#7C3AED' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Voir toute l'activité
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice preview modal */}
      {previewInvoice && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={() => setPreviewInvoice(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" />
          {/* Content */}
          <div
            className="relative bg-white rounded-2xl shadow-xl flex flex-col"
            style={{ width: '90vw', maxWidth: 800, height: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: '#E4E5E7' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#141A1F' }}>{previewInvoice.label}</h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewInvoice.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                  title="Ouvrir dans un nouvel onglet"
                >
                  <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
                <button
                  onClick={() => setPreviewInvoice(null)}
                  className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* PDF/Image viewer */}
            <div className="flex-1 overflow-hidden rounded-b-2xl bg-gray-100">
              {previewInvoice.url.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewInvoice.url}
                  className="w-full h-full border-0"
                  title={previewInvoice.label}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                  <img
                    src={previewInvoice.url}
                    alt={previewInvoice.label}
                    className="max-w-full max-h-full object-contain rounded-lg shadow"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Search Modal */}
      {showInvoiceSearchModal && (
        <InvoiceSearchModal
          transaction={transaction.original}
          onClose={() => setShowInvoiceSearchModal(false)}
          onReconcile={handleReconcileInvoices}
        />
      )}

      {/* Modal d'aide sur les justificatifs facultatifs */}
      {showJustificatifHelpModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                Justificatif facultatif ou perdu
              </h2>
              <button
                onClick={() => setShowJustificatifHelpModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 130px)' }}>
              <div className="prose prose-sm max-w-none" style={{ color: '#141A1F' }}>
                <p className="text-sm leading-relaxed mb-4" style={{ color: '#6C767F' }}>
                  Certaines transactions n'ont pas besoin d'être justifiées en comptabilité. C'est par exemple le cas des :
                </p>

                <ul className="list-disc pl-5 space-y-2 mb-4 text-sm" style={{ color: '#141A1F' }}>
                  <li><strong>Virements internes</strong> de compte à compte</li>
                  <li><strong>Frais bancaires</strong></li>
                  <li><strong>Transactions liées aux salaires</strong> ou à l'URSSAF</li>
                  <li><strong>Transactions Stripe, Shopify, GoCardless, PayPal</strong> (le récapitulatif en fin de période suffit)</li>
                  <li><strong>Justificatifs perdus</strong> que vous n'êtes pas en mesure de fournir</li>
                </ul>

                <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: '#F0FDF4' }}>
                  <p className="text-sm" style={{ color: '#166534' }}>
                    <strong>💡 Bon à savoir :</strong> Afin d'éviter que ces opérations ne soient considérées comme des transactions en attente de justificatif,
                    vous devez préciser que vous n'avez pas besoin (facultatif), ou pas la capacité (perdu), de fournir des factures.
                    Votre transaction sera alors considérée comme <strong>Justifiée</strong>.
                  </p>
                </div>

                <h3 className="font-semibold text-base mt-6 mb-3" style={{ color: '#141A1F' }}>
                  Comment marquer un justificatif comme facultatif ?
                </h3>

                <ol className="list-decimal pl-5 space-y-2 mb-4 text-sm" style={{ color: '#141A1F' }}>
                  <li>Cliquez sur l'opération qui vous intéresse</li>
                  <li>Cliquez sur les trois points <strong>(…)</strong> au bout de la ligne Justificatif</li>
                  <li>Sélectionnez <strong>Marquer comme Perdu</strong> ou <strong>Marquer comme Facultatif</strong></li>
                </ol>

                <div className="p-4 rounded-lg" style={{ backgroundColor: '#FEF3C7' }}>
                  <p className="text-sm" style={{ color: '#92400E' }}>
                    <strong>✍️ Cette opération est réversible.</strong> Vous pouvez changer le statut de votre justificatif à tout moment,
                    même si ce dernier était considéré comme facultatif ou perdu.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex justify-end" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={() => setShowJustificatifHelpModal(false)}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#006666' }}
              >
                J'ai compris
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ Main Page Component ============
interface TransactionsPageProps {
  onImportClick?: () => void
}

export default function TransactionsPage({ onImportClick }: TransactionsPageProps) {
  // State
  const [activeTab, setActiveTab] = useState<'tout' | 'non-justifiee'>('tout')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<DisplayTransaction | null>(null)
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [selectAllFiltered, setSelectAllFiltered] = useState(false)

  // Category popup state
  const [categoryPopup, setCategoryPopup] = useState<{
    transaction: DisplayTransaction
    position: { top: number; left: number }
  } | null>(null)

  // Journal codes (resolved from DB)
  const [journalAchats, setJournalAchats] = useState('')
  const [journalBanque, setJournalBanque] = useState('')
  const [journalRT, setJournalRT] = useState('')

  useEffect(() => {
    getJournalAchats().then(setJournalAchats).catch(e => console.error('Failed to resolve journal achats:', e))
    getJournalBanque().then(setJournalBanque).catch(e => console.error('Failed to resolve journal banque:', e))
    getJournalRT().then(setJournalRT).catch(e => console.error('Failed to resolve journal RT:', e))
  }, [])

  // Column customization state
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS)
  const [showCustomizePopup, setShowCustomizePopup] = useState(false)

  // Check if a column is visible
  const isColumnVisible = (id: string) => columns.find(c => c.id === id)?.visible ?? true

  // Filter states
  const [showStatusFilter, setShowStatusFilter] = useState(false)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [showAmountFilter, setShowAmountFilter] = useState(false)
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)
  const [showAccountFilter, setShowAccountFilter] = useState(false)

  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([])
  const [dateStart, setDateStart] = useState<Date | null>(null)
  const [dateEnd, setDateEnd] = useState<Date | null>(null)
  const [amountFilter, setAmountFilter] = useState<AmountFilter>('all')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [amountAbsolute, setAmountAbsolute] = useState(true)
  const [categoryFilters, setCategoryFilters] = useState<string[]>([])
  const [accountFilters, setAccountFilters] = useState<string[]>([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, _setItemsPerPage] = useState(25)

  // Analytical codes popup state
  const [analyticalPopup, setAnalyticalPopup] = useState<{
    transaction: DisplayTransaction
    position: { top: number; left: number }
  } | null>(null)

  // Third party popup state (for table)
  const [thirdPartyPopup, setThirdPartyPopup] = useState<{
    transaction: DisplayTransaction
    position: { top: number; left: number }
  } | null>(null)

  // Smart auto-reconcile state
  const [isAutoReconciling, setIsAutoReconciling] = useState(false)
  const [autoReconcileResult, setAutoReconcileResult] = useState<{
    matched: number
    suggestions: number
  } | null>(null)

  // Data hooks
  const { accounts, loading: accountsLoading, error: accountsError } = useBankAccounts()
  const { categories } = useTransactionCategories()
  const { thirdParties } = useThirdParties()
  const { accounts: chartOfAccounts } = useChartOfAccounts()
  const { transactions: rawTransactions, loading: transactionsLoading, error: transactionsError, refetch: refetchTransactions } = useAllBankTransactions()
  const { stats: suggestedStats, refetch: refetchSuggestedStats } = useSuggestedReconciliationStats()
  const { ids: suggestedTxIds, loading: suggestedIdsLoading, fetch: fetchSuggestedIds } = useSuggestedReconciliationIds()
  const [showSuggestedOnly, setShowSuggestedOnly] = useState(false)

  const loading = accountsLoading || transactionsLoading
  const error = accountsError || transactionsError

  // Transform transactions
  const allTransactions: DisplayTransaction[] = useMemo(() => {
    return rawTransactions.map(t => {
      // Get category from: 1) category field, 2) raw_data.category
      const rawDataCategory = (t.raw_data as Record<string, unknown>)?.category as string | undefined
      const categoryName = t.category || rawDataCategory || null

      return {
        id: t.id,
        date: formatDate(t.date),
        dateRaw: t.date,
        libelle: t.label || 'Transaction',
        montant: t.amount,
        categorie: categoryName,
        categoryId: t.category_id || null,
        statut: t.is_reconciled ? 'Justifiée' : 'Non justifiée',
        comments: t.comments || null,
        bankAccountId: t.bank_account_id,
        original: t,
      }
    })
  }, [rawTransactions])

  // Apply filters (without tab filter) - used for tab counts
  const baseFilteredTransactions = useMemo(() => {
    let result = allTransactions

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(t =>
        t.libelle.toLowerCase().includes(query) ||
        t.date.toLowerCase().includes(query) ||
        (t.categorie?.toLowerCase() || '').includes(query)
      )
    }

    // Status filter
    if (statusFilters.length > 0) {
      result = result.filter(t => {
        if (statusFilters.includes('non_justifiee') && t.statut === 'Non justifiée') return true
        if (statusFilters.includes('justifiee') && t.statut === 'Justifiée') return true
        return false
      })
    }

    // Date filter
    if (dateStart && dateEnd) {
      result = result.filter(t => {
        const txDate = new Date(t.dateRaw)
        // Normalize dates to compare only date part (ignoring time)
        const txDateOnly = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate())
        const startDateOnly = new Date(dateStart.getFullYear(), dateStart.getMonth(), dateStart.getDate())
        const endDateOnly = new Date(dateEnd.getFullYear(), dateEnd.getMonth(), dateEnd.getDate())
        return txDateOnly >= startDateOnly && txDateOnly <= endDateOnly
      })
    }

    // Amount filter
    if (amountFilter === 'encaissements') {
      result = result.filter(t => t.montant > 0)
    } else if (amountFilter === 'decaissements') {
      result = result.filter(t => t.montant < 0)
    }

    // Category filter
    if (categoryFilters.length > 0) {
      result = result.filter(t => {
        if (categoryFilters.includes('uncategorized') && !t.categoryId) return true
        return t.categoryId && categoryFilters.includes(t.categoryId)
      })
    }

    // Account filter
    if (accountFilters.length > 0) {
      result = result.filter(t => accountFilters.includes(t.bankAccountId))
    }

    // Suggested reconciliation filter
    if (showSuggestedOnly && suggestedTxIds.length > 0) {
      const idSet = new Set(suggestedTxIds)
      result = result.filter(t => idSet.has(t.id))
    }

    return result
  }, [allTransactions, searchQuery, statusFilters, dateStart, dateEnd, amountFilter, categoryFilters, accountFilters, showSuggestedOnly, suggestedTxIds])

  // Tab counts based on filtered transactions
  const totalCount = baseFilteredTransactions.length
  const nonJustifieCount = baseFilteredTransactions.filter(t => t.statut === 'Non justifiée').length

  // Apply tab filter for display
  const filteredTransactions = useMemo(() => {
    if (activeTab === 'non-justifiee') {
      return baseFilteredTransactions.filter(t => t.statut === 'Non justifiée')
    }
    return baseFilteredTransactions
  }, [baseFilteredTransactions, activeTab])

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex)

  // Selection calculations
  const currentPageIds = paginatedTransactions.map(t => t.id)
  const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedRows.includes(id))
  const someCurrentPageSelected = currentPageIds.some(id => selectedRows.includes(id))

  // Total selected count (either selectedRows or all filtered if selectAllFiltered is true)
  const effectiveSelectedCount = selectAllFiltered ? filteredTransactions.length : selectedRows.length

  // Calculate total amount of selected transactions
  const selectedTotalAmount = useMemo(() => {
    const ids = selectAllFiltered ? filteredTransactions.map(t => t.id) : selectedRows
    return filteredTransactions
      .filter(t => ids.includes(t.id))
      .reduce((sum, t) => sum + t.montant, 0)
  }, [selectedRows, selectAllFiltered, filteredTransactions])

  // Header checkbox handler
  const handleHeaderCheckboxChange = () => {
    if (allCurrentPageSelected) {
      // Deselect all on current page
      setSelectedRows(prev => prev.filter(id => !currentPageIds.includes(id)))
      setSelectAllFiltered(false)
    } else {
      // Select all on current page
      setSelectedRows(prev => [...new Set([...prev, ...currentPageIds])])
    }
  }

  // Select all filtered transactions
  const handleSelectAllFiltered = () => {
    setSelectedRows(filteredTransactions.map(t => t.id))
    setSelectAllFiltered(true)
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedRows([])
    setSelectAllFiltered(false)
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery, statusFilters, dateStart, dateEnd, amountFilter, categoryFilters, accountFilters])

  // Handlers
  const handleUpdateTransaction = async (id: string, updates: Partial<BankTransaction>) => {
    await updateBankTransaction(id, updates)
    refetchTransactions()
    refetchSuggestedStats()
  }

  const handleNextTransaction = () => {
    if (!selectedTransaction) return
    const currentIndex = filteredTransactions.findIndex(t => t.id === selectedTransaction.id)
    if (currentIndex < filteredTransactions.length - 1) {
      setSelectedTransaction(filteredTransactions[currentIndex + 1])
    }
  }

  // Handle smart auto-reconcile
  const handleSmartAutoReconcile = async () => {
    setIsAutoReconciling(true)
    setAutoReconcileResult(null)

    try {
      const result = await smartAutoReconcile()
      setAutoReconcileResult({
        matched: result.matched,
        suggestions: result.suggestions.length
      })

      // Refresh transactions to show updated reconciliation status
      refetchTransactions()
      refetchSuggestedStats()

      // Clear result message after 5 seconds
      setTimeout(() => {
        setAutoReconcileResult(null)
      }, 5000)
    } catch (error) {
      console.error('Error during smart auto-reconcile:', error)
    } finally {
      setIsAutoReconciling(false)
    }
  }

  // Find category for display
  const getCategoryForTransaction = (categoryId: string | null, categoryName: string | null) => {
    if (categoryId) {
      const cat = categories.find(c => c.id === categoryId)
      if (cat) return cat
    }
    if (categoryName) {
      const cat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
      if (cat) return cat
    }
    return null
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = () => {
      // Dropdowns will handle their own close via onClose
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="bg-white rounded-xl p-8 border text-center max-w-md" style={{ borderColor: '#E4E5E7' }}>
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="font-semibold mb-2" style={{ color: '#141A1F' }}>Erreur de connexion</h3>
          <p className="text-sm mb-4" style={{ color: '#6C767F' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-white font-medium text-sm"
            style={{ backgroundColor: '#006666' }}
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Main content - scroll vertical seulement */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>Transactions</h1>
          <div className="flex items-center gap-3">
            {/* Smart Auto-Reconcile Button */}
            <button
              onClick={handleSmartAutoReconcile}
              disabled={isAutoReconciling}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50"
              style={{
                borderColor: '#006666',
                color: '#006666',
                backgroundColor: isAutoReconciling ? '#F0FAFA' : 'transparent'
              }}
            >
              {isAutoReconciling ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Réconciliation...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  Réconcilier auto
                </>
              )}
            </button>

            {/* Auto-reconcile result notification */}
            {autoReconcileResult && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {autoReconcileResult.matched} réconciliée{autoReconcileResult.matched > 1 ? 's' : ''}
                {autoReconcileResult.suggestions > 0 && ` (${autoReconcileResult.suggestions} suggestion${autoReconcileResult.suggestions > 1 ? 's' : ''})`}
              </div>
            )}

            <button
              onClick={onImportClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#006666' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Importer un relevé
            </button>
            <div className="flex items-center gap-2 text-sm" style={{ color: '#6C767F' }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: loading ? '#FFC107' : '#23A84B' }} />
              {loading ? 'Chargement...' : 'Synchronisé'}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="flex gap-4 mb-6">
          {/* Solde Card */}
          <div className="bg-white rounded-xl border p-4 min-w-[250px]" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm" style={{ color: '#6C767F' }}>Solde</span>
              <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
                {formatCurrency(accounts.reduce((sum, acc) => sum + acc.current_balance, 0))}
              </span>
              <div className="flex items-center gap-1">
                <div className="w-6 h-4 rounded flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>
                  CIC
                </div>
                <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center" style={{ borderColor: '#006666' }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#006666' }} />
                </div>
                <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* Rapprochements suggérés Card */}
          <div
            onClick={() => {
              if (showSuggestedOnly) {
                setShowSuggestedOnly(false)
              } else {
                fetchSuggestedIds()
                setShowSuggestedOnly(true)
              }
            }}
            className={`bg-white rounded-xl border p-4 min-w-[250px] cursor-pointer transition-all hover:shadow-sm ${showSuggestedOnly ? 'ring-2' : ''}`}
            style={{ borderColor: showSuggestedOnly ? '#006666' : '#E4E5E7', ringColor: '#006666' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm" style={{ color: '#6C767F' }}>Rapprochements suggérés</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#E3F2FD', color: '#1976D2' }}>
                {suggestedStats.count}
              </span>
            </div>
            <span className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
              {formatCurrency(suggestedStats.amount)}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border mb-4 overflow-hidden min-w-0" style={{ borderColor: '#E4E5E7' }}>
          <div className="p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher une transaction..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>

              {/* Status Filter */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setShowStatusFilter(!showStatusFilter); setShowDateFilter(false); setShowAmountFilter(false); setShowCategoryFilter(false); setShowAccountFilter(false) }}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${statusFilters.length > 0 ? 'border-[#006666] bg-[#D9EFEB]' : ''}`}
                  style={{ borderColor: statusFilters.length > 0 ? '#006666' : '#D6D9DB', color: '#141A1F' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                  </svg>
                  Statut
                  {statusFilters.length > 0 && <span className="ml-1 text-xs">({statusFilters.length})</span>}
                </button>
                {showStatusFilter && (
                  <StatusFilterDropdown
                    value={statusFilters}
                    onChange={setStatusFilters}
                    onClose={() => setShowStatusFilter(false)}
                  />
                )}
              </div>

              {/* Date Filter */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setShowDateFilter(!showDateFilter); setShowStatusFilter(false); setShowAmountFilter(false); setShowCategoryFilter(false); setShowAccountFilter(false) }}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${dateStart && dateEnd ? 'border-[#006666] bg-[#D9EFEB]' : ''}`}
                  style={{ borderColor: dateStart && dateEnd ? '#006666' : '#D6D9DB', color: '#141A1F' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  {dateStart && dateEnd ? `${formatDateShort(dateStart)} - ${formatDateShort(dateEnd)}` : 'Date'}
                  {dateStart && dateEnd && (
                    <button onClick={(e) => { e.stopPropagation(); setDateStart(null); setDateEnd(null) }} className="ml-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </button>
                {showDateFilter && (
                  <DateFilterDropdown
                    startDate={dateStart}
                    endDate={dateEnd}
                    onChange={(start, end) => { setDateStart(start); setDateEnd(end) }}
                    onClose={() => setShowDateFilter(false)}
                  />
                )}
              </div>

              {/* Amount Filter */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setShowAmountFilter(!showAmountFilter); setShowStatusFilter(false); setShowDateFilter(false); setShowCategoryFilter(false); setShowAccountFilter(false) }}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${amountFilter !== 'all' ? 'border-[#006666] bg-[#D9EFEB]' : ''}`}
                  style={{ borderColor: amountFilter !== 'all' ? '#006666' : '#D6D9DB', color: '#141A1F' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Montant
                </button>
                {showAmountFilter && (
                  <AmountFilterDropdown
                    value={amountFilter}
                    minAmount={amountMin}
                    maxAmount={amountMax}
                    useAbsolute={amountAbsolute}
                    onChange={(filter, min, max, absolute) => {
                      setAmountFilter(filter)
                      setAmountMin(min)
                      setAmountMax(max)
                      setAmountAbsolute(absolute)
                    }}
                    onClose={() => setShowAmountFilter(false)}
                  />
                )}
              </div>

              {/* Category Filter */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setShowCategoryFilter(!showCategoryFilter); setShowStatusFilter(false); setShowDateFilter(false); setShowAmountFilter(false); setShowAccountFilter(false) }}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${categoryFilters.length > 0 ? 'border-[#006666] bg-[#D9EFEB]' : ''}`}
                  style={{ borderColor: categoryFilters.length > 0 ? '#006666' : '#D6D9DB', color: '#141A1F' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                  </svg>
                  Catégories
                  {categoryFilters.length > 0 && <span className="ml-1 text-xs">({categoryFilters.length})</span>}
                </button>
                {showCategoryFilter && (
                  <CategoryFilterDropdown
                    categories={categories}
                    selectedIds={categoryFilters}
                    onChange={setCategoryFilters}
                    onClose={() => setShowCategoryFilter(false)}
                  />
                )}
              </div>

              {/* Bank Account Filter */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setShowAccountFilter(!showAccountFilter); setShowStatusFilter(false); setShowDateFilter(false); setShowAmountFilter(false); setShowCategoryFilter(false) }}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${accountFilters.length > 0 ? 'border-[#006666] bg-[#D9EFEB]' : ''}`}
                  style={{ borderColor: accountFilters.length > 0 ? '#006666' : '#D6D9DB', color: '#141A1F' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                  </svg>
                  Comptes bancaires
                  {accountFilters.length > 0 && <span className="ml-1 text-xs">({accountFilters.length})</span>}
                </button>
                {showAccountFilter && (
                  <BankAccountFilterDropdown
                    accounts={accounts}
                    selectedIds={accountFilters}
                    onChange={setAccountFilters}
                    onClose={() => setShowAccountFilter(false)}
                  />
                )}
              </div>

              {/* Rapprochement suggéré tag */}
              {showSuggestedOnly && (
                <button
                  onClick={() => setShowSuggestedOnly(false)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: '#D9EFEB', color: '#006666', border: '1px solid #006666' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                  Rapprochement suggéré
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center gap-6">
              <button
                onClick={() => setActiveTab('tout')}
                className={`flex items-center gap-2 pb-1 text-sm font-medium ${activeTab === 'tout' ? 'border-b-2' : ''}`}
                style={activeTab === 'tout' ? { borderColor: '#006666', color: '#006666' } : { color: '#6C767F' }}
              >
                Tout
                <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>{totalCount}</span>
              </button>
              <button
                onClick={() => setActiveTab('non-justifiee')}
                className={`flex items-center gap-2 pb-1 text-sm font-medium ${activeTab === 'non-justifiee' ? 'border-b-2' : ''}`}
                style={activeTab === 'non-justifiee' ? { borderColor: '#006666', color: '#006666' } : { color: '#6C767F' }}
              >
                Non justifiée
                <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>{nonJustifieCount}</span>
              </button>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowCustomizePopup(!showCustomizePopup)}
                className="text-sm flex items-center gap-1 px-3 py-1.5 border rounded-lg"
                style={{ borderColor: '#006666', color: '#006666' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                Personnaliser
              </button>
              {showCustomizePopup && (
                <CustomizeColumnsPopup
                  columns={columns}
                  onChange={setColumns}
                  onClose={() => setShowCustomizePopup(false)}
                />
              )}
            </div>
          </div>

          {/* Selection Info Bar */}
          {selectedRows.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-3 border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#F8FAFA' }}>
              <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                {effectiveSelectedCount} élément{effectiveSelectedCount > 1 ? 's' : ''} sélectionné{effectiveSelectedCount > 1 ? 's' : ''}
              </span>
              {!selectAllFiltered && selectedRows.length < filteredTransactions.length && (
                <button
                  onClick={handleSelectAllFiltered}
                  className="text-sm font-medium hover:underline"
                  style={{ color: '#006666' }}
                >
                  Sélectionnez les {filteredTransactions.length - selectedRows.length} autres éléments sur {filteredTransactions.length}
                </button>
              )}
              {selectAllFiltered && (
                <button
                  onClick={clearSelection}
                  className="text-sm font-medium hover:underline"
                  style={{ color: '#006666' }}
                >
                  Effacer la sélection
                </button>
              )}
            </div>
          )}

          {/* Table - Scroll horizontal uniquement ici */}
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full" style={{ minWidth: '1400px' }}>
              <thead>
                <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
                  <th className="w-10 p-4">
                    <input
                      type="checkbox"
                      className="rounded w-5 h-5 cursor-pointer"
                      style={{ accentColor: '#006666' }}
                      checked={allCurrentPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someCurrentPageSelected && !allCurrentPageSelected
                      }}
                      onChange={handleHeaderCheckboxChange}
                    />
                  </th>
                  <th className="w-10 p-4"></th>
                  {isColumnVisible('statut') && (
                    <th className="text-left p-4 text-sm font-medium whitespace-nowrap min-w-[120px]" style={{ color: '#6C767F' }}>Statut</th>
                  )}
                  {isColumnVisible('date') && (
                    <th className="text-left p-4 text-sm font-medium whitespace-nowrap min-w-[120px]" style={{ color: '#6C767F' }}>
                      <div className="flex items-center gap-1">
                        Date
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </th>
                  )}
                  {isColumnVisible('libelle') && (
                    <th className="text-left p-4 text-sm font-medium whitespace-nowrap min-w-[250px]" style={{ color: '#6C767F' }}>Libellé</th>
                  )}
                  {isColumnVisible('montant') && (
                    <th className="text-right p-4 text-sm font-medium whitespace-nowrap min-w-[100px]" style={{ color: '#6C767F' }}>Montant</th>
                  )}
                  {isColumnVisible('categories') && (
                    <th className="text-left p-4 text-sm font-medium whitespace-nowrap min-w-[150px]" style={{ color: '#6C767F' }}>Catégories</th>
                  )}
                  {isColumnVisible('type') && (
                    <th className="text-left p-4 text-sm font-medium whitespace-nowrap min-w-[80px]" style={{ color: '#6C767F' }}>Type</th>
                  )}
                  {isColumnVisible('tiers') && (
                    <th className="text-left p-4 text-sm font-medium whitespace-nowrap min-w-[150px]" style={{ color: '#6C767F' }}>Tiers</th>
                  )}
                  {isColumnVisible('codeAnalytique') && (
                    <th className="text-left p-4 text-sm font-medium whitespace-nowrap min-w-[150px]" style={{ color: '#6C767F' }}>Code analytiques</th>
                  )}
                  {isColumnVisible('justificatif') && (
                    <th className="text-left p-4 text-sm font-medium whitespace-nowrap min-w-[100px]" style={{ color: '#6C767F' }}>Justif.</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2" />
                      <p style={{ color: '#6C767F' }}>Chargement des transactions...</p>
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center">
                      <p style={{ color: '#6C767F' }}>
                        {accounts.length === 0 ? 'Aucun compte bancaire configuré' : 'Aucune transaction trouvée'}
                      </p>
                    </td>
                  </tr>
                ) : paginatedTransactions.map((transaction) => {
                  const cat = getCategoryForTransaction(transaction.categoryId, transaction.categorie)
                  const rawData = transaction.original.raw_data as Record<string, unknown> | undefined
                  const thirdPartyName = rawData?.thirdParty as string | undefined
                  const linkedThirdParty = thirdParties.find(tp => tp.id === transaction.original.third_party_id)

                  return (
                    <tr
                      key={transaction.id}
                      onClick={() => setSelectedTransaction(transaction)}
                      className={`border-b cursor-pointer transition-colors ${
                        selectedRows.includes(transaction.id)
                          ? ''
                          : selectedTransaction?.id === transaction.id
                            ? 'bg-blue-50'
                            : 'hover:bg-gray-50'
                      }`}
                      style={{
                        borderColor: '#E4E5E7',
                        backgroundColor: selectedRows.includes(transaction.id) ? '#E6F2F2' : undefined
                      }}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          className="rounded w-5 h-5 cursor-pointer"
                          style={{ accentColor: '#006666' }}
                          checked={selectedRows.includes(transaction.id)}
                          onChange={() => {
                            setSelectedRows(prev =>
                              prev.includes(transaction.id) ? prev.filter(r => r !== transaction.id) : [...prev, transaction.id]
                            )
                            setSelectAllFiltered(false)
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="p-4">
                        <div className="w-8 h-5 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
                          CIC
                        </div>
                      </td>
                      {isColumnVisible('statut') && (
                        <td className="p-4 whitespace-nowrap">
                          <span
                            className="px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
                            style={transaction.statut === 'Non justifiée'
                              ? { backgroundColor: '#FFF3E0', color: '#E65100' }
                              : { backgroundColor: '#E8F5E9', color: '#2E7D32' }
                            }
                          >
                            {transaction.statut}
                          </span>
                        </td>
                      )}
                      {isColumnVisible('date') && (
                        <td className="p-4 text-sm whitespace-nowrap" style={{ color: '#141A1F' }}>{transaction.date}</td>
                      )}
                      {isColumnVisible('libelle') && (
                        <td className="p-4 text-sm font-medium min-w-[250px] max-w-[350px]" style={{ color: '#141A1F' }} title={transaction.libelle}>
                          <span className="block truncate">{transaction.libelle}</span>
                        </td>
                      )}
                      {isColumnVisible('montant') && (
                        <td className="p-4 text-sm font-medium text-right whitespace-nowrap" style={{ color: transaction.montant < 0 ? '#D32F2F' : '#2E7D32' }}>
                          {formatCurrency(transaction.montant)}
                        </td>
                      )}
                      {isColumnVisible('categories') && (
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {cat ? (
                              <span
                                className="px-2 py-1 rounded text-xs font-medium max-w-[120px] truncate"
                                style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                                title={cat.name}
                              >
                                {cat.name}
                              </span>
                            ) : transaction.categorie ? (
                              <span
                                className="px-2 py-1 rounded text-xs font-medium max-w-[120px] truncate"
                                style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}
                                title={transaction.categorie}
                              >
                                {transaction.categorie}
                              </span>
                            ) : null}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const rect = e.currentTarget.getBoundingClientRect()
                                setCategoryPopup({
                                  transaction,
                                  position: { top: rect.top, left: rect.left }
                                })
                              }}
                              className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100"
                              style={{ borderColor: '#006666', backgroundColor: 'white' }}
                            >
                              <svg className="w-4 h-4" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                      {isColumnVisible('type') && (
                        <td className="p-4">
                          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#F0F9FF', color: '#0369A1' }}>
                            {transaction.original.type}
                          </span>
                        </td>
                      )}
                      {isColumnVisible('tiers') && (
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {linkedThirdParty ? (
                              <span className="text-sm" style={{ color: '#141A1F' }}>{linkedThirdParty.name}</span>
                            ) : thirdPartyName ? (
                              <span className="text-sm" style={{ color: '#6C767F' }}>{thirdPartyName}</span>
                            ) : null}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const rect = e.currentTarget.getBoundingClientRect()
                                setThirdPartyPopup({
                                  transaction,
                                  position: { top: rect.top, left: rect.left }
                                })
                              }}
                              className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100"
                              style={{ borderColor: '#006666', backgroundColor: 'white' }}
                            >
                              <svg className="w-4 h-4" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                      {isColumnVisible('codeAnalytique') && (
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {/* Warning icon if category has no analytical code */}
                            {cat && !cat.default_accounting_code && (
                              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                              </svg>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const rect = e.currentTarget.getBoundingClientRect()
                                setAnalyticalPopup({
                                  transaction,
                                  position: { top: rect.top, left: rect.left }
                                })
                              }}
                              className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100"
                              style={{ borderColor: '#006666', backgroundColor: 'white' }}
                            >
                              <svg className="w-4 h-4" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                      {isColumnVisible('justificatif') && (
                        <td className="p-4">
                          {transaction.statut === 'Justifiée' ? (
                            <span className="text-green-600">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </span>
                          ) : (
                            <span style={{ color: '#6C767F' }}>-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-end p-4 border-t gap-4" style={{ borderColor: '#E4E5E7' }}>
            <span className="text-sm" style={{ color: '#6C767F' }}>
              {startIndex + 1}-{Math.min(endIndex, filteredTransactions.length)} sur {filteredTransactions.length}
            </span>
            <div className="flex items-center gap-1">
              {/* Previous button */}
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
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
                    className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium ${
                      currentPage === pageNum
                        ? 'text-white'
                        : 'hover:bg-gray-100'
                    }`}
                    style={currentPage === pageNum ? { backgroundColor: '#006666' } : { color: '#141A1F' }}
                  >
                    {pageNum}
                  </button>
                )
              })}

              {/* Next button */}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedTransaction && (
        <TransactionDetailPanel
          transaction={selectedTransaction}
          categories={categories}
          thirdParties={thirdParties}
          chartOfAccounts={chartOfAccounts}
          bankAccount={accounts.find(a => a.id === selectedTransaction.original.bank_account_id)}
          onClose={() => setSelectedTransaction(null)}
          onUpdate={handleUpdateTransaction}
          onNext={handleNextTransaction}
          onRefresh={() => { refetchTransactions(); refetchSuggestedStats() }}
        />
      )}

      {/* Category Assignment Popup */}
      {categoryPopup && (
        <CategoryAssignPopup
          transaction={categoryPopup.transaction}
          categories={categories}
          position={categoryPopup.position}
          onClose={() => setCategoryPopup(null)}
          onUpdate={handleUpdateTransaction}
        />
      )}

      {/* Analytical Codes Popup */}
      {analyticalPopup && (
        <AnalyticalCodesPopup
          transaction={analyticalPopup.transaction}
          categories={categories}
          position={analyticalPopup.position}
          onClose={() => setAnalyticalPopup(null)}
          onUpdate={handleUpdateTransaction}
        />
      )}

      {/* Third Party Popup */}
      {thirdPartyPopup && (
        <ThirdPartyAssignPopup
          transaction={thirdPartyPopup.transaction}
          thirdParties={thirdParties}
          position={thirdPartyPopup.position}
          onClose={() => setThirdPartyPopup(null)}
          onUpdate={handleUpdateTransaction}
        />
      )}

      {/* Floating Action Bar when items selected */}
      {selectedRows.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6">
          {/* Selection count badge */}
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg text-sm font-semibold text-white shadow-lg"
            style={{ backgroundColor: '#006666' }}
          >
            {effectiveSelectedCount}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 bg-white rounded-xl shadow-lg border px-2 py-2" style={{ borderColor: '#E4E5E7' }}>
            {/* Icon buttons with tooltips */}
            <div className="group relative">
              <button className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors" title="Marquer les justificatifs comme obligatoires">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Marquer les justificatifs<br />comme obligatoires
              </div>
            </div>

            <div className="group relative">
              <button className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors" title="Marquer les justificatifs comme facultatifs">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 019 14.437V9.564z" />
                </svg>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Marquer les justificatifs<br />comme facultatifs
              </div>
            </div>

            <div className="group relative">
              <button className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors" title="Marquer les justificatifs comme perdus">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Marquer les justificatifs<br />comme perdus
              </div>
            </div>

            <div className="group relative">
              <button className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors" title="Dissocier les justificatifs">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Dissocier les justificatifs
              </div>
            </div>

            <div className="w-px h-6 mx-1" style={{ backgroundColor: '#E4E5E7' }} />

            <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium" style={{ color: '#006666' }}>
              Exporter
            </button>

            <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors border text-sm font-medium" style={{ borderColor: '#006666', color: '#006666' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
              Catégoriser
            </button>

            <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors border text-sm font-medium" style={{ borderColor: '#006666', color: '#006666' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              Archiver
            </button>
          </div>

          {/* Total amount */}
          <div className="text-base font-semibold" style={{ color: selectedTotalAmount < 0 ? '#D32F2F' : '#2E7D32' }}>
            {formatCurrency(selectedTotalAmount)}
          </div>
        </div>
      )}
    </div>
  )
}
