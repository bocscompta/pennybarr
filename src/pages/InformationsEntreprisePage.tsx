import { useState, useEffect } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'

interface FiscalYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  is_closed: boolean
}

interface InformationsEntreprisePageProps {
  onNavigate?: (page: string) => void
}

type InfoTab = 'general' | 'tenue-comptable' | 'fiscal' | 'repartition-capital' | 'filiales' | 'evaluation-risques' | 'actions'

export default function InformationsEntreprisePage({ onNavigate }: InformationsEntreprisePageProps) {
  const [currentInfoTab, setCurrentInfoTab] = useState<InfoTab>('general')
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [showNewFiscalYearModal, setShowNewFiscalYearModal] = useState(false)

  // Company info state
  const [companyInfo, setCompanyInfo] = useState({
    raison_sociale: 'Mon Entreprise',
    nom_commercial: '',
    siren: '000000000',
    capital_social: '1000,00',
    forme_juridique: '5710 - SAS, société par actions simplifiée',
    numero_tva: 'FR54000000000',
    adresse: '',
    code_postal: '',
    ville: ''
  })

  // Fiscal config state
  const [fiscalConfig, setFiscalConfig] = useState({
    categorie_fiscale: 'Société à l\'IS',
    regime_fiscal: 'Régime réel simplifié',
    frequence_tva: 'Annuelle',
    date_limite_acomptes: '21',
    rof_tva: 'TVA1',
    date_assujettissement_tva: '30/04/2024',
    regime_tva_debits: false,
    oga: false
  })

  useEffect(() => {
    fetchFiscalYears()
  }, [])

  const fetchFiscalYears = async () => {
    const { data } = await supabase
      .from('fiscal_years')
      .select('*')
      .order('start_date', { ascending: false })
    if (data) setFiscalYears(data)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR')
  }

  const infoTabs = [
    { id: 'general', label: 'Général' },
    { id: 'tenue-comptable', label: 'Tenue comptable' },
    { id: 'fiscal', label: 'Fiscal' },
    { id: 'repartition-capital', label: 'Répartition du capital' },
    { id: 'filiales', label: 'Filiales et participations' },
    { id: 'evaluation-risques', label: 'Évaluation des risques', badge: 'Nouv.' },
    { id: 'actions', label: 'Actions' },
  ]

  // Tab: Général
  const renderGeneralTab = () => (
    <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
      <h3 className="font-medium mb-6" style={{ color: '#141A1F' }}>Informations</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Raison sociale</label>
          <input
            type="text"
            value={companyInfo.raison_sociale}
            onChange={(e) => setCompanyInfo({ ...companyInfo, raison_sociale: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB' }}
          />
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Nom commercial</label>
          <input
            type="text"
            value={companyInfo.nom_commercial}
            onChange={(e) => setCompanyInfo({ ...companyInfo, nom_commercial: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB' }}
            placeholder="Nom commercial"
          />
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>SIREN</label>
          <input
            type="text"
            value={companyInfo.siren}
            onChange={(e) => setCompanyInfo({ ...companyInfo, siren: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50"
            style={{ borderColor: '#D6D9DB' }}
            readOnly
          />
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Capital social</label>
          <div className="relative">
            <input
              type="text"
              value={companyInfo.capital_social}
              onChange={(e) => setCompanyInfo({ ...companyInfo, capital_social: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm pr-8"
              style={{ borderColor: '#D6D9DB' }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6C767F' }}>€</span>
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Forme juridique</label>
          <select
            value={companyInfo.forme_juridique}
            onChange={(e) => setCompanyInfo({ ...companyInfo, forme_juridique: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB' }}
          >
            <option value="5710 - SAS, société par actions simplifiée">5710 - SAS, société par actions simplifiée</option>
            <option value="5720 - SASU">5720 - SASU</option>
            <option value="5499 - SARL">5499 - SARL</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Numéro de TVA</label>
          <input
            type="text"
            value={companyInfo.numero_tva}
            onChange={(e) => setCompanyInfo({ ...companyInfo, numero_tva: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50"
            style={{ borderColor: '#D6D9DB' }}
            readOnly
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Adresse</label>
            <input
              type="text"
              value={companyInfo.adresse}
              onChange={(e) => setCompanyInfo({ ...companyInfo, adresse: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Code postal</label>
            <input
              type="text"
              value={companyInfo.code_postal}
              onChange={(e) => setCompanyInfo({ ...companyInfo, code_postal: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Ville</label>
            <input
              type="text"
              value={companyInfo.ville}
              onChange={(e) => setCompanyInfo({ ...companyInfo, ville: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#006666' }}
        >
          Enregistrer
        </button>
      </div>
    </div>
  )

  // Tab: Tenue comptable
  const renderTenueComptableTab = () => (
    <div className="space-y-6">
      {/* Figer et valider la comptabilité */}
      <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
        <h3 className="font-medium mb-4" style={{ color: '#141A1F' }}>Figer et valider la comptabilité</h3>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="text-sm" style={{ color: '#6C767F' }}>La comptabilité n'est pas figée</span>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm" style={{ borderColor: '#006666', color: '#006666' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
            Modifier la période sélectionnée
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" style={{ color: '#16A34A' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-sm" style={{ color: '#6C767F' }}>Dernière date de validation de la comptabilité :</span>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm" style={{ borderColor: '#006666', color: '#006666' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
            Valider à une nouvelle date
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-white rounded-lg border p-4 flex items-center gap-3" style={{ borderColor: '#E4E5E7' }}>
        <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <span className="text-sm" style={{ color: '#6C767F' }}>Besoin d'aide ?</span>
        <a href="#" className="text-sm underline" style={{ color: '#006666' }}>
          Comprendre la clôture et la validation des écritures
        </a>
      </div>

      {/* Exercices comptables */}
      <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
        <h3 className="font-medium mb-4" style={{ color: '#141A1F' }}>Exercices comptables</h3>
        <button
          onClick={() => setShowNewFiscalYearModal(true)}
          className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg text-sm font-medium transition-colors hover:bg-gray-50"
          style={{ borderColor: '#006666', color: '#006666' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Ajouter un exercice comptable
        </button>

        <div className="space-y-3">
          {fiscalYears.map((fy) => (
            <div
              key={fy.id}
              className="flex items-center justify-between p-4 rounded-lg border"
              style={{
                borderColor: fy.is_current ? '#006666' : '#E4E5E7',
                backgroundColor: fy.is_current ? '#F0F7F7' : 'white'
              }}
            >
              <div className="flex items-center gap-4">
                {fy.is_current && (
                  <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                    En cours
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <span className="text-sm" style={{ color: '#141A1F' }}>{formatDate(fy.start_date)}</span>
                </div>
                <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <span className="text-sm" style={{ color: '#141A1F' }}>{formatDate(fy.end_date)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {fy.is_current && (
                  <button className="text-xs px-3 py-1.5 border rounded-lg font-medium" style={{ borderColor: '#006666', color: '#006666' }}>
                    Clôturer
                  </button>
                )}
                <button className="p-1.5 rounded hover:bg-gray-100 text-red-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button className="text-sm flex items-center gap-1" style={{ color: '#006666' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Historique
          </button>
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#006666' }}
          >
            Enregistrer
          </button>
        </div>
      </div>

      {/* Informations */}
      <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
        <h3 className="font-medium mb-6" style={{ color: '#141A1F' }}>Informations</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 border rounded-lg" style={{ borderColor: '#E4E5E7' }}>
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
            <div>
              <div className="text-xs" style={{ color: '#6C767F' }}>Type de comptabilité</div>
              <div className="font-medium text-sm" style={{ color: '#141A1F' }}>Comptabilité d'engagement</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Statut de la reprise</label>
              <select className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB' }}>
                <option>Reprise à faire</option>
                <option>Reprise en cours</option>
                <option>Reprise terminée</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Date de reprise</label>
              <input type="date" className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Date de lettre de mission</label>
            <input type="date" defaultValue="2025-03-30" className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB' }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Solution de paie</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB' }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Outil de facturation</label>
              <select className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB' }}>
                <option>Choisir...</option>
                <option>Pennylane</option>
                <option>Autre</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#006666' }}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )

  // Tab: Fiscal
  const renderFiscalTab = () => (
    <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
      <h3 className="font-medium mb-6" style={{ color: '#141A1F' }}>Configuration</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Catégorie fiscale</label>
            <select
              value={fiscalConfig.categorie_fiscale}
              onChange={(e) => setFiscalConfig({ ...fiscalConfig, categorie_fiscale: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            >
              <option>Société à l'IS</option>
              <option>Société à l'IR</option>
              <option>Auto-entrepreneur</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Régime fiscal</label>
            <select
              value={fiscalConfig.regime_fiscal}
              onChange={(e) => setFiscalConfig({ ...fiscalConfig, regime_fiscal: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            >
              <option>Régime réel simplifié</option>
              <option>Régime réel normal</option>
              <option>Micro-entreprise</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={fiscalConfig.oga}
            onChange={(e) => setFiscalConfig({ ...fiscalConfig, oga: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm" style={{ color: '#141A1F' }}>Ajouter un Organisme de Gestion Agréé (OGA)</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Fréquence TVA</label>
            <select
              value={fiscalConfig.frequence_tva}
              onChange={(e) => setFiscalConfig({ ...fiscalConfig, frequence_tva: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            >
              <option>Annuelle</option>
              <option>Trimestrielle</option>
              <option>Mensuelle</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Date limite des acomptes de TVA</label>
            <input
              type="text"
              value={fiscalConfig.date_limite_acomptes}
              onChange={(e) => setFiscalConfig({ ...fiscalConfig, date_limite_acomptes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>ROF TVA</label>
            <select
              value={fiscalConfig.rof_tva}
              onChange={(e) => setFiscalConfig({ ...fiscalConfig, rof_tva: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            >
              <option>TVA1</option>
              <option>TVA2</option>
              <option>TVA3</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Date à partir de laquelle l'entreprise est assujettie à la TVA</label>
            <input
              type="date"
              defaultValue="2024-04-30"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={fiscalConfig.regime_tva_debits}
            onChange={(e) => setFiscalConfig({ ...fiscalConfig, regime_tva_debits: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm" style={{ color: '#141A1F' }}>Option du régime de la TVA sur les débits</span>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button className="px-4 py-2 rounded-lg text-sm font-medium text-white opacity-50" style={{ backgroundColor: '#006666' }} disabled>
          Enregistrer
        </button>
      </div>
    </div>
  )

  // Tab: Répartition du capital
  const renderRepartitionCapitalTab = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-48 h-48 mb-6 opacity-50 flex items-center justify-center bg-gray-100 rounded-full">
        <svg className="w-24 h-24" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium mb-2" style={{ color: '#141A1F' }}>
        Paramétrez la répartition du capital pour visualiser la liste d'actionnaires.
      </h3>
      <p className="text-sm text-center mb-6 max-w-md" style={{ color: '#6C767F' }}>
        Vous pourrez suivre l'évolution de l'actionnariat entre vos exercices comptables, et commencer à compléter votre liasse dès maintenant !
      </p>
      <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#006666' }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Paramétrer
      </button>
    </div>
  )

  // Tab: Filiales et participations
  const renderFilialesTab = () => (
    <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
      <h3 className="font-medium mb-6" style={{ color: '#141A1F' }}>Filiales et participations de l'entreprise</h3>
      <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6C767F' }}>Nom filiale</th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6C767F' }}>Forme juridique</th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6C767F' }}>SIREN</th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6C767F' }}>Pourcentage détenu</th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6C767F' }}>Outil comptable</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: '#6C767F' }}>
                Vous n'avez pas encore ajouté de filiales ou de participations
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <button className="mt-4 flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium" style={{ borderColor: '#006666', color: '#006666' }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Ajouter Filiale
      </button>
    </div>
  )

  // Tab: Évaluation des risques
  const renderEvaluationRisquesTab = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-32 h-32 mb-6 rounded-full bg-gray-100 flex items-center justify-center">
        <svg className="w-16 h-16" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium mb-2" style={{ color: '#141A1F' }}>Aucun formulaire à afficher</h3>
      <p className="text-sm mb-6" style={{ color: '#6C767F' }}>Aucun formulaire n'a encore été créé.</p>
      <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#006666' }}>
        Créer un formulaire
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>
  )

  // Tab: Actions
  const renderActionsTab = () => (
    <div className="space-y-6">
      {/* Archivage */}
      <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
        <h3 className="font-medium mb-4" style={{ color: '#141A1F' }}>Archivage ou restauration multiple</h3>
        <p className="text-sm mb-4" style={{ color: '#6C767F' }}>
          Archivez ou restaurez ci-dessous des transactions ou factures de l'entreprise sur une période donnée selon leur date comptable
          (Ex : pour la période 2021, une facture du 01/01/2021 ajoutée le 01/01/2022 sera archivée).
        </p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Début</label>
            <input
              type="date"
              placeholder="JJ/MM/AAAA"
              className="w-full px-3 py-2 border rounded-lg text-sm border-red-300"
            />
            <span className="text-xs text-red-500">Ce champ est requis</span>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Fin</label>
            <input
              type="date"
              placeholder="JJ/MM/AAAA"
              className="w-full px-3 py-2 border rounded-lg text-sm border-red-300"
            />
            <span className="text-xs text-red-500">Ce champ est requis</span>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm mb-2" style={{ color: '#6C767F' }}>Écritures concernées :</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: '#141A1F' }}>Transactions bancaires</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: '#141A1F' }}>Factures fournisseurs</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: '#141A1F' }}>Factures clients</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#DC2626' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            Archiver
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: '#006666', color: '#006666' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Restaurer
          </button>
        </div>
      </div>

      {/* Suppression */}
      <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
        <h3 className="font-medium mb-4" style={{ color: '#141A1F' }}>Suppression multiple</h3>
        <p className="text-sm mb-4" style={{ color: '#6C767F' }}>
          Supprimez définitivement ci-dessous des écritures de l'entreprise sur une période donnée selon leur date
          (Ex : pour la période 2021, une opération diverse au 01/01/2021 saisie le 01/01/2022 sera définitivement supprimée).
        </p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Début</label>
            <input
              type="date"
              placeholder="JJ/MM/AAAA"
              className="w-full px-3 py-2 border rounded-lg text-sm border-red-300"
            />
            <span className="text-xs text-red-500">Ce champ est requis</span>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Fin</label>
            <input
              type="date"
              placeholder="JJ/MM/AAAA"
              className="w-full px-3 py-2 border rounded-lg text-sm border-red-300"
            />
            <span className="text-xs text-red-500">Ce champ est requis</span>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm mb-2" style={{ color: '#6C767F' }}>Écritures concernées :</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: '#141A1F' }}>Factures fournisseurs archivées</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: '#141A1F' }}>Factures clients archivées</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: '#141A1F' }}>Opérations Diverses (OD)</span>
            </label>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white opacity-50" style={{ backgroundColor: '#DC2626' }} disabled>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Supprimer
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header - Full width like Pennylane */}
      <header className="bg-white px-8 pt-6 pb-0 border-b" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => onNavigate?.('accueil')}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>Informations entreprise</h1>
        </div>
        <p className="text-sm mb-4 ml-9" style={{ color: '#6C767F' }}>
          Vérifiez et mettez à jour les informations clés de l'entreprise pour sa gestion et sa comptabilité.
        </p>

        {/* Tabs */}
        <nav className="flex gap-1 -mx-8 px-8" style={{ marginBottom: '-1px' }}>
          {infoTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentInfoTab(tab.id as InfoTab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                currentInfoTab === tab.id
                  ? 'border-[#006666] text-[#006666]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.badge && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </header>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl">
          {currentInfoTab === 'general' && renderGeneralTab()}
          {currentInfoTab === 'tenue-comptable' && renderTenueComptableTab()}
          {currentInfoTab === 'fiscal' && renderFiscalTab()}
          {currentInfoTab === 'repartition-capital' && renderRepartitionCapitalTab()}
          {currentInfoTab === 'filiales' && renderFilialesTab()}
          {currentInfoTab === 'evaluation-risques' && renderEvaluationRisquesTab()}
          {currentInfoTab === 'actions' && renderActionsTab()}
        </div>
      </div>

      {/* New Fiscal Year Modal */}
      {showNewFiscalYearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowNewFiscalYearModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>Nouvel exercice comptable</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const form = e.target as HTMLFormElement
              const formData = new FormData(form)
              await supabase.from('fiscal_years').insert({
                company_id: COMPANY_ID,
                name: formData.get('name'),
                start_date: formData.get('start_date'),
                end_date: formData.get('end_date'),
                is_current: false,
                is_closed: false
              })
              fetchFiscalYears()
              setShowNewFiscalYearModal(false)
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Nom de l'exercice</label>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="Ex: Exercice 2029"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date de début</label>
                    <input
                      name="start_date"
                      type="date"
                      required
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Date de fin</label>
                    <input
                      name="end_date"
                      type="date"
                      required
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewFiscalYearModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium"
                  style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: '#006666' }}
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
