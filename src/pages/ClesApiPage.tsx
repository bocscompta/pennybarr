import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface ClesApiPageProps {
  onNavigate?: (page: string) => void
}

export default function ClesApiPage({ onNavigate }: ClesApiPageProps) {
  const [mistralApiKey, setMistralApiKey] = useState('')
  const [isSavingApiKey, setIsSavingApiKey] = useState(false)
  const [apiKeySaveStatus, setApiKeySaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [hasExistingMistralKey, setHasExistingMistralKey] = useState(false)

  useEffect(() => {
    checkExistingApiKeys()
  }, [])

  const checkExistingApiKeys = async () => {
    // Check if key exists in vault via RPC
    const { data } = await supabase.rpc('get_vault_secret', { secret_name: 'mistral_api_key' })
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4" style={{ borderColor: '#E4E5E7' }}>
        <button
          onClick={() => onNavigate?.('parametres')}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>Clés API</h1>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl">
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                <svg className="w-5 h-5" style={{ color: '#D97706' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Configuration des clés API</h2>
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
}
