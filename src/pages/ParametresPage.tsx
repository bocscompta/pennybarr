import { useState, useEffect } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'

// API Keys management

interface FiscalYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  is_closed: boolean
}

interface ParametresPageProps {
  onNavigate?: (page: string) => void
}

export default function ParametresPage({ onNavigate }: ParametresPageProps) {
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [showNewFiscalYearModal, setShowNewFiscalYearModal] = useState(false)
  const [showEditFiscalYearModal, setShowEditFiscalYearModal] = useState(false)
  const [editingFiscalYear, setEditingFiscalYear] = useState<FiscalYear | null>(null)

  // API Keys state
  const [mistralApiKey, setMistralApiKey] = useState('')
  const [isSavingApiKey, setIsSavingApiKey] = useState(false)
  const [apiKeySaveStatus, setApiKeySaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [hasExistingMistralKey, setHasExistingMistralKey] = useState(false)

  useEffect(() => {
    fetchFiscalYears()
    checkExistingApiKeys()
  }, [])

  const checkExistingApiKeys = async () => {
    // Check if Mistral API key exists in api_keys table
    const { data } = await supabase
      .from('api_keys')
      .select('id')
      .eq('key_name', 'mistral_api_key')
      .single()
    setHasExistingMistralKey(!!data)
  }

  const handleSaveApiKey = async (keyName: string, keyValue: string) => {
    if (!keyValue.trim()) return

    setIsSavingApiKey(true)
    setApiKeySaveStatus('idle')

    try {
      const { error } = await supabase.functions.invoke('save-api-key', {
        body: {
          keyName,
          keyValue: keyValue.trim()
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      setApiKeySaveStatus('success')
      setMistralApiKey('')
      setHasExistingMistralKey(true)
      setTimeout(() => setApiKeySaveStatus('idle'), 3000)
    } catch (error) {
      console.error('Error saving API key:', error)
      setApiKeySaveStatus('error')
      setTimeout(() => setApiKeySaveStatus('idle'), 3000)
    } finally {
      setIsSavingApiKey(false)
    }
  }

  const fetchFiscalYears = async () => {
    const { data } = await supabase
      .from('fiscal_years')
      .select('*')
      .order('start_date', { ascending: false })
    if (data) setFiscalYears(data)
  }

  const handleSetCurrentFiscalYear = async (fy: FiscalYear) => {
    await supabase.from('fiscal_years').update({ is_current: false }).eq('is_current', true)
    await supabase.from('fiscal_years').update({ is_current: true }).eq('id', fy.id)
    fetchFiscalYears()
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR')
  }

  // Main settings menu items
  const settingsMenuItems = [
    { id: 'connexions-bancaires', label: 'Connexions bancaires', disabled: true },
    { id: 'transmission-factures', label: 'Transmission de factures', disabled: true },
    { id: 'facturation-client', label: 'Facturation client', disabled: true },
    { id: 'familles-analytiques', label: 'Familles analytiques', disabled: true },
    { id: 'centre-regles', label: 'Centre de règles', disabled: true },
    { id: 'autopilot', label: 'Autopilot', badge: 'Nouv', disabled: true },
    { id: 'connectivite', label: 'Connectivité', onClick: () => onNavigate?.('connectivite') },
    { id: 'fonctionnalites-avancees', label: 'Fonctionnalités avancées', disabled: true },
    { id: 'intelligence-artificielle', label: 'Intelligence artificielle', badge: 'Nouv', disabled: true },
    { id: 'plan-comptable', label: 'Plan comptable', onClick: () => onNavigate?.('plan-comptable') },
    { id: 'separator1', type: 'separator' },
    { id: 'informations-entreprise', label: 'Informations entreprise', onClick: () => onNavigate?.('informations-entreprise') },
    { id: 'gestion-equipe', label: 'Gestion de l\'équipe', disabled: true },
    { id: 'gestion-abonnement', label: 'Gestion d\'abonnement', disabled: true },
    { id: 'separator2', type: 'separator' },
    { id: 'historique', label: 'Historique', isHeader: true },
    { id: 'imports', label: 'Imports', disabled: true },
    { id: 'exports', label: 'Exports', disabled: true },
  ]

  // Render main settings page
  const renderMainSettings = () => (
    <div className="flex-1 flex">
      {/* Sidebar menu */}
      <div className="w-72 bg-white border-r overflow-y-auto" style={{ borderColor: '#E4E5E7' }}>
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>Paramètres</h2>
          <nav className="space-y-1">
            {settingsMenuItems.map((item) => {
              if (item.type === 'separator') {
                return <div key={item.id} className="my-3 border-t" style={{ borderColor: '#E4E5E7' }} />
              }
              if (item.isHeader) {
                return (
                  <div key={item.id} className="px-3 py-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                    {item.label}
                  </div>
                )
              }
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                    item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                  }`}
                  style={{ color: '#141A1F' }}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E6F2F2', color: '#006666' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl space-y-6">
          {/* Import du Grand Livre */}
          <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
            <button
              onClick={() => onNavigate?.('grand-livre-import')}
              className="w-full flex items-center justify-between hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#E3F2FD' }}>
                  <svg className="w-6 h-6" style={{ color: '#1976D2' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium" style={{ color: '#141A1F' }}>Import du Grand Livre</div>
                  <div className="text-sm" style={{ color: '#6C767F' }}>Importer le plan comptable, tiers et écritures depuis Excel</div>
                </div>
              </div>
              <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Exercices comptables */}
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Exercices comptables</h2>
              <button
                onClick={() => setShowNewFiscalYearModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: '#006666' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nouvel exercice
              </button>
            </div>

            {fiscalYears.length === 0 ? (
              <div className="text-center py-12" style={{ color: '#6C767F' }}>
                Aucun exercice comptable configuré
              </div>
            ) : (
              <div className="space-y-3">
                {fiscalYears.map((fy) => (
                  <div
                    key={fy.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                    style={{
                      borderColor: fy.is_current ? '#006666' : '#E4E5E7',
                      backgroundColor: fy.is_current ? '#F0F7F7' : 'white'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: fy.is_current ? '#16A34A' : fy.is_closed ? '#6C767F' : '#FFC107' }}
                      />
                      <div>
                        <div className="font-medium" style={{ color: '#141A1F' }}>{fy.name}</div>
                        <div className="text-sm" style={{ color: '#6C767F' }}>
                          Du {formatDate(fy.start_date)} au {formatDate(fy.end_date)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {fy.is_current && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}>
                          En cours
                        </span>
                      )}
                      {fy.is_closed && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
                          Clôturé
                        </span>
                      )}
                      {!fy.is_current && !fy.is_closed && (
                        <button
                          onClick={() => handleSetCurrentFiscalYear(fy)}
                          className="text-xs px-3 py-1.5 rounded border hover:bg-gray-50 transition-colors"
                          style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                        >
                          Définir comme courant
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingFiscalYear(fy)
                          setShowEditFiscalYearModal(true)
                        }}
                        className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                      >
                        <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Entreprise */}
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>Entreprise</h2>
            <button
              onClick={() => onNavigate?.('informations-entreprise')}
              className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#E4E5E7' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
                  <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium" style={{ color: '#141A1F' }}>Informations entreprise</div>
                  <div className="text-sm" style={{ color: '#6C767F' }}>MON_ENTREPRISE - 000000000</div>
                </div>
              </div>
              <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Clés API */}
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                <svg className="w-5 h-5" style={{ color: '#D97706' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Clés API</h2>
                <p className="text-sm" style={{ color: '#6C767F' }}>Configurez vos clés API pour les services externes</p>
              </div>
            </div>

            {/* Mistral OCR API Key */}
            <div className="space-y-4">
              <div className="p-4 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: '#141A1F' }}>Mistral OCR</span>
                    {hasExistingMistralKey && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}>
                        Configurée
                      </span>
                    )}
                  </div>
                  <a
                    href="https://console.mistral.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs hover:underline"
                    style={{ color: '#006666' }}
                  >
                    Obtenir une clé
                  </a>
                </div>
                <p className="text-xs mb-3" style={{ color: '#6C767F' }}>
                  Utilisée pour l'extraction automatique des données de factures (OCR)
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={mistralApiKey}
                    onChange={(e) => setMistralApiKey(e.target.value)}
                    placeholder={hasExistingMistralKey ? "Entrez une nouvelle clé pour remplacer" : "Entrez votre clé API Mistral"}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                  <button
                    onClick={() => handleSaveApiKey('mistral_api_key', mistralApiKey)}
                    disabled={isSavingApiKey || !mistralApiKey.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    style={{ backgroundColor: '#006666' }}
                  >
                    {isSavingApiKey ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Enregistrement...
                      </>
                    ) : (
                      'Enregistrer'
                    )}
                  </button>
                </div>
                {apiKeySaveStatus === 'success' && (
                  <p className="text-xs mt-2" style={{ color: '#16A34A' }}>
                    Clé API enregistrée avec succès
                  </p>
                )}
                {apiKeySaveStatus === 'error' && (
                  <p className="text-xs mt-2" style={{ color: '#DC2626' }}>
                    Erreur lors de l'enregistrement. Veuillez réessayer.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>Paramètres</h1>
      </header>
      {renderMainSettings()}

      {/* New Fiscal Year Modal */}
      {showNewFiscalYearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowNewFiscalYearModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>Nouvel exercice comptable</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const form = e.target as HTMLFormElement
              const formData = new FormData(form)
              await supabase.from('fiscal_years').insert({
                company_id: COMPANY_ID,
                name: formData.get('name'),
                start_date: formData.get('start_date'),
                end_date: formData.get('end_date'),
                is_current: false,
                is_closed: false
              })
              fetchFiscalYears()
              setShowNewFiscalYearModal(false)
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Nom de l'exercice</label>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="Ex: Exercice 2029"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date de début</label>
                    <input
                      name="start_date"
                      type="date"
                      required
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date de fin</label>
                    <input
                      name="end_date"
                      type="date"
                      required
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewFiscalYearModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium"
                  style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: '#006666' }}
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Fiscal Year Modal */}
      {showEditFiscalYearModal && editingFiscalYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowEditFiscalYearModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>Modifier l'exercice</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const form = e.target as HTMLFormElement
              const formData = new FormData(form)
              await supabase.from('fiscal_years').update({
                name: formData.get('name'),
                start_date: formData.get('start_date'),
                end_date: formData.get('end_date')
              }).eq('id', editingFiscalYear.id)
              fetchFiscalYears()
              setShowEditFiscalYearModal(false)
              setEditingFiscalYear(null)
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Nom de l'exercice</label>
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={editingFiscalYear.name}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date de début</label>
                    <input
                      name="start_date"
                      type="date"
                      required
                      defaultValue={editingFiscalYear.start_date}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date de fin</label>
                    <input
                      name="end_date"
                      type="date"
                      required
                      defaultValue={editingFiscalYear.end_date}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditFiscalYearModal(false)
                    setEditingFiscalYear(null)
                  }}
                  className="px-4 py-2 border rounded-lg text-sm font-medium"
                  style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: '#006666' }}
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
