import { useState, useEffect } from 'react'
import { useInvoiceSettings } from '../../hooks/useInvoiceSettings'
import { supabase } from '../../lib/supabase'
import PaymentMethodCard from './PaymentMethodCard'
import { SEPA_MODE_LABELS, type SepaMode } from '../../types/invoiceSettings'

interface PaiementsTabProps {
  companyId: string
}

interface BankAccount {
  id: string
  name: string
  iban: string
  bic: string
}

export default function PaiementsTab({ companyId }: PaiementsTabProps) {
  const { paymentConfig, loading, error, updatePaymentConfig } = useInvoiceSettings(companyId)

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('')

  // Form state pour Virements
  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [paymentTermsDays, setPaymentTermsDays] = useState(30)
  const [showPaymentOption, setShowPaymentOption] = useState(true)
  const [hasFactoring, setHasFactoring] = useState(false)
  const [savingTransfer, setSavingTransfer] = useState(false)

  // State pour SEPA
  const [sepaEnabled, setSepaEnabled] = useState(false)
  const [sepaMode, setSepaMode] = useState<SepaMode>('manual')

  // State pour Stripe
  const [stripeEnabled, setStripeEnabled] = useState(false)

  // State pour Chèques
  const [checksEnabled, setChecksEnabled] = useState(true)

  useEffect(() => {
    if (paymentConfig) {
      setIban(paymentConfig.iban || '')
      setBic(paymentConfig.bic || '')
      setPaymentTermsDays(paymentConfig.default_payment_terms_days)
      setShowPaymentOption(paymentConfig.show_payment_option)
      setHasFactoring(paymentConfig.has_factoring)
      setSepaEnabled(paymentConfig.sepa_enabled)
      setSepaMode(paymentConfig.sepa_mode)
      setStripeEnabled(paymentConfig.stripe_enabled)
      setChecksEnabled(paymentConfig.checks_enabled)
    }
  }, [paymentConfig])

  useEffect(() => {
    async function fetchBankAccounts() {
      try {
        const { data, error } = await supabase
          .from('bank_accounts')
          .select('id, name, iban, bic')
          .eq('company_id', companyId)

        if (error) {
          console.error('Failed to fetch bank accounts:', error)
          return
        }

        setBankAccounts(data || [])
      } catch (err) {
        console.error('Error fetching bank accounts:', err)
      }
    }

    fetchBankAccounts()
  }, [companyId])

  const handleBankAccountChange = (accountId: string) => {
    setSelectedBankAccountId(accountId)
    const account = bankAccounts.find(a => a.id === accountId)
    if (account) {
      setIban(account.iban)
      setBic(account.bic)
    }
  }

  const handleSaveTransfer = async () => {
    try {
      setSavingTransfer(true)
      await updatePaymentConfig({
        iban,
        bic,
        default_payment_terms_days: paymentTermsDays,
        show_payment_option: showPaymentOption,
        has_factoring: hasFactoring
      })
    } catch (err) {
      console.error('Failed to save transfer config:', err)
    } finally {
      setSavingTransfer(false)
    }
  }

  const handleToggleSepa = async (enabled: boolean) => {
    setSepaEnabled(enabled)
    try {
      await updatePaymentConfig({ sepa_enabled: enabled })
    } catch (err) {
      console.error('Failed to toggle SEPA:', err)
      setSepaEnabled(!enabled)
    }
  }

  const handleToggleStripe = async (enabled: boolean) => {
    setStripeEnabled(enabled)
    try {
      await updatePaymentConfig({ stripe_enabled: enabled })
    } catch (err) {
      console.error('Failed to toggle Stripe:', err)
      setStripeEnabled(!enabled)
    }
  }

  const handleToggleChecks = async (enabled: boolean) => {
    setChecksEnabled(enabled)
    try {
      await updatePaymentConfig({ checks_enabled: enabled })
    } catch (err) {
      console.error('Failed to toggle checks:', err)
      setChecksEnabled(!enabled)
    }
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!paymentConfig) {
    return (
      <div className="max-w-4xl">
        <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
          <p className="text-sm" style={{ color: '#6C767F' }}>
            Configuration de paiement non trouvée
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Section 1: Virements */}
      <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
        <div className="mb-6">
          <h3 className="text-base font-medium mb-2" style={{ color: '#141A1F' }}>
            Virements
          </h3>
          <p className="text-sm" style={{ color: '#6C767F' }}>
            Configurez vos coordonnées bancaires pour recevoir des virements.{' '}
            <a href="#" className="text-stone-600 hover:underline">
              En savoir plus
            </a>
          </p>
        </div>

        <div className="space-y-4">
          {/* Ligne 1: Établissement bancaire + IBAN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                Établissement bancaire
              </label>
              <select
                value={selectedBankAccountId}
                onChange={e => handleBankAccountChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              >
                <option value="">Choisir un compte bancaire</option>
                {bankAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                IBAN
              </label>
              <input
                type="text"
                value={iban}
                onChange={e => setIban(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                placeholder="FR76 1234 5678 9012 3456 7890 123"
              />
            </div>
          </div>

          {/* Ligne 2: BIC + Conditions de paiement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                BIC
              </label>
              <input
                type="text"
                value={bic}
                onChange={e => setBic(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                placeholder="BNPAFRPPXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>
                Conditions de paiement
              </label>
              <select
                value={paymentTermsDays}
                onChange={e => setPaymentTermsDays(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
              >
                <option value={0}>Comptant</option>
                <option value={15}>Paiement sous 15 jours</option>
                <option value={30}>Paiement sous 30 jours</option>
                <option value={45}>Paiement sous 45 jours</option>
                <option value={60}>Paiement sous 60 jours</option>
              </select>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasFactoring}
                onChange={e => setHasFactoring(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-stone-600 focus:ring-stone-400"
              />
              <span className="text-sm" style={{ color: '#141A1F' }}>
                Présence d'une société d'affacturage
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showPaymentOption}
                onChange={e => setShowPaymentOption(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-stone-600 focus:ring-stone-400"
              />
              <span className="text-sm" style={{ color: '#141A1F' }}>
                Ajouter l'option "Payer" sur la facture
              </span>
            </label>
          </div>

          {/* Bouton Sauvegarder */}
          <div className="pt-2">
            <button
              onClick={handleSaveTransfer}
              disabled={savingTransfer}
              className="px-4 py-2 bg-stone-600 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingTransfer ? 'Enregistrement...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Prélèvement SEPA */}
      <PaymentMethodCard
        title="Prélèvement"
        description="Activez les prélèvements SEPA pour encaisser vos clients automatiquement."
        enabled={sepaEnabled}
        onToggle={handleToggleSepa}
        learnMoreLink="#"
        badge={sepaEnabled ? SEPA_MODE_LABELS[sepaMode] : undefined}
      />

      {/* Section 3: Carte bancaire (Stripe) */}
      <PaymentMethodCard
        title="Carte bancaire"
        description="Permettez à vos clients de payer par carte bancaire via Stripe."
        enabled={stripeEnabled}
        onToggle={handleToggleStripe}
        learnMoreLink="#"
        badge={stripeEnabled ? 'Stripe' : undefined}
      />

      {/* Section 4: Chèques */}
      <PaymentMethodCard
        title="Chèques"
        description="Acceptez les paiements par chèque. Cette méthode est activée par défaut."
        enabled={checksEnabled}
        onToggle={handleToggleChecks}
        learnMoreLink="#"
        badge={checksEnabled ? 'Actif' : undefined}
      />
    </div>
  )
}
