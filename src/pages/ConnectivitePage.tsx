import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { testConnection, clearApiKeyCache } from '../services/pennylaneApiService'
import PennylaneSyncPanel from '../components/pennylane/PennylaneSyncPanel'

interface ConnectivitePageProps {
  onNavigate?: (page: string) => void
}

type Tab = 'integrations' | 'cles-api'

export default function ConnectivitePage({ onNavigate }: ConnectivitePageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('integrations')

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => onNavigate?.('parametres')}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>Connectivit&eacute;</h1>
            <p className="text-sm" style={{ color: '#6C767F' }}>
              Connectez vos outils et configurez vos cl&eacute;s API
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6">
          {([
            { id: 'integrations' as Tab, label: 'Int\u00e9grations' },
            { id: 'cles-api' as Tab, label: 'Cl\u00e9s API' },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="pb-2 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: activeTab === tab.id ? '#006666' : 'transparent',
                color: activeTab === tab.id ? '#006666' : '#6C767F',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Tab Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'cles-api' && <ClesApiTab />}
      </div>
    </div>
  )
}

// ============ Integrations Tab (Pennylane) ============

function IntegrationsTab() {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus('testing')
    setConnectionError(null)
    clearApiKeyCache()
    try {
      const result = await testConnection()
      if (result.ok) {
        setConnectionStatus('ok')
        setCompanyName(result.company || null)
      } else {
        setConnectionStatus('error')
        setConnectionError(result.error || 'Erreur inconnue')
      }
    } catch (err) {
      setConnectionStatus('error')
      setConnectionError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
  }, [])

  return (
    <div className="max-w-4xl">
      {/* Pennylane Card */}
      <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F0F5F4' }}>
            <svg className="w-5 h-5" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Pennylane</h2>
            <p className="text-sm" style={{ color: '#6C767F' }}>
              Synchronisez toutes vos donn&eacute;es Pennylane : clients, fournisseurs, factures, devis, produits
            </p>
          </div>
        </div>

        {/* Connection Test */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleTestConnection}
            disabled={connectionStatus === 'testing'}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#006666' }}
          >
            {connectionStatus === 'testing' ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Test en cours...
              </span>
            ) : 'Tester la connexion'}
          </button>

          {connectionStatus === 'ok' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#F0F5F4' }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#006666' }} />
              <span className="text-sm font-medium" style={{ color: '#006666' }}>
                Connect&eacute;{companyName ? ` \u2014 ${companyName}` : ''}
              </span>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-red-700">{connectionError}</span>
            </div>
          )}
        </div>

        {/* Full Sync Panel */}
        <PennylaneSyncPanel />
      </div>

      {/* How it works */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E4E5E7' }}>
        <h2 className="font-semibold mb-3" style={{ color: '#141A1F' }}>Comment fonctionne la synchronisation</h2>
        <div className="space-y-2 text-sm" style={{ color: '#6C767F' }}>
          <div className="flex items-start gap-2">
            <span className="font-medium" style={{ color: '#006666' }}>1.</span>
            <span>Cat&eacute;gories analytiques, fournisseurs, clients et produits depuis Pennylane</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium" style={{ color: '#006666' }}>2.</span>
            <span>Factures fournisseurs et clients avec d&eacute;tection de doublons</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium" style={{ color: '#006666' }}>3.</span>
            <span>Devis avec lignes de d&eacute;tail et liaison produits/clients</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium" style={{ color: '#006666' }}>4.</span>
            <span>T&eacute;l&eacute;chargement des documents PDF et rapprochement bancaire automatique</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ Cles API Tab ============

function ClesApiTab() {
  const [mistralApiKey, setMistralApiKey] = useState('')
  const [pennylaneApiKey, setPennylaneApiKey] = useState('')
  const [resendApiKey, setResendApiKey] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'success' | 'error'>>({})
  const [hasExistingMistralKey, setHasExistingMistralKey] = useState(false)
  const [hasExistingPennylaneKey, setHasExistingPennylaneKey] = useState(false)
  const [hasExistingResendKey, setHasExistingResendKey] = useState(false)

  useEffect(() => {
    checkExistingApiKeys()
  }, [])

  const checkExistingApiKeys = async () => {
    const [mistral, pennylane, resend] = await Promise.all([
      supabase.rpc('get_vault_secret', { secret_name: 'mistral_api_key' }),
      supabase.rpc('get_vault_secret', { secret_name: 'pennylane_api_key' }),
      supabase.rpc('get_vault_secret', { secret_name: 'resend_api_key' }),
    ])
    setHasExistingMistralKey(!!mistral.data)
    setHasExistingPennylaneKey(!!pennylane.data)
    setHasExistingResendKey(!!resend.data)
  }

  const handleSaveApiKey = async (keyName: string, keyValue: string, clearFn: () => void, setExisting: (v: boolean) => void) => {
    if (!keyValue.trim()) return

    setSavingKey(keyName)
    setSaveStatus((s) => ({ ...s, [keyName]: 'idle' }))

    try {
      const { error } = await supabase.rpc('upsert_vault_secret', {
        secret_name: keyName,
        secret_value: keyValue.trim(),
      })

      if (error) throw new Error(error.message)

      setSaveStatus((s) => ({ ...s, [keyName]: 'success' }))
      clearFn()
      setExisting(true)
      if (keyName === 'pennylane_api_key') clearApiKeyCache()
      setTimeout(() => setSaveStatus((s) => ({ ...s, [keyName]: 'idle' })), 3000)
    } catch (error) {
      console.error(`Error saving ${keyName}:`, error)
      setSaveStatus((s) => ({ ...s, [keyName]: 'error' }))
      setTimeout(() => setSaveStatus((s) => ({ ...s, [keyName]: 'idle' })), 3000)
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
            <svg className="w-5 h-5" style={{ color: '#D97706' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Configuration des cl&eacute;s API</h2>
            <p className="text-sm" style={{ color: '#6C767F' }}>Configurez vos cl&eacute;s API pour les services externes</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Pennylane API Key */}
          <ApiKeyCard
            name="Pennylane"
            description="Utilis\u00e9e pour la synchronisation des factures fournisseurs"
            linkUrl="https://app.pennylane.com/settings/api"
            linkLabel="G\u00e9rer les acc\u00e8s"
            hasExistingKey={hasExistingPennylaneKey}
            keyValue={pennylaneApiKey}
            onKeyChange={setPennylaneApiKey}
            onSave={() => handleSaveApiKey('pennylane_api_key', pennylaneApiKey, () => setPennylaneApiKey(''), setHasExistingPennylaneKey)}
            isSaving={savingKey === 'pennylane_api_key'}
            saveStatus={saveStatus['pennylane_api_key'] || 'idle'}
          />

          {/* Mistral OCR API Key */}
          <ApiKeyCard
            name="Mistral OCR"
            description="Utilis\u00e9e pour l'extraction automatique des donn\u00e9es de factures (OCR)"
            linkUrl="https://console.mistral.ai/"
            linkLabel="Obtenir une cl\u00e9"
            hasExistingKey={hasExistingMistralKey}
            keyValue={mistralApiKey}
            onKeyChange={setMistralApiKey}
            onSave={() => handleSaveApiKey('mistral_api_key', mistralApiKey, () => setMistralApiKey(''), setHasExistingMistralKey)}
            isSaving={savingKey === 'mistral_api_key'}
            saveStatus={saveStatus['mistral_api_key'] || 'idle'}
          />

          {/* Resend API Key */}
          <ApiKeyCard
            name="Resend"
            description="Envoi d'emails transactionnels (codes OTP, notifications)"
            linkUrl="https://resend.com/api-keys"
            linkLabel="G\u00e9rer les cl\u00e9s"
            hasExistingKey={hasExistingResendKey}
            keyValue={resendApiKey}
            onKeyChange={setResendApiKey}
            onSave={() => handleSaveApiKey('resend_api_key', resendApiKey, () => setResendApiKey(''), setHasExistingResendKey)}
            isSaving={savingKey === 'resend_api_key'}
            saveStatus={saveStatus['resend_api_key'] || 'idle'}
          />
        </div>
      </div>
    </div>
  )
}

// ============ Reusable API Key Card ============

function ApiKeyCard({
  name,
  description,
  linkUrl,
  linkLabel,
  hasExistingKey,
  keyValue,
  onKeyChange,
  onSave,
  isSaving,
  saveStatus,
}: {
  name: string
  description: string
  linkUrl: string
  linkLabel: string
  hasExistingKey: boolean
  keyValue: string
  onKeyChange: (v: string) => void
  onSave: () => void
  isSaving: boolean
  saveStatus: 'idle' | 'success' | 'error'
}) {
  return (
    <div className="p-4 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium" style={{ color: '#141A1F' }}>{name}</span>
          {hasExistingKey && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F0F5F4', color: '#006666' }}>
              Configur&eacute;e
            </span>
          )}
        </div>
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs hover:underline"
          style={{ color: '#006666' }}
        >
          {linkLabel}
        </a>
      </div>
      <p className="text-xs mb-3" style={{ color: '#6C767F' }}>{description}</p>
      <div className="flex gap-2">
        <input
          type="password"
          value={keyValue}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder={hasExistingKey ? "Entrez une nouvelle cl\u00e9 pour remplacer" : `Entrez votre cl\u00e9 API ${name}`}
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
          style={{ borderColor: '#D6D9DB' }}
        />
        <button
          onClick={onSave}
          disabled={isSaving || !keyValue.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#006666' }}
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
      {saveStatus === 'success' && (
        <p className="text-xs mt-2" style={{ color: '#006666' }}>Cl&eacute; API enregistr&eacute;e</p>
      )}
      {saveStatus === 'error' && (
        <p className="text-xs mt-2" style={{ color: '#DC2626' }}>Erreur lors de l&apos;enregistrement</p>
      )}
    </div>
  )
}
