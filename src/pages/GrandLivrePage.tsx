import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import LettrageBadge from '../components/LettrageBadge'
import type { LettrageType } from '../types/database'
import { exportToPDF, exportToCSV } from '../services/exportService'
// Lettrage colors utility available for future use if needed
// import { getLettrageColor } from '../utils/lettrageColors'

// Types
interface AccountingEntry {
  id: string
  company_id: string
  journal: string
  date: string
  piece_number: string | null
  label: string
  account_code: string
  debit: number
  credit: number
  is_validated: boolean
  created_at: string
  third_party_code?: string
  lettering?: string  // Legacy field
  lettrage_code?: string | null
  lettrage_type?: LettrageType | null
  vat_rate?: number
}

interface ChartOfAccount {
  id: string
  code: string
  label: string
  type: string
  parent_code: string | null
}

interface Journal {
  id: string
  code: string
  name: string
  type: string
}

interface ThirdParty {
  id: string
  code: string
  name: string
  type: string
}

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

// Format number without currency symbol
const formatNumber = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

// Format date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Get account class info
const getAccountClassInfo = (code: string): { classNum: string; className: string; subClassNum: string; subClassName: string } => {
  const firstDigit = code.charAt(0)
  const firstTwo = code.substring(0, 2)

  const classNames: Record<string, string> = {
    '1': 'Capitaux',
    '2': 'Immobilisations',
    '3': 'Stocks',
    '4': 'Tiers',
    '5': 'Financiers',
    '6': 'Charges',
    '7': 'Produits',
  }

  const subClassNames: Record<string, string> = {
    '10': 'Capital et réserves',
    '11': 'Report à nouveau',
    '12': 'Résultat de l\'exercice',
    '13': 'Subventions d\'investissement',
    '14': 'Provisions réglementées',
    '15': 'Provisions pour risques et charges',
    '16': 'Emprunts et dettes assimilées',
    '17': 'Dettes rattachées à des participations',
    '18': 'Comptes de liaison des établissements',
    '20': 'Immobilisations incorporelles',
    '21': 'Immobilisations corporelles',
    '22': 'Immobilisations mises en concession',
    '23': 'Immobilisations en cours',
    '26': 'Participations et créances rattachées',
    '27': 'Autres immobilisations financières',
    '28': 'Amortissements des immobilisations',
    '29': 'Dépréciations des immobilisations',
    '31': 'Matières premières et fournitures',
    '32': 'Autres approvisionnements',
    '33': 'En-cours de production de biens',
    '34': 'En-cours de production de services',
    '35': 'Stocks de produits',
    '37': 'Stocks de marchandises',
    '39': 'Dépréciations des stocks',
    '40': 'Fournisseurs et comptes rattachés',
    '41': 'Clients et comptes rattachés',
    '42': 'Personnel et comptes rattachés',
    '43': 'Sécurité sociale et autres organismes',
    '44': 'État et autres collectivités publiques',
    '45': 'Groupe et associés',
    '46': 'Débiteurs divers et créditeurs divers',
    '47': 'Comptes transitoires ou d\'attente',
    '48': 'Comptes de régularisation',
    '49': 'Dépréciations des comptes de tiers',
    '50': 'Valeurs mobilières de placement',
    '51': 'Banques, établissements financiers',
    '52': 'Instruments de trésorerie',
    '53': 'Caisse',
    '58': 'Virements internes',
    '59': 'Dépréciations des comptes financiers',
    '60': 'Achats',
    '61': 'Services extérieurs',
    '62': 'Autres services extérieurs',
    '63': 'Impôts, taxes et versements assimilés',
    '64': 'Charges de personnel',
    '65': 'Autres charges de gestion courante',
    '66': 'Charges financières',
    '67': 'Charges exceptionnelles',
    '68': 'Dotations aux amortissements',
    '69': 'Participation des salariés et impôts',
    '70': 'Ventes de produits fabriqués',
    '71': 'Production stockée',
    '72': 'Production immobilisée',
    '74': 'Subventions d\'exploitation',
    '75': 'Autres produits de gestion courante',
    '76': 'Produits financiers',
    '77': 'Produits exceptionnels',
    '78': 'Reprises sur amortissements et provisions',
    '79': 'Transferts de charges',
  }

  return {
    classNum: firstDigit,
    className: classNames[firstDigit] || 'Autre',
    subClassNum: firstTwo,
    subClassName: subClassNames[firstTwo] || 'Autre',
  }
}

// Chevron Icon
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
)

// ============ Filter Dropdown Components ============

// Accounts Filter Dropdown
function AccountsFilterDropdown({
  accounts,
  selectedCodes,
  onChange,
  onClose,
}: {
  accounts: ChartOfAccount[]
  selectedCodes: string[]
  onChange: (codes: string[]) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')

  const filtered = accounts.filter(a =>
    a.code.includes(search) || a.label.toLowerCase().includes(search.toLowerCase())
  )

  const toggleAccount = (code: string) => {
    if (selectedCodes.includes(code)) {
      onChange(selectedCodes.filter(c => c !== code))
    } else {
      onChange([...selectedCodes, code])
    }
  }

  const selectAll = () => onChange(filtered.map(a => a.code))
  const clearAll = () => onChange([])

  return (
    <div className="absolute top-full left-0 mt-1 w-96 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
      <div className="p-3 border-b" style={{ borderColor: '#E4E5E7' }}>
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un compte..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
            style={{ borderColor: '#D6D9DB' }}
          />
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={selectAll} className="text-xs" style={{ color: '#006666' }}>Tout sélectionner</button>
          <span className="text-xs" style={{ color: '#D6D9DB' }}>|</span>
          <button onClick={clearAll} className="text-xs" style={{ color: '#006666' }}>Tout désélectionner</button>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-sm" style={{ color: '#6C767F' }}>Aucun résultat</p>
        ) : (
          filtered.slice(0, 50).map((account) => (
            <label key={account.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b last:border-b-0" style={{ borderColor: '#F2F2F3' }}>
              <input
                type="checkbox"
                checked={selectedCodes.includes(account.code)}
                onChange={() => toggleAccount(account.code)}
                className="rounded w-4 h-4"
                style={{ accentColor: '#006666' }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium" style={{ color: '#006666' }}>{account.code}</span>
                <span className="text-sm ml-2" style={{ color: '#141A1F' }}>{account.label}</span>
              </div>
            </label>
          ))
        )}
      </div>
      <div className="flex gap-2 p-3 border-t" style={{ borderColor: '#E4E5E7' }}>
        <button onClick={() => { clearAll(); onClose() }} className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg" style={{ borderColor: '#D6D9DB', color: '#6C767F' }}>
          Réinitialiser
        </button>
        <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: '#006666' }}>
          Appliquer ({selectedCodes.length})
        </button>
      </div>
    </div>
  )
}

// Journals Filter Dropdown
function JournalsFilterDropdown({
  journals,
  selectedCodes,
  onChange,
  onClose,
}: {
  journals: Journal[]
  selectedCodes: string[]
  onChange: (codes: string[]) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')

  const filtered = journals.filter(j =>
    j.code.toLowerCase().includes(search.toLowerCase()) || j.name.toLowerCase().includes(search.toLowerCase())
  )

  const toggleJournal = (code: string) => {
    if (selectedCodes.includes(code)) {
      onChange(selectedCodes.filter(c => c !== code))
    } else {
      onChange([...selectedCodes, code])
    }
  }

  return (
    <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
      <div className="p-3 border-b" style={{ borderColor: '#E4E5E7' }}>
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un journal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
            style={{ borderColor: '#D6D9DB' }}
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filtered.map((journal) => (
          <label key={journal.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b last:border-b-0" style={{ borderColor: '#F2F2F3' }}>
            <input
              type="checkbox"
              checked={selectedCodes.includes(journal.code)}
              onChange={() => toggleJournal(journal.code)}
              className="rounded w-4 h-4"
              style={{ accentColor: '#006666' }}
            />
            <div>
              <span className="px-2 py-0.5 rounded text-xs font-medium mr-2" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
                {journal.code}
              </span>
              <span className="text-sm" style={{ color: '#141A1F' }}>{journal.name}</span>
            </div>
          </label>
        ))}
      </div>
      <div className="flex gap-2 p-3 border-t" style={{ borderColor: '#E4E5E7' }}>
        <button onClick={() => { onChange([]); onClose() }} className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg" style={{ borderColor: '#D6D9DB', color: '#6C767F' }}>
          Réinitialiser
        </button>
        <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: '#006666' }}>
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
  const [viewMonth, setViewMonth] = useState(endDate || new Date())
  const [selectedPreset, setSelectedPreset] = useState<string>('custom')
  const [tempStart, setTempStart] = useState<Date | null>(startDate)
  const [tempEnd, setTempEnd] = useState<Date | null>(endDate)

  const presets = [
    { id: 'this-month', label: 'Ce mois-ci' },
    { id: 'last-month', label: 'Mois dernier' },
    { id: 'this-quarter', label: 'Ce trimestre' },
    { id: 'last-quarter', label: 'Trimestre dernier' },
    { id: 'this-year', label: 'Cette année' },
    { id: 'last-year', label: 'Année dernière' },
    { id: 'custom', label: 'Personnalisé' },
  ]

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId)
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const quarter = Math.floor(month / 3)

    switch (presetId) {
      case 'this-month':
        setTempStart(new Date(year, month, 1))
        setTempEnd(new Date(year, month + 1, 0))
        break
      case 'last-month':
        setTempStart(new Date(year, month - 1, 1))
        setTempEnd(new Date(year, month, 0))
        break
      case 'this-quarter':
        setTempStart(new Date(year, quarter * 3, 1))
        setTempEnd(new Date(year, quarter * 3 + 3, 0))
        break
      case 'last-quarter':
        setTempStart(new Date(year, (quarter - 1) * 3, 1))
        setTempEnd(new Date(year, quarter * 3, 0))
        break
      case 'this-year':
        setTempStart(new Date(year, 0, 1))
        setTempEnd(new Date(year, 11, 31))
        break
      case 'last-year':
        setTempStart(new Date(year - 1, 0, 1))
        setTempEnd(new Date(year - 1, 11, 31))
        break
    }
  }

  const handleApply = () => {
    onChange(tempStart, tempEnd)
    onClose()
  }

  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay()
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1

  const isInRange = (date: Date) => {
    if (!tempStart || !tempEnd) return false
    return date >= tempStart && date <= tempEnd
  }

  const isStartDate = (date: Date) => tempStart && date.toDateString() === tempStart.toDateString()
  const isEndDate = (date: Date) => tempEnd && date.toDateString() === tempEnd.toDateString()

  return (
    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7', width: '580px' }}>
      <div className="flex">
        {/* Left side - Presets */}
        <div className="w-48 p-4 border-r" style={{ borderColor: '#E4E5E7' }}>
          <div className="space-y-1">
            {presets.map(preset => (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedPreset === preset.id ? 'bg-[#E6F2F2]' : 'hover:bg-gray-50'}`}
                style={{ color: selectedPreset === preset.id ? '#006666' : '#141A1F' }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right side - Calendar */}
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1))} className="p-1.5 hover:bg-gray-100 rounded" style={{ color: '#006666' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-sm font-semibold" style={{ color: '#141A1F' }}>
              {viewMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1))} className="p-1.5 hover:bg-gray-100 rounded" style={{ color: '#006666' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
            {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map(day => (
              <span key={day} className="font-medium py-1" style={{ color: '#6C767F' }}>{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: adjustedFirstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="w-9 h-9" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day)
              const inRange = isInRange(date)
              const isStart = isStartDate(date)
              const isEnd = isEndDate(date)

              return (
                <button
                  key={day}
                  onClick={() => {
                    setSelectedPreset('custom')
                    if (!tempStart || (tempStart && tempEnd)) {
                      setTempStart(date)
                      setTempEnd(null)
                    } else {
                      if (date < tempStart) {
                        setTempEnd(tempStart)
                        setTempStart(date)
                      } else {
                        setTempEnd(date)
                      }
                    }
                  }}
                  className={`w-9 h-9 rounded-lg text-sm flex items-center justify-center transition-colors
                    ${isStart || isEnd ? 'bg-[#006666] text-white' : ''}
                    ${inRange && !isStart && !isEnd ? 'bg-[#E6F2F2]' : ''}
                    ${!inRange && !isStart && !isEnd ? 'hover:bg-gray-100' : ''}
                  `}
                  style={{ color: isStart || isEnd ? 'white' : '#141A1F' }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Selected range display */}
          <div className="mt-4 pt-4 border-t flex items-center gap-2" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex-1 px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB', color: tempStart ? '#141A1F' : '#6C767F' }}>
              {tempStart ? formatDate(tempStart.toISOString()) : 'Date de début'}
            </div>
            <span style={{ color: '#6C767F' }}>→</span>
            <div className="flex-1 px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB', color: tempEnd ? '#141A1F' : '#6C767F' }}>
              {tempEnd ? formatDate(tempEnd.toISOString()) : 'Date de fin'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-3 border-t" style={{ borderColor: '#E4E5E7' }}>
        <button onClick={() => { onChange(null, null); onClose() }} className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg" style={{ borderColor: '#D6D9DB', color: '#6C767F' }}>
          Réinitialiser
        </button>
        <button onClick={handleApply} className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: '#006666' }}>
          Appliquer
        </button>
      </div>
    </div>
  )
}

// Lettering Filter Dropdown
function LetteringFilterDropdown({
  value,
  onChange,
  onClose,
}: {
  value: 'all' | 'lettered' | 'unlettered'
  onChange: (value: 'all' | 'lettered' | 'unlettered') => void
  onClose: () => void
}) {
  const [tempValue, setTempValue] = useState(value)

  const options = [
    { id: 'all', label: 'Toutes les écritures' },
    { id: 'lettered', label: 'Écritures lettrées' },
    { id: 'unlettered', label: 'Écritures non lettrées' },
  ]

  return (
    <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
      <div className="py-2">
        {options.map(option => (
          <label
            key={option.id}
            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${tempValue === option.id ? 'bg-[#E6F2F2]' : 'hover:bg-gray-50'}`}
          >
            <input
              type="radio"
              name="lettering"
              checked={tempValue === option.id}
              onChange={() => setTempValue(option.id as typeof value)}
              className="w-4 h-4"
              style={{ accentColor: '#006666' }}
            />
            <span className="text-sm" style={{ color: '#141A1F' }}>{option.label}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 p-3 border-t" style={{ borderColor: '#E4E5E7' }}>
        <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg" style={{ borderColor: '#D6D9DB', color: '#6C767F' }}>
          Annuler
        </button>
        <button
          onClick={() => { onChange(tempValue); onClose() }}
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
  operator,
  onChange,
  onClose,
}: {
  field: 'debit' | 'credit'
  value: string
  operator: string
  onChange: (value: string, operator: string) => void
  onClose: () => void
}) {
  const [tempValue, setTempValue] = useState(value)
  const [tempOperator, setTempOperator] = useState(operator || '=')

  const operators = [
    { id: '=', label: '= égal à' },
    { id: '>', label: '> supérieur à' },
    { id: '<', label: '< inférieur à' },
    { id: '>=', label: '≥ supérieur ou égal à' },
    { id: '<=', label: '≤ inférieur ou égal à' },
    { id: '!=', label: '≠ différent de' },
  ]

  return (
    <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
      <div className="p-3 border-b" style={{ borderColor: '#E4E5E7' }}>
        <label className="text-xs font-medium" style={{ color: '#6C767F' }}>Montant en €</label>
        <input
          type="number"
          placeholder="0,00"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          className="w-full mt-1 px-3 py-2 text-sm border rounded-lg"
          style={{ borderColor: '#D6D9DB' }}
        />
      </div>
      <div className="py-2">
        {operators.map(op => (
          <label
            key={op.id}
            className={`flex items-center gap-3 px-4 py-2 cursor-pointer ${tempOperator === op.id ? 'bg-[#E6F2F2]' : 'hover:bg-gray-50'}`}
          >
            <input
              type="radio"
              name="operator"
              checked={tempOperator === op.id}
              onChange={() => setTempOperator(op.id)}
              className="w-4 h-4"
              style={{ accentColor: '#006666' }}
            />
            <span className="text-sm" style={{ color: '#141A1F' }}>{op.label}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 p-3 border-t" style={{ borderColor: '#E4E5E7' }}>
        <button onClick={() => { onChange('', '='); onClose() }} className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg" style={{ borderColor: '#D6D9DB', color: '#6C767F' }}>
          Réinitialiser
        </button>
        <button
          onClick={() => { onChange(tempValue, tempOperator); onClose() }}
          className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ backgroundColor: '#006666' }}
        >
          Appliquer
        </button>
      </div>
    </div>
  )
}

// Export Modal
function ExportModal({
  onClose,
  entriesCount,
  hasFilters,
  filters
}: {
  onClose: () => void
  entriesCount: number
  hasFilters: boolean
  filters: {
    startDate?: string
    endDate?: string
    journal?: string
    accountCode?: string
  }
}) {
  const [exportType, setExportType] = useState('general')
  const [exportFormat, setExportFormat] = useState('xlsx')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    try {
      if (exportFormat === 'pdf') {
        await exportToPDF('grandlivre', filters)
      } else if (exportFormat === 'csv') {
        await exportToCSV('grandlivre', filters)
      } else {
        // xlsx - pour l'instant fallback sur CSV
        await exportToCSV('grandlivre', filters)
      }
      onClose()
    } catch (err) {
      console.error('Erreur export:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'export')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Exporter le grand livre</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Info banner */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: '#F2F2F3' }}>
            <svg className="w-5 h-5 mt-0.5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div>
              <p className="text-sm" style={{ color: '#141A1F' }}>
                {hasFilters
                  ? `Vous allez exporter ${entriesCount} écriture${entriesCount > 1 ? 's' : ''} filtrée${entriesCount > 1 ? 's' : ''}`
                  : 'Aucun filtre n\'étant activé, vous exportez l\'intégralité du grand livre'
                }
              </p>
              <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
                {entriesCount} écriture{entriesCount > 1 ? 's' : ''} comptable{entriesCount > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
              <svg className="w-5 h-5 mt-0.5" style={{ color: '#DC2626' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}

          {/* Export Type */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: '#141A1F' }}>Type d'export</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'general', label: 'Général', desc: 'Sans axe analytique' },
                { id: 'column', label: 'Analytique (colonnes)', desc: 'Axes en colonne' },
                { id: 'line', label: 'Analytique (lignes)', desc: 'Axes en ligne' },
              ].map(type => (
                <label
                  key={type.id}
                  className={`flex flex-col p-4 border rounded-lg cursor-pointer transition-colors ${exportType === type.id ? 'border-[#006666] bg-[#E6F2F2]' : 'hover:border-gray-300'}`}
                  style={{ borderColor: exportType === type.id ? '#006666' : '#E4E5E7' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="exportType"
                      checked={exportType === type.id}
                      onChange={() => setExportType(type.id)}
                      className="w-4 h-4"
                      style={{ accentColor: '#006666' }}
                    />
                    <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{type.label}</span>
                  </div>
                  <span className="text-xs ml-6" style={{ color: '#6C767F' }}>{type.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Export Format */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: '#141A1F' }}>Format d'export</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'xlsx', label: 'Excel (.xlsx)', icon: '📊' },
                { id: 'csv', label: 'CSV (.csv)', icon: '📄' },
                { id: 'pdf', label: 'PDF (.pdf)', icon: '📕' },
              ].map(format => (
                <label
                  key={format.id}
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${exportFormat === format.id ? 'border-[#006666] bg-[#E6F2F2]' : 'hover:border-gray-300'}`}
                  style={{ borderColor: exportFormat === format.id ? '#006666' : '#E4E5E7' }}
                >
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={exportFormat === format.id}
                    onChange={() => setExportFormat(format.id)}
                    className="w-4 h-4"
                    style={{ accentColor: '#006666' }}
                  />
                  <span className="text-lg">{format.icon}</span>
                  <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{format.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t" style={{ borderColor: '#E4E5E7' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-lg" style={{ borderColor: '#E4E5E7', color: '#141A1F' }}>
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-6 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: '#006666' }}
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Export en cours...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Exporter
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Customize Columns Popup
function CustomizeColumnsPopup({
  columns,
  onChange,
  onClose,
}: {
  columns: { id: string; label: string; visible: boolean }[]
  onChange: (columns: { id: string; label: string; visible: boolean }[]) => void
  onClose: () => void
}) {
  const [tempColumns, setTempColumns] = useState(columns)

  const toggleColumn = (id: string) => {
    setTempColumns(tempColumns.map(c => c.id === id ? { ...c, visible: !c.visible } : c))
  }

  const resetColumns = () => {
    setTempColumns(columns.map(c => ({ ...c, visible: true })))
  }

  return (
    <div className="absolute top-full right-0 mt-1 w-80 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          <span className="font-medium" style={{ color: '#141A1F' }}>Personnaliser l'affichage</span>
        </div>
        <button onClick={resetColumns} className="text-sm" style={{ color: '#006666' }}>Réinitialiser</button>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium" style={{ color: '#141A1F' }}>Colonnes visibles</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E6F2F2', color: '#006666' }}>
            {tempColumns.filter(c => c.visible).length}/{tempColumns.length}
          </span>
        </div>

        <div className="space-y-1">
          {tempColumns.map(column => (
            <div key={column.id} className="flex items-center justify-between py-2.5 px-3 hover:bg-gray-50 rounded-lg">
              <span className="text-sm" style={{ color: '#141A1F' }}>{column.label}</span>
              <button
                onClick={() => toggleColumn(column.id)}
                className={`w-11 h-6 rounded-full relative transition-colors ${column.visible ? 'bg-[#006666]' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${column.visible ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 p-4 border-t" style={{ borderColor: '#E4E5E7' }}>
        <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg" style={{ borderColor: '#D6D9DB', color: '#6C767F' }}>
          Annuler
        </button>
        <button onClick={() => { onChange(tempColumns); onClose() }} className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: '#006666' }}>
          Appliquer
        </button>
      </div>
    </div>
  )
}

// Keyboard Shortcuts Modal
function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: 'Tab', desc: 'Passer au champ suivant' },
    { key: 'Shift + Tab', desc: 'Retourner au champ précédent' },
    { key: 'Cmd + Enter', desc: 'Enregistrer l\'écriture' },
    { key: 'Esc', desc: 'Fermer sans enregistrer' },
    { key: 'F9', desc: 'Équilibrer automatiquement' },
    { key: 'F2', desc: 'Modifier la cellule sélectionnée' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h3 className="text-base font-semibold" style={{ color: '#141A1F' }}>Raccourcis clavier</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <span className="text-sm" style={{ color: '#141A1F' }}>{s.desc}</span>
              <kbd className="px-2 py-1 text-xs font-mono rounded" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// New Entry Side Panel
function NewEntryPanel({
  onClose,
  journals,
  accounts,
}: {
  onClose: () => void
  journals: Journal[]
  accounts: ChartOfAccount[]
}) {
  const [date, setDate] = useState('31/12/2025')
  const [journal, setJournal] = useState('')
  const [pieceNumber, setPieceNumber] = useState('')
  const [mainLabel, setMainLabel] = useState('')
  const [showJournalDropdown, setShowJournalDropdown] = useState(false)
  const [journalSearch, setJournalSearch] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showEntryMenu, setShowEntryMenu] = useState(false)
  const [lineMenuIndex, setLineMenuIndex] = useState<number | null>(null)
  const [lines, setLines] = useState([
    { accountCode: '471', accountLabel: 'Comptes d\'attente', lineLabel: '', vat: 'N/A', debit: '0,00', credit: '0,00' },
  ])

  const filteredJournals = journals.filter(j =>
    j.code.toLowerCase().includes(journalSearch.toLowerCase()) ||
    j.name.toLowerCase().includes(journalSearch.toLowerCase())
  )

  const selectJournal = (j: Journal) => {
    setJournal(j.code)
    setShowJournalDropdown(false)
    setJournalSearch('')
  }

  const selectedJournal = journals.find(j => j.code === journal)

  const addLine = () => {
    setLines([...lines, { accountCode: '', accountLabel: '', lineLabel: '', vat: 'N/A', debit: '0,00', credit: '0,00' }])
    setShowEntryMenu(false)
  }

  const updateLine = (index: number, field: string, value: string) => {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setLines(newLines)
  }

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index))
    }
    setLineMenuIndex(null)
  }

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit.replace(',', '.')) || 0), 0)
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit.replace(',', '.')) || 0), 0)

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'F1') {
        e.preventDefault()
        setShowShortcuts(true)
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        // Save action
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="w-[480px] flex-shrink-0 bg-white border-l flex flex-col h-full" style={{ borderColor: '#E4E5E7' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
        <button
          onClick={() => setShowShortcuts(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100"
          style={{ color: '#6C767F' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          Raccourcis F1
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100"
            style={{ color: '#6C767F' }}
          >
            Annuler
          </button>
          <button
            className="px-4 py-1.5 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: '#006666' }}
          >
            Enregistrer
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Journal selector */}
        <div className="mb-4">
          <label className="text-xs font-medium mb-1.5 block uppercase tracking-wide" style={{ color: '#6C767F' }}>
            Journal
          </label>
          <div className="relative">
            <button
              onClick={() => setShowJournalDropdown(!showJournalDropdown)}
              className="w-full flex items-center justify-between px-3 py-2.5 border rounded-lg text-sm text-left"
              style={{ borderColor: '#D6D9DB' }}
            >
              {selectedJournal ? (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
                    {selectedJournal.code}
                  </span>
                  <span style={{ color: '#141A1F' }}>{selectedJournal.name}</span>
                </div>
              ) : (
                <span style={{ color: '#6C767F' }}>Sélectionner un journal</span>
              )}
              <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showJournalDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-20" style={{ borderColor: '#E4E5E7' }}>
                <div className="p-2 border-b" style={{ borderColor: '#E4E5E7' }}>
                  <div className="relative">
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={journalSearch}
                      onChange={(e) => setJournalSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
                      style={{ borderColor: '#D6D9DB' }}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredJournals.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => selectJournal(j)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-left"
                    >
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
                        {j.code}
                      </span>
                      <span className="text-sm" style={{ color: '#141A1F' }}>{j.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Date and Piece Number */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block uppercase tracking-wide" style={{ color: '#6C767F' }}>
              Date
            </label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block uppercase tracking-wide" style={{ color: '#6C767F' }}>
              Numéro de pièce
            </label>
            <input
              type="text"
              value={pieceNumber}
              onChange={(e) => setPieceNumber(e.target.value)}
              placeholder=""
              className="w-full px-3 py-2.5 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>
        </div>

        {/* Main Label */}
        <div className="mb-5">
          <label className="text-xs font-medium mb-1.5 block uppercase tracking-wide" style={{ color: '#6C767F' }}>
            Libellé
          </label>
          <input
            type="text"
            value={mainLabel}
            onChange={(e) => setMainLabel(e.target.value)}
            className="w-full px-3 py-2.5 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB' }}
          />
        </div>

        {/* Lines */}
        <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
          {/* Header */}
          <div className="flex items-center bg-gray-50 text-xs font-medium uppercase tracking-wide py-2.5 px-3" style={{ color: '#6C767F' }}>
            <div className="flex-1">Compte</div>
            <div className="w-12 text-center">TVA</div>
            <div className="w-20 text-right">Débit</div>
            <div className="w-20 text-right">Crédit</div>
            <div className="w-8"></div>
          </div>

          {/* Lines */}
          {lines.map((line, index) => (
            <div key={index} className="flex items-center border-t py-2 px-3" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex-1 min-w-0">
                <select
                  value={line.accountCode}
                  onChange={(e) => {
                    const account = accounts.find(a => a.code === e.target.value)
                    updateLine(index, 'accountCode', e.target.value)
                    updateLine(index, 'accountLabel', account?.label || '')
                  }}
                  className="w-full px-2 py-1.5 text-sm border-0 bg-transparent focus:ring-0"
                  style={{ color: '#141A1F' }}
                >
                  <option value="">Sélectionner</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.code}>{a.code} - {a.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-12 text-center text-sm" style={{ color: '#6C767F' }}>
                {line.vat}
              </div>
              <div className="w-20">
                <input
                  type="text"
                  value={line.debit}
                  onChange={(e) => updateLine(index, 'debit', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm text-right border-0 bg-transparent focus:ring-0"
                  style={{ color: '#141A1F' }}
                />
              </div>
              <div className="w-20">
                <input
                  type="text"
                  value={line.credit}
                  onChange={(e) => updateLine(index, 'credit', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm text-right border-0 bg-transparent focus:ring-0"
                  style={{ color: '#141A1F' }}
                />
              </div>
              <div className="w-8 relative">
                <button
                  onClick={() => setLineMenuIndex(lineMenuIndex === index ? null : index)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                  </svg>
                </button>
                {lineMenuIndex === index && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border z-30" style={{ borderColor: '#E4E5E7' }}>
                    <button
                      onClick={() => { updateLine(index, 'lineLabel', ' '); setLineMenuIndex(null) }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
                      style={{ color: '#141A1F' }}
                    >
                      Ajouter un libellé de ligne
                    </button>
                    <button
                      onClick={() => removeLine(index)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-t"
                      style={{ color: '#EF4444', borderColor: '#E4E5E7' }}
                    >
                      Supprimer la ligne d'écriture
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Total row */}
          <div className="flex items-center border-t bg-gray-50 py-2.5 px-3 font-medium" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex-1 text-sm" style={{ color: '#141A1F' }}>Total</div>
            <div className="w-12"></div>
            <div className="w-20 text-right text-sm" style={{ color: '#141A1F' }}>
              {formatNumber(totalDebit)}
            </div>
            <div className="w-20 text-right text-sm" style={{ color: '#141A1F' }}>
              {formatNumber(totalCredit)}
            </div>
            <div className="w-8 relative">
              <button
                onClick={() => setShowEntryMenu(!showEntryMenu)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
              </button>
              {showEntryMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border z-30" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={addLine}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
                    style={{ color: '#141A1F' }}
                  >
                    Ajouter une nouvelle ligne d'écriture
                  </button>
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-t"
                    style={{ color: '#141A1F', borderColor: '#E4E5E7' }}
                  >
                    Extourner l'écriture
                  </button>
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-t"
                    style={{ color: '#141A1F', borderColor: '#E4E5E7' }}
                  >
                    Dupliquer l'écriture
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-t"
                    style={{ color: '#EF4444', borderColor: '#E4E5E7' }}
                  >
                    Supprimer l'écriture
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}

// Entry Detail Panel
function EntryDetailPanel({
  entry,
  account,
  onClose
}: {
  entry: AccountingEntry
  account?: ChartOfAccount
  onClose: () => void
}) {
  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
        <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Détail de l'écriture</h2>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Account info */}
        <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#F8FAFA' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold" style={{ color: '#006666' }}>{entry.account_code}</span>
            <span className="font-medium" style={{ color: '#141A1F' }}>{account?.label || 'Compte'}</span>
          </div>
          <p className="text-sm" style={{ color: '#6C767F' }}>{account?.type || 'Type de compte'}</p>
        </div>

        {/* Entry details */}
        <div className="space-y-4">
          <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
            <span className="text-sm" style={{ color: '#6C767F' }}>Date</span>
            <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{formatDate(entry.date)}</span>
          </div>
          <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
            <span className="text-sm" style={{ color: '#6C767F' }}>Journal</span>
            <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
              {entry.journal}
            </span>
          </div>
          <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
            <span className="text-sm" style={{ color: '#6C767F' }}>N° de pièce</span>
            <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{entry.piece_number || '—'}</span>
          </div>
          <div className="py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
            <span className="text-sm block mb-1" style={{ color: '#6C767F' }}>Libellé</span>
            <span className="text-sm" style={{ color: '#141A1F' }}>{entry.label}</span>
          </div>
          <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
            <span className="text-sm" style={{ color: '#6C767F' }}>Débit</span>
            <span className="text-sm font-mono font-medium" style={{ color: Number(entry.debit) > 0 ? '#141A1F' : '#6C767F' }}>
              {Number(entry.debit) > 0 ? formatNumber(Number(entry.debit)) + ' €' : '—'}
            </span>
          </div>
          <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
            <span className="text-sm" style={{ color: '#6C767F' }}>Crédit</span>
            <span className="text-sm font-mono font-medium" style={{ color: Number(entry.credit) > 0 ? '#141A1F' : '#6C767F' }}>
              {Number(entry.credit) > 0 ? formatNumber(Number(entry.credit)) + ' €' : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
            <span className="text-sm" style={{ color: '#6C767F' }}>Lettrage</span>
            {entry.lettrage_code ? (
              <LettrageBadge
                code={entry.lettrage_code}
                type={entry.lettrage_type || 'tiers'}
                isComplete={true}
                size="md"
              />
            ) : entry.lettering ? (
              <span className="text-sm font-medium" style={{ color: '#006666' }}>
                {entry.lettering}
              </span>
            ) : (
              <span className="text-sm" style={{ color: '#6C767F' }}>—</span>
            )}
          </div>
          <div className="flex justify-between py-3">
            <span className="text-sm" style={{ color: '#6C767F' }}>Statut</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${entry.is_validated ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {entry.is_validated ? 'Validée' : 'Brouillon'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 border-t" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex gap-3">
          <button className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg" style={{ borderColor: '#E4E5E7', color: '#141A1F' }}>
            Modifier
          </button>
          <button className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: '#006666' }}>
            Voir la pièce
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ Main Component ============

interface GrandLivrePageProps {
  onNavigate?: (page: string) => void
}

export default function GrandLivrePage({ onNavigate: _onNavigate }: GrandLivrePageProps) {
  // Data state
  const [entries, setEntries] = useState<AccountingEntry[]>([])
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [journals, setJournals] = useState<Journal[]>([])
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'general' | 'fournisseurs' | 'clients' | 'charges'>('general')
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedJournals, setSelectedJournals] = useState<string[]>([])
  const [dateStart, setDateStart] = useState<Date | null>(null)
  const [dateEnd, setDateEnd] = useState<Date | null>(null)
  const [letteringFilter, setLetteringFilter] = useState<'all' | 'lettered' | 'unlettered'>('all')
  const [selectedVatRates, setSelectedVatRates] = useState<number[]>([])
  const [debitValue, setDebitValue] = useState('')
  const [debitOperator, setDebitOperator] = useState('=')
  const [creditValue, setCreditValue] = useState('')
  const [creditOperator, setCreditOperator] = useState('=')

  // UI state
  const [showAccountsFilter, setShowAccountsFilter] = useState(false)
  const [showJournalsFilter, setShowJournalsFilter] = useState(false)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [showLetteringFilter, setShowLetteringFilter] = useState(false)
  const [_showVatFilter, setShowVatFilter] = useState(false)
  const [showDebitFilter, setShowDebitFilter] = useState(false)
  const [showCreditFilter, setShowCreditFilter] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showCustomizePopup, setShowCustomizePopup] = useState(false)
  const [showNewEntryModal, setShowNewEntryModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<AccountingEntry | null>(null)
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set(['4', '5', '6', '7']))
  // const [expandedSubClasses, setExpandedSubClasses] = useState<Set<string>>(new Set()) // Removed - not used in Pennylane style
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())

  // Columns configuration
  const [columns, setColumns] = useState([
    { id: 'date', label: 'Date', visible: true },
    { id: 'journal', label: 'Journal', visible: true },
    { id: 'pieceLabel', label: 'Libellé de pièce', visible: true },
    { id: 'lineLabel', label: 'Libellé de ligne', visible: true },
    { id: 'pieceNumber', label: 'N° de pièce', visible: true },
    { id: 'invoiceNumber', label: 'N° de facture', visible: false },
    { id: 'thirdParty', label: 'Tiers', visible: true },
    { id: 'vatRate', label: 'Taux TVA', visible: false },
    { id: 'lettering', label: 'Lettrage', visible: true },
    { id: 'debit', label: 'Débit', visible: true },
    { id: 'credit', label: 'Crédit', visible: true },
    { id: 'balance', label: 'Solde', visible: true },
  ])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setShowAccountsFilter(false)
        setShowJournalsFilter(false)
        setShowDateFilter(false)
        setShowLetteringFilter(false)
        setShowVatFilter(false)
        setShowDebitFilter(false)
        setShowCreditFilter(false)
        setShowCustomizePopup(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [entriesRes, accountsRes, journalsRes, thirdPartiesRes] = await Promise.all([
          supabase.from('accounting_entries').select('*').order('date', { ascending: false }),
          supabase.from('chart_of_accounts').select('*').order('code'),
          supabase.from('journals').select('*').order('code'),
          supabase.from('third_parties').select('*').order('name'),
        ])

        if (entriesRes.data) setEntries(entriesRes.data)
        if (accountsRes.data) setAccounts(accountsRes.data)
        if (journalsRes.data) setJournals(journalsRes.data)
        if (thirdPartiesRes.data) setThirdParties(thirdPartiesRes.data)
      } catch (err) {
        console.error('Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Check if any filters are active
  const hasActiveFilters = selectedAccounts.length > 0 || selectedJournals.length > 0 ||
    dateStart !== null || dateEnd !== null || letteringFilter !== 'all' ||
    selectedVatRates.length > 0 || !!debitValue || !!creditValue || !!searchQuery

  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = entries

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(e =>
        e.label.toLowerCase().includes(query) ||
        e.piece_number?.toLowerCase().includes(query) ||
        e.account_code.includes(query)
      )
    }

    // Tab filter
    if (activeTab === 'fournisseurs') {
      result = result.filter(e => e.account_code.startsWith('40'))
    } else if (activeTab === 'clients') {
      result = result.filter(e => e.account_code.startsWith('41'))
    } else if (activeTab === 'charges') {
      result = result.filter(e => e.account_code.startsWith('6') || e.account_code.startsWith('7'))
    }

    // Account filter
    if (selectedAccounts.length > 0) {
      result = result.filter(e => selectedAccounts.some(code => e.account_code.startsWith(code)))
    }

    // Journal filter
    if (selectedJournals.length > 0) {
      result = result.filter(e => selectedJournals.includes(e.journal))
    }

    // Date filter
    if (dateStart) {
      result = result.filter(e => new Date(e.date) >= dateStart)
    }
    if (dateEnd) {
      result = result.filter(e => new Date(e.date) <= dateEnd)
    }

    // Lettering filter (check both new lettrage_code and legacy lettering field)
    if (letteringFilter === 'lettered') {
      result = result.filter(e => e.lettrage_code || e.lettering)
    } else if (letteringFilter === 'unlettered') {
      result = result.filter(e => !e.lettrage_code && !e.lettering)
    }

    // Amount filters
    if (debitValue) {
      const val = parseFloat(debitValue)
      result = result.filter(e => {
        const debit = Number(e.debit) || 0
        switch (debitOperator) {
          case '=': return Math.abs(debit - val) < 0.01
          case '>': return debit > val
          case '<': return debit < val
          case '>=': return debit >= val
          case '<=': return debit <= val
          case '!=': return Math.abs(debit - val) >= 0.01
          default: return true
        }
      })
    }

    if (creditValue) {
      const val = parseFloat(creditValue)
      result = result.filter(e => {
        const credit = Number(e.credit) || 0
        switch (creditOperator) {
          case '=': return Math.abs(credit - val) < 0.01
          case '>': return credit > val
          case '<': return credit < val
          case '>=': return credit >= val
          case '<=': return credit <= val
          case '!=': return Math.abs(credit - val) >= 0.01
          default: return true
        }
      })
    }

    return result
  }, [entries, searchQuery, activeTab, selectedAccounts, selectedJournals, dateStart, dateEnd, letteringFilter, selectedVatRates, debitValue, debitOperator, creditValue, creditOperator])

  // Group entries by Class → Account (Pennylane style)
  const groupedEntries = useMemo(() => {
    const classes: Record<string, {
      total: { debit: number; credit: number }
      accounts: Record<string, {
        label: string
        thirdPartyName?: string
        total: { debit: number; credit: number }
        entries: AccountingEntry[]
      }>
    }> = {}

    filteredEntries.forEach(entry => {
      const { classNum } = getAccountClassInfo(entry.account_code)

      // Initialize class
      if (!classes[classNum]) {
        classes[classNum] = {
          total: { debit: 0, credit: 0 },
          accounts: {}
        }
      }

      // Initialize account
      if (!classes[classNum].accounts[entry.account_code]) {
        const account = accounts.find(a => a.code === entry.account_code)
        // Find third party name if exists
        const thirdParty = entry.third_party_code
          ? thirdParties.find(t => t.code === entry.third_party_code)
          : null

        classes[classNum].accounts[entry.account_code] = {
          label: account?.label || 'Compte inconnu',
          thirdPartyName: thirdParty?.name,
          total: { debit: 0, credit: 0 },
          entries: []
        }
      }

      // Add entry
      classes[classNum].accounts[entry.account_code].entries.push(entry)

      // Update totals
      const debit = Number(entry.debit) || 0
      const credit = Number(entry.credit) || 0

      classes[classNum].total.debit += debit
      classes[classNum].total.credit += credit
      classes[classNum].accounts[entry.account_code].total.debit += debit
      classes[classNum].accounts[entry.account_code].total.credit += credit
    })

    return classes
  }, [filteredEntries, accounts, thirdParties])

  // Calculate totals
  const totals = useMemo(() => {
    return filteredEntries.reduce((acc, e) => ({
      debit: acc.debit + (Number(e.debit) || 0),
      credit: acc.credit + (Number(e.credit) || 0),
    }), { debit: 0, credit: 0 })
  }, [filteredEntries])

  const toggleClass = (classNum: string) => {
    const newSet = new Set(expandedClasses)
    if (newSet.has(classNum)) newSet.delete(classNum)
    else newSet.add(classNum)
    setExpandedClasses(newSet)
  }

  // toggleSubClass removed - not used in Pennylane style (Class → Account directly)

  const toggleAccount = (accountCode: string) => {
    const newSet = new Set(expandedAccounts)
    if (newSet.has(accountCode)) newSet.delete(accountCode)
    else newSet.add(accountCode)
    setExpandedAccounts(newSet)
  }

  const classNames: Record<string, string> = {
    '1': 'Capitaux',
    '2': 'Immobilisations',
    '3': 'Stocks et en-cours',
    '4': 'Tiers',
    '5': 'Financiers',
    '6': 'Charges',
    '7': 'Produits',
  }

  // Close all dropdowns helper
  const closeAllDropdowns = () => {
    setShowAccountsFilter(false)
    setShowJournalsFilter(false)
    setShowDateFilter(false)
    setShowLetteringFilter(false)
    setShowVatFilter(false)
    setShowDebitFilter(false)
    setShowCreditFilter(false)
  }

  return (
    <div className="flex-1 flex overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Main content area */}
      <div className={`flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300 ${showNewEntryModal ? 'mr-0' : ''}`}>
        {/* Header */}
        <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>Grand livre</h1>
            <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm" style={{ borderColor: '#23A84B', color: '#23A84B' }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#23A84B' }} />
              Exercice 2024-2025
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <span className="text-sm" style={{ color: '#6C767F' }}>
              Résultat : <span className="font-semibold" style={{ color: totals.debit - totals.credit >= 0 ? '#141A1F' : '#EF4444' }}>
                {formatCurrency(totals.debit - totals.credit)}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm" style={{ borderColor: '#006666', color: '#006666' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
              Lettrer auto.
            </button>
            <button
              onClick={() => setShowNewEntryModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#006666' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nouvelle écriture
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b px-6" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex gap-1">
          {[
            { id: 'general', label: 'Général' },
            { id: 'fournisseurs', label: 'Fournisseurs' },
            { id: 'clients', label: 'Clients' },
            { id: 'charges', label: 'Charges et produits' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id ? 'border-[#006666]' : 'border-transparent hover:border-gray-300'}`}
              style={{ color: activeTab === tab.id ? '#006666' : '#6C767F' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm w-48"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          {/* Filter buttons */}
          <div className="relative" data-dropdown>
            <button
              onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowAccountsFilter(!showAccountsFilter) }}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${selectedAccounts.length > 0 ? 'border-[#006666] bg-[#E6F2F2]' : 'hover:border-gray-400'}`}
              style={{ borderColor: selectedAccounts.length > 0 ? '#006666' : '#D6D9DB', color: '#141A1F' }}
            >
              Comptes
              {selectedAccounts.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#006666] text-white">{selectedAccounts.length}</span>
              )}
            </button>
            {showAccountsFilter && (
              <AccountsFilterDropdown
                accounts={accounts}
                selectedCodes={selectedAccounts}
                onChange={setSelectedAccounts}
                onClose={() => setShowAccountsFilter(false)}
              />
            )}
          </div>

          <div className="relative" data-dropdown>
            <button
              onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowDateFilter(!showDateFilter) }}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${dateStart || dateEnd ? 'border-[#006666] bg-[#E6F2F2]' : 'hover:border-gray-400'}`}
              style={{ borderColor: dateStart || dateEnd ? '#006666' : '#D6D9DB', color: '#141A1F' }}
            >
              Date
              {(dateStart || dateEnd) && <span className="w-2 h-2 rounded-full bg-[#006666]"></span>}
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

          <div className="relative" data-dropdown>
            <button
              onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowJournalsFilter(!showJournalsFilter) }}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${selectedJournals.length > 0 ? 'border-[#006666] bg-[#E6F2F2]' : 'hover:border-gray-400'}`}
              style={{ borderColor: selectedJournals.length > 0 ? '#006666' : '#D6D9DB', color: '#141A1F' }}
            >
              Journaux
              {selectedJournals.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#006666] text-white">{selectedJournals.length}</span>
              )}
            </button>
            {showJournalsFilter && (
              <JournalsFilterDropdown
                journals={journals}
                selectedCodes={selectedJournals}
                onChange={setSelectedJournals}
                onClose={() => setShowJournalsFilter(false)}
              />
            )}
          </div>

          <div className="relative" data-dropdown>
            <button
              onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowLetteringFilter(!showLetteringFilter) }}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${letteringFilter !== 'all' ? 'border-[#006666] bg-[#E6F2F2]' : 'hover:border-gray-400'}`}
              style={{ borderColor: letteringFilter !== 'all' ? '#006666' : '#D6D9DB', color: '#141A1F' }}
            >
              Lettrage
              {letteringFilter !== 'all' && <span className="w-2 h-2 rounded-full bg-[#006666]"></span>}
            </button>
            {showLetteringFilter && (
              <LetteringFilterDropdown
                value={letteringFilter}
                onChange={setLetteringFilter}
                onClose={() => setShowLetteringFilter(false)}
              />
            )}
          </div>

          <div className="relative" data-dropdown>
            <button
              onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowDebitFilter(!showDebitFilter) }}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${debitValue ? 'border-[#006666] bg-[#E6F2F2]' : 'hover:border-gray-400'}`}
              style={{ borderColor: debitValue ? '#006666' : '#D6D9DB', color: '#141A1F' }}
            >
              Débit
              {debitValue && <span className="w-2 h-2 rounded-full bg-[#006666]"></span>}
            </button>
            {showDebitFilter && (
              <AmountFilterDropdown
                field="debit"
                value={debitValue}
                operator={debitOperator}
                onChange={(v, o) => { setDebitValue(v); setDebitOperator(o) }}
                onClose={() => setShowDebitFilter(false)}
              />
            )}
          </div>

          <div className="relative" data-dropdown>
            <button
              onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowCreditFilter(!showCreditFilter) }}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${creditValue ? 'border-[#006666] bg-[#E6F2F2]' : 'hover:border-gray-400'}`}
              style={{ borderColor: creditValue ? '#006666' : '#D6D9DB', color: '#141A1F' }}
            >
              Crédit
              {creditValue && <span className="w-2 h-2 rounded-full bg-[#006666]"></span>}
            </button>
            {showCreditFilter && (
              <AmountFilterDropdown
                field="credit"
                value={creditValue}
                operator={creditOperator}
                onChange={(v, o) => { setCreditValue(v); setCreditOperator(o) }}
                onClose={() => setShowCreditFilter(false)}
              />
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#006666', color: '#006666' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exporter
          </button>

          <div className="relative" data-dropdown>
            <button
              onClick={(e) => { e.stopPropagation(); setShowCustomizePopup(!showCustomizePopup) }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#006666' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Colonnes
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

        {/* Active filters summary */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: '#F2F2F3' }}>
            <span className="text-xs" style={{ color: '#6C767F' }}>Filtres actifs:</span>
            {selectedAccounts.length > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-[#E6F2F2]" style={{ color: '#006666' }}>
                {selectedAccounts.length} compte{selectedAccounts.length > 1 ? 's' : ''}
              </span>
            )}
            {(dateStart || dateEnd) && (
              <span className="text-xs px-2 py-1 rounded-full bg-[#E6F2F2]" style={{ color: '#006666' }}>
                Période
              </span>
            )}
            {selectedJournals.length > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-[#E6F2F2]" style={{ color: '#006666' }}>
                {selectedJournals.length} journal{selectedJournals.length > 1 ? 'x' : ''}
              </span>
            )}
            <button
              onClick={() => {
                setSelectedAccounts([])
                setSelectedJournals([])
                setDateStart(null)
                setDateEnd(null)
                setLetteringFilter('all')
                setSelectedVatRates([])
                setDebitValue('')
                setCreditValue('')
                setSearchQuery('')
              }}
              className="text-xs ml-auto"
              style={{ color: '#006666' }}
            >
              Tout effacer
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[1200px]">
          {/* Table Header */}
          <div className="sticky top-0 bg-white border-b flex items-center px-4 py-2.5 z-10" style={{ borderColor: '#E4E5E7' }}>
            <div className="w-6 flex-shrink-0" />
            <div className="w-20 flex-shrink-0 text-xs font-medium" style={{ color: '#6C767F' }}>Date</div>
            <div className="w-12 flex-shrink-0 text-xs font-medium" style={{ color: '#6C767F' }}>Jour.</div>
            <div className="flex-1 min-w-[180px] text-xs font-medium" style={{ color: '#6C767F' }}>Libellé de pièce</div>
            <div className="w-32 flex-shrink-0 text-xs font-medium" style={{ color: '#6C767F' }}>Libellé de ligne</div>
            <div className="w-28 flex-shrink-0 text-xs font-medium" style={{ color: '#6C767F' }}>N° Facture</div>
            <div className="w-16 flex-shrink-0 text-xs font-medium text-center" style={{ color: '#6C767F' }}>Let.</div>
            <div className="w-24 flex-shrink-0 text-xs font-medium text-right" style={{ color: '#6C767F' }}>Débit</div>
            <div className="w-24 flex-shrink-0 text-xs font-medium text-right" style={{ color: '#6C767F' }}>Crédit</div>
          </div>

          {/* Table Body */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#006666' }} />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="w-16 h-16 mb-4" style={{ color: '#D6D9DB' }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-lg font-medium mb-1" style={{ color: '#141A1F' }}>Aucune écriture trouvée</p>
              <p className="text-sm" style={{ color: '#6C767F' }}>
                {hasActiveFilters ? 'Modifiez vos filtres pour voir plus de résultats' : 'Commencez par importer ou créer des écritures'}
              </p>
            </div>
          ) : (
            <div>
              {Object.entries(groupedEntries).sort(([a], [b]) => a.localeCompare(b)).map(([classNum, classData]) => (
                <div key={classNum}>
                  {/* Class Row */}
                  <button
                    onClick={() => toggleClass(classNum)}
                    className="w-full flex items-center px-4 py-2 hover:bg-gray-100 transition-colors border-b"
                    style={{ backgroundColor: '#F8F9FA', borderColor: '#E4E5E7' }}
                  >
                    <div className="w-6 flex-shrink-0" style={{ color: '#6C767F' }}>
                      <ChevronIcon expanded={expandedClasses.has(classNum)} />
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: '#141A1F' }}>{classNum}</span>
                      <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{classNames[classNum]}</span>
                    </div>
                    <div className="w-24 flex-shrink-0 text-right text-sm font-medium" style={{ color: '#141A1F' }}>
                      {formatNumber(classData.total.debit)}
                    </div>
                    <div className="w-24 flex-shrink-0 text-right text-sm font-medium" style={{ color: '#141A1F' }}>
                      {formatNumber(classData.total.credit)}
                    </div>
                  </button>

                  {/* Accounts (directly under class, Pennylane style) */}
                  {expandedClasses.has(classNum) && Object.entries(classData.accounts).sort(([a], [b]) => a.localeCompare(b)).map(([accountCode, accountData]) => (
                    <div key={accountCode}>
                      {/* Account Row */}
                      <button
                        onClick={() => toggleAccount(accountCode)}
                        className="w-full flex items-center px-4 py-2 hover:bg-gray-50 transition-colors border-b pl-6"
                        style={{ borderColor: '#E4E5E7' }}
                      >
                        <div className="w-6 flex-shrink-0" style={{ color: '#6C767F' }}>
                          <ChevronIcon expanded={expandedAccounts.has(accountCode)} />
                        </div>
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{accountCode}</span>
                          <span className="text-sm truncate" style={{ color: '#141A1F' }}>{accountData.label}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: '#E8E8E8', color: '#6C767F' }}>
                            {accountData.entries.length}
                          </span>
                        </div>
                        <div className="w-24 flex-shrink-0 text-right text-sm" style={{ color: '#141A1F' }}>
                          {formatNumber(accountData.total.debit)}
                        </div>
                        <div className="w-24 flex-shrink-0 text-right text-sm" style={{ color: '#141A1F' }}>
                          {formatNumber(accountData.total.credit)}
                        </div>
                      </button>

                      {/* Entries */}
                      {expandedAccounts.has(accountCode) && accountData.entries
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((entry) => (
                        <div
                          key={entry.id}
                          onClick={() => setSelectedEntry(entry)}
                          className="flex items-center px-4 py-1.5 hover:bg-blue-50 transition-colors border-b cursor-pointer pl-12"
                          style={{ borderColor: '#F2F2F3' }}
                        >
                          <div className="w-6 flex-shrink-0" />
                          <div className="w-20 flex-shrink-0 text-sm" style={{ color: '#141A1F' }}>{formatDate(entry.date)}</div>
                          <div className="w-12 flex-shrink-0">
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#E8E8E8', color: '#6C767F' }}>
                              {entry.journal}
                            </span>
                          </div>
                          <div className="flex-1 min-w-[180px] text-sm truncate pr-2 flex items-center gap-2" style={{ color: '#141A1F' }}>
                            <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#9CA3AF' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <span className="truncate">{entry.label}</span>
                          </div>
                          <div className="w-32 flex-shrink-0 text-sm truncate" style={{ color: '#6C767F' }}>—</div>
                          <div className="w-28 flex-shrink-0 text-sm" style={{ color: '#6C767F' }}>{entry.piece_number || '—'}</div>
                          <div className="w-16 flex-shrink-0 text-sm text-center flex justify-center">
                            {entry.lettrage_code ? (
                              <LettrageBadge
                                code={entry.lettrage_code}
                                type={entry.lettrage_type || 'tiers'}
                                isComplete={true}
                                size="sm"
                              />
                            ) : entry.lettering ? (
                              <span style={{ color: '#006666' }}>{entry.lettering}</span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded" style={{ backgroundColor: '#FEE2E2' }}>
                                <span style={{ color: '#DC2626', fontSize: '10px' }}>N/A</span>
                              </span>
                            )}
                          </div>
                          <div className="w-24 flex-shrink-0 text-sm text-right" style={{ color: Number(entry.debit) > 0 ? '#141A1F' : '#D6D9DB' }}>
                            {Number(entry.debit) > 0 ? formatNumber(Number(entry.debit)) : '—'}
                          </div>
                          <div className="w-24 flex-shrink-0 text-sm text-right" style={{ color: Number(entry.credit) > 0 ? '#141A1F' : '#D6D9DB' }}>
                            {Number(entry.credit) > 0 ? formatNumber(Number(entry.credit)) : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

        {/* Export Modal */}
        {showExportModal && (
          <ExportModal
            onClose={() => setShowExportModal(false)}
            entriesCount={filteredEntries.length}
            hasFilters={hasActiveFilters}
            filters={{
              startDate: dateStart ? dateStart.toISOString().split('T')[0] : undefined,
              endDate: dateEnd ? dateEnd.toISOString().split('T')[0] : undefined,
              journal: selectedJournals.length === 1 ? selectedJournals[0] : undefined,
              accountCode: selectedAccounts.length === 1 ? selectedAccounts[0] : undefined,
            }}
          />
        )}

        {/* Entry Detail Panel */}
        {selectedEntry && (
          <>
            <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelectedEntry(null)} />
            <EntryDetailPanel
              entry={selectedEntry}
              account={accounts.find(a => a.code === selectedEntry.account_code)}
              onClose={() => setSelectedEntry(null)}
            />
          </>
        )}
      </div>

      {/* New Entry Side Panel */}
      {showNewEntryModal && (
        <NewEntryPanel
          onClose={() => setShowNewEntryModal(false)}
          journals={journals}
          accounts={accounts}
        />
      )}
    </div>
  )
}
