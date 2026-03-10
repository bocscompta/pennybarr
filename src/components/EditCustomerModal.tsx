import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ThirdParty } from '../types/database'

interface EditCustomerModalProps {
  customer: ThirdParty
  onClose: () => void
  onCustomerUpdated: () => void
}

export default function EditCustomerModal({ customer, onClose, onCustomerUpdated }: EditCustomerModalProps) {
  const [name, setName] = useState(customer.name || '')
  const [siren, setSiren] = useState(customer.siren || '')
  const [siret, setSiret] = useState(customer.siret || '')
  const [vatNumber, setVatNumber] = useState(customer.vat_number || '')
  const [address, setAddress] = useState(customer.address || '')
  const [postalCode, setPostalCode] = useState(customer.postal_code || '')
  const [city, setCity] = useState(customer.city || '')
  const [country, setCountry] = useState(customer.country || 'France')
  const [email, setEmail] = useState(customer.email || '')
  const [phone, setPhone] = useState(customer.phone || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Le nom du client est requis')
      return
    }

    try {
      setSaving(true)

      const { error } = await supabase
        .from('third_parties')
        .update({
          name: name.trim(),
          siren: siren || null,
          siret: siret || null,
          vat_number: vatNumber || null,
          address: address || null,
          postal_code: postalCode || null,
          city: city || null,
          country: country || null,
          email: email || null,
          phone: phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id)

      if (error) {
        console.error('Error updating customer:', error)
        throw new Error(`Erreur mise à jour client: ${error.message}`)
      }

      onCustomerUpdated()
      onClose()
    } catch (err) {
      console.error('Failed to update customer:', err)
      alert(err instanceof Error ? err.message : 'Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            Éditer le client
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
              Nom *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
            />
          </div>

          {/* SIREN + SIRET */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                SIREN
              </label>
              <input
                type="text"
                value={siren}
                onChange={(e) => setSiren(e.target.value)}
                maxLength={9}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                SIRET
              </label>
              <input
                type="text"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                maxLength={14}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              />
            </div>
          </div>

          {/* Adresse */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
              Adresse
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
            />
          </div>

          {/* Code postal + Ville */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                Code postal
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                Ville
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              />
            </div>
          </div>

          {/* Email + Téléphone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                Téléphone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              />
            </div>
          </div>

          {/* Numéro TVA */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
              Numéro de TVA
            </label>
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#006666' }}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
