import { useState } from 'react'
import { useReminderSequences } from '../../hooks/useReminderSequences'
import { useEmailTemplates } from '../../hooks/useInvoiceTemplates'
import { replaceSequenceSteps } from '../../services/paymentReminderService'
import type { PaymentReminderSequence, CreatePaymentReminderStepData } from '../../types/invoiceSettings'

interface RelancesTabProps {
  companyId: string
}

export default function RelancesTab({ companyId }: RelancesTabProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingSequence, setEditingSequence] = useState<PaymentReminderSequence | null>(null)

  const { sequences, loading, error, deleteSequence, toggleActive } =
    useReminderSequences(companyId)

  const handleEdit = (sequence: PaymentReminderSequence) => {
    setEditingSequence(sequence)
    setShowModal(true)
  }

  const handleDelete = async (sequenceId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette séquence de relances ?')) return
    try {
      await deleteSequence(sequenceId)
    } catch (err) {
      console.error('Failed to delete sequence:', err)
    }
  }

  const handleToggleActive = async (sequenceId: string, isActive: boolean) => {
    try {
      await toggleActive(sequenceId, !isActive)
    } catch (err) {
      console.error('Failed to toggle sequence:', err)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingSequence(null)
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
      {/* Banner info si aucune séquence */}
      {sequences.length === 0 && (
        <div
          className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3"
        >
          <svg
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            style={{ color: '#3B82F6' }}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: '#1E40AF' }}>
              Les relances d'impayés sont disponibles !
            </p>
            <p className="text-sm mt-1" style={{ color: '#3B82F6' }}>
              Souhaitez-vous activer la séquence par défaut ?{' '}
              <button
                onClick={() => setShowModal(true)}
                className="font-medium underline hover:no-underline"
              >
                Activer pour tous vos clients
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Header avec bouton */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium" style={{ color: '#141A1F' }}>
            Séquences de relances
          </h3>
          <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
            Automatisez vos relances de paiement
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
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
          Nouvelle séquence
        </button>
      </div>

      {/* Tableau des séquences */}
      <div className="bg-white rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium"
                  style={{ color: '#6C767F' }}
                >
                  Nom de la séquence
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium"
                  style={{ color: '#6C767F' }}
                >
                  Description
                </th>
                <th
                  className="px-6 py-3 text-center text-xs font-medium"
                  style={{ color: '#6C767F' }}
                >
                  Étapes
                </th>
                <th
                  className="px-6 py-3 text-center text-xs font-medium"
                  style={{ color: '#6C767F' }}
                >
                  Statut
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
              {sequences.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <p className="text-sm" style={{ color: '#6C767F' }}>
                      Aucune séquence de relances configurée
                    </p>
                  </td>
                </tr>
              ) : (
                sequences.map(sequence => (
                  <tr key={sequence.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium" style={{ color: '#141A1F' }}>
                        {sequence.name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#6C767F' }}>
                        {sequence.is_automatic ? 'Automatique' : 'Avec validation'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm" style={{ color: '#6C767F' }}>
                        {sequence.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm" style={{ color: '#141A1F' }}>
                        -
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {sequence.is_active ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: '#F0FDF4', color: '#10B981' }}
                        >
                          ✓ Active
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: '#F3F4F6', color: '#6C767F' }}
                        >
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleActive(sequence.id, sequence.is_active)}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          title={sequence.is_active ? 'Désactiver' : 'Activer'}
                        >
                          <svg
                            className="w-4 h-4"
                            style={{ color: '#6C767F' }}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            viewBox="0 0 24 24"
                          >
                            {sequence.is_active ? (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"
                              />
                            ) : (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5.636 18.364a9 9 0 1012.728 0M12 21v-9"
                              />
                            )}
                          </svg>
                        </button>
                        <button
                          onClick={() => handleEdit(sequence)}
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
                          onClick={() => handleDelete(sequence.id)}
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

      {/* Modal création séquence */}
      {showModal && (
        <ReminderSequenceModal
          companyId={companyId}
          sequence={editingSequence}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}

// ==============================================================================
// REMINDER SEQUENCE MODAL
// ==============================================================================

interface ReminderSequenceModalProps {
  companyId: string
  sequence: PaymentReminderSequence | null
  onClose: () => void
}

interface StepForm {
  delay_days: number
  email_template_id: string
}

function ReminderSequenceModal({ companyId, sequence, onClose }: ReminderSequenceModalProps) {
  const { createSequence, updateSequence } = useReminderSequences(companyId)
  const { templates: emailTemplates } = useEmailTemplates(companyId, 'reminder')

  const [name, setName] = useState(sequence?.name || '')
  const [description, setDescription] = useState(sequence?.description || '')
  const [isAutomatic, setIsAutomatic] = useState(sequence?.is_automatic ?? true)
  const [steps, setSteps] = useState<StepForm[]>([
    { delay_days: 7, email_template_id: '' },
    { delay_days: 14, email_template_id: '' }
  ])
  const [saving, setSaving] = useState(false)

  const handleAddStep = () => {
    setSteps([...steps, { delay_days: 0, email_template_id: '' }])
  }

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index))
  }

  const handleUpdateStep = (index: number, field: keyof StepForm, value: any) => {
    setSteps(steps.map((step, i) => (i === index ? { ...step, [field]: value } : step)))
  }

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Le nom de la séquence est requis')
      return
    }

    try {
      setSaving(true)

      let sequenceId: string

      if (sequence) {
        // Mise à jour de la séquence existante
        await updateSequence(sequence.id, {
          name,
          description: description || null,
          is_automatic: isAutomatic
        })
        sequenceId = sequence.id
      } else {
        // Création d'une nouvelle séquence
        const newSequence = await createSequence({
          company_id: companyId,
          name,
          description: description || null,
          is_automatic: isAutomatic,
          is_active: false
        })
        sequenceId = newSequence.id
      }

      // Sauvegarder les étapes
      const stepsData: CreatePaymentReminderStepData[] = steps.map((step, index) => ({
        sequence_id: sequenceId,
        step_order: index,
        delay_days: step.delay_days,
        email_template_id: step.email_template_id || null
      }))

      await replaceSequenceSteps(sequenceId, stepsData)

      onClose()
    } catch (err) {
      console.error('Failed to save reminder sequence:', err)
      alert(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: '#E4E5E7' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            {sequence ? 'Modifier la séquence' : 'Créer un modèle de relance'}
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
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
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
                placeholder="Relance standard"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                placeholder="Description de la séquence de relances..."
              />
            </div>

            {/* Étapes */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium" style={{ color: '#141A1F' }}>
                  Étapes de relance
                </label>
                <button
                  onClick={handleAddStep}
                  className="px-3 py-1.5 border-2 border-dashed rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                  style={{ borderColor: '#E4E5E7', color: '#6C767F' }}
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
                  Ajouter une étape
                </button>
              </div>

              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{ borderColor: '#E4E5E7' }}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                      <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                        {index + 1}
                      </span>
                    </div>

                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#6C767F' }}>
                          Délai (jours)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={step.delay_days}
                          onChange={e =>
                            handleUpdateStep(index, 'delay_days', parseInt(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                          style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#6C767F' }}>
                          Template email
                        </label>
                        <select
                          value={step.email_template_id}
                          onChange={e => handleUpdateStep(index, 'email_template_id', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                          style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                        >
                          <option value="">Choisir un template</option>
                          {emailTemplates.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {steps.length > 1 && (
                      <button
                        onClick={() => handleRemoveStep(index)}
                        className="flex-shrink-0 p-1.5 hover:bg-red-50 rounded transition-colors"
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
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Mode de relance */}
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: '#141A1F' }}>
                Mode de relance
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  style={{ borderColor: isAutomatic ? '#006666' : '#E4E5E7', backgroundColor: isAutomatic ? '#F0F5F4' : 'transparent' }}
                >
                  <input
                    type="radio"
                    checked={isAutomatic}
                    onChange={() => setIsAutomatic(true)}
                    className="mt-0.5 h-4 w-4 text-stone-600 focus:ring-stone-400"
                  />
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#141A1F' }}>
                      Automatique
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#6C767F' }}>
                      Les relances sont envoyées automatiquement
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  style={{ borderColor: !isAutomatic ? '#006666' : '#E4E5E7', backgroundColor: !isAutomatic ? '#F0F5F4' : 'transparent' }}
                >
                  <input
                    type="radio"
                    checked={!isAutomatic}
                    onChange={() => setIsAutomatic(false)}
                    className="mt-0.5 h-4 w-4 text-stone-600 focus:ring-stone-400"
                  />
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#141A1F' }}>
                      Avec validation
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#6C767F' }}>
                      Vous devez valider chaque relance avant envoi
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
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
