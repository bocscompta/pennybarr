import { useState } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'

interface CreateCustomerModalProps {
  onClose: () => void
  onCustomerCreated: (customerId: string, customerName: string) => void
}

interface SireneResult {
  siren: string
  siret: string
  name: string
  address: string
  postal_code: string
  city: string
  vat_number?: string
}

export default function CreateCustomerModal({ onClose, onCustomerCreated }: CreateCustomerModalProps) {
  const [clientType, setClientType] = useState<'company' | 'individual'>('company')
  const [searchMode, setSearchMode] = useState<'api' | 'manual'>('api')

  // Company fields
  const [companyName, setCompanyName] = useState('')
  const [siretSearch, setSiretSearch] = useState('')
  const [siren, setSiren] = useState('')
  const [siret, setSiret] = useState('')
  const [vatNumber, setVatNumber] = useState('')

  // Address fields
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('France')
  const [differentDeliveryAddress, setDifferentDeliveryAddress] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState('')

  // Optional fields
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)

  const handleSearchSiret = async (siretValue: string) => {
    const cleanSiret = siretValue.replace(/\s/g, '')

    // Vérifier que c'est bien 14 chiffres
    if (!/^\d{14}$/.test(cleanSiret)) {
      return // Pas encore un SIRET valide
    }

    try {
      setSearching(true)

      // Appel Edge Function Supabase (évite CORS)
      const { data, error } = await supabase.functions.invoke('search-siret', {
        body: { siret: cleanSiret }
      })

      if (error) {
        console.error('Error calling search-siret function:', error)
        throw new Error(error.message || 'Erreur lors de la recherche')
      }

      if (!data || data.error) {
        throw new Error(data?.error || 'Entreprise non trouvée')
      }

      // Remplir automatiquement les champs
      setCompanyName(data.name || '')
      setSiret(data.siret || cleanSiret) // Utiliser le SIRET recherché si l'API ne le retourne pas
      setSiren(data.siren || cleanSiret.substring(0, 9)) // Extraire SIREN des 9 premiers chiffres
      setAddress(data.address || '')
      setPostalCode(data.postal_code || '')
      setCity(data.city || '')
      setVatNumber(data.vat_number || '')

      setSearchMode('manual')
    } catch (err) {
      console.error('Error searching SIRET:', err)
      alert(err instanceof Error ? err.message : 'Erreur lors de la recherche')
    } finally {
      setSearching(false)
    }
  }

  const handleSiretChange = (value: string) => {
    setSiretSearch(value)

    // Recherche automatique quand SIRET complet (14 chiffres)
    const cleanValue = value.replace(/\s/g, '')
    if (/^\d{14}$/.test(cleanValue)) {
      handleSearchSiret(value)
    }
  }

  const handleCreate = async () => {
    if (!companyName.trim()) {
      alert('Le nom est requis')
      return
    }

    try {
      setCreating(true)

      const { data, error } = await supabase
        .from('third_parties')
        .insert({
          company_id: COMPANY_ID,
          name: companyName.trim(),
          type: 'customer',
          siren: siren || null,
          siret: siret || null,
          vat_number: vatNumber || null,
          address: address || null,
          postal_code: postalCode || null,
          city: city || null,
          country: country || null,
          phone: phone || null,
          email: email || null,
          code: reference || null
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating customer:', error)
        throw new Error(`Erreur création client: ${error.message}`)
      }

      onCustomerCreated(data.id, data.name)
      onClose()
    } catch (err) {
      console.error('Failed to create customer:', err)
      alert(err instanceof Error ? err.message : 'Erreur lors de la création du client')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            Nouveau client
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded transition-colors">
            <svg
              className="w-5 h-5"
              style={{ color: '#6C767F' }}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Type de client */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
              Mon client est :
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={clientType === 'company'}
                  onChange={() => setClientType('company')}
                  className="h-4 w-4 text-stone-600 focus:ring-stone-400"
                />
                <span className="text-sm" style={{ color: '#141A1F' }}>
                  Une entreprise
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={clientType === 'individual'}
                  onChange={() => setClientType('individual')}
                  className="h-4 w-4 text-stone-600 focus:ring-stone-400"
                />
                <span className="text-sm" style={{ color: '#141A1F' }}>
                  Un particulier
                </span>
              </label>
            </div>
          </div>

          {/* Recherche INSEE (entreprise uniquement) */}
          {clientType === 'company' && searchMode === 'api' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium" style={{ color: '#141A1F' }}>
                  Rechercher dans la base INSEE
                </label>
                <button
                  onClick={() => setSearchMode('manual')}
                  className="text-sm text-stone-600 hover:underline"
                >
                  Ajouter une entreprise manuellement
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={siretSearch}
                  onChange={(e) => handleSiretChange(e.target.value)}
                  placeholder="Indiquer la raison sociale, le SIREN ou le SIRET"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                  style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-stone-600" />
                  </div>
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
                Collez un SIRET (14 chiffres) pour rechercher automatiquement
              </p>
            </div>
          )}

          {/* Formulaire manuel */}
          {(clientType === 'individual' || searchMode === 'manual') && (
            <>
              {/* Raison sociale / Nom */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                  {clientType === 'company' ? 'Raison sociale' : 'Nom'} *
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                  style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                  placeholder={clientType === 'company' ? 'Nom de l\'entreprise' : 'Nom du client'}
                />
              </div>

              {/* Adresse */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium" style={{ color: '#141A1F' }}>
                    Adresse de facturation
                  </label>
                  {clientType === 'company' && (
                    <button className="text-sm text-stone-600 hover:underline">
                      Saisir une adresse manuellement
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Adresse"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 mb-2"
                  style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Code postal"
                    className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                    style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                  />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ville"
                    className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                    style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                  />
                </div>
              </div>

              {/* SIREN (entreprise uniquement) */}
              {clientType === 'company' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                      Numéro SIREN
                    </label>
                    <input
                      type="text"
                      value={siren}
                      onChange={(e) => setSiren(e.target.value)}
                      placeholder="123456789"
                      maxLength={9}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                      style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                      Numéro SIRET
                    </label>
                    <input
                      type="text"
                      value={siret}
                      onChange={(e) => setSiret(e.target.value)}
                      placeholder="12345678900001"
                      maxLength={14}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                      style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                    />
                  </div>
                </div>
              )}

              {/* Paramètres optionnels (accordéon) */}
              <details className="border-t pt-4" style={{ borderColor: '#E4E5E7' }}>
                <summary className="text-sm font-medium cursor-pointer mb-4" style={{ color: '#141A1F' }}>
                  Paramètres optionnels
                </summary>
                <div className="space-y-4 pl-4">
                  {/* Téléphone + TVA */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                        Téléphone
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+33 1 23 45 67 89"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                        style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                      />
                    </div>
                    {clientType === 'company' && (
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                          Numéro de TVA
                        </label>
                        <input
                          type="text"
                          value={vatNumber}
                          onChange={(e) => setVatNumber(e.target.value)}
                          placeholder="FR12345678901"
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                          style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                      Liste d'e-mails
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@entreprise.com"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                      style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                    />
                  </div>

                  {/* Référence */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                      Référence
                    </label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Référence interne"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                      style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                    />
                    <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
                      Référence : Il s'agit d'une indication supplémentaire qui peut vous permettre de rechercher et/ou de différencier plus rapidement vos clients.
                    </p>
                  </div>

                  {/* Remarques */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                      Remarques
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Notes internes..."
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                      style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                    />
                  </div>
                </div>
              </details>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
          >
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !companyName.trim()}
            className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#006666' }}
          >
            {creating ? 'Création...' : 'Créer le client'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ Helper Functions ============

/**
 * Calculer le numéro de TVA intracommunautaire français à partir du SIREN
 * Format: FR + clé + SIREN (9 chiffres)
 */
function calculateTVANumber(siren: string): string {
  const sirenNum = parseInt(siren, 10)
  if (isNaN(sirenNum)) return ''

  // Algorithme de calcul de la clé de TVA
  const key = (12 + 3 * (sirenNum % 97)) % 97
  return `FR${key.toString().padStart(2, '0')}${siren}`
}
