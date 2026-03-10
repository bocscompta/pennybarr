import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ALL_ACCOUNTS } from '../data/planComptable'
import { createChartOfAccount } from '../services/supabaseService'

interface ThirdParty {
  id: string
  code: string
  name: string
  type: 'supplier' | 'customer' | 'both'
  email?: string
  phone?: string
  address?: string
  siret?: string
  vat_number?: string
  account_number?: string
  counterpart_account?: string
  default_vat_rate?: string
  category?: string
  iban?: string
  autofacture?: boolean
  created_at: string
}

// Column configuration
interface ColumnConfig {
  id: string
  label: string
  visible: boolean
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'selection', label: 'Sélection', visible: true },
  { id: 'nom', label: 'Nom', visible: true },
  { id: 'numero_compte', label: 'Numéro de compte', visible: true },
  { id: 'contrepartie', label: 'Contrepartie', visible: true },
  { id: 'tva', label: 'TVA', visible: true },
  { id: 'categories', label: 'Catégories', visible: true },
  { id: 'autofacture', label: 'Autofacture', visible: true },
  { id: 'solde', label: 'Solde', visible: true },
]

interface AccountingEntry {
  third_party_code: string
  debit: number
  credit: number
}

// Génère les options de contrepartie à partir du plan comptable complet
const COUNTERPART_OPTIONS = ALL_ACCOUNTS
  .map(a => ({
    value: a.code,
    label: `${a.code} - ${a.label}`,
    count: 0 // Le compteur sera mis à jour dynamiquement
  }))
  .sort((a, b) => a.value.localeCompare(b.value))

// Options pour la TVA
const TVA_OPTIONS = [
  { value: 'autoliq', label: 'Autoliquidé 20%' },
  { value: '20', label: '20%' },
  { value: '10', label: '10%' },
  { value: '5.5', label: '5,5%' },
  { value: '0', label: 'Aucune' },
]

// Catégories
const CATEGORY_OPTIONS = [
  { value: 'logiciels', label: 'Logiciels & SaaS', color: '#006666' },
  { value: 'ordinateur', label: 'Ordinateur & Mat.', color: '#F97316' },
  { value: 'telecom', label: 'Télécom', color: '#8B5CF6' },
  { value: 'banque', label: 'Frais bancaires', color: '#EF4444' },
]

interface TiersPageProps {
  onNavigate?: (page: string) => void
  initialTab?: 'suppliers' | 'customers'
}

export default function TiersPage({ onNavigate: _onNavigate, initialTab = 'suppliers' }: TiersPageProps) {
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([])
  const [entries, setEntries] = useState<AccountingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'suppliers' | 'customers'>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedThirdParty, setSelectedThirdParty] = useState<ThirdParty | null>(null)
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  // Custom accounts created by user
  const [customAccounts, setCustomAccounts] = useState<{ value: string; label: string; count: number }[]>([])

  // Merge standard options with custom accounts
  const allCounterpartOptions = useMemo(() => {
    const merged = [...customAccounts, ...COUNTERPART_OPTIONS]
    // Remove duplicates (prefer custom accounts)
    const seen = new Set<string>()
    return merged.filter(opt => {
      if (seen.has(opt.value)) return false
      seen.add(opt.value)
      return true
    }).sort((a, b) => a.value.localeCompare(b.value))
  }, [customAccounts])

  // Handler for creating new account
  const handleCreateNewAccount = async (code: string, label: string) => {
    try {
      // Persist to database
      await createChartOfAccount(code, label)

      // Add to local state for immediate UI update
      const newAccount = {
        value: code,
        label: `${code} - ${label}`,
        count: 0
      }
      setCustomAccounts(prev => [...prev, newAccount])
    } catch (error: unknown) {
      console.error('Error creating account:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      alert(`Erreur lors de la création du compte: ${errorMessage}`)
      throw error // Re-throw to prevent modal from closing
    }
  }

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Filters
  const [showCounterpartFilter, setShowCounterpartFilter] = useState(false)
  const [showTvaFilter, setShowTvaFilter] = useState(false)
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)

  // Column customization
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS)
  const [showCustomizePanel, setShowCustomizePanel] = useState(false)
  const [tempColumns, setTempColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS)

  const isColumnVisible = (id: string) => columns.find(c => c.id === id)?.visible ?? true

  const handleOpenCustomize = () => {
    setTempColumns([...columns])
    setShowCustomizePanel(true)
  }

  const handleApplyColumns = () => {
    setColumns(tempColumns)
    setShowCustomizePanel(false)
  }

  const handleResetColumns = () => {
    setTempColumns(DEFAULT_COLUMNS)
  }

  const toggleTempColumn = (id: string) => {
    setTempColumns(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c))
  }

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [tpRes, entriesRes] = await Promise.all([
          supabase.from('third_parties').select('*').order('name'),
          supabase.from('accounting_entries').select('third_party_code, debit, credit'),
        ])

        if (tpRes.data) setThirdParties(tpRes.data)
        if (entriesRes.data) setEntries(entriesRes.data)
      } catch (err) {
        console.error('Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Calculate balances per third party
  const balances = useMemo(() => {
    const result: Record<string, { debit: number; credit: number; balance: number; count: number }> = {}
    entries.forEach(entry => {
      if (!entry.third_party_code) return
      if (!result[entry.third_party_code]) {
        result[entry.third_party_code] = { debit: 0, credit: 0, balance: 0, count: 0 }
      }
      result[entry.third_party_code].debit += Number(entry.debit) || 0
      result[entry.third_party_code].credit += Number(entry.credit) || 0
      result[entry.third_party_code].count += 1
    })
    Object.values(result).forEach(b => {
      b.balance = b.debit - b.credit
    })
    return result
  }, [entries])

  // Filter third parties
  const filteredThirdParties = useMemo(() => {
    return thirdParties.filter(tp => {
      // Type filter
      if (activeTab === 'suppliers' && tp.type !== 'supplier' && tp.type !== 'both') return false
      if (activeTab === 'customers' && tp.type !== 'customer' && tp.type !== 'both') return false

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return tp.code?.toLowerCase().includes(query) ||
          tp.name.toLowerCase().includes(query) ||
          tp.email?.toLowerCase().includes(query)
      }
      return true
    })
  }, [thirdParties, activeTab, searchQuery])

  // Pagination
  const totalPages = Math.ceil(filteredThirdParties.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedThirdParties = filteredThirdParties.slice(startIndex, startIndex + itemsPerPage)

  // Stats
  const stats = useMemo(() => {
    const suppliers = thirdParties.filter(tp => tp.type === 'supplier' || tp.type === 'both')
    const customers = thirdParties.filter(tp => tp.type === 'customer' || tp.type === 'both')
    return {
      suppliersCount: suppliers.length,
      customersCount: customers.length,
    }
  }, [thirdParties])

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  }

  // Selection handlers
  const toggleRowSelection = (id: string) => {
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const toggleAllSelection = () => {
    if (selectedRows.length === paginatedThirdParties.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(paginatedThirdParties.map(tp => tp.id))
    }
  }

  // Update third party field
  const updateThirdPartyField = async (id: string, field: string, value: string) => {
    try {
      await supabase.from('third_parties').update({ [field]: value }).eq('id', id)
      setThirdParties(prev => prev.map(tp => tp.id === id ? { ...tp, [field]: value } : tp))
    } catch (err) {
      console.error('Error updating:', err)
    }
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i)
      }
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
            {activeTab === 'suppliers' ? 'Fournisseurs' : 'Clients'}
          </h1>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
              Exporter
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
              Importer
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#006666' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nouveau {activeTab === 'suppliers' ? 'fournisseur' : 'client'}
            </button>
          </div>
        </div>
      </header>

      {/* Filters Row */}
      <div className="bg-white border-b px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher un fournisseur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm w-56"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          {/* Filter Chips */}
          <button
            onClick={() => setShowCounterpartFilter(!showCounterpartFilter)}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
          >
            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
            Contrepartie
          </button>

          <button
            onClick={() => setShowTvaFilter(!showTvaFilter)}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
          >
            % TVA
          </button>

          <button
            onClick={() => setShowCategoryFilter(!showCategoryFilter)}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
          >
            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
            Catégories
          </button>

          <button className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Visibilité
          </button>

          <button className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
            IBAN
          </button>

          <button className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            Auto-facture activé
          </button>

          <div className="flex-1" />

          {/* Personnaliser */}
          <div className="relative">
            <button
              onClick={handleOpenCustomize}
              className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#006666', color: '#006666' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Personnaliser
            </button>

            {/* Customize Panel */}
            {showCustomizePanel && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg border shadow-xl z-50" style={{ borderColor: '#E4E5E7' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#E4E5E7' }}>
                  <span className="font-medium text-sm" style={{ color: '#141A1F' }}>Personnaliser l'affichage</span>
                  <button
                    onClick={handleResetColumns}
                    className="text-sm"
                    style={{ color: '#006666' }}
                  >
                    Réinit.
                  </button>
                </div>

                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium" style={{ color: '#141A1F' }}>Colonnes</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E6F2F2', color: '#006666' }}>
                      {tempColumns.filter(c => c.visible).length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {tempColumns.map(col => (
                      <label key={col.id} className="flex items-center justify-between py-1 cursor-pointer">
                        <span className="text-sm" style={{ color: '#141A1F' }}>{col.label}</span>
                        <button
                          onClick={() => toggleTempColumn(col.id)}
                          className={`w-10 h-6 rounded-full transition-colors relative ${col.visible ? 'bg-[#006666]' : 'bg-gray-300'}`}
                        >
                          <span
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${col.visible ? 'left-5' : 'left-1'}`}
                          />
                        </button>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 px-4 py-3 border-t" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={() => setShowCustomizePanel(false)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm font-medium"
                    style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleApplyColumns}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: '#006666' }}
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full" style={{ minWidth: '1200px' }}>
          <thead className="sticky top-0 bg-white border-b z-10" style={{ borderColor: '#E4E5E7' }}>
            <tr>
              {isColumnVisible('selection') && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === paginatedThirdParties.length && paginatedThirdParties.length > 0}
                    onChange={toggleAllSelection}
                    className="rounded w-4 h-4"
                    style={{ accentColor: '#006666' }}
                  />
                </th>
              )}
              {isColumnVisible('nom') && (
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Nom</th>
              )}
              {isColumnVisible('numero_compte') && (
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Numéro de compte</th>
              )}
              {isColumnVisible('contrepartie') && (
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Contrepartie</th>
              )}
              {isColumnVisible('tva') && (
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>TVA</th>
              )}
              {isColumnVisible('categories') && (
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Catégories</th>
              )}
              {isColumnVisible('autofacture') && (
                <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Autofacture</th>
              )}
              {isColumnVisible('solde') && (
                <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Solde</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.filter(c => c.visible).length} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#006666' }} />
                </td>
              </tr>
            ) : paginatedThirdParties.length === 0 ? (
              <tr>
                <td colSpan={columns.filter(c => c.visible).length} className="text-center py-12">
                  <p className="text-sm" style={{ color: '#6C767F' }}>Aucun {activeTab === 'suppliers' ? 'fournisseur' : 'client'} trouvé</p>
                </td>
              </tr>
            ) : (
              paginatedThirdParties.map(tp => {
                const balance = balances[tp.code] || { balance: 0 }
                return (
                  <tr
                    key={tp.id}
                    className="border-b hover:bg-gray-50 transition-colors"
                    style={{ borderColor: '#F2F2F3' }}
                  >
                    {isColumnVisible('selection') && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(tp.id)}
                          onChange={() => toggleRowSelection(tp.id)}
                          className="rounded w-4 h-4"
                          style={{ accentColor: '#006666' }}
                        />
                      </td>
                    )}
                    {isColumnVisible('nom') && (
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{tp.name}</span>
                      </td>
                    )}
                    {isColumnVisible('numero_compte') && (
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: '#141A1F' }}>{tp.account_number || tp.code || '—'}</span>
                      </td>
                    )}
                    {isColumnVisible('contrepartie') && (
                      <td className="px-4 py-3">
                        <SelectDropdown
                          value={tp.counterpart_account || ''}
                          options={allCounterpartOptions}
                          placeholder="Choisir..."
                          onChange={(val) => updateThirdPartyField(tp.id, 'counterpart_account', val)}
                          showCounts={true}
                          onCreateNew={handleCreateNewAccount}
                        />
                      </td>
                    )}
                    {isColumnVisible('tva') && (
                      <td className="px-4 py-3">
                        <SelectDropdown
                          value={tp.default_vat_rate || ''}
                          options={TVA_OPTIONS}
                          placeholder="Choisir..."
                          onChange={(val) => updateThirdPartyField(tp.id, 'default_vat_rate', val)}
                        />
                      </td>
                    )}
                    {isColumnVisible('categories') && (
                      <td className="px-4 py-3">
                        {tp.category ? (
                          <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                              backgroundColor: CATEGORY_OPTIONS.find(c => c.value === tp.category)?.color + '20' || '#E6F2F2',
                              color: CATEGORY_OPTIONS.find(c => c.value === tp.category)?.color || '#006666'
                            }}
                          >
                            {CATEGORY_OPTIONS.find(c => c.value === tp.category)?.label || tp.category}
                          </span>
                        ) : (
                          <span style={{ color: '#D6D9DB' }}>—</span>
                        )}
                      </td>
                    )}
                    {isColumnVisible('autofacture') && (
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-sm">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tp.autofacture ? '#10B981' : '#EF4444' }}
                          />
                          {tp.autofacture ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                    )}
                    {isColumnVisible('solde') && (
                      <td className="px-4 py-3 text-right">
                        {balance.balance !== 0 ? (
                          <span className="text-sm font-medium" style={{ color: balance.balance < 0 ? '#EF4444' : '#141A1F' }}>
                            {formatNumber(balance.balance)} €
                          </span>
                        ) : (
                          <span style={{ color: '#D6D9DB' }}>—</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-white border-t px-6 py-3 flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-2">
          {[25, 50, 100].map(size => (
            <button
              key={size}
              onClick={() => { setItemsPerPage(size); setCurrentPage(1) }}
              className={`px-2 py-1 text-sm rounded ${itemsPerPage === size ? 'font-medium' : ''}`}
              style={{
                backgroundColor: itemsPerPage === size ? '#E6F2F2' : 'transparent',
                color: itemsPerPage === size ? '#006666' : '#6C767F'
              }}
            >
              {size}
            </button>
          ))}
          <span className="text-sm" style={{ color: '#6C767F' }}>éléments par page</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: '#6C767F' }}>
            {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredThirdParties.length)} sur {filteredThirdParties.length}
          </span>

          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {getPageNumbers().map((page, idx) => (
              <button
                key={idx}
                onClick={() => typeof page === 'number' && setCurrentPage(page)}
                disabled={page === '...'}
                className={`w-8 h-8 text-sm rounded ${currentPage === page ? 'font-medium' : ''}`}
                style={{
                  backgroundColor: currentPage === page ? '#E6F2F2' : 'transparent',
                  color: currentPage === page ? '#006666' : '#6C767F'
                }}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* New Third Party Modal */}
      {showNewModal && (
        <NewThirdPartyModal
          type={activeTab === 'suppliers' ? 'supplier' : 'customer'}
          onClose={() => setShowNewModal(false)}
          onSave={(tp) => {
            setThirdParties([...thirdParties, tp])
            setShowNewModal(false)
          }}
        />
      )}

      {/* Third Party Detail Panel */}
      {selectedThirdParty && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelectedThirdParty(null)} />
          <ThirdPartyDetailPanel
            thirdParty={selectedThirdParty}
            balance={balances[selectedThirdParty.code] || { debit: 0, credit: 0, balance: 0, count: 0 }}
            onClose={() => setSelectedThirdParty(null)}
          />
        </>
      )}
    </div>
  )
}

// Select Dropdown Component for Contrepartie
function SelectDropdown({
  value,
  options,
  placeholder,
  onChange,
  showCounts = false,
  onCreateNew,
}: {
  value: string
  options: { value: string; label: string; count?: number }[]
  placeholder: string
  onChange: (value: string) => void
  showCounts?: boolean
  onCreateNew?: (code: string, label: string) => void | Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const selected = options.find(o => o.value === value)

  const filteredOptions = useMemo(() => {
    if (!search) return options

    const searchLower = search.toLowerCase()
    const filtered = options.filter(o =>
      o.label.toLowerCase().includes(searchLower) ||
      o.value.toLowerCase().includes(searchLower)
    )

    // Trier pour prioriser les comptes qui commencent par la recherche
    return filtered.sort((a, b) => {
      const aStartsWithCode = a.value.startsWith(search)
      const bStartsWithCode = b.value.startsWith(search)
      const aStartsWithLabel = a.label.toLowerCase().startsWith(searchLower)
      const bStartsWithLabel = b.label.toLowerCase().startsWith(searchLower)

      // Priorité 1: code commence par la recherche
      if (aStartsWithCode && !bStartsWithCode) return -1
      if (!aStartsWithCode && bStartsWithCode) return 1

      // Priorité 2: label commence par la recherche
      if (aStartsWithLabel && !bStartsWithLabel) return -1
      if (!aStartsWithLabel && bStartsWithLabel) return 1

      // Sinon, garder l'ordre original (par count)
      return 0
    })
  }, [options, search])

  // Get short label for display in button
  const getShortLabel = (label: string) => {
    const parts = label.split(' - ')
    if (parts.length > 1) {
      return `${parts[0]} - ${parts[1].substring(0, 8)}...`
    }
    return label.length > 15 ? label.substring(0, 15) + '...' : label
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); setSearch('') }}
        className="flex items-center gap-1 px-2 py-1 border rounded text-sm min-w-[140px] max-w-[160px]"
        style={{ borderColor: '#D6D9DB', color: selected ? '#141A1F' : '#9CA3AF' }}
      >
        <span className="truncate flex-1 text-left">
          {selected ? getShortLabel(selected.label) : placeholder}
        </span>
        {selected && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false) }}
            className="hover:bg-gray-200 rounded p-0.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-80 bg-white border rounded-lg shadow-xl z-20" style={{ borderColor: '#E4E5E7' }}>
            {/* Search input */}
            {showCounts && (
              <div className="p-2 border-b" style={{ borderColor: '#E4E5E7' }}>
                <input
                  type="text"
                  placeholder="Rechercher un compte..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            {/* Header */}
            {showCounts && (
              <div className="px-4 py-2">
                <span className="text-xs font-semibold uppercase" style={{ color: '#6C767F' }}>
                  Les plus utilisés
                </span>
              </div>
            )}

            {/* Options */}
            <div className="max-h-64 overflow-y-auto">
              {filteredOptions.slice(0, search ? 50 : (showCounts ? 8 : 10)).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false) }}
                  className={`w-full px-4 py-2.5 text-left transition-colors ${value === opt.value ? 'text-white' : 'hover:bg-gray-50'}`}
                  style={{
                    backgroundColor: value === opt.value ? '#006666' : undefined,
                    color: value === opt.value ? 'white' : '#141A1F'
                  }}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  {showCounts && opt.count !== undefined && (
                    <div className="text-xs mt-0.5" style={{ color: value === opt.value ? 'rgba(255,255,255,0.8)' : '#6C767F' }}>
                      {opt.count} lignes
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Info message */}
            {showCounts && (
              <div className="px-4 py-3 border-t flex items-start gap-2" style={{ borderColor: '#E4E5E7', backgroundColor: '#F0F9FF' }}>
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#3B82F6' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="text-xs" style={{ color: '#1E40AF' }}>
                  Accédez à plus de comptes en affinant la recherche.
                </span>
              </div>
            )}

            {/* Create new */}
            {showCounts && onCreateNew && (
              <div className="px-4 py-3 border-t" style={{ borderColor: '#E4E5E7' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowCreateModal(true)
                    setNewCode(search) // Pré-remplir avec la recherche actuelle
                    setNewLabel('')
                  }}
                  className="text-sm font-medium flex items-center gap-1 hover:opacity-80"
                  style={{ color: '#006666' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Créer un nouveau compte
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal création de compte */}
      {showCreateModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowCreateModal(false)} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-50 w-96 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Ajouter un compte</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Numéro</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Ex: 615700001"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Libellé</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Entrez le libellé du compte"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={async () => {
                  if (newCode.trim() && newLabel.trim() && onCreateNew) {
                    setIsCreating(true)
                    try {
                      await onCreateNew(newCode.trim(), newLabel.trim())
                      onChange(newCode.trim())
                      setShowCreateModal(false)
                      setIsOpen(false)
                      setNewCode('')
                      setNewLabel('')
                    } finally {
                      setIsCreating(false)
                    }
                  }
                }}
                disabled={!newCode.trim() || !newLabel.trim() || isCreating}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: newCode.trim() && newLabel.trim() && !isCreating ? '#006666' : '#E4E5E7',
                  color: newCode.trim() && newLabel.trim() && !isCreating ? 'white' : '#9CA3AF'
                }}
              >
                {isCreating ? 'Création...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// New Third Party Modal
function NewThirdPartyModal({
  type,
  onClose,
  onSave,
}: {
  type: 'supplier' | 'customer'
  onClose: () => void
  onSave: (tp: ThirdParty) => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [siret, setSiret] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('third_parties')
        .insert([{ code, name, type, email, phone, siret }])
        .select()
        .single()

      if (error) throw error
      if (data) onSave(data)
    } catch (err) {
      console.error('Error creating third party:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            Nouveau {type === 'supplier' ? 'fournisseur' : 'client'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
              placeholder="401000001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Nom *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
              placeholder="Nom du tiers"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Téléphone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>SIRET</label>
            <input
              type="text"
              value={siret}
              onChange={(e) => setSiret(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-sm font-medium"
            style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#006666' }}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Third Party Detail Panel
function ThirdPartyDetailPanel({
  thirdParty,
  balance,
  onClose,
}: {
  thirdParty: ThirdParty
  balance: { debit: number; credit: number; balance: number; count: number }
  onClose: () => void
}) {
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  }

  return (
    <div className="fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
        <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>{thirdParty.name}</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase mb-1" style={{ color: '#6C767F' }}>Code</p>
            <p className="text-sm" style={{ color: '#141A1F' }}>{thirdParty.code || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase mb-1" style={{ color: '#6C767F' }}>Type</p>
            <p className="text-sm" style={{ color: '#141A1F' }}>
              {thirdParty.type === 'supplier' ? 'Fournisseur' : thirdParty.type === 'customer' ? 'Client' : 'Les deux'}
            </p>
          </div>
          {thirdParty.email && (
            <div>
              <p className="text-xs font-medium uppercase mb-1" style={{ color: '#6C767F' }}>Email</p>
              <p className="text-sm" style={{ color: '#006666' }}>{thirdParty.email}</p>
            </div>
          )}
          {thirdParty.phone && (
            <div>
              <p className="text-xs font-medium uppercase mb-1" style={{ color: '#6C767F' }}>Téléphone</p>
              <p className="text-sm" style={{ color: '#141A1F' }}>{thirdParty.phone}</p>
            </div>
          )}
          {thirdParty.siret && (
            <div>
              <p className="text-xs font-medium uppercase mb-1" style={{ color: '#6C767F' }}>SIRET</p>
              <p className="text-sm" style={{ color: '#141A1F' }}>{thirdParty.siret}</p>
            </div>
          )}

          <div className="border-t pt-4 mt-4" style={{ borderColor: '#E4E5E7' }}>
            <p className="text-xs font-medium uppercase mb-3" style={{ color: '#6C767F' }}>Solde comptable</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs" style={{ color: '#6C767F' }}>Débit</p>
                <p className="text-sm font-medium" style={{ color: '#141A1F' }}>{formatNumber(balance.debit)} €</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#6C767F' }}>Crédit</p>
                <p className="text-sm font-medium" style={{ color: '#141A1F' }}>{formatNumber(balance.credit)} €</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#6C767F' }}>Solde</p>
                <p className="text-sm font-medium" style={{ color: balance.balance < 0 ? '#EF4444' : '#141A1F' }}>
                  {formatNumber(balance.balance)} €
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
