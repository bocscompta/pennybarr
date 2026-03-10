import { useState, useEffect, useRef } from 'react'
import { useInvoiceSettings } from '../../hooks/useInvoiceSettings'
import { supabase } from '../../lib/supabase'
import AccordionSection from './AccordionSection'
import DocumentTypeCard from './DocumentTypeCard'
import { DOCUMENT_TYPE_LABELS, SALE_TYPE_LABELS } from '../../types/invoiceSettings'
import type { DocumentType, SaleType } from '../../types/invoiceSettings'

interface ConfigurationTabProps {
  companyId: string
}

export default function ConfigurationTab({ companyId }: ConfigurationTabProps) {
  const { settings, loading, error, updateSettings, initialize } = useInvoiceSettings(companyId)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [expandedSections, setExpandedSections] = useState({
    numerotation: true,
    infos: false,
    design: false
  })

  // Form state pour Informations entreprise
  const [companyDisplayName, setCompanyDisplayName] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [saleType, setSaleType] = useState<SaleType>('services')
  const [savingInfo, setSavingInfo] = useState(false)

  // Form state pour Design
  const [primaryColor, setPrimaryColor] = useState('#868E96')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [savingDesign, setSavingDesign] = useState(false)

  // Modal numérotation
  const [showNumberingModal, setShowNumberingModal] = useState(false)
  const [editingDocumentType, setEditingDocumentType] = useState<DocumentType | null>(null)

  useEffect(() => {
    if (settings) {
      setCompanyDisplayName(settings.company_display_name || '')
      setCompanyEmail(settings.company_email || '')
      setCompanyPhone(settings.company_phone || '')
      setSaleType(settings.sale_type)
      setPrimaryColor(settings.primary_color)
    }
  }, [settings])

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleSaveInfo = async () => {
    try {
      setSavingInfo(true)
      await updateSettings({
        company_display_name: companyDisplayName,
        company_email: companyEmail,
        company_phone: companyPhone,
        sale_type: saleType
      })
    } catch (err) {
      console.error('Failed to save company info:', err)
    } finally {
      setSavingInfo(false)
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingLogo(true)

      // Vérifier le type de fichier
      if (!file.type.startsWith('image/')) {
        throw new Error('Le fichier doit être une image')
      }

      // Créer un nom de fichier unique
      const fileExt = file.name.split('.').pop()
      const fileName = `${companyId}/logo-${Date.now()}.${fileExt}`

      // Upload vers Supabase Storage (bucket invoice-documents)
      const { data, error: uploadError } = await supabase.storage
        .from('invoice-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('[ConfigurationTab] Failed to upload logo:', uploadError)
        throw new Error(`Échec de l'upload: ${uploadError.message}`)
      }

      // Récupérer l'URL publique
      const {
        data: { publicUrl }
      } = supabase.storage.from('invoice-documents').getPublicUrl(data.path)

      // Sauvegarder l'URL dans les settings
      await updateSettings({
        logo_url: publicUrl
      })
    } catch (err) {
      console.error('Failed to upload logo:', err)
      alert(err instanceof Error ? err.message : 'Erreur lors de l\'upload du logo')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) {
        logoInputRef.current.value = ''
      }
    }
  }

  const handleRemoveLogo = async () => {
    if (!confirm('Supprimer le logo ?')) return
    try {
      await updateSettings({
        logo_url: null
      })
    } catch (err) {
      console.error('Failed to remove logo:', err)
    }
  }

  const handleSaveDesign = async () => {
    try {
      setSavingDesign(true)
      await updateSettings({
        primary_color: primaryColor
      })
    } catch (err) {
      console.error('Failed to save design:', err)
    } finally {
      setSavingDesign(false)
    }
  }

  const handleEditNumbering = (type: DocumentType) => {
    setEditingDocumentType(type)
    setShowNumberingModal(true)
  }

  const handleCloseNumberingModal = () => {
    setShowNumberingModal(false)
    setEditingDocumentType(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-stone-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl">
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="max-w-4xl">
        <div
          className="bg-white rounded-lg border p-6"
          style={{ borderColor: '#E4E5E7' }}
        >
          <p className="text-sm mb-4" style={{ color: '#6C767F' }}>
            Aucune configuration trouvée. Initialiser les paramètres par défaut ?
          </p>
          <button
            onClick={initialize}
            className="px-4 py-2 bg-stone-600 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            Initialiser
          </button>
        </div>
      </div>
    )
  }

  const documentTypes: Array<{
    type: DocumentType
    label: string
    prefix: string
    nextNumber: number
    status: 'active' | 'pending' | 'resetable'
  }> = [
    {
      type: 'invoice',
      label: DOCUMENT_TYPE_LABELS.invoice,
      prefix: settings.invoice_prefix,
      nextNumber: settings.invoice_next_number,
      status: 'resetable'
    },
    {
      type: 'quote',
      label: DOCUMENT_TYPE_LABELS.quote,
      prefix: settings.quote_prefix,
      nextNumber: settings.quote_next_number,
      status: 'active'
    },
    {
      type: 'delivery_note',
      label: DOCUMENT_TYPE_LABELS.delivery_note,
      prefix: settings.delivery_note_prefix,
      nextNumber: settings.delivery_note_next_number,
      status: 'pending'
    },
    {
      type: 'purchase_order',
      label: DOCUMENT_TYPE_LABELS.purchase_order,
      prefix: settings.purchase_order_prefix,
      nextNumber: settings.purchase_order_next_number,
      status: 'pending'
    },
    {
      type: 'proforma',
      label: DOCUMENT_TYPE_LABELS.proforma,
      prefix: settings.proforma_prefix,
      nextNumber: settings.proforma_next_number,
      status: 'pending'
    }
  ]

  return (
    <div className="max-w-4xl">
      {/* Section 1: Numérotation */}
      <AccordionSection
        title="Numérotation"
        description="Vous devez définir une structure de numérotation unique pour chaque type de document."
        isExpanded={expandedSections.numerotation}
        onToggle={() => toggleSection('numerotation')}
      >
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {documentTypes.map(doc => (
            <DocumentTypeCard
              key={doc.type}
              type={doc.type}
              label={doc.label}
              prefix={doc.prefix}
              nextNumber={doc.nextNumber}
              status={doc.status}
              onClick={() => handleEditNumbering(doc.type)}
            />
          ))}
        </div>
      </AccordionSection>

      {/* Section 2: Informations d'entreprise */}
      <AccordionSection
        title="Informations d'entreprise"
        isExpanded={expandedSections.infos}
        onToggle={() => toggleSection('infos')}
      >
        <div className="pt-4 space-y-4">
          {/* Nom de l'entreprise */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
              Nom de l'entreprise de facturation
            </label>
            <input
              type="text"
              value={companyDisplayName}
              onChange={e => setCompanyDisplayName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              placeholder="Nom affiché sur les factures"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
              E-mail
            </label>
            <input
              type="email"
              value={companyEmail}
              onChange={e => setCompanyEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              placeholder="contact@entreprise.com"
            />
          </div>

          {/* Téléphone */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
              Téléphone de l'entreprise
            </label>
            <input
              type="tel"
              value={companyPhone}
              onChange={e => setCompanyPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              placeholder="+33 1 23 45 67 89"
            />
          </div>

          {/* Type de vente */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
              Type de vente de l'entreprise
            </label>
            <select
              value={saleType}
              onChange={e => setSaleType(e.target.value as SaleType)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
            >
              {Object.entries(SALE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Bouton Sauvegarder */}
          <div className="pt-2">
            <button
              onClick={handleSaveInfo}
              disabled={savingInfo}
              className="px-4 py-2 bg-stone-600 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingInfo ? 'Enregistrement...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </AccordionSection>

      {/* Section 3: Design des documents */}
      <AccordionSection
        title="Design des documents"
        isExpanded={expandedSections.design}
        onToggle={() => toggleSection('design')}
      >
        <div className="pt-4 space-y-6">
          {/* Logo */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
              Logo
            </label>
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center relative"
                style={{ borderColor: '#E4E5E7' }}
              >
                {settings.logo_url ? (
                  <>
                    <img
                      src={settings.logo_url}
                      alt="Logo"
                      className="w-full h-full object-contain p-2"
                    />
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                      title="Supprimer le logo"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <svg
                    className="w-8 h-8"
                    style={{ color: '#9CA3AF' }}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                    />
                  </svg>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              >
                {uploadingLogo ? 'Upload...' : 'Modifier'}
              </button>
            </div>
          </div>

          {/* Couleur */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
              Couleur
            </label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="w-12 h-12 rounded border cursor-pointer"
                  style={{ borderColor: '#E4E5E7' }}
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="w-28 px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-400"
                  style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                />
              </div>
              <button
                onClick={handleSaveDesign}
                disabled={savingDesign}
                className="px-4 py-2 bg-stone-600 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingDesign ? 'Enregistrement...' : 'Modifier'}
              </button>
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* Modal Numérotation */}
      {showNumberingModal && editingDocumentType && settings && (
        <NumberingModal
          documentType={editingDocumentType}
          currentPrefix={getDocumentPrefix(editingDocumentType, settings)}
          currentNumber={getDocumentNumber(editingDocumentType, settings)}
          onSave={async (prefix, number) => {
            await updateSettings(getNumberingUpdate(editingDocumentType, prefix, number))
            handleCloseNumberingModal()
          }}
          onClose={handleCloseNumberingModal}
        />
      )}
    </div>
  )
}

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

function getDocumentPrefix(type: DocumentType, settings: any): string {
  const map: Record<DocumentType, string> = {
    invoice: settings.invoice_prefix,
    quote: settings.quote_prefix,
    delivery_note: settings.delivery_note_prefix,
    purchase_order: settings.purchase_order_prefix,
    proforma: settings.proforma_prefix
  }
  return map[type]
}

function getDocumentNumber(type: DocumentType, settings: any): number {
  const map: Record<DocumentType, number> = {
    invoice: settings.invoice_next_number,
    quote: settings.quote_next_number,
    delivery_note: settings.delivery_note_next_number,
    purchase_order: settings.purchase_order_next_number,
    proforma: settings.proforma_next_number
  }
  return map[type]
}

function getNumberingUpdate(type: DocumentType, prefix: string, number: number): any {
  const updates: Record<DocumentType, any> = {
    invoice: { invoice_prefix: prefix, invoice_next_number: number },
    quote: { quote_prefix: prefix, quote_next_number: number },
    delivery_note: { delivery_note_prefix: prefix, delivery_note_next_number: number },
    purchase_order: { purchase_order_prefix: prefix, purchase_order_next_number: number },
    proforma: { proforma_prefix: prefix, proforma_next_number: number }
  }
  return updates[type]
}

// ==============================================================================
// NUMBERING MODAL
// ==============================================================================

interface NumberingModalProps {
  documentType: DocumentType
  currentPrefix: string
  currentNumber: number
  onSave: (prefix: string, number: number) => Promise<void>
  onClose: () => void
}

function NumberingModal({
  documentType,
  currentPrefix,
  currentNumber,
  onSave,
  onClose
}: NumberingModalProps) {
  const [prefix, setPrefix] = useState(currentPrefix)
  const [nextNumber, setNextNumber] = useState(currentNumber)
  const [saving, setSaving] = useState(false)

  const exampleNumber = `${prefix}${new Date().getFullYear()}-${String(nextNumber).padStart(4, '0')}`

  const handleSave = async () => {
    if (!prefix.trim()) {
      alert('Le préfixe est requis')
      return
    }
    if (nextNumber < 1) {
      alert('Le numéro doit être supérieur à 0')
      return
    }

    try {
      setSaving(true)
      await onSave(prefix, nextNumber)
    } catch (err) {
      console.error('Failed to save numbering:', err)
      alert(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            Numérotation - {DOCUMENT_TYPE_LABELS[documentType]}
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
        <div className="p-6 space-y-4">
          {/* Préfixe */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
              Préfixe
            </label>
            <input
              type="text"
              value={prefix}
              onChange={e => setPrefix(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              placeholder="F-"
            />
          </div>

          {/* Numéro suivant */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
              Prochain numéro
            </label>
            <input
              type="number"
              min="1"
              value={nextNumber}
              onChange={e => setNextNumber(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
            />
          </div>

          {/* Preview */}
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
            <div className="text-xs font-medium mb-1" style={{ color: '#6C767F' }}>
              Aperçu
            </div>
            <div className="text-sm font-mono" style={{ color: '#141A1F' }}>
              {exampleNumber}
            </div>
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
            className="px-4 py-2 bg-stone-600 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Enregistrement...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
