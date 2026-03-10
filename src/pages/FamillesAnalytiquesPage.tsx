import { useState, useEffect, useMemo } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'

// ============ Types ============

interface AnalyticalFamily {
  id: string
  company_id: string
  code: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
}

interface AnalyticalCode {
  id: string
  company_id: string
  family_id: string
  code: string
  label: string
  description: string | null
  budget_annual: number
  responsible: string | null
  is_active: boolean
  created_at: string
}

interface CodeStats {
  total_charges: number
  total_produits: number
  resultat: number
}

// ============ Constants ============

const DEFAULT_COLORS = [
  '#57534e', // stone-600
  '#78716c', // stone-500
  '#a8a29e', // stone-400
  '#44403c', // stone-700
  '#292524', // stone-800
  '#d6d3d1', // stone-300
  '#1c1917', // stone-900
  '#e7e5e4', // stone-200
]

// ============ Helper Functions ============

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// ============ Component Props ============

interface FamillesAnalytiquesPageProps {
  onNavigate?: (page: string) => void
}

// ============ Main Component ============

export default function FamillesAnalytiquesPage({ onNavigate: _onNavigate }: FamillesAnalytiquesPageProps) {
  // State
  const [families, setFamilies] = useState<AnalyticalFamily[]>([])
  const [codes, setCodes] = useState<AnalyticalCode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [showFamilyModal, setShowFamilyModal] = useState(false)
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [editingFamily, setEditingFamily] = useState<AnalyticalFamily | null>(null)
  const [editingCode, setEditingCode] = useState<AnalyticalCode | null>(null)

  // Stats (placeholder - would need accounting entries with analytical codes)
  const [_codeStats] = useState<Record<string, CodeStats>>({})

  // ============ Data Fetching ============

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [familiesRes, codesRes] = await Promise.all([
          supabase
            .from('analytical_families')
            .select('*')
            .eq('company_id', COMPANY_ID)
            .order('code'),
          supabase
            .from('analytical_codes')
            .select('*')
            .eq('company_id', COMPANY_ID)
            .order('code'),
        ])

        if (familiesRes.error) {
          console.error('Error fetching families:', familiesRes.error)
          throw new Error(`Erreur chargement familles: ${familiesRes.error.message}`)
        }
        if (codesRes.error) {
          console.error('Error fetching codes:', codesRes.error)
          throw new Error(`Erreur chargement codes: ${codesRes.error.message}`)
        }

        setFamilies(familiesRes.data || [])
        setCodes(codesRes.data || [])

        // Select first family by default
        if (familiesRes.data && familiesRes.data.length > 0 && !selectedFamilyId) {
          setSelectedFamilyId(familiesRes.data[0].id)
        }
      } catch (err) {
        console.error('Error in fetchData:', err)
        throw err
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedFamilyId])

  // ============ Computed Values ============

  const selectedFamily = useMemo(() => {
    return families.find(f => f.id === selectedFamilyId) || null
  }, [families, selectedFamilyId])

  const filteredCodes = useMemo(() => {
    let filtered = codes.filter(c => c.family_id === selectedFamilyId)

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        c => c.code.toLowerCase().includes(query) || c.label.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [codes, selectedFamilyId, searchQuery])

  const familyStats = useMemo(() => {
    const stats: Record<string, { count: number; totalBudget: number }> = {}

    families.forEach(family => {
      const familyCodes = codes.filter(c => c.family_id === family.id)
      stats[family.id] = {
        count: familyCodes.length,
        totalBudget: familyCodes.reduce((sum, c) => sum + (Number(c.budget_annual) || 0), 0),
      }
    })

    return stats
  }, [families, codes])

  const totalBudget = useMemo(() => {
    return filteredCodes.reduce((sum, c) => sum + (Number(c.budget_annual) || 0), 0)
  }, [filteredCodes])

  // ============ Handlers ============

  const handleSaveFamily = async (data: Partial<AnalyticalFamily>) => {
    try {
      if (editingFamily) {
        // Update existing
        const { error } = await supabase
          .from('analytical_families')
          .update({
            code: data.code,
            name: data.name,
            description: data.description,
            color: data.color,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingFamily.id)

        if (error) {
          console.error('Error updating family:', error)
          throw new Error(`Erreur mise a jour famille: ${error.message}`)
        }

        setFamilies(prev =>
          prev.map(f => (f.id === editingFamily.id ? { ...f, ...data } : f))
        )
      } else {
        // Create new
        const { data: newFamily, error } = await supabase
          .from('analytical_families')
          .insert({
            company_id: COMPANY_ID,
            code: data.code,
            name: data.name,
            description: data.description,
            color: data.color || DEFAULT_COLORS[families.length % DEFAULT_COLORS.length],
          })
          .select()
          .single()

        if (error) {
          console.error('Error creating family:', error)
          throw new Error(`Erreur creation famille: ${error.message}`)
        }

        if (newFamily) {
          setFamilies(prev => [...prev, newFamily])
          setSelectedFamilyId(newFamily.id)
        }
      }

      setShowFamilyModal(false)
      setEditingFamily(null)
    } catch (err) {
      console.error('Error saving family:', err)
      throw err
    }
  }

  const handleDeleteFamily = async (familyId: string) => {
    if (!confirm('Supprimer cette famille et tous ses codes analytiques ?')) return

    try {
      const { error } = await supabase
        .from('analytical_families')
        .delete()
        .eq('id', familyId)

      if (error) {
        console.error('Error deleting family:', error)
        throw new Error(`Erreur suppression famille: ${error.message}`)
      }

      setFamilies(prev => prev.filter(f => f.id !== familyId))
      setCodes(prev => prev.filter(c => c.family_id !== familyId))

      if (selectedFamilyId === familyId) {
        setSelectedFamilyId(families.find(f => f.id !== familyId)?.id || null)
      }
    } catch (err) {
      console.error('Error deleting family:', err)
      throw err
    }
  }

  const handleSaveCode = async (data: Partial<AnalyticalCode>) => {
    try {
      if (editingCode) {
        // Update existing
        const { error } = await supabase
          .from('analytical_codes')
          .update({
            code: data.code,
            label: data.label,
            description: data.description,
            budget_annual: data.budget_annual || 0,
            responsible: data.responsible,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCode.id)

        if (error) {
          console.error('Error updating code:', error)
          throw new Error(`Erreur mise a jour code: ${error.message}`)
        }

        setCodes(prev =>
          prev.map(c => (c.id === editingCode.id ? { ...c, ...data } : c))
        )
      } else {
        // Create new
        const { data: newCode, error } = await supabase
          .from('analytical_codes')
          .insert({
            company_id: COMPANY_ID,
            family_id: selectedFamilyId,
            code: data.code,
            label: data.label,
            description: data.description,
            budget_annual: data.budget_annual || 0,
            responsible: data.responsible,
          })
          .select()
          .single()

        if (error) {
          console.error('Error creating code:', error)
          throw new Error(`Erreur creation code: ${error.message}`)
        }

        if (newCode) {
          setCodes(prev => [...prev, newCode])
        }
      }

      setShowCodeModal(false)
      setEditingCode(null)
    } catch (err) {
      console.error('Error saving code:', err)
      throw err
    }
  }

  const handleDeleteCode = async (codeId: string) => {
    if (!confirm('Supprimer ce code analytique ?')) return

    try {
      const { error } = await supabase
        .from('analytical_codes')
        .delete()
        .eq('id', codeId)

      if (error) {
        console.error('Error deleting code:', error)
        throw new Error(`Erreur suppression code: ${error.message}`)
      }

      setCodes(prev => prev.filter(c => c.id !== codeId))
    } catch (err) {
      console.error('Error deleting code:', err)
      throw err
    }
  }

  // ============ Render ============

  return (
    <div className="flex-1 flex overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Sidebar - Families */}
      <div className="w-72 bg-white border-r flex flex-col" style={{ borderColor: '#E4E5E7' }}>
        <div className="p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold mb-1" style={{ color: '#141A1F' }}>
            Familles analytiques
          </h2>
          <p className="text-sm" style={{ color: '#6C767F' }}>
            {families.length} axe{families.length > 1 ? 's' : ''} d'analyse
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#78716c' }} />
            </div>
          ) : families.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: '#6C767F' }}>
                Aucune famille analytique
              </p>
            </div>
          ) : (
            families.map(family => {
              const stats = familyStats[family.id] || { count: 0, totalBudget: 0 }
              const isSelected = family.id === selectedFamilyId

              return (
                <button
                  key={family.id}
                  onClick={() => setSelectedFamilyId(family.id)}
                  className={`w-full text-left px-3 py-3 rounded-lg mb-1 transition-colors group ${
                    isSelected ? 'bg-stone-100' : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: family.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-bold"
                          style={{ color: family.color }}
                        >
                          {family.code}
                        </span>
                        <span
                          className="text-sm font-medium truncate"
                          style={{ color: isSelected ? '#44403c' : '#141A1F' }}
                        >
                          {family.name}
                        </span>
                      </div>
                      {family.description && (
                        <p className="text-xs truncate mt-0.5" style={{ color: '#6C767F' }}>
                          {family.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}
                        >
                          {stats.count} code{stats.count > 1 ? 's' : ''}
                        </span>
                        {stats.totalBudget > 0 && (
                          <span className="text-xs" style={{ color: '#6C767F' }}>
                            {formatCurrency(stats.totalBudget)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setEditingFamily(family)
                          setShowFamilyModal(true)
                        }}
                        className="p-1 hover:bg-stone-200 rounded"
                      >
                        <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          handleDeleteFamily(family.id)
                        }}
                        className="p-1 hover:bg-stone-200 rounded"
                      >
                        <svg className="w-4 h-4" style={{ color: '#b91c1c' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="p-4 border-t" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={() => {
              setEditingFamily(null)
              setShowFamilyModal(true)
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#57534e' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouvelle famille
          </button>
        </div>
      </div>

      {/* Main content - Codes */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedFamily && (
                <>
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedFamily.color }}
                  />
                  <div>
                    <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
                      {selectedFamily.name}
                    </h1>
                    <p className="text-sm" style={{ color: '#6C767F' }}>
                      Code: {selectedFamily.code}
                      {selectedFamily.description && ` - ${selectedFamily.description}`}
                    </p>
                  </div>
                </>
              )}
              {!selectedFamily && !loading && (
                <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
                  Selectionnez une famille
                </h1>
              )}
            </div>
            {selectedFamily && (
              <button
                onClick={() => {
                  setEditingCode(null)
                  setShowCodeModal(true)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: '#57534e' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nouveau code
              </button>
            )}
          </div>
        </header>

        {/* Search and stats */}
        {selectedFamily && (
          <div className="bg-white border-b px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <svg
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#6C767F' }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher un code analytique..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-xs" style={{ color: '#6C767F' }}>
                    Codes
                  </div>
                  <div className="text-lg font-semibold" style={{ color: '#44403c' }}>
                    {filteredCodes.length}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs" style={{ color: '#6C767F' }}>
                    Budget total
                  </div>
                  <div className="text-lg font-semibold" style={{ color: '#57534e' }}>
                    {formatCurrency(totalBudget)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Codes list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#78716c' }} />
            </div>
          ) : !selectedFamily ? (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="w-16 h-16 mb-4" style={{ color: '#D6D9DB' }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
              </svg>
              <p className="text-lg font-medium mb-1" style={{ color: '#141A1F' }}>
                Selectionnez une famille analytique
              </p>
              <p className="text-sm" style={{ color: '#6C767F' }}>
                Choisissez une famille dans la barre laterale pour voir ses codes
              </p>
            </div>
          ) : filteredCodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="w-16 h-16 mb-4" style={{ color: '#D6D9DB' }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
              <p className="text-lg font-medium mb-1" style={{ color: '#141A1F' }}>
                Aucun code analytique
              </p>
              <p className="text-sm" style={{ color: '#6C767F' }}>
                {searchQuery ? 'Aucun resultat pour cette recherche' : 'Commencez par ajouter un code analytique'}
              </p>
            </div>
          ) : (
            <div className="bg-white">
              {/* Table header */}
              <div
                className="grid grid-cols-12 gap-4 px-6 py-3 border-b sticky top-0 bg-white"
                style={{ borderColor: '#E4E5E7' }}
              >
                <div className="col-span-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                  Code
                </div>
                <div className="col-span-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                  Libelle
                </div>
                <div className="col-span-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                  Responsable
                </div>
                <div className="col-span-2 text-xs font-medium uppercase text-right" style={{ color: '#6C767F' }}>
                  Budget annuel
                </div>
                <div className="col-span-2 text-xs font-medium uppercase text-right" style={{ color: '#6C767F' }}>
                  Realise
                </div>
                <div className="col-span-1 text-xs font-medium uppercase text-right" style={{ color: '#6C767F' }}>
                  Actions
                </div>
              </div>

              {/* Codes rows */}
              {filteredCodes.map(code => {
                // Placeholder stats - would come from accounting entries
                const realise = 0
                const ecart = code.budget_annual - realise
                const ecartPercent = code.budget_annual > 0 ? (realise / code.budget_annual) * 100 : 0

                return (
                  <div
                    key={code.id}
                    className="grid grid-cols-12 gap-4 px-6 py-4 border-b hover:bg-stone-50 transition-colors"
                    style={{ borderColor: '#F2F2F3' }}
                  >
                    <div className="col-span-2">
                      <span
                        className="text-sm font-medium px-2 py-1 rounded"
                        style={{
                          backgroundColor: selectedFamily?.color + '15',
                          color: selectedFamily?.color,
                        }}
                      >
                        {code.code}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <div className="text-sm font-medium" style={{ color: '#141A1F' }}>
                        {code.label}
                      </div>
                      {code.description && (
                        <p className="text-xs truncate" style={{ color: '#6C767F' }}>
                          {code.description}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      {code.responsible ? (
                        <span className="text-sm" style={{ color: '#141A1F' }}>
                          {code.responsible}
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: '#D6D9DB' }}>
                          -
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 text-right">
                      {code.budget_annual > 0 ? (
                        <span className="text-sm font-mono" style={{ color: '#141A1F' }}>
                          {formatNumber(code.budget_annual)} EUR
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: '#D6D9DB' }}>
                          -
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 text-right">
                      <div className="text-sm font-mono" style={{ color: '#6C767F' }}>
                        {formatNumber(realise)} EUR
                      </div>
                      {code.budget_annual > 0 && (
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <div className="w-16 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(ecartPercent, 100)}%`,
                                backgroundColor: ecartPercent > 90 ? '#b91c1c' : ecartPercent > 70 ? '#d97706' : '#78716c',
                              }}
                            />
                          </div>
                          <span
                            className="text-xs"
                            style={{
                              color: ecart >= 0 ? '#57534e' : '#b91c1c',
                            }}
                          >
                            {ecartPercent.toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="col-span-1 flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditingCode(code)
                          setShowCodeModal(true)
                        }}
                        className="p-1.5 hover:bg-stone-100 rounded"
                        title="Modifier"
                      >
                        <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteCode(code.id)}
                        className="p-1.5 hover:bg-stone-100 rounded"
                        title="Supprimer"
                      >
                        <svg className="w-4 h-4" style={{ color: '#b91c1c' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Family Modal */}
      {showFamilyModal && (
        <FamilyModal
          family={editingFamily}
          onClose={() => {
            setShowFamilyModal(false)
            setEditingFamily(null)
          }}
          onSave={handleSaveFamily}
        />
      )}

      {/* Code Modal */}
      {showCodeModal && selectedFamily && (
        <CodeModal
          code={editingCode}
          familyName={selectedFamily.name}
          onClose={() => {
            setShowCodeModal(false)
            setEditingCode(null)
          }}
          onSave={handleSaveCode}
        />
      )}
    </div>
  )
}

// ============ Family Modal Component ============

interface FamilyModalProps {
  family: AnalyticalFamily | null
  onClose: () => void
  onSave: (data: Partial<AnalyticalFamily>) => void
}

function FamilyModal({ family, onClose, onSave }: FamilyModalProps) {
  const [code, setCode] = useState(family?.code || '')
  const [name, setName] = useState(family?.name || '')
  const [description, setDescription] = useState(family?.description || '')
  const [color, setColor] = useState(family?.color || DEFAULT_COLORS[0])
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || !name) return

    setSaving(true)
    try {
      await onSave({ code, name, description, color })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            {family ? 'Modifier la famille' : 'Nouvelle famille analytique'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
              Code *
            </label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: PROJET, DEPT, PRODUIT"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
              required
            />
            <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
              Code court identifiant la famille (majuscules)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
              Nom *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Projets, Departements, Produits"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description de cet axe d'analyse..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
              Couleur
            </label>
            <div className="flex gap-2">
              {DEFAULT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'scale-110 border-stone-600' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border rounded-lg"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!code || !name || saving}
              className="px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: '#57534e' }}
            >
              {saving ? 'Enregistrement...' : family ? 'Modifier' : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============ Code Modal Component ============

interface CodeModalProps {
  code: AnalyticalCode | null
  familyName: string
  onClose: () => void
  onSave: (data: Partial<AnalyticalCode>) => void
}

function CodeModal({ code, familyName, onClose, onSave }: CodeModalProps) {
  const [codeValue, setCodeValue] = useState(code?.code || '')
  const [label, setLabel] = useState(code?.label || '')
  const [description, setDescription] = useState(code?.description || '')
  const [budgetAnnual, setBudgetAnnual] = useState(code?.budget_annual?.toString() || '')
  const [responsible, setResponsible] = useState(code?.responsible || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codeValue || !label) return

    setSaving(true)
    try {
      await onSave({
        code: codeValue,
        label,
        description,
        budget_annual: budgetAnnual ? parseFloat(budgetAnnual) : 0,
        responsible: responsible || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
              {code ? 'Modifier le code' : 'Nouveau code analytique'}
            </h2>
            <p className="text-sm" style={{ color: '#6C767F' }}>
              Famille: {familyName}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
              Code analytique *
            </label>
            <input
              type="text"
              value={codeValue}
              onChange={e => setCodeValue(e.target.value.toUpperCase())}
              placeholder="Ex: PROJ001, DEPT-VENTES"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
              Libelle *
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex: Projet Alpha, Service Commercial"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description optionnelle..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
              Budget annuel (EUR)
            </label>
            <input
              type="number"
              value={budgetAnnual}
              onChange={e => setBudgetAnnual(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
              Responsable
            </label>
            <input
              type="text"
              value={responsible}
              onChange={e => setResponsible(e.target.value)}
              placeholder="Nom du responsable"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border rounded-lg"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!codeValue || !label || saving}
              className="px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: '#57534e' }}
            >
              {saving ? 'Enregistrement...' : code ? 'Modifier' : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
