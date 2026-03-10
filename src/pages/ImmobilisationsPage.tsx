import { useState, useEffect, useMemo } from 'react'
import {
  listAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  getDepreciationScheduleWithStatus,
  generateYearlyDepreciation,
  previewYearlyDepreciations,
  sellAsset,
  isFullyDepreciated,
  getRemainingDepreciationYears,
  type DepreciationPreview,
} from '../services/immobilisationsService'
import type {
  Asset,
  AssetFormData,
  AssetCategory,
  AssetStatus,
  DepreciationMethod,
  DepreciationScheduleEntry,
} from '../types/immobilisations'

// Extended schedule entry with status
interface ScheduleEntryWithStatus extends DepreciationScheduleEntry {
  isPosted: boolean
  depreciationId?: string
}

// Format date from ISO string
const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

// Category info
const CATEGORY_INFO: Record<AssetCategory, { label: string; prefix: string; color: string }> = {
  incorporel: { label: 'Incorporelle', prefix: '20x', color: '#8B5CF6' },
  corporel: { label: 'Corporelle', prefix: '21x', color: '#3B82F6' },
  financier: { label: 'Financiere', prefix: '26x', color: '#10B981' },
}

// Status info
const STATUS_INFO: Record<AssetStatus, { label: string; bgColor: string; textColor: string }> = {
  active: { label: 'En service', bgColor: '#DCFCE7', textColor: '#166534' },
  disposed: { label: 'Cedee', bgColor: '#FEE2E2', textColor: '#991B1B' },
  scrapped: { label: 'Mise au rebut', bgColor: '#F5F5F5', textColor: '#6C767F' },
}

// Method labels
const METHOD_LABELS: Record<DepreciationMethod, string> = {
  linear: 'Lineaire',
  degressive: 'Degressif',
}

// Method badge component
const MethodBadge = ({ method }: { method: DepreciationMethod }) => {
  const isLinear = method === 'linear'
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium"
      style={{
        backgroundColor: isLinear ? '#F0FDF4' : '#FEF3C7',
        color: isLinear ? '#166534' : '#92400E',
      }}
    >
      {METHOD_LABELS[method]}
    </span>
  )
}

// Fully depreciated badge
const FullyDepreciatedBadge = () => (
  <span
    className="px-2 py-0.5 rounded text-xs font-medium"
    style={{ backgroundColor: '#F5F5F5', color: '#6C767F' }}
  >
    Amorti
  </span>
)

// Status badge component
const StatusBadge = ({ status }: { status: AssetStatus }) => {
  const config = STATUS_INFO[status]
  return (
    <span
      className="px-2 py-1 rounded text-xs font-medium"
      style={{ backgroundColor: config.bgColor, color: config.textColor }}
    >
      {config.label}
    </span>
  )
}

// Category badge component
const CategoryBadge = ({ category }: { category: AssetCategory }) => {
  const config = CATEGORY_INFO[category]
  return (
    <span
      className="px-2 py-1 rounded text-xs font-medium"
      style={{ backgroundColor: `${config.color}15`, color: config.color }}
    >
      {config.label}
    </span>
  )
}

// Empty form data
const createEmptyFormData = (): AssetFormData => ({
  code: '',
  name: '',
  description: '',
  category: 'corporel',
  acquisitionDate: new Date().toISOString().split('T')[0],
  acquisitionValue: 0,
  residualValue: 0,
  depreciationMethod: 'linear',
  depreciationDurationMonths: 60,
  depreciationStartDate: new Date().toISOString().split('T')[0],
  accountCodeAsset: '21500',
  accountCodeDepreciation: '28150',
  accountCodeExpense: '68112',
  location: '',
})

// Account code suggestions per category
const ACCOUNT_SUGGESTIONS: Record<AssetCategory, { asset: string[]; depreciation: string[]; expense: string }> = {
  incorporel: {
    asset: ['20500', '20700', '20800'],
    depreciation: ['28050', '28070', '28080'],
    expense: '68111',
  },
  corporel: {
    asset: ['21300', '21500', '21800', '21820', '21830'],
    depreciation: ['28130', '28150', '28180', '28182', '28183'],
    expense: '68112',
  },
  financier: {
    asset: ['26100', '26700', '27500'],
    depreciation: ['29610', '29670', '29750'],
    expense: '68620',
  },
}

interface ImmobilisationsPageProps {
  onNavigate?: (page: string) => void
}

export default function ImmobilisationsPage({ onNavigate: _onNavigate }: ImmobilisationsPageProps) {
  // List state
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterCategory, setFilterCategory] = useState<AssetCategory | ''>('')
  const [filterStatus, setFilterStatus] = useState<AssetStatus | ''>('')
  const [searchTerm, setSearchTerm] = useState('')

  // Expanded asset for depreciation schedule
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null)
  const [depreciationSchedule, setDepreciationSchedule] = useState<ScheduleEntryWithStatus[]>([])
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [depreciationPreviews, setDepreciationPreviews] = useState<DepreciationPreview[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewYear, setPreviewYear] = useState(new Date().getFullYear())

  // Create/Edit modal state
  const [showModal, setShowModal] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [formData, setFormData] = useState<AssetFormData>(createEmptyFormData())
  const [saving, setSaving] = useState(false)

  // Generate depreciation modal
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear())
  const [generating, setGenerating] = useState(false)

  // Sell modal
  const [showSellModal, setShowSellModal] = useState(false)
  const [sellingAsset, setSellingAsset] = useState<Asset | null>(null)
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [salePrice, setSalePrice] = useState(0)
  const [selling, setSelling] = useState(false)

  // Action loading
  const [actionLoading, setActionLoading] = useState(false)

  // Load assets
  const loadAssets = async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: { category?: AssetCategory; status?: AssetStatus; searchTerm?: string } = {}
      if (filterCategory) filters.category = filterCategory
      if (filterStatus) filters.status = filterStatus
      if (searchTerm) filters.searchTerm = searchTerm

      const data = await listAssets(filters)
      setAssets(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error loading assets:', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  // Load depreciation schedule for expanded asset
  const loadDepreciationSchedule = async (assetId: string) => {
    setLoadingSchedule(true)
    try {
      const schedule = await getDepreciationScheduleWithStatus(assetId)
      setDepreciationSchedule(schedule)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error loading depreciation schedule:', message)
      setError(message)
    } finally {
      setLoadingSchedule(false)
    }
  }

  // Load depreciation preview
  const loadDepreciationPreview = async (year: number) => {
    setLoadingPreview(true)
    try {
      const previews = await previewYearlyDepreciations(year)
      setDepreciationPreviews(previews)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error loading depreciation preview:', message)
      setError(message)
    } finally {
      setLoadingPreview(false)
    }
  }

  // Handle open preview modal
  const handleOpenPreviewModal = async () => {
    setShowPreviewModal(true)
    setPreviewYear(generateYear)
    await loadDepreciationPreview(generateYear)
  }

  // Initial load
  useEffect(() => {
    loadAssets()
  }, [filterCategory, filterStatus, searchTerm])

  // Handle expand/collapse
  const handleToggleExpand = async (assetId: string) => {
    if (expandedAssetId === assetId) {
      setExpandedAssetId(null)
      setDepreciationSchedule([])
    } else {
      setExpandedAssetId(assetId)
      await loadDepreciationSchedule(assetId)
    }
  }

  // Open create modal
  const handleOpenCreate = () => {
    setEditingAsset(null)
    setFormData(createEmptyFormData())
    setShowModal(true)
  }

  // Open edit modal
  const handleOpenEdit = (asset: Asset) => {
    setEditingAsset(asset)
    setFormData({
      code: asset.code,
      name: asset.name,
      description: asset.description || '',
      category: asset.category,
      acquisitionDate: asset.acquisition_date,
      acquisitionValue: asset.acquisition_value,
      residualValue: asset.residual_value,
      depreciationMethod: asset.depreciation_method,
      depreciationDurationMonths: asset.depreciation_duration_months,
      depreciationStartDate: asset.depreciation_start_date,
      accountCodeAsset: asset.account_code_asset,
      accountCodeDepreciation: asset.account_code_depreciation,
      accountCodeExpense: asset.account_code_expense,
      location: asset.location || '',
    })
    setShowModal(true)
  }

  // Handle save (create or update)
  const handleSave = async () => {
    if (!formData.code || !formData.name || formData.acquisitionValue <= 0) {
      setError('Veuillez remplir tous les champs obligatoires')
      return
    }

    setSaving(true)
    try {
      if (editingAsset) {
        await updateAsset(editingAsset.id, formData)
      } else {
        await createAsset(formData)
      }
      setShowModal(false)
      await loadAssets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error saving asset:', message)
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  // Handle delete
  const handleDelete = async (asset: Asset) => {
    if (!window.confirm(`Supprimer l'immobilisation "${asset.name}" ?`)) return

    setActionLoading(true)
    try {
      await deleteAsset(asset.id)
      if (expandedAssetId === asset.id) {
        setExpandedAssetId(null)
        setDepreciationSchedule([])
      }
      await loadAssets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error deleting asset:', message)
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle generate depreciation
  const handleGenerateDepreciation = async () => {
    setGenerating(true)
    try {
      const depreciations = await generateYearlyDepreciation(generateYear)
      setShowGenerateModal(false)
      if (depreciations.length === 0) {
        setError(`Aucune dotation a generer pour l'annee ${generateYear}`)
      } else {
        // Refresh assets if one was expanded
        if (expandedAssetId) {
          await loadDepreciationSchedule(expandedAssetId)
        }
        alert(`${depreciations.length} dotation(s) generee(s) pour l'annee ${generateYear}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error generating depreciation:', message)
      setError(message)
    } finally {
      setGenerating(false)
    }
  }

  // Open sell modal
  const handleOpenSell = (asset: Asset) => {
    setSellingAsset(asset)
    setSaleDate(new Date().toISOString().split('T')[0])
    setSalePrice(0)
    setShowSellModal(true)
  }

  // Handle sell
  const handleSell = async () => {
    if (!sellingAsset) return

    setSelling(true)
    try {
      await sellAsset(sellingAsset.id, saleDate, salePrice)
      setShowSellModal(false)
      setSellingAsset(null)
      await loadAssets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error selling asset:', message)
      setError(message)
    } finally {
      setSelling(false)
    }
  }

  // Update account codes when category changes
  const handleCategoryChange = (category: AssetCategory) => {
    const suggestions = ACCOUNT_SUGGESTIONS[category]
    setFormData({
      ...formData,
      category,
      accountCodeAsset: suggestions.asset[0],
      accountCodeDepreciation: suggestions.depreciation[0],
      accountCodeExpense: suggestions.expense,
    })
  }

  // Calculate totals
  const totals = useMemo(() => {
    let totalAcquisition = 0
    let totalDepreciation = 0
    let totalVNC = 0

    assets.forEach((asset) => {
      if (asset.status === 'active') {
        totalAcquisition += asset.acquisition_value
        // Note: cumulated depreciation would need to be fetched
        // For now, we show acquisition value
      }
    })

    return { totalAcquisition, totalDepreciation, totalVNC }
  }, [assets])

  // Loading state
  if (loading && assets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: '#006666' }}></div>
          <p style={{ color: '#6C767F' }}>Chargement des immobilisations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>Immobilisations</h1>
          <span className="text-sm px-2 py-1 rounded" style={{ backgroundColor: '#E4E5E7', color: '#6C767F' }}>
            {assets.length} immobilisation{assets.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium"
            style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Generer dotations
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm"
            style={{ backgroundColor: '#006666' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouvelle immobilisation
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] max-w-md relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par code ou nom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: '#6C767F' }}>Categorie:</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as AssetCategory | '')}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white"
            style={{ borderColor: '#D6D9DB' }}
          >
            <option value="">Toutes</option>
            <option value="incorporel">Incorporelle (20x)</option>
            <option value="corporel">Corporelle (21x)</option>
            <option value="financier">Financiere (26x)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: '#6C767F' }}>Statut:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as AssetStatus | '')}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white"
            style={{ borderColor: '#D6D9DB' }}
          >
            <option value="">Tous</option>
            <option value="active">En service</option>
            <option value="disposed">Cedee</option>
            <option value="scrapped">Mise au rebut</option>
          </select>
        </div>
        {(filterCategory || filterStatus || searchTerm) && (
          <button
            onClick={() => {
              setFilterCategory('')
              setFilterStatus('')
              setSearchTerm('')
            }}
            className="px-3 py-1.5 text-sm rounded-lg border"
            style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
          >
            Reinitialiser
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E5E7' }}>
          <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Valeur brute totale</p>
          <p className="text-xl font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(totals.totalAcquisition)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E5E7' }}>
          <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Immobilisations actives</p>
          <p className="text-xl font-semibold" style={{ color: '#166534' }}>
            {assets.filter((a) => a.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E5E7' }}>
          <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Cedees/Rebut</p>
          <p className="text-xl font-semibold" style={{ color: '#6C767F' }}>
            {assets.filter((a) => a.status !== 'active').length}
          </p>
        </div>
      </div>

      {/* Assets table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
        {assets.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#D6D9DB' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
            <p className="font-medium mb-1" style={{ color: '#141A1F' }}>Aucune immobilisation</p>
            <p className="text-sm" style={{ color: '#6C767F' }}>Creez votre premiere immobilisation</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b text-xs font-medium uppercase" style={{ borderColor: '#E4E5E7', color: '#6C767F', backgroundColor: '#FAFAFB' }}>
              <div className="col-span-1"></div>
              <div className="col-span-1">Code</div>
              <div className="col-span-2">Nom</div>
              <div className="col-span-1">Categorie</div>
              <div className="col-span-1">Methode</div>
              <div className="col-span-1 text-right">Valeur brute</div>
              <div className="col-span-1 text-right">Duree</div>
              <div className="col-span-1 text-right">Restant</div>
              <div className="col-span-3">Statut</div>
            </div>

            {/* Table rows */}
            <div className="divide-y" style={{ borderColor: '#F2F2F3' }}>
              {assets.map((asset) => {
                const isExpanded = expandedAssetId === asset.id
                const fullyDepreciated = isFullyDepreciated(asset)
                const remainingYears = getRemainingDepreciationYears(asset)
                const durationYears = Math.ceil(asset.depreciation_duration_months / 12)

                return (
                  <div key={asset.id}>
                    {/* Main row */}
                    <div
                      className={`grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer items-center ${isExpanded ? 'bg-gray-50' : ''}`}
                      onClick={() => handleToggleExpand(asset.id)}
                    >
                      <div className="col-span-1">
                        <svg
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          style={{ color: '#6C767F' }}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                      <div className="col-span-1">
                        <span className="text-sm font-medium" style={{ color: '#006666' }}>{asset.code}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm" style={{ color: '#141A1F' }}>{asset.name}</span>
                        {asset.description && (
                          <p className="text-xs truncate" style={{ color: '#6C767F' }}>{asset.description}</p>
                        )}
                      </div>
                      <div className="col-span-1">
                        <CategoryBadge category={asset.category} />
                      </div>
                      <div className="col-span-1">
                        <MethodBadge method={asset.depreciation_method} />
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="text-sm font-mono" style={{ color: '#141A1F' }}>
                          {formatCurrency(asset.acquisition_value)}
                        </span>
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="text-sm" style={{ color: '#6C767F' }}>{durationYears} ans</span>
                      </div>
                      <div className="col-span-1 text-right">
                        {fullyDepreciated ? (
                          <span className="text-xs" style={{ color: '#6C767F' }}>-</span>
                        ) : (
                          <span className="text-sm" style={{ color: '#141A1F' }}>{remainingYears} an{remainingYears > 1 ? 's' : ''}</span>
                        )}
                      </div>
                      <div className="col-span-3 flex items-center gap-2">
                        <StatusBadge status={asset.status} />
                        {fullyDepreciated && asset.status === 'active' && <FullyDepreciatedBadge />}
                        <div className="flex-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEdit(asset)
                          }}
                          className="p-1 rounded hover:bg-gray-200"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        {asset.status === 'active' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenSell(asset)
                            }}
                            className="p-1 rounded hover:bg-gray-200"
                            title="Ceder"
                          >
                            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(asset)
                          }}
                          className="p-1 rounded hover:bg-gray-200"
                          title="Supprimer"
                          disabled={actionLoading}
                        >
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Expanded depreciation schedule */}
                    {isExpanded && (
                      <div className="bg-gray-50 border-t px-4 py-4" style={{ borderColor: '#E4E5E7' }}>
                        {/* Asset details */}
                        <div className="mb-4 grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span style={{ color: '#6C767F' }}>Methode:</span>{' '}
                            <span style={{ color: '#141A1F' }}>{METHOD_LABELS[asset.depreciation_method]}</span>
                          </div>
                          <div>
                            <span style={{ color: '#6C767F' }}>Duree:</span>{' '}
                            <span style={{ color: '#141A1F' }}>{Math.ceil(asset.depreciation_duration_months / 12)} ans</span>
                          </div>
                          <div>
                            <span style={{ color: '#6C767F' }}>Compte immo:</span>{' '}
                            <span style={{ color: '#141A1F' }}>{asset.account_code_asset}</span>
                          </div>
                          <div>
                            <span style={{ color: '#6C767F' }}>Compte amort:</span>{' '}
                            <span style={{ color: '#141A1F' }}>{asset.account_code_depreciation}</span>
                          </div>
                        </div>

                        {/* Depreciation schedule table */}
                        <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                          <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFAFB' }}>
                            <h3 className="font-medium text-sm" style={{ color: '#141A1F' }}>Tableau d'amortissement</h3>
                          </div>

                          {loadingSchedule ? (
                            <div className="p-4 text-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: '#006666' }}></div>
                            </div>
                          ) : depreciationSchedule.length === 0 ? (
                            <div className="p-4 text-center text-sm" style={{ color: '#6C767F' }}>
                              Aucun amortissement
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-7 gap-4 px-4 py-2 text-xs font-medium uppercase" style={{ color: '#6C767F', backgroundColor: '#FAFAFB' }}>
                                <div>Annee</div>
                                <div className="text-right">VNC debut</div>
                                <div className="text-right">Dotation</div>
                                <div className="text-right">Cumul amort.</div>
                                <div className="text-right">VNC fin</div>
                                <div>Periode</div>
                                <div className="text-center">Statut</div>
                              </div>
                              <div className="divide-y" style={{ borderColor: '#F2F2F3' }}>
                                {depreciationSchedule.map((entry) => {
                                  const currentYear = new Date().getFullYear()
                                  const isPast = entry.year < currentYear
                                  const isCurrent = entry.year === currentYear
                                  const isFuture = entry.year > currentYear

                                  return (
                                    <div
                                      key={entry.year}
                                      className={`grid grid-cols-7 gap-4 px-4 py-2 text-sm ${isCurrent ? 'bg-amber-50' : ''}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span style={{ color: '#141A1F', fontWeight: isCurrent ? 600 : 400 }}>
                                          {entry.year}
                                        </span>
                                        {isCurrent && (
                                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                            En cours
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-right font-mono" style={{ color: '#6C767F' }}>
                                        {formatCurrency(entry.openingValue)}
                                      </div>
                                      <div className="text-right font-mono" style={{ color: '#006666' }}>
                                        {formatCurrency(entry.depreciationAmount)}
                                      </div>
                                      <div className="text-right font-mono" style={{ color: '#6C767F' }}>
                                        {formatCurrency(entry.cumulatedDepreciation)}
                                      </div>
                                      <div className="text-right font-mono font-medium" style={{ color: '#141A1F' }}>
                                        {formatCurrency(entry.closingValue)}
                                      </div>
                                      <div className="text-xs" style={{ color: '#6C767F' }}>
                                        {formatDate(entry.periodStart)} - {formatDate(entry.periodEnd)}
                                      </div>
                                      <div className="text-center">
                                        {entry.isPosted ? (
                                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                            Comptabilise
                                          </span>
                                        ) : isPast ? (
                                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                            </svg>
                                            A regulariser
                                          </span>
                                        ) : isFuture ? (
                                          <span className="text-xs" style={{ color: '#6C767F' }}>
                                            Previsionnel
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                            A generer
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* VNC Chart (simple bar representation) */}
                              <div className="px-4 py-3 border-t" style={{ borderColor: '#E4E5E7' }}>
                                <p className="text-xs font-medium mb-2" style={{ color: '#6C767F' }}>Evolution VNC</p>
                                <div className="flex items-end gap-1 h-16">
                                  {depreciationSchedule.map((entry) => {
                                    const maxValue = depreciationSchedule[0]?.openingValue || 1
                                    const heightPercent = (entry.closingValue / maxValue) * 100
                                    const isCurrent = entry.year === new Date().getFullYear()

                                    return (
                                      <div
                                        key={entry.year}
                                        className="flex-1 rounded-t transition-all"
                                        style={{
                                          height: `${Math.max(heightPercent, 2)}%`,
                                          backgroundColor: isCurrent ? '#006666' : '#E4E5E7',
                                        }}
                                        title={`${entry.year}: ${formatCurrency(entry.closingValue)}`}
                                      />
                                    )
                                  })}
                                </div>
                                <div className="flex justify-between mt-1">
                                  <span className="text-xs" style={{ color: '#6C767F' }}>
                                    {depreciationSchedule[0]?.year}
                                  </span>
                                  <span className="text-xs" style={{ color: '#6C767F' }}>
                                    {depreciationSchedule[depreciationSchedule.length - 1]?.year}
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="font-semibold text-lg" style={{ color: '#141A1F' }}>
                {editingAsset ? 'Modifier l\'immobilisation' : 'Nouvelle immobilisation'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="IMM001"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Categorie *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value as AssetCategory)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  >
                    <option value="incorporel">Incorporelle (20x)</option>
                    <option value="corporel">Corporelle (21x)</option>
                    <option value="financier">Financiere (26x)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Nom *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nom de l'immobilisation"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description optionnelle..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>

              {/* Acquisition */}
              <div className="pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
                <h3 className="font-medium text-sm mb-3" style={{ color: '#141A1F' }}>Acquisition</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date d'acquisition *</label>
                    <input
                      type="date"
                      value={formData.acquisitionDate}
                      onChange={(e) => setFormData({ ...formData, acquisitionDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Valeur d'acquisition *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.acquisitionValue || ''}
                      onChange={(e) => setFormData({ ...formData, acquisitionValue: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Valeur residuelle</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.residualValue || ''}
                      onChange={(e) => setFormData({ ...formData, residualValue: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                </div>
              </div>

              {/* Depreciation */}
              <div className="pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
                <h3 className="font-medium text-sm mb-3" style={{ color: '#141A1F' }}>Amortissement</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Methode *</label>
                    <select
                      value={formData.depreciationMethod}
                      onChange={(e) => setFormData({ ...formData, depreciationMethod: e.target.value as DepreciationMethod })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    >
                      <option value="linear">Lineaire</option>
                      <option value="degressive">Degressif</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Duree (mois) *</label>
                    <input
                      type="number"
                      value={formData.depreciationDurationMonths || ''}
                      onChange={(e) => setFormData({ ...formData, depreciationDurationMonths: parseInt(e.target.value) || 0 })}
                      placeholder="60"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                    <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
                      = {Math.ceil(formData.depreciationDurationMonths / 12)} an(s)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date de debut *</label>
                    <input
                      type="date"
                      value={formData.depreciationStartDate}
                      onChange={(e) => setFormData({ ...formData, depreciationStartDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                </div>
              </div>

              {/* Accounting */}
              <div className="pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
                <h3 className="font-medium text-sm mb-3" style={{ color: '#141A1F' }}>Comptes comptables</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Compte immo (2xxx) *</label>
                    <select
                      value={formData.accountCodeAsset}
                      onChange={(e) => setFormData({ ...formData, accountCodeAsset: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    >
                      {ACCOUNT_SUGGESTIONS[formData.category].asset.map((code) => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Compte amort (28xxx) *</label>
                    <select
                      value={formData.accountCodeDepreciation}
                      onChange={(e) => setFormData({ ...formData, accountCodeDepreciation: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    >
                      {ACCOUNT_SUGGESTIONS[formData.category].depreciation.map((code) => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Compte dotation (68x)</label>
                    <input
                      type="text"
                      value={formData.accountCodeExpense}
                      onChange={(e) => setFormData({ ...formData, accountCodeExpense: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Localisation</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Bureau, Entrepot, etc."
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end gap-3" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.code || !formData.name || formData.acquisitionValue <= 0}
                className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                style={{ backgroundColor: '#006666' }}
              >
                {saving ? 'Enregistrement...' : editingAsset ? 'Mettre a jour' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Depreciation Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="font-semibold" style={{ color: '#141A1F' }}>Generer les dotations annuelles</h2>
              <button onClick={() => setShowGenerateModal(false)} className="p-1 rounded hover:bg-gray-100">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm" style={{ color: '#6C767F' }}>
                Cette action va calculer et enregistrer les dotations aux amortissements pour toutes les immobilisations actives de l'annee selectionnee.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Annee</label>
                <input
                  type="number"
                  value={generateYear}
                  onChange={(e) => setGenerateYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={handleOpenPreviewModal}
                className="px-4 py-2 rounded-lg border text-sm font-medium flex items-center gap-2"
                style={{ borderColor: '#D6D9DB', color: '#006666' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Previsualiser
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 rounded-lg border text-sm font-medium"
                  style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleGenerateDepreciation}
                  disabled={generating}
                  className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                  style={{ backgroundColor: '#006666' }}
                >
                  {generating ? 'Generation...' : 'Generer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Depreciation Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
              <div>
                <h2 className="font-semibold" style={{ color: '#141A1F' }}>
                  Previsualisation des dotations {previewYear}
                </h2>
                <p className="text-sm" style={{ color: '#6C767F' }}>
                  {depreciationPreviews.length} immobilisation{depreciationPreviews.length > 1 ? 's' : ''} concernee{depreciationPreviews.length > 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="p-1 rounded hover:bg-gray-100">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingPreview ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#006666' }}></div>
                  <p className="mt-4 text-sm" style={{ color: '#6C767F' }}>Calcul des dotations...</p>
                </div>
              ) : depreciationPreviews.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#D6D9DB' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                  <p className="font-medium" style={{ color: '#141A1F' }}>Aucune dotation a generer</p>
                  <p className="text-sm" style={{ color: '#6C767F' }}>Toutes les immobilisations sont deja amorties ou ont deja leurs dotations pour {previewYear}</p>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: '#FAFAFB' }}>
                      <p className="text-xs" style={{ color: '#6C767F' }}>Total dotations</p>
                      <p className="text-lg font-semibold" style={{ color: '#006666' }}>
                        {formatCurrency(depreciationPreviews.reduce((sum, p) => sum + p.depreciation.amount, 0))}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: '#FAFAFB' }}>
                      <p className="text-xs" style={{ color: '#6C767F' }}>Deja comptabilisees</p>
                      <p className="text-lg font-semibold" style={{ color: '#166534' }}>
                        {depreciationPreviews.filter((p) => p.isAlreadyPosted).length}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: '#FAFAFB' }}>
                      <p className="text-xs" style={{ color: '#6C767F' }}>A generer</p>
                      <p className="text-lg font-semibold" style={{ color: '#92400E' }}>
                        {depreciationPreviews.filter((p) => !p.isAlreadyPosted).length}
                      </p>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                    <div className="grid grid-cols-8 gap-2 px-4 py-2 text-xs font-medium uppercase" style={{ color: '#6C767F', backgroundColor: '#FAFAFB' }}>
                      <div className="col-span-2">Immobilisation</div>
                      <div>Methode</div>
                      <div className="text-right">VNC debut</div>
                      <div className="text-right">Dotation</div>
                      <div className="text-right">VNC fin</div>
                      <div className="text-center">Prorata</div>
                      <div className="text-center">Statut</div>
                    </div>
                    <div className="divide-y" style={{ borderColor: '#F2F2F3' }}>
                      {depreciationPreviews.map((preview) => (
                        <div
                          key={preview.asset.id}
                          className={`grid grid-cols-8 gap-2 px-4 py-2 text-sm ${preview.isAlreadyPosted ? 'opacity-50' : ''}`}
                        >
                          <div className="col-span-2">
                            <span className="font-medium" style={{ color: '#006666' }}>{preview.asset.code}</span>
                            <span className="ml-2" style={{ color: '#141A1F' }}>{preview.asset.name}</span>
                          </div>
                          <div>
                            <span
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{
                                backgroundColor: preview.depreciation.methodUsed === 'linear' ? '#F0FDF4' : '#FEF3C7',
                                color: preview.depreciation.methodUsed === 'linear' ? '#166534' : '#92400E',
                              }}
                            >
                              {preview.depreciation.methodUsed === 'linear' ? 'Lin.' : 'Deg.'}
                            </span>
                          </div>
                          <div className="text-right font-mono" style={{ color: '#6C767F' }}>
                            {formatCurrency(preview.depreciation.netBookValueStart)}
                          </div>
                          <div className="text-right font-mono font-medium" style={{ color: '#006666' }}>
                            {formatCurrency(preview.depreciation.amount)}
                          </div>
                          <div className="text-right font-mono" style={{ color: '#141A1F' }}>
                            {formatCurrency(preview.depreciation.netBookValueEnd)}
                          </div>
                          <div className="text-center text-xs" style={{ color: '#6C767F' }}>
                            {preview.depreciation.prorata < 1
                              ? `${Math.round(preview.depreciation.prorata * 100)}%`
                              : '100%'}
                          </div>
                          <div className="text-center">
                            {preview.isAlreadyPosted ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                A faire
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t flex items-center justify-end gap-3" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Fermer
              </button>
              {depreciationPreviews.filter((p) => !p.isAlreadyPosted).length > 0 && (
                <button
                  onClick={async () => {
                    setShowPreviewModal(false)
                    await handleGenerateDepreciation()
                  }}
                  disabled={generating}
                  className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                  style={{ backgroundColor: '#006666' }}
                >
                  {generating ? 'Generation...' : `Generer ${depreciationPreviews.filter((p) => !p.isAlreadyPosted).length} dotation(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {showSellModal && sellingAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="font-semibold" style={{ color: '#141A1F' }}>Ceder l'immobilisation</h2>
              <button onClick={() => setShowSellModal(false)} className="p-1 rounded hover:bg-gray-100">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#FAFAFB' }}>
                <p className="font-medium text-sm" style={{ color: '#141A1F' }}>{sellingAsset.name}</p>
                <p className="text-xs" style={{ color: '#6C767F' }}>Code: {sellingAsset.code}</p>
                <p className="text-sm mt-2" style={{ color: '#141A1F' }}>
                  Valeur d'acquisition: {formatCurrency(sellingAsset.acquisition_value)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date de cession *</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Prix de cession *</label>
                <input
                  type="number"
                  step="0.01"
                  value={salePrice || ''}
                  onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
                <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
                  Entrez 0 pour une mise au rebut
                </p>
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end gap-3" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={() => setShowSellModal(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleSell}
                disabled={selling || !saleDate}
                className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                style={{ backgroundColor: '#006666' }}
              >
                {selling ? 'Traitement...' : 'Confirmer la cession'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
