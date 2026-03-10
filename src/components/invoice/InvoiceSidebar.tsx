import { useState } from 'react'
import type { CreateInvoiceFormData } from '../../types/invoiceForm'
import type { BankAccount } from '../../types/database'

interface InvoiceSidebarProps {
  formData: CreateInvoiceFormData
  bankAccounts: BankAccount[]
  onUpdate: (updates: Partial<CreateInvoiceFormData>) => void
}

const PAYMENT_TERMS = [
  { value: 0, label: 'Paiement comptant' },
  { value: 30, label: 'Paiement sous 30 jours' },
  { value: 45, label: 'Paiement sous 45 jours' },
  { value: 60, label: 'Paiement sous 60 jours' },
]

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  virement: 'Virement bancaire',
  carte: 'Carte bancaire',
  prelevement: 'Prelevement',
  cheque: 'Cheque',
  especes: 'Especes',
}

export default function InvoiceSidebar({ formData, bankAccounts, onUpdate }: InvoiceSidebarProps) {
  const [langueOpen, setLangueOpen] = useState(true)
  const [conditionsOpen, setConditionsOpen] = useState(true)

  const togglePaymentMethod = (method: keyof typeof formData.paymentMethods) => {
    onUpdate({
      paymentMethods: {
        ...formData.paymentMethods,
        [method]: !formData.paymentMethods[method],
      },
    })
  }

  const selectedBank = bankAccounts.find((b) => b.id === formData.bankAccountId)

  return (
    <div className="border-l border-gray-200 pl-6" style={{ minWidth: '280px', maxWidth: '320px' }}>
      {/* Collapse button */}
      <div className="flex justify-start mb-4">
        <button className="w-7 h-7 border border-gray-200 rounded flex items-center justify-center hover:bg-gray-50">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-6">Parametres</h2>

      {/* Modele de facture */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded bg-gray-900 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-gray-900">Modele de facture</span>
        </div>
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
          Les modeles vous permettent de personnaliser vos documents en maintenant une numerotation unique.{' '}
          <button className="text-teal-600 underline hover:text-teal-700">En savoir plus</button>
        </p>
        <label className="text-xs text-gray-500 block mb-1">Modele utilise</label>
        <select className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white text-gray-700">
          <option>Modele par defaut</option>
        </select>
      </div>

      {/* Langue */}
      <div className="mb-6">
        <button
          onClick={() => setLangueOpen(!langueOpen)}
          className="w-full flex items-center justify-between mb-2"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gray-900 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.148 15.08 2 17.292m6.228-4.546a48.219 48.219 0 01-1.042-.327" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">Langue</span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${langueOpen ? '' : '-rotate-90'}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {langueOpen && (
          <div>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Selectionnez la langue a utiliser et verifiez que tous les champs de votre document sont traduits.
            </p>
            <select className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white text-gray-700">
              <option>Francais</option>
              <option>English</option>
            </select>
          </div>
        )}
      </div>

      {/* Conditions de paiement */}
      <div className="mb-6">
        <button
          onClick={() => setConditionsOpen(!conditionsOpen)}
          className="w-full flex items-center justify-between mb-2"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gray-900 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">Conditions de paiement</span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${conditionsOpen ? '' : '-rotate-90'}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {conditionsOpen && (
          <div>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Ce choix est declaratif. Definissez vos moyens de paiement preferes pour cette facture.{' '}
              <button className="text-teal-600 underline hover:text-teal-700">En savoir plus</button>
            </p>

            {/* Delai */}
            <label className="text-xs text-gray-500 block mb-1">Delai de paiement</label>
            <select
              value={formData.paymentTermsDays}
              onChange={(e) => {
                const days = parseInt(e.target.value)
                if (formData.invoiceDate && days > 0) {
                  const date = new Date(formData.invoiceDate)
                  date.setDate(date.getDate() + days)
                  onUpdate({
                    paymentTermsDays: days,
                    dueDate: date.toISOString().split('T')[0],
                  })
                } else {
                  onUpdate({ paymentTermsDays: days })
                }
              }}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white text-gray-700 mb-4"
            >
              {PAYMENT_TERMS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Moyens de paiement */}
            <div className="space-y-2.5">
              {(Object.keys(formData.paymentMethods) as Array<keyof typeof formData.paymentMethods>).map((method) => (
                <label key={method} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700">{PAYMENT_METHOD_LABELS[method]}</span>
                  <button
                    type="button"
                    onClick={() => togglePaymentMethod(method)}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                      formData.paymentMethods[method] ? 'bg-teal-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                        formData.paymentMethods[method] ? 'translate-x-4' : ''
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>

            {/* Bank details if virement enabled */}
            {formData.paymentMethods.virement && bankAccounts.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <label className="text-xs text-gray-500 block mb-1">Compte bancaire</label>
                <select
                  value={formData.bankAccountId || ''}
                  onChange={(e) => onUpdate({ bankAccountId: e.target.value || undefined })}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white text-gray-700"
                >
                  <option value="">Selectionner</option>
                  {bankAccounts.map((bank) => (
                    <option key={bank.id} value={bank.id}>{bank.name}</option>
                  ))}
                </select>
                {selectedBank && (
                  <div className="mt-2 text-xs space-y-0.5 text-gray-500">
                    {selectedBank.iban && <p>IBAN: <span className="font-mono">{selectedBank.iban}</span></p>}
                    {selectedBank.bic && <p>BIC: <span className="font-mono">{selectedBank.bic}</span></p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
