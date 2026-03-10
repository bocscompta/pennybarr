import { useState, useMemo, useEffect } from 'react'
import { ALL_ACCOUNTS, ACCOUNT_CLASSES } from '../data/planComptable'
import type { Account } from '../data/planComptable'
import { getChartOfAccounts, createChartOfAccount } from '../services/supabaseService'

// Extended account with additional properties for the table
interface ExtendedAccount extends Account {
  tvaAttribution?: string
  lettrage?: boolean
  aNouvDet?: boolean
  auxiliarise?: 'non' | 'auxiliarisable' | 'sous-compte'
}

// Convert accounts to extended accounts
const extendedAccounts: ExtendedAccount[] = ALL_ACCOUNTS.map(acc => ({
  ...acc,
  tvaAttribution: '',
  lettrage: false,
  aNouvDet: false,
  auxiliarise: acc.type === 'Fournisseur' || acc.type === 'Client' ? 'auxiliarisable' : 'non',
}))

interface PlanComptablePageProps {
  onNavigate?: (page: string) => void
}

export default function PlanComptablePage({ onNavigate: _onNavigate }: PlanComptablePageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<'contains' | 'starts'>('contains')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [auxiliaryFilter, setAuxiliaryFilter] = useState<'all' | 'auxiliary' | 'non-auxiliary'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [accounts, setAccounts] = useState<ExtendedAccount[]>(extendedAccounts)

  // Modal state for adding new account
  const [showAddModal, setShowAddModal] = useState(false)
  const [newAccountCode, setNewAccountCode] = useState('')
  const [newAccountLabel, setNewAccountLabel] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Load custom accounts from database and merge with static accounts
  useEffect(() => {
    async function loadCustomAccounts() {
      try {
        const dbAccounts = await getChartOfAccounts()
        // Get codes of static accounts
        const staticCodes = new Set(ALL_ACCOUNTS.map(a => a.code))
        // Filter only accounts that are not in static list (custom accounts)
        const customAccounts = dbAccounts.filter(a => !staticCodes.has(a.code))

        if (customAccounts.length > 0) {
          const extendedCustom: ExtendedAccount[] = customAccounts.map(acc => ({
            code: acc.code,
            label: acc.label,
            type: 'Personnalisé' as const,
            active: acc.is_active,
            tvaAttribution: '',
            lettrage: false,
            aNouvDet: false,
            auxiliarise: 'non' as const,
          }))
          // Merge with static accounts (not prev state to avoid duplicates)
          // and deduplicate by code
          const merged = [...extendedAccounts, ...extendedCustom]
          const uniqueByCode = merged.reduce((acc, curr) => {
            if (!acc.some(a => a.code === curr.code)) {
              acc.push(curr)
            }
            return acc
          }, [] as ExtendedAccount[])
          setAccounts(uniqueByCode.sort((a, b) => a.code.localeCompare(b.code)))
        }
      } catch (error) {
        console.error('Error loading custom accounts:', error)
      }
    }
    loadCustomAccounts()
  }, [])

  // Handle creating new account
  const handleCreateAccount = async () => {
    if (!newAccountCode.trim() || !newAccountLabel.trim()) return

    // Check if account already exists
    const existingAccount = accounts.find(a => a.code === newAccountCode.trim())
    if (existingAccount) {
      alert(`Le compte ${newAccountCode} existe déjà.`)
      return
    }

    setIsCreating(true)
    try {
      await createChartOfAccount(newAccountCode.trim(), newAccountLabel.trim())

      // Add to local state
      const newAccount: ExtendedAccount = {
        code: newAccountCode.trim(),
        label: newAccountLabel.trim(),
        type: 'Personnalisé',
        active: true,
        tvaAttribution: '',
        lettrage: false,
        aNouvDet: false,
        auxiliarise: 'non',
      }

      setAccounts(prev => {
        // Avoid duplicates
        if (prev.some(a => a.code === newAccount.code)) return prev
        const merged = [...prev, newAccount]
        return merged.sort((a, b) => a.code.localeCompare(b.code))
      })

      // Reset and close modal
      setNewAccountCode('')
      setNewAccountLabel('')
      setShowAddModal(false)
    } catch (error: unknown) {
      console.error('Error creating account:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      alert(`Erreur lors de la création du compte: ${errorMessage}`)
    } finally {
      setIsCreating(false)
    }
  }

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesCode = searchType === 'starts'
          ? account.code.startsWith(searchQuery)
          : account.code.includes(searchQuery)
        const matchesLabel = searchType === 'starts'
          ? account.label.toLowerCase().startsWith(query)
          : account.label.toLowerCase().includes(query)
        if (!matchesCode && !matchesLabel) return false
      }

      // Status filter
      if (statusFilter === 'active' && !account.active) return false
      if (statusFilter === 'inactive' && account.active) return false

      // Auxiliary filter
      if (auxiliaryFilter === 'auxiliary' && account.auxiliarise === 'non') return false
      if (auxiliaryFilter === 'non-auxiliary' && account.auxiliarise !== 'non') return false

      return true
    })
  }, [accounts, searchQuery, searchType, statusFilter, auxiliaryFilter])

  // Pagination
  const totalPages = Math.ceil(filteredAccounts.length / pageSize)
  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredAccounts.slice(start, start + pageSize)
  }, [filteredAccounts, currentPage, pageSize])

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedAccounts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedAccounts.map(a => a.code)))
    }
  }

  const toggleSelect = (code: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(code)) {
      newSet.delete(code)
    } else {
      newSet.add(code)
    }
    setSelectedIds(newSet)
  }

  // Toggle account property
  const toggleAccountProperty = (code: string, property: 'active' | 'lettrage' | 'aNouvDet') => {
    setAccounts(prev => prev.map(acc =>
      acc.code === code ? { ...acc, [property]: !acc[property] } : acc
    ))
  }

  // Export to CSV
  const handleExport = () => {
    const headers = ['Numéro', 'Type', 'Libellé', 'Activé', 'Lettrage', 'A-nvx dét.', 'Auxiliarisé']
    const rows = filteredAccounts.map(acc => [
      acc.code,
      acc.type,
      acc.label,
      acc.active ? 'Oui' : 'Non',
      acc.lettrage ? 'Oui' : 'Non',
      acc.aNouvDet ? 'Oui' : 'Non',
      acc.auxiliarise === 'non' ? 'Non auxiliarisable' : acc.auxiliarise === 'auxiliarisable' ? 'Auxiliarisable' : 'Sous-compte auxiliaire'
    ])

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'plan_comptable.csv'
    link.click()
  }

  // Get auxiliary badge
  const getAuxiliaryBadge = (aux: ExtendedAccount['auxiliarise']) => {
    if (aux === 'auxiliarisable') {
      return <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#D1FAE5', color: '#047857' }}>Auxiliarisable</span>
    }
    if (aux === 'sous-compte') {
      return <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>Sous-compte auxiliaire</span>
    }
    return <span className="text-xs" style={{ color: '#9CA3AF' }}>Non auxiliarisable</span>
  }

  // Pagination numbers
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

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, filteredAccounts.length)

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-5" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>Plan comptable</h1>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50" style={{ borderColor: '#006666', color: '#006666' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              Auxiliariser les comptes
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90"
              style={{ backgroundColor: '#006666' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Ajouter un compte
            </button>
          </div>
        </div>
        <p className="text-sm" style={{ color: '#6C767F' }}>
          Consultez, ajoutez et configurez les comptes de votre dossier.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 flex-wrap" style={{ borderColor: '#E4E5E7' }}>
        {/* Search type dropdown */}
        <div className="relative">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as 'contains' | 'starts')}
            className="appearance-none pl-3 pr-8 py-2 border rounded-lg text-sm bg-white cursor-pointer"
            style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
          >
            <option value="contains">Contient</option>
            <option value="starts">Commence par</option>
          </select>
          <svg className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher un compte"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
            className="w-48 pl-3 pr-8 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Status filter */}
        <button
          onClick={() => setStatusFilter(s => s === 'all' ? 'active' : s === 'active' ? 'inactive' : 'all')}
          className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${statusFilter !== 'all' ? 'bg-[#E6F2F2]' : ''}`}
          style={{ borderColor: statusFilter !== 'all' ? '#006666' : '#D6D9DB', color: statusFilter !== 'all' ? '#006666' : '#141A1F' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          Statut des comptes
          {statusFilter !== 'all' && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#006666', color: 'white' }}>
              {statusFilter === 'active' ? 'Actifs' : 'Inactifs'}
            </span>
          )}
        </button>

        {/* Auxiliary filter */}
        <button
          onClick={() => setAuxiliaryFilter(s => s === 'all' ? 'auxiliary' : s === 'auxiliary' ? 'non-auxiliary' : 'all')}
          className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${auxiliaryFilter !== 'all' ? 'bg-[#E6F2F2]' : ''}`}
          style={{ borderColor: auxiliaryFilter !== 'all' ? '#006666' : '#D6D9DB', color: auxiliaryFilter !== 'all' ? '#006666' : '#141A1F' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
          </svg>
          Comptes auxiliaires
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Export button */}
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium"
          style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Exporter (.XLS)
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-white sticky top-0 z-10">
            <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === paginatedAccounts.length && paginatedAccounts.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                <div className="flex items-center gap-1">
                  Numéro
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                  </svg>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Libellé</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                <div className="flex items-center gap-1">
                  Attribution TVA
                  <svg className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                <div className="flex items-center justify-center gap-1">
                  Activé
                  <svg className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                <div className="flex items-center justify-center gap-1">
                  Lettrage
                  <svg className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                <div className="flex items-center justify-center gap-1">
                  A-nvx dét.
                  <svg className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                <div className="flex items-center gap-1">
                  Auxiliarisé
                  <svg className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Règles de transac.</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {paginatedAccounts.map((account, index) => (
              <tr
                key={`${account.code}-${index}`}
                className="border-b hover:bg-gray-50 transition-colors"
                style={{ borderColor: '#F2F2F3' }}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(account.code)}
                    onChange={() => toggleSelect(account.code)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-mono" style={{ color: '#141A1F' }}>{account.code}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: account.type === 'Personnalisé' ? '#006666' : '#6C767F' }}>
                    {account.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: '#141A1F' }}>{account.label}</span>
                    {!account.active && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                        Obsolète
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: '#9CA3AF' }}>—</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleAccountProperty(account.code, 'active')}
                    className={`relative w-9 h-5 rounded-full transition-colors ${account.active ? 'bg-[#006666]' : 'bg-gray-200'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${account.active ? 'left-[18px]' : 'left-0.5'}`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleAccountProperty(account.code, 'lettrage')}
                    className={`relative w-9 h-5 rounded-full transition-colors ${account.lettrage ? 'bg-[#006666]' : 'bg-gray-200'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${account.lettrage ? 'left-[18px]' : 'left-0.5'}`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleAccountProperty(account.code, 'aNouvDet')}
                    className={`relative w-9 h-5 rounded-full transition-colors ${account.aNouvDet ? 'bg-[#006666]' : 'bg-gray-200'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${account.aNouvDet ? 'left-[18px]' : 'left-0.5'}`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3">
                  {getAuxiliaryBadge(account.auxiliarise)}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: '#9CA3AF' }}>—</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-white border-t px-6 py-3 flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-2">
          {[25, 50, 100].map(size => (
            <button
              key={size}
              onClick={() => { setPageSize(size); setCurrentPage(1) }}
              className={`px-2.5 py-1 text-sm rounded ${pageSize === size ? 'bg-[#006666] text-white' : 'hover:bg-gray-100'}`}
              style={{ color: pageSize === size ? 'white' : '#141A1F' }}
            >
              {size}
            </button>
          ))}
          <span className="text-sm ml-2" style={{ color: '#6C767F' }}>éléments par page</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: '#6C767F' }}>
            {startItem}-{endItem} sur {filteredAccounts.length}
          </span>

          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {getPageNumbers().map((page, idx) => (
              typeof page === 'number' ? (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 text-sm rounded ${currentPage === page ? 'bg-[#006666] text-white' : 'hover:bg-gray-100'}`}
                  style={{ color: currentPage === page ? 'white' : '#141A1F' }}
                >
                  {page}
                </button>
              ) : (
                <span key={idx} className="px-1 text-sm" style={{ color: '#6C767F' }}>...</span>
              )
            ))}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Barre d'actions en bas - apparaît quand des comptes sont sélectionnés */}
      {selectedIds.size > 0 && (() => {
        // Calculer l'état actuel des comptes sélectionnés
        const selectedAccounts = accounts.filter(a => selectedIds.has(a.code))
        const allActive = selectedAccounts.every(a => a.active)
        const someActive = selectedAccounts.some(a => a.active)
        const allLettrage = selectedAccounts.every(a => a.lettrage)
        const someLettrage = selectedAccounts.some(a => a.lettrage)
        const allANouvDet = selectedAccounts.every(a => a.aNouvDet)
        const someANouvDet = selectedAccounts.some(a => a.aNouvDet)

        return (
          <div
            className="fixed bottom-0 left-0 right-0 bg-[#1E293B] text-white px-6 py-3 flex items-center justify-between z-40 shadow-lg"
          >
            <div className="flex items-center gap-6">
              <span className="text-sm font-medium">
                {selectedIds.size} élément{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center gap-8">
              {/* Activé - Active/désactiver les comptes sélectionnés */}
              <div className="flex items-center gap-2">
                <span className="text-sm">Activé</span>
                <button
                  onClick={() => {
                    const newValue = !allActive
                    setAccounts(prev => prev.map(acc =>
                      selectedIds.has(acc.code) ? { ...acc, active: newValue } : acc
                    ))
                  }}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    allActive ? 'bg-[#006666]' : someActive ? 'bg-[#006666]/50' : 'bg-gray-500'
                  }`}
                  title="Activer/désactiver les comptes pour les écritures comptables"
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      allActive || someActive ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Lettrage - Rapprochement débit/crédit */}
              <div className="flex items-center gap-2">
                <span className="text-sm">Lettrage</span>
                <button
                  onClick={() => {
                    const newValue = !allLettrage
                    setAccounts(prev => prev.map(acc =>
                      selectedIds.has(acc.code) ? { ...acc, lettrage: newValue } : acc
                    ))
                  }}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    allLettrage ? 'bg-[#006666]' : someLettrage ? 'bg-[#006666]/50' : 'bg-gray-500'
                  }`}
                  title="Lettrage: rapprocher les débits et crédits (clients, fournisseurs, banques)"
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      allLettrage || someLettrage ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* À-nvx dét. - À-nouveaux détaillés */}
              <div className="flex items-center gap-2">
                <span className="text-sm">À-nvx dét.</span>
                <button
                  onClick={() => {
                    const newValue = !allANouvDet
                    setAccounts(prev => prev.map(acc =>
                      selectedIds.has(acc.code) ? { ...acc, aNouvDet: newValue } : acc
                    ))
                  }}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    allANouvDet ? 'bg-[#006666]' : someANouvDet ? 'bg-[#006666]/50' : 'bg-gray-500'
                  }`}
                  title="À-nouveaux détaillés: reporter chaque écriture en détail à l'ouverture"
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      allANouvDet || someANouvDet ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Bouton désélectionner */}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="ml-4 px-3 py-1 text-sm border border-gray-500 rounded hover:bg-gray-700"
              >
                Désélectionner
              </button>
            </div>
          </div>
        )
      })()}

      {/* Modal Ajouter un compte */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowAddModal(false)} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-50 w-[420px] p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Ajouter un compte</h3>
              <button
                onClick={() => setShowAddModal(false)}
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
                  value={newAccountCode}
                  onChange={(e) => setNewAccountCode(e.target.value)}
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
                  value={newAccountLabel}
                  onChange={(e) => setNewAccountLabel(e.target.value)}
                  placeholder="Entrez le libellé du compte"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleCreateAccount}
                disabled={!newAccountCode.trim() || !newAccountLabel.trim() || isCreating}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: newAccountCode.trim() && newAccountLabel.trim() && !isCreating ? '#006666' : '#E4E5E7',
                  color: newAccountCode.trim() && newAccountLabel.trim() && !isCreating ? 'white' : '#9CA3AF'
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
