import { useState } from 'react'
import { useCurrentCompany } from '../hooks/useCurrentCompany'
import ConfigurationTab from '../components/invoice-settings/ConfigurationTab'
import PersonalisationTab from '../components/invoice-settings/PersonalisationTab'
import PaiementsTab from '../components/invoice-settings/PaiementsTab'
import EmailsAnnexesTab from '../components/invoice-settings/EmailsAnnexesTab'
import RelancesTab from '../components/invoice-settings/RelancesTab'

interface ParametresFacturesClientsPageProps {
  onNavigate?: (page: string) => void
}

type Tab = 'configuration' | 'personnalisation' | 'paiements' | 'emails' | 'relances'

export default function ParametresFacturesClientsPage({
  onNavigate
}: ParametresFacturesClientsPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('configuration')
  const { companyId, loading: companyLoading, error: companyError } = useCurrentCompany()

  const tabs = [
    { id: 'configuration' as Tab, label: 'Configuration' },
    { id: 'personnalisation' as Tab, label: 'Personnalisation' },
    { id: 'paiements' as Tab, label: 'Paiements' },
    { id: 'emails' as Tab, label: 'Emails et annexes' },
    { id: 'relances' as Tab, label: 'Relances automatiques' }
  ]

  if (companyLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-stone-600" />
      </div>
    )
  }

  if (companyError || !companyId) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <p className="text-sm text-red-700">
            {companyError || 'Impossible de récupérer les informations de l\'entreprise'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => onNavigate?.('parametres')}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-5 h-5"
              style={{ color: '#6C767F' }}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
              Facturation client
            </h1>
            <p className="text-sm" style={{ color: '#6C767F' }}>
              Paramétrez toute votre facturation client, des modèles de factures aux méthodes de
              paiement.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="pb-2 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: activeTab === tab.id ? '#006666' : 'transparent',
                color: activeTab === tab.id ? '#006666' : '#6C767F'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Tab Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'configuration' && companyId && <ConfigurationTab companyId={companyId} />}
        {activeTab === 'personnalisation' && companyId && (
          <PersonalisationTab companyId={companyId} />
        )}
        {activeTab === 'paiements' && companyId && <PaiementsTab companyId={companyId} />}
        {activeTab === 'emails' && companyId && <EmailsAnnexesTab companyId={companyId} />}
        {activeTab === 'relances' && companyId && <RelancesTab companyId={companyId} />}
      </div>
    </div>
  )
}
