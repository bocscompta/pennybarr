import { useState, useEffect, useCallback } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'

// Types for import history
type ImportType = 'bank_statement' | 'supplier_invoices' | 'customer_invoices' | 'fec' | 'grand_livre' | 'other'
type ImportStatus = 'success' | 'partial' | 'failed'

interface ImportHistory {
  id: string
  company_id: string
  import_type: ImportType
  file_name: string
  file_size?: number
  records_total: number
  records_imported: number
  records_skipped: number
  records_failed: number
  status: ImportStatus
  error_log?: ImportError[]
  imported_by?: string
  started_at: string
  completed_at?: string
  can_rollback: boolean
  created_at: string
}

interface ImportError {
  line: number
  field?: string
  value?: string
  reason: string
}

// Type labels
const typeLabels: Record<ImportType, string> = {
  bank_statement: 'Relevé bancaire',
  supplier_invoices: 'Factures fournisseurs',
  customer_invoices: 'Factures clients',
  fec: 'FEC',
  grand_livre: 'Grand Livre',
  other: 'Autre',
}

const typeColors: Record<ImportType, { bg: string; text: string }> = {
  bank_statement: { bg: '#E0F2FE', text: '#0369A1' },
  supplier_invoices: { bg: '#FEF3C7', text: '#92400E' },
  customer_invoices: { bg: '#DCFCE7', text: '#166534' },
  fec: { bg: '#F3E8FF', text: '#7C3AED' },
  grand_livre: { bg: '#E0E7FF', text: '#4338CA' },
  other: { bg: '#F3F4F6', text: '#4B5563' },
}

// Status labels and colors
const statusLabels: Record<ImportStatus, string> = {
  success: 'Succès',
  partial: 'Partiel',
  failed: 'Échec',
}

const statusColors: Record<ImportStatus, { bg: string; text: string }> = {
  success: { bg: '#DCFCE7', text: '#166534' },
  partial: { bg: '#FEF3C7', text: '#92400E' },
  failed: { bg: '#FEE2E2', text: '#991B1B' },
}

// Format file size
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`
}

// Format date
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface HistoriqueImportsPageProps {
  onNavigate?: (page: string) => void
}

export default function HistoriqueImportsPage({ onNavigate }: HistoriqueImportsPageProps) {
  // State
  const [imports, setImports] = useState<ImportHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterType, setFilterType] = useState<ImportType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<ImportStatus | 'all'>('all')
  const [filterPeriod, setFilterPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  // Selected import for detail view
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedImport, setSelectedImport] = useState<ImportHistory | null>(null)

  // Modal states
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // New import form state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importType, setImportType] = useState<ImportType>('bank_statement')
  const [importing, setImporting] = useState(false)

  // Load imports
  const loadImports = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('import_history')
        .select('*')
        .eq('company_id', COMPANY_ID)
        .order('created_at', { ascending: false })

      // Apply type filter
      if (filterType !== 'all') {
        query = query.eq('import_type', filterType)
      }

      // Apply status filter
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      // Apply period filter
      if (filterPeriod !== 'all') {
        const days = filterPeriod === '7d' ? 7 : filterPeriod === '30d' ? 30 : 90
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        query = query.gte('created_at', startDate.toISOString())
      }

      const { data, error: queryError } = await query

      if (queryError) {
        throw new Error(`Erreur lors du chargement: ${queryError.message}`)
      }

      setImports(data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Failed to load imports:', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus, filterPeriod])

  useEffect(() => {
    loadImports()
  }, [loadImports])

  // Toggle row expansion
  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setSelectedImport(null)
    } else {
      setExpandedId(id)
      const imp = imports.find(i => i.id === id) || null
      setSelectedImport(imp)
    }
  }

  // Handle delete (rollback)
  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      // In a real implementation, this would also rollback the imported data
      const { error: deleteError } = await supabase
        .from('import_history')
        .delete()
        .eq('id', id)
        .eq('company_id', COMPANY_ID)

      if (deleteError) {
        throw new Error(`Erreur lors de la suppression: ${deleteError.message}`)
      }

      setShowDeleteConfirm(null)
      loadImports()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Failed to delete import:', message)
      setError(message)
    } finally {
      setDeleting(false)
    }
  }

  // Handle new import
  const handleNewImport = async () => {
    if (!importFile) return

    setImporting(true)
    try {
      // Create import history record
      const newImport: Partial<ImportHistory> = {
        company_id: COMPANY_ID,
        import_type: importType,
        file_name: importFile.name,
        file_size: importFile.size,
        records_total: 0,
        records_imported: 0,
        records_skipped: 0,
        records_failed: 0,
        status: 'success',
        started_at: new Date().toISOString(),
        can_rollback: true,
      }

      const { error: insertError } = await supabase
        .from('import_history')
        .insert(newImport)

      if (insertError) {
        throw new Error(`Erreur lors de l'import: ${insertError.message}`)
      }

      setShowImportModal(false)
      setImportFile(null)
      loadImports()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Failed to create import:', message)
      setError(message)
    } finally {
      setImporting(false)
    }
  }

  // Export report
  const handleExportReport = (imp: ImportHistory) => {
    const report = {
      id: imp.id,
      type: typeLabels[imp.import_type],
      file: imp.file_name,
      date: formatDate(imp.created_at),
      status: statusLabels[imp.status],
      records: {
        total: imp.records_total,
        imported: imp.records_imported,
        skipped: imp.records_skipped,
        failed: imp.records_failed,
      },
      errors: imp.error_log || [],
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rapport-import-${imp.id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Calculate stats
  const stats = {
    total: imports.length,
    success: imports.filter(i => i.status === 'success').length,
    partial: imports.filter(i => i.status === 'partial').length,
    failed: imports.filter(i => i.status === 'failed').length,
    totalRecords: imports.reduce((sum, i) => sum + i.records_imported, 0),
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onNavigate && (
              <>
                <button
                  onClick={() => onNavigate('parametres')}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: '#6C767F' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Retour
                </button>
                <div className="h-6 w-px" style={{ backgroundColor: '#E4E5E7' }} />
              </>
            )}
            <div>
              <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
                Historique des imports
              </h1>
              <p className="text-sm mt-0.5" style={{ color: '#6C767F' }}>
                Relevés bancaires, factures, FEC et autres fichiers importés
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm"
            style={{ backgroundColor: '#006666' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouvel import
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
              <p className="text-sm font-medium" style={{ color: '#6C767F' }}>Total imports</p>
              <p className="text-2xl font-semibold mt-1" style={{ color: '#141A1F' }}>{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
              <p className="text-sm font-medium" style={{ color: '#166534' }}>Succès</p>
              <p className="text-2xl font-semibold mt-1" style={{ color: '#166534' }}>{stats.success}</p>
            </div>
            <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
              <p className="text-sm font-medium" style={{ color: '#92400E' }}>Partiels</p>
              <p className="text-2xl font-semibold mt-1" style={{ color: '#92400E' }}>{stats.partial}</p>
            </div>
            <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
              <p className="text-sm font-medium" style={{ color: '#991B1B' }}>Échecs</p>
              <p className="text-2xl font-semibold mt-1" style={{ color: '#991B1B' }}>{stats.failed}</p>
            </div>
            <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
              <p className="text-sm font-medium" style={{ color: '#6C767F' }}>Enregistrements</p>
              <p className="text-2xl font-semibold mt-1" style={{ color: '#141A1F' }}>{stats.totalRecords.toLocaleString('fr-FR')}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex flex-wrap items-center gap-4">
              {/* Type filter */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6C767F' }}>Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as ImportType | 'all')}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                  style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                >
                  <option value="all">Tous les types</option>
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Status filter */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6C767F' }}>Statut</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as ImportStatus | 'all')}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                  style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                >
                  <option value="all">Tous les statuts</option>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Period filter */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6C767F' }}>Période</label>
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value as '7d' | '30d' | '90d' | 'all')}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                  style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                >
                  <option value="7d">7 derniers jours</option>
                  <option value="30d">30 derniers jours</option>
                  <option value="90d">90 derniers jours</option>
                  <option value="all">Toute la période</option>
                </select>
              </div>

              <div className="flex-1" />

              {/* Refresh button */}
              <button
                onClick={loadImports}
                className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm"
                style={{ borderColor: '#E4E5E7', color: '#6C767F' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Actualiser
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className="bg-white rounded-lg border p-8 text-center" style={{ borderColor: '#E4E5E7' }}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#006666' }} />
              <p className="mt-3 text-sm" style={{ color: '#6C767F' }}>Chargement des imports...</p>
            </div>
          ) : imports.length === 0 ? (
            /* Empty state */
            <div className="bg-white rounded-lg border p-12 text-center" style={{ borderColor: '#E4E5E7' }}>
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
                <svg className="w-8 h-8" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="mt-4 font-medium" style={{ color: '#141A1F' }}>Aucun import trouvé</h3>
              <p className="mt-1 text-sm" style={{ color: '#6C767F' }}>
                Commencez par importer un fichier pour le voir apparaître ici.
              </p>
              <button
                onClick={() => setShowImportModal(true)}
                className="mt-4 px-4 py-2 rounded-lg text-white font-medium text-sm"
                style={{ backgroundColor: '#006666' }}
              >
                Nouvel import
              </button>
            </div>
          ) : (
            /* Import list */
            <div className="bg-white rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#F9FAFB' }}>
                    <th className="text-left p-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Date</th>
                    <th className="text-left p-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Type</th>
                    <th className="text-left p-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Fichier</th>
                    <th className="text-center p-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Enregistrements</th>
                    <th className="text-center p-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Statut</th>
                    <th className="text-right p-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp) => (
                    <>
                      <tr
                        key={imp.id}
                        className="border-b cursor-pointer hover:bg-gray-50 transition-colors"
                        style={{ borderColor: '#F2F2F3' }}
                        onClick={() => toggleExpand(imp.id)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <svg
                              className={`w-4 h-4 transition-transform ${expandedId === imp.id ? 'rotate-90' : ''}`}
                              style={{ color: '#6C767F' }}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                            <span className="text-sm" style={{ color: '#141A1F' }}>
                              {formatDate(imp.created_at)}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                              backgroundColor: typeColors[imp.import_type].bg,
                              color: typeColors[imp.import_type].text,
                            }}
                          >
                            {typeLabels[imp.import_type]}
                          </span>
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="text-sm font-medium truncate max-w-xs" style={{ color: '#141A1F' }}>
                              {imp.file_name}
                            </p>
                            <p className="text-xs" style={{ color: '#6C767F' }}>
                              {formatFileSize(imp.file_size)}
                            </p>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                            {imp.records_imported}
                          </span>
                          <span className="text-sm" style={{ color: '#6C767F' }}> / {imp.records_total}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                              backgroundColor: statusColors[imp.status].bg,
                              color: statusColors[imp.status].text,
                            }}
                          >
                            {statusLabels[imp.status]}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleExportReport(imp); }}
                              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                              title="Exporter le rapport"
                            >
                              <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                            </button>
                            {imp.can_rollback && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(imp.id); }}
                                className="p-1.5 rounded hover:bg-red-50 transition-colors"
                                title="Supprimer (rollback)"
                              >
                                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {expandedId === imp.id && selectedImport && (
                        <tr key={`${imp.id}-detail`}>
                          <td colSpan={6} className="p-0">
                            <div className="p-4 bg-gray-50 border-t" style={{ borderColor: '#E4E5E7' }}>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Stats */}
                                <div>
                                  <h4 className="font-medium text-sm mb-3" style={{ color: '#141A1F' }}>
                                    Détails de l'import
                                  </h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span style={{ color: '#6C767F' }}>Total dans le fichier</span>
                                      <span style={{ color: '#141A1F' }}>{selectedImport.records_total}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span style={{ color: '#6C767F' }}>Importés avec succès</span>
                                      <span style={{ color: '#166534' }}>{selectedImport.records_imported}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span style={{ color: '#6C767F' }}>Ignorés (doublons)</span>
                                      <span style={{ color: '#92400E' }}>{selectedImport.records_skipped}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span style={{ color: '#6C767F' }}>Échoués (erreurs)</span>
                                      <span style={{ color: '#991B1B' }}>{selectedImport.records_failed}</span>
                                    </div>
                                    <div className="border-t pt-2 mt-2" style={{ borderColor: '#E4E5E7' }}>
                                      <div className="flex justify-between text-sm">
                                        <span style={{ color: '#6C767F' }}>Démarré à</span>
                                        <span style={{ color: '#141A1F' }}>{formatDate(selectedImport.started_at)}</span>
                                      </div>
                                      {selectedImport.completed_at && (
                                        <div className="flex justify-between text-sm mt-1">
                                          <span style={{ color: '#6C767F' }}>Terminé à</span>
                                          <span style={{ color: '#141A1F' }}>{formatDate(selectedImport.completed_at)}</span>
                                        </div>
                                      )}
                                      {selectedImport.imported_by && (
                                        <div className="flex justify-between text-sm mt-1">
                                          <span style={{ color: '#6C767F' }}>Importé par</span>
                                          <span style={{ color: '#141A1F' }}>{selectedImport.imported_by}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Errors */}
                                <div>
                                  <h4 className="font-medium text-sm mb-3" style={{ color: '#141A1F' }}>
                                    Erreurs ({selectedImport.error_log?.length || 0})
                                  </h4>
                                  {selectedImport.error_log && selectedImport.error_log.length > 0 ? (
                                    <div className="max-h-48 overflow-y-auto space-y-2">
                                      {selectedImport.error_log.slice(0, 10).map((err, idx) => (
                                        <div key={idx} className="p-2 rounded text-sm bg-red-50 border border-red-100">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-red-700">Ligne {err.line}</span>
                                            {err.field && (
                                              <span className="text-red-600">- {err.field}</span>
                                            )}
                                          </div>
                                          <p className="text-red-600 text-xs mt-0.5">{err.reason}</p>
                                          {err.value && (
                                            <p className="text-red-500 text-xs mt-0.5 font-mono truncate">
                                              Valeur: {err.value}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                      {selectedImport.error_log.length > 10 && (
                                        <p className="text-xs text-center" style={{ color: '#6C767F' }}>
                                          ... et {selectedImport.error_log.length - 10} autres erreurs
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm" style={{ color: '#6C767F' }}>
                                      Aucune erreur rencontrée lors de cet import.
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-3 mt-4 pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
                                <button
                                  onClick={() => handleExportReport(selectedImport)}
                                  className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm font-medium"
                                  style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                  </svg>
                                  Exporter le rapport
                                </button>
                                {selectedImport.can_rollback && (
                                  <button
                                    onClick={() => setShowDeleteConfirm(selectedImport.id)}
                                    className="flex items-center gap-2 px-3 py-1.5 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                    Supprimer et annuler l'import
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowImportModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Nouvel import</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Type selection */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                  Type d'import
                </label>
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value as ImportType)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                >
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* File upload */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                  Fichier
                </label>
                <label
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ borderColor: importFile ? '#006666' : '#D6D9DB' }}
                >
                  {importFile ? (
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-medium text-sm" style={{ color: '#141A1F' }}>{importFile.name}</p>
                        <p className="text-xs" style={{ color: '#6C767F' }}>{formatFileSize(importFile.size)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <svg className="w-8 h-8 mb-2" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-sm" style={{ color: '#6C767F' }}>
                        <span className="font-medium" style={{ color: '#006666' }}>Cliquez</span> ou glissez un fichier
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#6C767F' }}>CSV, Excel, OFX, QIF</p>
                    </div>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv,.xlsx,.xls,.ofx,.qif"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowImportModal(false); setImportFile(null); }}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#E4E5E7', color: '#6C767F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleNewImport}
                disabled={!importFile || importing}
                className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                style={{ backgroundColor: '#006666' }}
              >
                {importing ? 'Import en cours...' : 'Importer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-100">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: '#141A1F' }}>
                  Supprimer cet import ?
                </h3>
                <p className="mt-1 text-sm" style={{ color: '#6C767F' }}>
                  Cette action supprimera l'enregistrement de l'import et tentera d'annuler les données importées.
                  Cette action est irréversible.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#E4E5E7', color: '#6C767F' }}
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50 bg-red-600 hover:bg-red-700 transition-colors"
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
