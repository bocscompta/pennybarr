import { useState } from 'react'
import type { CreateInvoiceFormData, CustomField } from '../../types/invoiceForm'
import type { ThirdParty } from '../../types/database'
import { useCompanyInfo } from '../../hooks/useCompanyInfo'
import { COMPANY_ID } from '../../lib/supabase'
import ThirdPartyPicker from '../ThirdPartyPicker'
import CreateCustomerModal from '../CreateCustomerModal'
import EditCustomerModal from '../EditCustomerModal'

interface InvoiceHeaderProps {
  formData: CreateInvoiceFormData
  customers: ThirdParty[]
  onUpdate: (updates: Partial<CreateInvoiceFormData>) => void
}

const SALE_TYPES = [
  { value: 'services', label: 'Prestations de services' },
  { value: 'goods', label: 'Livraisons de biens' },
  { value: 'both', label: 'Les deux' },
] as const

function generateFieldId(): string {
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function InvoiceHeader({ formData, customers, onUpdate }: InvoiceHeaderProps) {
  const [editingCustomField, setEditingCustomField] = useState<string | null>(null)
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false)
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false)
  const { companyInfo } = useCompanyInfo(COMPANY_ID)

  const handleCustomerSelect = (name: string, id: string | null) => {
    onUpdate({ customerName: name, customerId: id })
  }

  const handleCustomerCreated = (customerId: string, customerName: string) => {
    onUpdate({
      customerId,
      customerName
    })
    // Force page reload to refresh customer list
    window.location.reload()
  }

  const handleAddCustomField = () => {
    const newField: CustomField = {
      id: generateFieldId(),
      label: '',
      value: ''
    }
    onUpdate({ customFields: [...formData.customFields, newField] })
    setEditingCustomField(newField.id)
  }

  const handleUpdateCustomField = (id: string, updates: Partial<CustomField>) => {
    onUpdate({
      customFields: formData.customFields.map(f =>
        f.id === id ? { ...f, ...updates } : f
      )
    })
  }

  const handleRemoveCustomField = (id: string) => {
    onUpdate({
      customFields: formData.customFields.filter(f => f.id !== id)
    })
  }

  const handleAddDocumentTitle = () => {
    if (formData.documentTitle === undefined) {
      onUpdate({ documentTitle: '' })
    }
  }

  const handleRemoveDocumentTitle = () => {
    onUpdate({ documentTitle: undefined })
  }

  const handleAddDocumentDescription = () => {
    if (formData.documentDescription === undefined) {
      onUpdate({ documentDescription: '' })
    }
  }

  const handleRemoveDocumentDescription = () => {
    onUpdate({ documentDescription: undefined })
  }

  const selectedCustomer = formData.customerId
    ? customers.find(c => c.id === formData.customerId)
    : null

  return (
    <div>
      {/* 2-COLUMN LAYOUT: Left (Logo + Form) | Right (Emetteur + Client) */}
      <div className="flex justify-between items-start">
        {/* ===== LEFT COLUMN: Logo + Devis Form ===== */}
        <div className="flex-shrink-0" style={{ width: '380px' }}>
          {/* Logo */}
          <div
            className="w-24 h-24 rounded-lg flex items-center justify-center mb-3"
            style={{ backgroundColor: '#1a1a3e' }}
          >
            <span className="text-white text-3xl font-bold tracking-tight">Pm</span>
          </div>

          {/* Facture/Devis info - directly under logo */}
          <div>
            <h2 className="text-base text-gray-400 mb-2">Facture</h2>

            <div className="space-y-1.5">
              {/* Numero */}
              <div className="flex items-center">
                <label className="text-sm font-medium w-36 flex-shrink-0" style={{ color: '#111827' }}>Numéro</label>
                <span className="text-sm" style={{ color: '#374151' }}>{formData.invoiceNumber}</span>
              </div>

              {/* Date d'emission */}
              <div className="flex items-center">
                <label className="text-sm font-medium w-36 flex-shrink-0" style={{ color: '#111827' }}>Date d'émission</label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => onUpdate({ invoiceDate: e.target.value })}
                    className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
                    style={{ color: '#374151' }}
                  />
                </div>
              </div>

              {/* Date d'echeance */}
              <div className="flex items-center">
                <label className="text-sm font-medium w-36 flex-shrink-0" style={{ color: '#111827' }}>Date d'échéance</label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => onUpdate({ dueDate: e.target.value })}
                    className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
                    style={{ color: '#374151' }}
                  />
                </div>
              </div>

              {/* Type de vente */}
              <div className="flex items-center">
                <label className="text-sm font-medium w-36 flex-shrink-0" style={{ color: '#111827' }}>Type de vente</label>
                <select
                  value={formData.saleType}
                  onChange={(e) => onUpdate({ saleType: e.target.value as CreateInvoiceFormData['saleType'] })}
                  className="text-sm border border-gray-200 rounded px-2 py-1 pr-6 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
                  style={{ color: '#374151' }}
                >
                  {SALE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom fields */}
            {formData.customFields.map(field => (
              <div key={field.id} className="flex items-center mt-1.5">
                {editingCustomField === field.id ? (
                  <input
                    type="text"
                    value={field.label}
                    onChange={e => handleUpdateCustomField(field.id, { label: e.target.value })}
                    onBlur={() => setEditingCustomField(null)}
                    placeholder="Nom du champ"
                    className="text-sm font-medium w-36 border-b border-gray-300 focus:outline-none focus:border-gray-500"
                    style={{ color: '#111827' }}
                    autoFocus
                  />
                ) : (
                  <label
                    className="text-sm font-medium w-36 flex-shrink-0 cursor-pointer"
                    style={{ color: '#111827' }}
                    onClick={() => setEditingCustomField(field.id)}
                  >
                    {field.label || 'Nouveau champ'}
                  </label>
                )}
                <input
                  type="text"
                  value={field.value}
                  onChange={e => handleUpdateCustomField(field.id, { value: e.target.value })}
                  className="text-sm bg-transparent border-none focus:outline-none focus:ring-0 p-0 flex-1"
                  style={{ color: '#374151' }}
                  placeholder="Valeur"
                />
                <button
                  onClick={() => handleRemoveCustomField(field.id)}
                  className="ml-1 p-0.5 hover:bg-gray-100 rounded"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            <button
              onClick={handleAddCustomField}
              className="text-xs mt-2 hover:text-gray-600"
              style={{ color: '#9CA3AF' }}
            >
              + Ajouter un champ libre
            </button>
          </div>

          {/* Optional sections - Document title & description */}
          <div className="mt-4 space-y-1.5">
            {/* Document title */}
            {formData.documentTitle !== undefined ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formData.documentTitle}
                  onChange={e => onUpdate({ documentTitle: e.target.value })}
                  placeholder="Titre du document"
                  className="text-sm font-semibold border-b border-gray-300 focus:outline-none focus:border-gray-500 flex-1"
                  style={{ color: '#111827' }}
                />
                <button
                  onClick={handleRemoveDocumentTitle}
                  className="p-0.5 hover:bg-gray-100 rounded"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={handleAddDocumentTitle}
                className="text-sm font-semibold hover:text-gray-700 block"
                style={{ color: '#111827' }}
              >
                + Ajouter un titre de document
              </button>
            )}

            {/* Document description */}
            {formData.documentDescription !== undefined ? (
              <div className="flex items-center gap-2">
                <textarea
                  value={formData.documentDescription}
                  onChange={e => onUpdate({ documentDescription: e.target.value })}
                  placeholder="Description du document"
                  rows={2}
                  className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-gray-400 flex-1"
                  style={{ color: '#6B7280' }}
                />
                <button
                  onClick={handleRemoveDocumentDescription}
                  className="p-0.5 hover:bg-gray-100 rounded self-start"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={handleAddDocumentDescription}
                className="text-xs hover:text-gray-600 block"
                style={{ color: '#9CA3AF' }}
              >
                + Ajouter une description
              </button>
            )}
          </div>
        </div>

        {/* ===== RIGHT COLUMN: Emetteur + Client ===== */}
        <div className="text-left" style={{ minWidth: '300px' }}>
          {/* Émetteur (données réelles depuis companies) */}
          <div className="mb-4">
            <p className="text-xs mb-0.5" style={{ color: '#9CA3AF' }}>Émetteur ou émettrice</p>
            {companyInfo && (
              <>
                <p className="text-sm font-medium" style={{ color: '#111827' }}>{companyInfo.name}</p>
                {companyInfo.address && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>{companyInfo.address}</p>
                )}
                {(companyInfo.postal_code || companyInfo.city) && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>
                    {companyInfo.postal_code} {companyInfo.city}, {companyInfo.country === 'FR' ? 'France' : companyInfo.country}
                  </p>
                )}
                {companyInfo.email && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>{companyInfo.email}</p>
                )}
                {companyInfo.phone && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>{companyInfo.phone}</p>
                )}
              </>
            )}
          </div>

          {/* Client info */}
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#9CA3AF' }}>Client ou cliente</p>
            {selectedCustomer ? (
              <div>
                {/* Client dropdown style with × and ▼ */}
                <div
                  className="flex items-center justify-between border rounded px-2 py-1.5 mb-1"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <span className="text-sm font-medium" style={{ color: '#111827' }}>{selectedCustomer.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdate({ customerId: null, customerName: '' })}
                      className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <button className="p-0.5 hover:bg-gray-100 rounded transition-colors">
                      <svg className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Client details below dropdown */}
                {selectedCustomer.siren && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>{selectedCustomer.siren}</p>
                )}
                {selectedCustomer.address && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>{selectedCustomer.address}</p>
                )}
                {(selectedCustomer.postal_code || selectedCustomer.city) && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>
                    {selectedCustomer.postal_code} {selectedCustomer.city} - {selectedCustomer.country || 'France'}
                  </p>
                )}
                {selectedCustomer.email && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>{selectedCustomer.email}</p>
                )}
                {selectedCustomer.vat_number && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>{selectedCustomer.vat_number}</p>
                )}
                {/* Lien éditer */}
                <button
                  onClick={() => setShowEditCustomerModal(true)}
                  className="text-xs mt-1 flex items-center gap-1 hover:underline"
                  style={{ color: '#006666' }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  Éditer les informations de ce client
                </button>
              </div>
            ) : (
              <ThirdPartyPicker
                thirdParties={customers}
                value={formData.customerName}
                selectedId={formData.customerId}
                type="customer"
                onChange={handleCustomerSelect}
                onCreateNew={() => setShowNewCustomerModal(true)}
                placeholder="Choisir..."
              />
            )}
          </div>
        </div>
      </div>

      {/* Modal Create Customer */}
      {showNewCustomerModal && (
        <CreateCustomerModal
          onClose={() => setShowNewCustomerModal(false)}
          onCustomerCreated={handleCustomerCreated}
        />
      )}

      {/* Modal Edit Customer */}
      {showEditCustomerModal && selectedCustomer && (
        <EditCustomerModal
          customer={selectedCustomer}
          onClose={() => setShowEditCustomerModal(false)}
          onCustomerUpdated={() => {
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
