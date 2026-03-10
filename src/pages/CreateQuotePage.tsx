import { useState, useEffect, useMemo } from 'react'
import type { CreateInvoiceFormData } from '../types/invoiceForm'
import type { BankAccount, Product } from '../types/database'
import { useCustomers, useBankAccounts } from '../hooks/useSupabase'
import { useCompanyInfo } from '../hooks/useCompanyInfo'
import { supabase, COMPANY_ID } from '../lib/supabase'
import { generateDevisNumber, createDevis, type DevisLineInput } from '../services/devisService'
import { calculateInvoiceTotals } from '../services/invoiceCreationService'
import InvoiceLinesTable, { createEmptyLine } from '../components/invoice/InvoiceLinesTable'
import InvoiceTotalsBlock from '../components/invoice/InvoiceTotalsBlock'
import InvoiceSidebar from '../components/invoice/InvoiceSidebar'
import CreateCustomerModal from '../components/CreateCustomerModal'
import EditCustomerModal from '../components/EditCustomerModal'

interface CreateQuotePageProps {
  onNavigate: (page: string) => void
  returnTo?: string
}

function createInitialFormData(): CreateInvoiceFormData {
  const today = new Date().toISOString().split('T')[0]
  const validityDate = new Date()
  validityDate.setDate(validityDate.getDate() + 30)

  return {
    customerId: null,
    customerName: '',
    invoiceNumber: '',
    invoiceDate: today,
    dueDate: validityDate.toISOString().split('T')[0],
    saleType: 'services',
    description: '',
    documentTitle: undefined,
    documentDescription: undefined,
    customFields: [],
    sections: [],
    lines: [createEmptyLine()],
    paymentTermsDays: 30,
    paymentMethods: {
      virement: true,
      carte: false,
      prelevement: false,
      cheque: false,
      especes: false,
    },
    bankAccountId: undefined,
    currency: 'EUR',
  }
}

export default function CreateQuotePage({ onNavigate, returnTo = 'devis' }: CreateQuotePageProps) {
  const [formData, setFormData] = useState<CreateInvoiceFormData>(createInitialFormData())
  const [products, setProducts] = useState<Product[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { customers } = useCustomers()
  const { accounts: bankAccounts } = useBankAccounts()
  const { companyInfo } = useCompanyInfo(COMPANY_ID)

  // Load products + quote number on mount
  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true)
      .order('code')
      .then(({ data, error: err }) => {
        if (err) {
          console.error('Error loading products:', err)
          throw new Error(`Erreur chargement produits: ${err.message}`)
        }
        if (!data) {
          throw new Error('Produits introuvables')
        }
        setProducts(data)
      })
      .catch((err) => {
        console.error('Error loading products:', err)
        setError(err.message)
      })

    generateDevisNumber()
      .then((num) => setFormData((prev) => ({ ...prev, invoiceNumber: num })))
      .catch((err) => {
        console.error('Error generating quote number:', err)
        setError(`Erreur generation numero: ${err.message}`)
      })
  }, [])

  // Set default bank account
  useEffect(() => {
    if (bankAccounts.length > 0 && !formData.bankAccountId) {
      setFormData((prev) => ({ ...prev, bankAccountId: bankAccounts[0].id }))
    }
  }, [bankAccounts])

  const totals = useMemo(() => calculateInvoiceTotals(formData.lines), [formData.lines])

  const updateFormData = (updates: Partial<CreateInvoiceFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  const handleSubmit = async (status: 'draft' | 'sent') => {
    setError(null)
    setIsSubmitting(true)
    try {
      // Validate
      if (!formData.customerId) {
        throw new Error('Le client est requis')
      }
      if (!formData.invoiceNumber.trim()) {
        throw new Error('Le numero de devis est requis')
      }
      if (formData.lines.length === 0) {
        throw new Error('Le devis doit contenir au moins une ligne')
      }

      // Convert to devis format
      const devisLines: DevisLineInput[] = formData.lines.map(line => ({
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPriceHT: line.unitPriceHT,
        vatRate: line.vatRate,
        discountPercent: line.discountPercent
      }))

      await createDevis({
        customerId: formData.customerId,
        number: formData.invoiceNumber,
        date: formData.invoiceDate,
        validityDate: formData.dueDate,
        notes: formData.description || null,
        lines: devisLines
      })

      onNavigate(returnTo)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error creating quote:', err)
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
        <h1 className="text-base font-semibold text-gray-900">Créez un devis</h1>
        <button
          onClick={() => onNavigate(returnTo)}
          className="p-1 rounded hover:bg-gray-100"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: document preview */}
        <div className="flex-1 overflow-y-auto p-6">
          <div
            className="bg-white rounded-lg shadow-sm border border-gray-200 w-full px-10 py-8"
            style={{ maxWidth: '1100px' }}
          >
            <QuoteHeader
              formData={formData}
              customers={customers}
              companyInfo={companyInfo}
              onUpdate={updateFormData}
            />

            <InvoiceLinesTable
              lines={formData.lines}
              products={products}
              sections={formData.sections}
              onLinesChange={(lines) => updateFormData({ lines })}
              onSectionsChange={(sections) => updateFormData({ sections })}
            />

            {/* Totals inline */}
            <div className="mt-6 flex justify-end">
              <div className="w-64">
                <InvoiceTotalsBlock totals={totals} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="overflow-y-auto py-6 pr-6 flex-shrink-0">
          <InvoiceSidebar
            formData={formData}
            bankAccounts={bankAccounts as BankAccount[]}
            onUpdate={updateFormData}
          />
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-3 mx-auto" style={{ maxWidth: '1100px' }}>
          <button
            type="button"
            disabled
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border cursor-not-allowed"
            style={{ borderColor: '#0D9488', color: '#0D9488', opacity: 0.5 }}
          >
            Aperçu PDF
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('draft')}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border disabled:opacity-50"
            style={{ borderColor: '#0D9488', color: '#0D9488' }}
          >
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer comme brouillon'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('sent')}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#0D9488' }}
          >
            {isSubmitting ? 'Envoi...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ Quote Header (adapted from InvoiceHeader) ============

interface QuoteHeaderProps {
  formData: CreateInvoiceFormData
  customers: any[]
  companyInfo: any
  onUpdate: (updates: Partial<CreateInvoiceFormData>) => void
}

function QuoteHeader({ formData, customers, companyInfo, onUpdate }: QuoteHeaderProps) {
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false)
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false)
  const [editingCustomField, setEditingCustomField] = useState<string | null>(null)

  const handleCustomerSelect = (customerId: string) => {
    if (customerId === '__create__') {
      setShowNewCustomerModal(true)
      return
    }
    const customer = customers.find(c => c.id === customerId)
    onUpdate({
      customerId: customerId || null,
      customerName: customer?.name || ''
    })
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
    const newField = {
      id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: '',
      value: ''
    }
    onUpdate({ customFields: [...formData.customFields, newField] })
    setEditingCustomField(newField.id)
  }

  const handleUpdateCustomField = (id: string, updates: any) => {
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

          {/* Devis info - directly under logo */}
          <div>
            <h2 className="text-base text-gray-400 mb-2">Devis</h2>

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

              {/* Date d'écheance */}
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
                  onChange={(e) => onUpdate({ saleType: e.target.value as any })}
                  className="text-sm border border-gray-200 rounded px-2 py-1 pr-6 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
                  style={{ color: '#374151' }}
                >
                  <option value="services">Prestations de services</option>
                  <option value="goods">Livraisons de biens</option>
                  <option value="both">Les deux</option>
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
                  onClick={() => onUpdate({ documentTitle: undefined })}
                  className="p-0.5 hover:bg-gray-100 rounded"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => onUpdate({ documentTitle: '' })}
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
                  onClick={() => onUpdate({ documentDescription: undefined })}
                  className="p-0.5 hover:bg-gray-100 rounded self-start"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => onUpdate({ documentDescription: '' })}
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
              <select
                value={formData.customerId || ''}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
                style={{ color: '#374151' }}
              >
                <option value="">Choisir...</option>
                <option value="__create__" style={{ color: '#006666' }}>+ Créer un client</option>
                <option disabled>──────────</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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
