import { useState, useEffect, useMemo } from 'react'
import type { CreateInvoiceFormData } from '../types/invoiceForm'
import type { BankAccount, Product } from '../types/database'
import { useCustomers, useBankAccounts } from '../hooks/useSupabase'
import { supabase, COMPANY_ID } from '../lib/supabase'
import { generateInvoiceNumber, calculateInvoiceTotals, createInvoiceWithLines } from '../services/invoiceCreationService'
import InvoiceHeader from '../components/invoice/InvoiceHeader'
import InvoiceLinesTable, { createEmptyLine } from '../components/invoice/InvoiceLinesTable'
import InvoiceTotalsBlock from '../components/invoice/InvoiceTotalsBlock'
import InvoiceSidebar from '../components/invoice/InvoiceSidebar'

interface CreateInvoicePageProps {
  onNavigate: (page: string) => void
  returnTo?: string // Page vers laquelle retourner (dashboard ou factures-clients)
}

function createInitialFormData(): CreateInvoiceFormData {
  const today = new Date().toISOString().split('T')[0]
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  return {
    customerId: null,
    customerName: '',
    invoiceNumber: '',
    invoiceDate: today,
    dueDate: dueDate.toISOString().split('T')[0],
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

export default function CreateInvoicePage({ onNavigate, returnTo = 'factures-clients' }: CreateInvoicePageProps) {
  const [formData, setFormData] = useState<CreateInvoiceFormData>(createInitialFormData())
  const [products, setProducts] = useState<Product[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { customers } = useCustomers()
  const { accounts: bankAccounts } = useBankAccounts()

  // Load products + invoice number on mount
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

    generateInvoiceNumber()
      .then((num) => setFormData((prev) => ({ ...prev, invoiceNumber: num })))
      .catch((err) => {
        console.error('Error generating invoice number:', err)
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
      await createInvoiceWithLines(formData, status)
      onNavigate(returnTo)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error creating invoice:', err)
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
        <h1 className="text-base font-semibold text-gray-900">Creez une facture</h1>
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
            <InvoiceHeader
              formData={formData}
              customers={customers}
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
            Apercu PDF
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
            {isSubmitting ? 'Finalisation...' : 'Finaliser'}
          </button>
        </div>
      </div>
    </div>
  )
}
