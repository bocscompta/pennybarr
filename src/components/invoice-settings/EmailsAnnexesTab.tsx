import { useState, useEffect } from 'react'
import { useEmailTemplates } from '../../hooks/useInvoiceTemplates'
import { useInvoiceSettings } from '../../hooks/useInvoiceSettings'
import AccordionSection from './AccordionSection'
import {
  EMAIL_TEMPLATE_TYPE_LABELS,
  LANGUAGE_LABELS,
  type EmailTemplateType,
  type EmailTemplate,
  type AttachmentsConfig
} from '../../types/invoiceSettings'

interface EmailsAnnexesTabProps {
  companyId: string
}

export default function EmailsAnnexesTab({ companyId }: EmailsAnnexesTabProps) {
  const [templateTypeFilter, setTemplateTypeFilter] = useState<EmailTemplateType | 'all'>('all')
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [expandedSections, setExpandedSections] = useState({
    templates: true,
    annexes: false
  })

  // Gestion des annexes
  const { settings, updateSettings } = useInvoiceSettings(companyId)
  const [attachments, setAttachments] = useState<AttachmentsConfig>({
    cgv: false,
    kbis: false,
    rib: false
  })

  const { templates, loading, error, deleteTemplate } = useEmailTemplates(
    companyId,
    templateTypeFilter === 'all' ? undefined : templateTypeFilter
  )

  useEffect(() => {
    if (settings?.attachments_config) {
      setAttachments(settings.attachments_config)
    }
  }, [settings])

  const handleAttachmentChange = async (key: keyof AttachmentsConfig, value: boolean) => {
    const newAttachments = { ...attachments, [key]: value }
    setAttachments(newAttachments)

    try {
      await updateSettings({ attachments_config: newAttachments })
    } catch (err) {
      console.error('Failed to update attachments:', err)
      setAttachments(attachments)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setShowEmailModal(true)
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce modèle d\'email ?')) return
    try {
      await deleteTemplate(templateId)
    } catch (err) {
      console.error('Failed to delete email template:', err)
    }
  }

  const handleCloseModal = () => {
    setShowEmailModal(false)
    setEditingTemplate(null)
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
      <div className="max-w-6xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      {/* Section 1: Modèles d'emails */}
      <div className="bg-white rounded-lg border mb-6" style={{ borderColor: '#E4E5E7' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-medium" style={{ color: '#141A1F' }}>
                Modèles d'emails
              </h3>
              <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                Personnalisez les emails envoyés automatiquement à vos clients
              </p>
            </div>
            <button
              onClick={() => setShowEmailModal(true)}
              className="px-4 py-2 bg-stone-600 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Créer
            </button>
          </div>

          {/* Filtre */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium" style={{ color: '#6C767F' }}>
              Type
            </label>
            <select
              value={templateTypeFilter}
              onChange={e => setTemplateTypeFilter(e.target.value as EmailTemplateType | 'all')}
              className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
            >
              <option value="all">Tous</option>
              {Object.entries(EMAIL_TEMPLATE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium"
                  style={{ color: '#6C767F' }}
                >
                  Nom du modèle
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium"
                  style={{ color: '#6C767F' }}
                >
                  Concerne les...
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium"
                  style={{ color: '#6C767F' }}
                >
                  Langue
                </th>
                <th
                  className="px-6 py-3 text-center text-xs font-medium"
                  style={{ color: '#6C767F' }}
                >
                  Modèle par défaut
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium"
                  style={{ color: '#6C767F' }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#E4E5E7' }}>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <p className="text-sm" style={{ color: '#6C767F' }}>
                      Aucun modèle d'email trouvé
                    </p>
                  </td>
                </tr>
              ) : (
                templates.map(template => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium" style={{ color: '#141A1F' }}>
                        {template.name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#6C767F' }}>
                        {template.subject}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: '#6C767F' }}>
                      {EMAIL_TEMPLATE_TYPE_LABELS[template.template_type]}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span>{LANGUAGE_LABELS[template.language]}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {template.is_default && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: '#F0FDF4', color: '#10B981' }}
                        >
                          ✓ Par défaut
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(template)}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            style={{ color: '#6C767F' }}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="p-1.5 hover:bg-red-50 rounded transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            style={{ color: '#EF4444' }}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Annexes */}
      <AccordionSection
        title="Annexes"
        description="Sélectionnez les documents à joindre automatiquement à vos emails"
        isExpanded={expandedSections.annexes}
        onToggle={() => toggleSection('annexes')}
      >
        <div className="pt-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={attachments.cgv}
              onChange={e => handleAttachmentChange('cgv', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-stone-600 focus:ring-stone-400"
            />
            <span className="text-sm" style={{ color: '#141A1F' }}>
              Conditions générales de vente (CGV)
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={attachments.kbis}
              onChange={e => handleAttachmentChange('kbis', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-stone-600 focus:ring-stone-400"
            />
            <span className="text-sm" style={{ color: '#141A1F' }}>
              Extrait Kbis
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={attachments.rib}
              onChange={e => handleAttachmentChange('rib', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-stone-600 focus:ring-stone-400"
            />
            <span className="text-sm" style={{ color: '#141A1F' }}>
              RIB
            </span>
          </label>
        </div>
      </AccordionSection>

      {/* Modal Email Template */}
      {showEmailModal && (
        <EmailTemplateModal
          companyId={companyId}
          template={editingTemplate}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}

// ==============================================================================
// EMAIL TEMPLATE MODAL
// ==============================================================================

interface EmailTemplateModalProps {
  companyId: string
  template: EmailTemplate | null
  onClose: () => void
}

function EmailTemplateModal({ companyId, template, onClose }: EmailTemplateModalProps) {
  const { createTemplate, updateTemplate } = useEmailTemplates(companyId)

  const [name, setName] = useState(template?.name || '')
  const [templateType, setTemplateType] = useState<EmailTemplateType>(template?.template_type || 'invoice')
  const [language, setLanguage] = useState(template?.language || 'fr')
  const [subject, setSubject] = useState(template?.subject || '')
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || '')
  const [isDefault, setIsDefault] = useState(template?.is_default || false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Le nom du modèle est requis')
      return
    }
    if (!subject.trim()) {
      alert('Le sujet est requis')
      return
    }
    if (!bodyHtml.trim()) {
      alert('Le corps de l\'email est requis')
      return
    }

    try {
      setSaving(true)

      if (template) {
        await updateTemplate(template.id, {
          name,
          template_type: templateType,
          language,
          subject,
          body_html: bodyHtml,
          is_default: isDefault
        })
      } else {
        await createTemplate({
          company_id: companyId,
          name,
          template_type: templateType,
          language,
          subject,
          body_html: bodyHtml,
          is_default: isDefault
        })
      }

      onClose()
    } catch (err) {
      console.error('Failed to save email template:', err)
      alert(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: '#E4E5E7' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            {template ? 'Modifier le modèle d\'email' : 'Nouveau modèle d\'email'}
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
              Nom du modèle *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              placeholder="Email de facture standard"
            />
          </div>

          {/* Type + Langue */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                Type *
              </label>
              <select
                value={templateType}
                onChange={e => setTemplateType(e.target.value as EmailTemplateType)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              >
                {Object.entries(EMAIL_TEMPLATE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                Langue
              </label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              >
                {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sujet */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
              Sujet *
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              placeholder="Votre facture {invoice_number}"
            />
          </div>

          {/* Corps HTML */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
              Corps de l'email *
            </label>
            <textarea
              value={bodyHtml}
              onChange={e => setBodyHtml(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-400"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              placeholder="<p>Bonjour,</p><p>Veuillez trouver ci-joint votre facture...</p>"
            />
            <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
              Variables disponibles : {'{invoice_number}'}, {'{customer_name}'}, {'{amount}'}
            </p>
          </div>

          {/* Modèle par défaut */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={e => setIsDefault(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-stone-600 focus:ring-stone-400"
            />
            <span className="text-sm" style={{ color: '#141A1F' }}>
              Définir comme modèle par défaut
            </span>
          </label>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-end gap-3"
          style={{ borderColor: '#E4E5E7' }}
        >
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
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
