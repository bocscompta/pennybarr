import { useState, useMemo, useRef, useEffect } from 'react'
import { useSuppliersWithBalance } from '../hooks/useSupabase'

interface CentreDeReglesPageProps {
  onNavigate?: (page: string) => void
  onBack?: () => void
}

// Sample rule data structure
interface CategorizationRule {
  id: string
  name: string
  accountNumber: string
  contrepartie: string | null
  tva: string | null
  categories: string[]
  autofacture: boolean
  solde: number | null
}

// Available accounts for contrepartie dropdown (Plan Comptable Général)
const availableAccounts = [
  // Classe 1 - Capitaux
  { code: '101', label: 'Capital', lines: 1 },
  { code: '1011', label: 'Capital souscrit - non appelé', lines: 0 },
  { code: '1012', label: 'Capital souscrit - appelé, non versé', lines: 0 },
  { code: '1013', label: 'Capital souscrit - appelé, versé', lines: 0 },
  { code: '102', label: 'Fonds fiduciaires', lines: 0 },
  { code: '106', label: 'Réserves', lines: 0 },
  { code: '1061', label: 'Réserve légale', lines: 0 },
  { code: '108', label: 'Compte de l\'exploitant', lines: 12 },
  { code: '119', label: 'Report à nouveau - solde débiteur', lines: 0 },
  { code: '120', label: 'Résultat de l\'exercice (bénéfice)', lines: 1 },
  { code: '129', label: 'Résultat de l\'exercice (perte)', lines: 0 },
  { code: '164', label: 'Emprunts auprès des établissements de crédit', lines: 3 },
  // Classe 2 - Immobilisations
  { code: '2154', label: 'Matériel industriel', lines: 5 },
  { code: '2183', label: 'Matériel de bureau et informatique', lines: 8 },
  { code: '2184', label: 'Mobilier', lines: 2 },
  { code: '28183', label: 'Amortissements matériel informatique', lines: 8 },
  // Classe 4 - Tiers
  { code: '401', label: 'Fournisseurs', lines: 234 },
  { code: '4011', label: 'Fournisseurs - Achats de biens et prestations', lines: 180 },
  { code: '411', label: 'Clients', lines: 156 },
  { code: '4111', label: 'Clients - Ventes de biens ou prestations', lines: 120 },
  { code: '421', label: 'Personnel - Rémunérations dues', lines: 24 },
  { code: '431', label: 'Sécurité sociale', lines: 12 },
  { code: '44564', label: 'TVA déductible sur encaissements', lines: 455 },
  { code: '44566', label: 'TVA déductible sur autres biens et services', lines: 320 },
  { code: '44571', label: 'TVA collectée', lines: 280 },
  { code: '44574', label: 'TVA collectée sur encaissements', lines: 303 },
  { code: '44530001', label: 'TVA due autoliquidée à 20%', lines: 146 },
  { code: '455', label: 'Associés - Comptes courants', lines: 8 },
  // Classe 5 - Financiers
  { code: '512', label: 'Banques', lines: 890 },
  { code: '5121', label: 'Banque - Compte courant', lines: 756 },
  { code: '530', label: 'Caisse', lines: 45 },
  // Classe 6 - Charges
  { code: '6063', label: 'Fournitures de bureau', lines: 89 },
  { code: '6064', label: 'Fournitures administratives', lines: 34 },
  { code: '6068', label: 'Autres matières et fournitures', lines: 23 },
  { code: '6135', label: 'Locations mobilières', lines: 54 },
  { code: '6152', label: 'Entretien et réparations sur biens immobiliers', lines: 12 },
  { code: '6155', label: 'Entretien et réparations sur biens mobiliers', lines: 18 },
  { code: '6157', label: 'Logiciels en ligne / SaaS développement', lines: 199 },
  { code: '6161', label: 'Assurances multirisques', lines: 6 },
  { code: '6226', label: 'Honoraires', lines: 42 },
  { code: '6227', label: 'Frais d\'actes et de contentieux', lines: 8 },
  { code: '6231', label: 'Annonces et insertions', lines: 15 },
  { code: '6234', label: 'Cadeaux à la clientèle', lines: 7 },
  { code: '6251', label: 'Voyages et déplacements', lines: 28 },
  { code: '6256', label: 'Missions', lines: 19 },
  { code: '6257', label: 'Réceptions', lines: 11 },
  { code: '6261', label: 'Frais de télécommunications', lines: 45 },
  { code: '6262', label: 'Téléphone', lines: 76 },
  { code: '627', label: 'Services bancaires et assimilés', lines: 134 },
  { code: '6411', label: 'Salaires, appointements', lines: 24 },
  { code: '6451', label: 'Cotisations à l\'URSSAF', lines: 24 },
  { code: '6611', label: 'Intérêts des emprunts et dettes', lines: 12 },
  // Classe 7 - Produits
  { code: '701', label: 'Ventes de produits finis', lines: 0 },
  { code: '706', label: 'Prestations de services', lines: 187 },
  { code: '707', label: 'Ventes de marchandises', lines: 56 },
  { code: '708', label: 'Produits des activités annexes', lines: 12 },
  { code: '7411', label: 'Subventions d\'exploitation', lines: 2 },
  { code: '761', label: 'Produits de participations', lines: 0 },
  { code: '764', label: 'Revenus des valeurs mobilières de placement', lines: 3 },
]

// Available TVA options
const tvaOptions = [
  { value: '20%', label: '20% (FR)' },
  { value: '10%', label: '10% (FR)' },
  { value: '5.5%', label: '5.5% (FR)' },
  { value: '2.1%', label: '2.1% (FR)' },
  { value: 'Autoliquidé 20%', label: 'Autoliquidé 20%' },
  { value: 'Aucune', label: 'Aucune' },
]

export default function CentreDeReglesPage({ onNavigate, onBack }: CentreDeReglesPageProps) {
  const [activeTab, setActiveTab] = useState<'transactions' | 'fournisseurs' | 'clients' | 'produits'>('fournisseurs')
  const [searchQuery, setSearchQuery] = useState('')
  const [showInfoBanner, setShowInfoBanner] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Dropdown states
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [showImportDropdown, setShowImportDropdown] = useState(false)
  const [showNouvelleRegleDropdown, setShowNouvelleRegleDropdown] = useState(false)
  const [activeContrepartieDropdown, setActiveContrepartieDropdown] = useState<string | null>(null)
  const [activeTvaDropdown, setActiveTvaDropdown] = useState<string | null>(null)
  const [contrepartieSearch, setContrepartieSearch] = useState('')

  // Side panel state for supplier (new or edit)
  const [showSupplierPanel, setShowSupplierPanel] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  // Supplier form state
  const [supplierForm, setSupplierForm] = useState({
    nom: '',
    numeroCompte: '',
    numeroTva: '',
    siret: '',
    profession: '',
    adresse: '',
    codePostal: '',
    ville: '',
    codeInsee: '',
    pays: 'France',
    iban: '',
    compteCharges: '',
    tauxTva: '',
    regleTva: 'automatique' as 'automatique' | 'debits' | 'encaissements',
    modePaiement: '',
    delaiPaiement: '',
    delaiUnite: 'jours',
    traitementAuto: false,
    autofactures: false,
    visibiliteFactures: true,
    visibiliteNotes: false,
    emails: '',
    categories: [] as string[]
  })
  const [showChargesTvaBanner, setShowChargesTvaBanner] = useState(true)
  const [showCategoriesBanner, setShowCategoriesBanner] = useState(true)
  const [chargesLines, setChargesLines] = useState([{ compte: '', tva: '' }])

  // Column customization state
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [columnsExpanded, setColumnsExpanded] = useState(true)
  const defaultColumns = [
    { id: 'selection', label: 'Sélection', visible: true },
    { id: 'nom', label: 'Nom', visible: true },
    { id: 'numeroCompte', label: 'Numéro de compte', visible: true },
    { id: 'contrepartie', label: 'Contrepartie', visible: true },
    { id: 'tva', label: 'TVA', visible: true },
    { id: 'categories', label: 'Catégories', visible: true },
    { id: 'autofacture', label: 'Autofacture', visible: true },
    { id: 'solde', label: 'Solde', visible: true },
  ]
  const [columns, setColumns] = useState(defaultColumns)
  const [tempColumns, setTempColumns] = useState(defaultColumns)

  // Refs for dropdowns
  const exportRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<HTMLDivElement>(null)
  const nouvelleRegleRef = useRef<HTMLDivElement>(null)

  // Ref for customize dropdown
  const customizeRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false)
      }
      if (importRef.current && !importRef.current.contains(event.target as Node)) {
        setShowImportDropdown(false)
      }
      if (nouvelleRegleRef.current && !nouvelleRegleRef.current.contains(event.target as Node)) {
        setShowNouvelleRegleDropdown(false)
      }
      if (customizeRef.current && !customizeRef.current.contains(event.target as Node)) {
        setShowCustomizeModal(false)
      }
      // Close contrepartie and TVA dropdowns when clicking outside
      setActiveContrepartieDropdown(null)
      setActiveTvaDropdown(null)
      setContrepartieSearch('')
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch real suppliers from Supabase with balance
  const { suppliers, loading } = useSuppliersWithBalance()

  // Rule data with editable contrepartie/tva
  const [ruleOverrides, setRuleOverrides] = useState<Record<string, { contrepartie?: string | null; tva?: string | null }>>({})

  // Active filters
  const [activeFilters, setActiveFilters] = useState<string[]>([])

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    )
  }

  // Generate rules from suppliers data
  const rules: CategorizationRule[] = useMemo(() => {
    if (!suppliers) return []

    return suppliers.map((supplier, index) => {
      // Generate account number
      const accountNumber = supplier.code || `40110${String(index).padStart(4, '0')}`

      // Determine contrepartie based on supplier name
      let contrepartie = null
      if (supplier.name.toLowerCase().includes('adobe') ||
          supplier.name.toLowerCase().includes('anthropic') ||
          supplier.name.toLowerCase().includes('black forest')) {
        contrepartie = '6157 - Logiciels'
      } else if (supplier.name.toLowerCase().includes('amazon')) {
        contrepartie = '6063'
      } else if (supplier.name.toLowerCase().includes('apple')) {
        contrepartie = supplier.name.toLowerCase().includes('retail') ? '6063 - Fournitures' : '6157 - Logiciels'
      } else if (supplier.name.toLowerCase().includes('telecom') ||
                 supplier.name.toLowerCase().includes('bouygues') ||
                 supplier.name.toLowerCase().includes('sfr') ||
                 supplier.name.toLowerCase().includes('orange')) {
        contrepartie = '6262 - Téléphone'
      } else if (supplier.name.toLowerCase().includes('bpi') ||
                 supplier.name.toLowerCase().includes('banque')) {
        contrepartie = '6135 - Locations'
      }

      // Determine TVA
      let tva = null
      if (supplier.name.toLowerCase().includes('amazon')) {
        tva = 'Autoliquidé 20%'
      } else if (contrepartie) {
        tva = '20%'
      }

      // Determine categories
      let categories: string[] = []
      if (supplier.name.toLowerCase().includes('amazon')) {
        categories = ['Ordinateur...']
      } else if (supplier.name.toLowerCase().includes('anthropic')) {
        categories = ['Logiciels &...']
      }

      // Use balance from supplier (already negative for amounts owed)
      const solde = supplier.balance || null

      return {
        id: supplier.id,
        name: supplier.name,
        accountNumber,
        contrepartie,
        tva,
        categories,
        autofacture: false,
        solde: solde !== 0 ? solde : null
      }
    })
  }, [suppliers])

  // Filter rules based on search
  const filteredRules = useMemo(() => {
    if (!searchQuery) return rules
    return rules.filter(rule =>
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.accountNumber.includes(searchQuery)
    )
  }, [rules, searchQuery])

  // Pagination
  const totalItems = filteredRules.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedRules = filteredRules.slice(startIndex, endIndex)

  // Tab counts
  const tabCounts = {
    transactions: 295,
    fournisseurs: rules.length || 107,
    clients: 20,
    produits: 11
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—'
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  return (
    <div className="h-screen bg-white w-full flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>
            )}
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>Centre de règles</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Exporter Button */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50"
                style={{ borderColor: '#006666', color: '#006666' }}
              >
                Exporter
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExportDropdown && (
                <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-50" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={() => { alert('Export Transactions'); setShowExportDropdown(false) }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                    style={{ color: '#141A1F' }}
                  >
                    Transactions
                  </button>
                  <button
                    onClick={() => { alert('Export Fournisseurs'); setShowExportDropdown(false) }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-t"
                    style={{ color: '#141A1F', borderColor: '#E4E5E7' }}
                  >
                    Fournisseurs
                  </button>
                  <button
                    onClick={() => { alert('Export Clients - Particuliers'); setShowExportDropdown(false) }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-t"
                    style={{ color: '#141A1F', borderColor: '#E4E5E7' }}
                  >
                    Clients - Particuliers
                  </button>
                  <button
                    onClick={() => { alert('Export Clients - Sociétés'); setShowExportDropdown(false) }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-t"
                    style={{ color: '#141A1F', borderColor: '#E4E5E7' }}
                  >
                    Clients - Sociétés
                  </button>
                </div>
              )}
            </div>

            {/* Importer Button */}
            <div className="relative" ref={importRef}>
              <button
                onClick={() => setShowImportDropdown(!showImportDropdown)}
                className="px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50"
                style={{ borderColor: '#006666', color: '#006666' }}
              >
                Importer
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showImportDropdown && (
                <div className="absolute right-0 mt-1 w-40 bg-white border rounded-lg shadow-lg z-50" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={() => { alert('Import Transactions'); setShowImportDropdown(false) }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                    style={{ color: '#141A1F' }}
                  >
                    Transactions
                  </button>
                  <button
                    onClick={() => { alert('Import Tiers'); setShowImportDropdown(false) }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-t"
                    style={{ color: '#141A1F', borderColor: '#E4E5E7' }}
                  >
                    Tiers
                  </button>
                </div>
              )}
            </div>

            {/* Nouvelle règle Button */}
            <div className="relative" ref={nouvelleRegleRef}>
              <button
                onClick={() => setShowNouvelleRegleDropdown(!showNouvelleRegleDropdown)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: '#006666' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nouvelle règle
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showNouvelleRegleDropdown && (
                <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-50" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={() => {
                      setSelectedSupplierId(null)
                      setIsEditMode(false)
                      setSupplierForm({
                        nom: '',
                        numeroCompte: '',
                        numeroTva: '',
                        siret: '',
                        profession: '',
                        adresse: '',
                        codePostal: '',
                        ville: '',
                        codeInsee: '',
                        pays: 'France',
                        iban: '',
                        compteCharges: '',
                        tauxTva: '',
                        regleTva: 'automatique',
                        modePaiement: '',
                        delaiPaiement: '',
                        delaiUnite: 'jours',
                        traitementAuto: false,
                        autofactures: false,
                        visibiliteFactures: true,
                        visibiliteNotes: false,
                        emails: '',
                        categories: []
                      })
                      setChargesLines([{ compte: '', tva: '' }])
                      setShowSupplierPanel(true)
                      setShowNouvelleRegleDropdown(false)
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                    style={{ color: '#141A1F' }}
                  >
                    Fournisseur
                  </button>
                  <button
                    onClick={() => {
                      setNewRuleType('client-particulier')
                      setShowNewRuleModal(true)
                      setShowNouvelleRegleDropdown(false)
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-t"
                    style={{ color: '#141A1F', borderColor: '#E4E5E7' }}
                  >
                    Client - Particulier
                  </button>
                  <button
                    onClick={() => {
                      setNewRuleType('client-societe')
                      setShowNewRuleModal(true)
                      setShowNouvelleRegleDropdown(false)
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-t"
                    style={{ color: '#141A1F', borderColor: '#E4E5E7' }}
                  >
                    Client - Société
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 border-b" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex gap-6">
          {(['transactions', 'fournisseurs', 'clients', 'produits'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              style={activeTab === tab ? { borderColor: '#006666', color: '#006666' } : {}}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{
                backgroundColor: activeTab === tab ? '#D9EFEB' : '#F3F4F6',
                color: activeTab === tab ? '#006666' : '#6C767F'
              }}>
                {tabCounts[tab]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Info Banner */}
      {showInfoBanner && (
        <div className="mx-8 mt-6 px-4 py-3 rounded-lg flex items-center justify-between" style={{ backgroundColor: '#D9EFEB' }}>
          <div className="flex items-center gap-3">
            <span className="text-lg">✨</span>
            <span className="text-sm" style={{ color: '#006666' }}>
              Gagnez du temps ! Créez une règle en spécifiant un compte de charges et/ou un taux de TVA pour traiter automatiquement vos nouvelles factures.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#" className="text-sm font-medium underline" style={{ color: '#006666' }}>
              En savoir plus
              <svg className="w-3.5 h-3.5 inline ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
            <button onClick={() => setShowInfoBanner(false)} className="p-1 hover:bg-teal-100 rounded">
              <svg className="w-4 h-4" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-8 py-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-shrink-0" style={{ width: '240px' }}>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher un fournisseur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          {/* Filter buttons */}
          {['Contrepartie', '% TVA', 'Catégories', 'Visibilité', 'IBAN', 'Auto-facture activé'].map((filter) => (
            <button
              key={filter}
              onClick={() => toggleFilter(filter)}
              className={`px-4 py-2 border rounded-lg text-sm flex items-center gap-2 transition-colors ${
                activeFilters.includes(filter) ? 'bg-teal-50 border-teal-600' : 'hover:bg-gray-50'
              }`}
              style={{
                borderColor: activeFilters.includes(filter) ? '#006666' : '#D6D9DB',
                color: activeFilters.includes(filter) ? '#006666' : '#141A1F'
              }}
            >
              {filter === 'Contrepartie' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
                </svg>
              )}
              {filter === '% TVA' && <span className="font-medium">%</span>}
              {filter === 'Catégories' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                </svg>
              )}
              {filter === 'Visibilité' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {filter === 'IBAN' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              )}
              {filter === 'Auto-facture activé' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 13.5V3.75m0 9.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 3.75V16.5m12-3V3.75m0 9.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 3.75V16.5m-6-9V3.75m0 3.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 9.75V10.5" />
                </svg>
              )}
              {filter}
            </button>
          ))}

          {/* Customize button with dropdown */}
          <div className="relative ml-auto" ref={customizeRef}>
            <button
              onClick={() => {
                setTempColumns([...columns])
                setShowCustomizeModal(!showCustomizeModal)
              }}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 font-medium ${
                showCustomizeModal ? 'text-white' : 'border hover:bg-gray-50'
              }`}
              style={showCustomizeModal
                ? { backgroundColor: '#006666' }
                : { borderColor: '#D6D9DB', color: '#141A1F' }
              }
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Personnaliser
            </button>

            {/* Customize Dropdown */}
            {showCustomizeModal && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border rounded-lg shadow-xl z-50" style={{ borderColor: '#E4E5E7' }}>
                {/* Header */}
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
                  <div className="font-semibold" style={{ color: '#141A1F' }}>
                    Personnaliser l'affichage
                  </div>
                  <button
                    onClick={() => setTempColumns(defaultColumns)}
                    className="text-sm hover:underline"
                    style={{ color: '#006666' }}
                  >
                    Réinit.
                  </button>
                </div>

                {/* Colonnes Header */}
                <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={() => setColumnsExpanded(!columnsExpanded)}
                    className="flex items-center gap-2 text-sm font-medium"
                    style={{ color: '#141A1F' }}
                  >
                    Colonnes
                    <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#E8F5F3', color: '#006666' }}>
                      {tempColumns.filter(c => c.visible).length}
                    </span>
                  </button>
                  <button onClick={() => setColumnsExpanded(!columnsExpanded)}>
                    <svg
                      className={`w-4 h-4 transition-transform ${columnsExpanded ? 'rotate-0' : 'rotate-180'}`}
                      style={{ color: '#6C767F' }}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                </div>

                {/* Columns List */}
                {columnsExpanded && (
                  <div className="max-h-80 overflow-y-auto">
                    {tempColumns.map((column, index) => (
                      <div
                        key={column.id}
                        className="flex items-center justify-between px-6 py-2.5 hover:bg-gray-50 border-b last:border-b-0"
                        style={{ borderColor: '#F3F4F6' }}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', index.toString())
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
                          const toIndex = index
                          if (fromIndex !== toIndex) {
                            const newColumns = [...tempColumns]
                            const [removed] = newColumns.splice(fromIndex, 1)
                            newColumns.splice(toIndex, 0, removed)
                            setTempColumns(newColumns)
                          }
                        }}
                      >
                        {/* Toggle + Label */}
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Toggle Switch */}
                          <button
                            onClick={() => {
                              setTempColumns(prev => prev.map((c, i) =>
                                i === index ? { ...c, visible: !c.visible } : c
                              ))
                            }}
                            className={`relative rounded-full transition-colors flex-shrink-0 ${
                              column.visible ? '' : 'bg-gray-200'
                            }`}
                            style={{
                              width: '36px',
                              height: '20px',
                              backgroundColor: column.visible ? '#006666' : undefined
                            }}
                          >
                            <span
                              className="absolute bg-white rounded-full shadow transition-all"
                              style={{
                                width: '16px',
                                height: '16px',
                                top: '2px',
                                left: column.visible ? '18px' : '2px'
                              }}
                            />
                          </button>
                          <span className="text-xs whitespace-nowrap" style={{ color: '#141A1F' }}>{column.label}</span>
                        </div>

                        {/* Drag Handle */}
                        <div className="cursor-grab active:cursor-grabbing" style={{ color: '#9CA3AF' }}>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="9" cy="6" r="1.5" />
                            <circle cx="15" cy="6" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" />
                            <circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="18" r="1.5" />
                            <circle cx="15" cy="18" r="1.5" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="px-4 py-3 border-t flex items-center justify-center gap-3" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={() => setShowCustomizeModal(false)}
                    className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
                    style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      setColumns([...tempColumns])
                      setShowCustomizeModal(false)
                    }}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: '#006666' }}
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-8 flex-1 min-h-0 pb-16">
        <div className="border rounded-lg overflow-auto h-full" style={{ borderColor: '#E4E5E7' }}>
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFAFA' }}>
                {columns.find(c => c.id === 'selection')?.visible && (
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                )}
                {columns.find(c => c.id === 'nom')?.visible && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>Nom</th>
                )}
                {columns.find(c => c.id === 'numeroCompte')?.visible && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>Numéro de compte</th>
                )}
                {columns.find(c => c.id === 'contrepartie')?.visible && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>Contrepartie</th>
                )}
                {columns.find(c => c.id === 'tva')?.visible && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>TVA</th>
                )}
                {columns.find(c => c.id === 'categories')?.visible && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>Catégories</th>
                )}
                {columns.find(c => c.id === 'autofacture')?.visible && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>Autofacture</th>
                )}
                {columns.find(c => c.id === 'solde')?.visible && (
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>Solde</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.filter(c => c.visible).length} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-teal-600" />
                      Chargement...
                    </div>
                  </td>
                </tr>
              ) : paginatedRules.length === 0 ? (
                <tr>
                  <td colSpan={columns.filter(c => c.visible).length} className="px-4 py-8 text-center text-gray-500">
                    Aucun fournisseur trouvé
                  </td>
                </tr>
              ) : (
                paginatedRules.map((rule) => {
                  const currentContrepartie = ruleOverrides[rule.id]?.contrepartie !== undefined
                    ? ruleOverrides[rule.id].contrepartie
                    : rule.contrepartie
                  const currentTva = ruleOverrides[rule.id]?.tva !== undefined
                    ? ruleOverrides[rule.id].tva
                    : rule.tva

                  // When no search query, show most used accounts sorted by lines descending
                  // When searching, filter by code or label
                  const filteredAccounts = contrepartieSearch.trim() === ''
                    ? [...availableAccounts].sort((a, b) => b.lines - a.lines).slice(0, 10)
                    : availableAccounts.filter(acc =>
                        acc.code.includes(contrepartieSearch) ||
                        acc.label.toLowerCase().includes(contrepartieSearch.toLowerCase())
                      )

                  return (
                  <tr
                    key={rule.id}
                    className={`border-b cursor-pointer transition-colors ${selectedSupplierId === rule.id ? '' : 'hover:bg-gray-50'}`}
                    style={{
                      borderColor: '#E4E5E7',
                      backgroundColor: selectedSupplierId === rule.id ? '#D9EFEB' : undefined
                    }}
                    onClick={() => {
                      setSelectedSupplierId(rule.id)
                      setIsEditMode(true)
                      // Find the supplier data and populate the form
                      const supplier = suppliers.find(s => s.id === rule.id)
                      if (supplier) {
                        setSupplierForm({
                          nom: supplier.name || '',
                          numeroCompte: supplier.code || '',
                          numeroTva: supplier.vat_number || '',
                          siret: supplier.siret || '',
                          profession: '',
                          adresse: supplier.address || '',
                          codePostal: supplier.postal_code || '',
                          ville: supplier.city || '',
                          codeInsee: '',
                          pays: supplier.country || 'France',
                          iban: '',
                          compteCharges: rule.contrepartie || '',
                          tauxTva: rule.tva || '',
                          regleTva: 'automatique',
                          modePaiement: '',
                          delaiPaiement: supplier.payment_terms?.toString() || '',
                          delaiUnite: 'jours',
                          traitementAuto: false,
                          autofactures: rule.autofacture,
                          visibiliteFactures: true,
                          visibiliteNotes: false,
                          emails: supplier.email || '',
                          categories: rule.categories || []
                        })
                        setChargesLines(rule.contrepartie ? [{ compte: rule.contrepartie.split(' - ')[0] || '', tva: rule.tva || '' }] : [{ compte: '', tva: '' }])
                      }
                      setShowSupplierPanel(true)
                    }}
                  >
                    {columns.find(c => c.id === 'selection')?.visible && (
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </td>
                    )}
                    {columns.find(c => c.id === 'nom')?.visible && (
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: '#141A1F' }}>
                        {rule.name.length > 35 ? rule.name.substring(0, 35) + '...' : rule.name}
                      </td>
                    )}
                    {columns.find(c => c.id === 'numeroCompte')?.visible && (
                      <td className="px-4 py-3 text-sm" style={{ color: '#6C767F' }}>{rule.accountNumber}</td>
                    )}

                    {/* Contrepartie Dropdown */}
                    {columns.find(c => c.id === 'contrepartie')?.visible && (
                    <td className="px-4 py-3 relative">
                      <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
                        {currentContrepartie ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setActiveContrepartieDropdown(activeContrepartieDropdown === rule.id ? null : rule.id)}
                              className="px-2 py-1 text-xs rounded border flex items-center gap-1 hover:bg-gray-50"
                              style={{ borderColor: activeContrepartieDropdown === rule.id ? '#006666' : '#D6D9DB', color: '#141A1F' }}
                            >
                              {currentContrepartie.length > 15 ? currentContrepartie.substring(0, 15) + '...' : currentContrepartie}
                              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setRuleOverrides(prev => ({ ...prev, [rule.id]: { ...prev[rule.id], contrepartie: null } }))}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setActiveContrepartieDropdown(activeContrepartieDropdown === rule.id ? null : rule.id)}
                            className="px-2 py-1 text-sm rounded border flex items-center gap-1 hover:bg-gray-50"
                            style={{ borderColor: '#D6D9DB', color: '#9CA3AF' }}
                          >
                            Choisir...
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}

                        {activeContrepartieDropdown === rule.id && (
                          <div
                            className="absolute left-0 top-full mt-1 w-80 bg-white border rounded-lg shadow-xl z-50"
                            style={{ borderColor: '#E4E5E7' }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <div className="p-2 border-b" style={{ borderColor: '#E4E5E7' }}>
                              <input
                                type="text"
                                value={contrepartieSearch}
                                onChange={(e) => setContrepartieSearch(e.target.value)}
                                placeholder="Rechercher un compte..."
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                style={{ borderColor: '#D6D9DB' }}
                                autoFocus
                              />
                            </div>
                            <div className="p-2 text-xs font-medium uppercase" style={{ color: '#6C767F', backgroundColor: '#F8F9FA' }}>
                              LES PLUS UTILISÉS
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                              {filteredAccounts.map((account) => (
                                <button
                                  key={account.code}
                                  onClick={() => {
                                    setRuleOverrides(prev => ({ ...prev, [rule.id]: { ...prev[rule.id], contrepartie: `${account.code} - ${account.label}` } }))
                                    setActiveContrepartieDropdown(null)
                                    setContrepartieSearch('')
                                  }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-teal-50 border-t"
                                  style={{ borderColor: '#E4E5E7' }}
                                >
                                  <div className="text-sm" style={{ color: '#141A1F' }}>
                                    {account.code} - {account.label}
                                  </div>
                                  <div className="text-xs" style={{ color: '#6C767F' }}>
                                    {account.lines} lignes
                                  </div>
                                </button>
                              ))}
                            </div>
                            <div className="p-2 text-xs" style={{ color: '#6C767F', backgroundColor: '#D9EFEB' }}>
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" style={{ color: '#006666' }} fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                                </svg>
                                Accédez à plus de comptes en affinant la recherche.
                              </div>
                            </div>
                            <button
                              onClick={() => { alert('Créer un nouveau compte'); setActiveContrepartieDropdown(null) }}
                              className="w-full text-left px-4 py-3 text-sm font-medium border-t flex items-center gap-2"
                              style={{ color: '#006666', borderColor: '#E4E5E7' }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                              Créer un nouveau compte
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    )}

                    {/* TVA Dropdown */}
                    {columns.find(c => c.id === 'tva')?.visible && (
                    <td className="px-4 py-3 relative">
                      <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
                        {currentTva ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setActiveTvaDropdown(activeTvaDropdown === rule.id ? null : rule.id)}
                              className="px-2 py-1 text-xs rounded border flex items-center gap-1 hover:bg-gray-50"
                              style={{ borderColor: activeTvaDropdown === rule.id ? '#006666' : '#D6D9DB', color: '#141A1F' }}
                            >
                              {currentTva.length > 12 ? currentTva.substring(0, 12) + '...' : currentTva}
                              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setRuleOverrides(prev => ({ ...prev, [rule.id]: { ...prev[rule.id], tva: null } }))}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setActiveTvaDropdown(activeTvaDropdown === rule.id ? null : rule.id)}
                            className="px-2 py-1 text-sm rounded border flex items-center gap-1 hover:bg-gray-50"
                            style={{ borderColor: '#D6D9DB', color: '#9CA3AF' }}
                          >
                            Choisir...
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}

                        {activeTvaDropdown === rule.id && (
                          <div
                            className="absolute left-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-xl z-50"
                            style={{ borderColor: '#E4E5E7' }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            {tvaOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setRuleOverrides(prev => ({ ...prev, [rule.id]: { ...prev[rule.id], tva: option.value } }))
                                  setActiveTvaDropdown(null)
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-teal-50 border-t first:border-t-0"
                                style={{ color: '#141A1F', borderColor: '#E4E5E7' }}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    )}

                    {columns.find(c => c.id === 'categories')?.visible && (
                    <td className="px-4 py-3">
                      {rule.categories.length > 0 ? (
                        <span className="text-sm" style={{ color: '#006666' }}>
                          {rule.categories[0]}
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: '#9CA3AF' }}>—</span>
                      )}
                    </td>
                    )}
                    {columns.find(c => c.id === 'autofacture')?.visible && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rule.autofacture ? '#10B981' : '#6C767F' }} />
                        <span className="text-sm" style={{ color: '#6C767F' }}>{rule.autofacture ? 'Actif' : 'Inactif'}</span>
                      </div>
                    </td>
                    )}
                    {columns.find(c => c.id === 'solde')?.visible && (
                    <td className="px-4 py-3 text-right text-sm font-medium" style={{ color: rule.solde && rule.solde < 0 ? '#EF4444' : '#141A1F' }}>
                      {formatCurrency(rule.solde)}
                    </td>
                    )}
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="fixed bottom-0 left-0 right-0 px-8 py-3 flex items-center justify-between border-t bg-white z-40" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-2">
          {[25, 50, 100].map((size) => (
            <button
              key={size}
              onClick={() => { setItemsPerPage(size); setCurrentPage(1) }}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                itemsPerPage === size
                  ? 'text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              style={itemsPerPage === size ? { backgroundColor: '#006666' } : {}}
            >
              {size}
            </button>
          ))}
          <span className="text-sm" style={{ color: '#6C767F' }}>éléments par page</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: '#6C767F' }}>
            {startIndex + 1}-{Math.min(endIndex, totalItems)} sur {totalItems}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                    currentPage === pageNum
                      ? 'text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={currentPage === pageNum ? { backgroundColor: '#006666' } : {}}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <button
              onClick={() => {/* refresh */}}
              className="p-1.5 rounded hover:bg-gray-100 ml-2"
            >
              <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Supplier Side Panel (Create/Edit) */}
      {showSupplierPanel && (
        <div className="fixed inset-0 z-50 flex">
          {/* Transparent backdrop - table remains visible */}
          <div
            className="flex-1"
            onClick={() => {
              setShowSupplierPanel(false)
              setSelectedSupplierId(null)
            }}
          />

          {/* Side Panel */}
          <div className="w-[750px] bg-white h-full overflow-y-auto shadow-xl border-l" style={{ borderColor: '#E4E5E7' }}>
            {/* Header */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                {isEditMode ? 'Modifier le fournisseur' : 'Créer un nouveau fournisseur'}
              </h2>
              <div className="flex items-center gap-3">
                {isEditMode && (
                  <button
                    className="px-3 py-2 text-sm font-medium flex items-center gap-1 hover:bg-gray-50 rounded-lg"
                    style={{ color: '#141A1F' }}
                  >
                    Ouvrir
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => {
                    // Save logic here
                    alert('Fournisseur sauvegardé!')
                    setShowSupplierPanel(false)
                    setSelectedSupplierId(null)
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: '#006666' }}
                >
                  Sauvegarder
                </button>
                <button
                  onClick={() => {
                    setShowSupplierPanel(false)
                    setSelectedSupplierId(null)
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-8">
              {/* Informations générales */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold" style={{ color: '#141A1F' }}>Informations générales</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Nom</label>
                    <input
                      type="text"
                      value={supplierForm.nom}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, nom: e.target.value }))}
                      placeholder="Définir un nom"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 flex items-center gap-1" style={{ color: '#141A1F' }}>
                      Numéro de compte
                      <svg className="w-4 h-4" style={{ color: '#9CA3AF' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </label>
                    <input
                      type="text"
                      value={supplierForm.numeroCompte}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, numeroCompte: e.target.value }))}
                      placeholder="4010000001"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Numéro de TVA</label>
                    <input
                      type="text"
                      value={supplierForm.numeroTva}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, numeroTva: e.target.value }))}
                      placeholder="Définir un numéro de TVA"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>SIRET</label>
                    <input
                      type="text"
                      value={supplierForm.siret}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, siret: e.target.value }))}
                      placeholder="Entrer le SIRET"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Profession</label>
                    <input
                      type="text"
                      value={supplierForm.profession}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, profession: e.target.value }))}
                      placeholder="Renseigner la profession"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Adresse</label>
                    <input
                      type="text"
                      value={supplierForm.adresse}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, adresse: e.target.value }))}
                      placeholder="Renseigner une adresse"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Code postal</label>
                    <input
                      type="text"
                      value={supplierForm.codePostal}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, codePostal: e.target.value }))}
                      placeholder="Code"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Ville</label>
                    <input
                      type="text"
                      value={supplierForm.ville}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, ville: e.target.value }))}
                      placeholder="Renseigner une ville"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Code commune INSEE</label>
                    <input
                      type="text"
                      value={supplierForm.codeInsee}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, codeInsee: e.target.value }))}
                      placeholder="Code"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Pays</label>
                    <select
                      value={supplierForm.pays}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, pays: e.target.value }))}
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                    >
                      <option value="">Sélectionner un pays</option>
                      <option value="France">France</option>
                      <option value="Belgique">Belgique</option>
                      <option value="Suisse">Suisse</option>
                      <option value="Luxembourg">Luxembourg</option>
                      <option value="Allemagne">Allemagne</option>
                      <option value="Espagne">Espagne</option>
                      <option value="Italie">Italie</option>
                      <option value="Royaume-Uni">Royaume-Uni</option>
                      <option value="États-Unis">États-Unis</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Informations bancaires */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold" style={{ color: '#141A1F' }}>Informations bancaires</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>IBAN</label>
                    <input
                      type="text"
                      value={supplierForm.iban}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, iban: e.target.value }))}
                      placeholder="XXXX XXXX XXXX XXXX XXXX XXXX XXX"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Justificatif (optionnel)</label>
                    <button
                      className="text-sm font-medium flex items-center gap-1 mt-2"
                      style={{ color: '#006666' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Ajouter un justificatif
                    </button>
                  </div>
                </div>
              </div>

              {/* Comptes de charges & TVA */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold" style={{ color: '#141A1F' }}>Comptes de charges & TVA</h3>

                {showChargesTvaBanner && (
                  <div className="p-4 rounded-lg flex items-start justify-between" style={{ backgroundColor: '#D9EFEB' }}>
                    <div className="flex items-start gap-2">
                      <span className="text-lg">✨</span>
                      <p className="text-sm" style={{ color: '#006666' }}>
                        Gagnez du temps ! Renseignez un compte de charges et/ou un taux de TVA pour traiter automatiquement vos nouvelles factures.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a href="#" className="text-sm font-medium underline whitespace-nowrap" style={{ color: '#006666' }}>
                        En savoir plus
                        <svg className="w-3.5 h-3.5 inline ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                      <button onClick={() => setShowChargesTvaBanner(false)} className="p-1 hover:bg-teal-100 rounded">
                        <svg className="w-4 h-4" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {chargesLines.map((line, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <select
                        value={line.compte}
                        onChange={(e) => {
                          const newLines = [...chargesLines]
                          newLines[index].compte = e.target.value
                          setChargesLines(newLines)
                        }}
                        className="w-full px-3 py-2.5 pr-8 border rounded-lg text-sm"
                        style={{ borderColor: '#D6D9DB', color: line.compte ? '#141A1F' : '#9CA3AF' }}
                      >
                        <option value="">Aucun compte de charges/produits sélectionné</option>
                        {availableAccounts.filter(a => a.code.startsWith('6')).map((account) => (
                          <option key={account.code} value={account.code}>
                            {account.code} - {account.label}
                          </option>
                        ))}
                      </select>
                      {line.compte && (
                        <button
                          onClick={() => {
                            const newLines = [...chargesLines]
                            newLines[index].compte = ''
                            setChargesLines(newLines)
                          }}
                          className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="flex-1 relative">
                      <select
                        value={line.tva}
                        onChange={(e) => {
                          const newLines = [...chargesLines]
                          newLines[index].tva = e.target.value
                          setChargesLines(newLines)
                        }}
                        className="w-full px-3 py-2.5 pr-8 border rounded-lg text-sm"
                        style={{ borderColor: '#D6D9DB', color: line.tva ? '#141A1F' : '#9CA3AF' }}
                      >
                        <option value="">Aucun taux de TVA sélectionné</option>
                        {tvaOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {line.tva && (
                        <button
                          onClick={() => {
                            const newLines = [...chargesLines]
                            newLines[index].tva = ''
                            setChargesLines(newLines)
                          }}
                          className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {chargesLines.length > 1 && (
                      <button
                        onClick={() => {
                          setChargesLines(prev => prev.filter((_, i) => i !== index))
                        }}
                        className="p-2 text-red-400 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={() => setChargesLines(prev => [...prev, { compte: '', tva: '' }])}
                  className="text-sm font-medium flex items-center gap-1"
                  style={{ color: '#006666' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Ajouter une ligne
                </button>
              </div>

              {/* Règles d'exigibilité de la TVA + Paiement */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: '#141A1F' }}>
                    Règles d'exigibilité de la TVA
                  </h3>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="regleTva"
                        checked={supplierForm.regleTva === 'automatique'}
                        onChange={() => setSupplierForm(prev => ({ ...prev, regleTva: 'automatique' }))}
                        className="w-5 h-5"
                        style={{ accentColor: '#006666' }}
                      />
                      <span className="text-sm" style={{ color: '#141A1F' }}>Automatique</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="regleTva"
                        checked={supplierForm.regleTva === 'debits'}
                        onChange={() => setSupplierForm(prev => ({ ...prev, regleTva: 'debits' }))}
                        className="w-5 h-5"
                        style={{ accentColor: '#006666' }}
                      />
                      <span className="text-sm" style={{ color: '#141A1F' }}>Option TVA sur les débits</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="regleTva"
                        checked={supplierForm.regleTva === 'encaissements'}
                        onChange={() => setSupplierForm(prev => ({ ...prev, regleTva: 'encaissements' }))}
                        className="w-5 h-5"
                        style={{ accentColor: '#006666' }}
                      />
                      <span className="text-sm" style={{ color: '#141A1F' }}>Appliquer une TVA sur les encaissements</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: '#141A1F' }}>
                    Paiement
                    <svg className="w-4 h-4" style={{ color: '#9CA3AF' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <a href="#" className="text-sm font-medium underline ml-auto" style={{ color: '#006666' }}>
                      En savoir plus
                      <svg className="w-3.5 h-3.5 inline ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </h3>

                  <div className="p-3 rounded-lg border" style={{ borderColor: '#E4E5E7', backgroundColor: '#F9FAFB' }}>
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#6C767F' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#141A1F' }}>Bon à savoir</p>
                        <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
                          Les factures avec virement récurrent ou prélèvement automatique passent automatiquement en "En attente" puis en "Payée" à l'échéance.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Mode de paiement</label>
                    <select
                      value={supplierForm.modePaiement}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, modePaiement: e.target.value }))}
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB', color: supplierForm.modePaiement ? '#141A1F' : '#9CA3AF' }}
                    >
                      <option value="">Choisir</option>
                      <option value="virement">Virement</option>
                      <option value="prelevement">Prélèvement</option>
                      <option value="cb">Carte bancaire</option>
                      <option value="cheque">Chèque</option>
                      <option value="especes">Espèces</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#141A1F' }}>Délai de paiement</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={supplierForm.delaiPaiement}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, delaiPaiement: e.target.value }))}
                        placeholder="Ex : 15"
                        className="w-full px-3 py-2.5 border rounded-lg text-sm"
                        style={{ borderColor: '#D6D9DB' }}
                      />
                      <select
                        value={supplierForm.delaiUnite}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, delaiUnite: e.target.value }))}
                        className="w-full px-3 py-2.5 border rounded-lg text-sm"
                        style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                      >
                        <option value="jours">Jours</option>
                        <option value="mois">Mois</option>
                      </select>
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: '#6C767F' }}>
                      Ce délai sera appliqué sur la date d'émission des factures de ce fournisseur
                    </p>
                  </div>
                </div>
              </div>

              {/* Automatisations + Visibilité */}
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 rounded-lg border space-y-4" style={{ borderColor: '#E4E5E7' }}>
                  <h3 className="text-base font-semibold" style={{ color: '#141A1F' }}>Automatisations</h3>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => setSupplierForm(prev => ({ ...prev, traitementAuto: !prev.traitementAuto }))}
                        className={`relative rounded-full transition-colors flex-shrink-0 mt-0.5 ${supplierForm.traitementAuto ? '' : 'bg-gray-200'}`}
                        style={{
                          width: '36px',
                          height: '20px',
                          backgroundColor: supplierForm.traitementAuto ? '#006666' : undefined
                        }}
                      >
                        <span
                          className="absolute bg-white rounded-full shadow transition-all"
                          style={{
                            width: '16px',
                            height: '16px',
                            top: '2px',
                            left: supplierForm.traitementAuto ? '18px' : '2px'
                          }}
                        />
                      </button>
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#141A1F' }}>Traitement automatique des factures</p>
                        <p className="text-xs mt-0.5" style={{ color: '#6C767F' }}>
                          Passe les factures <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>Pré-traitées</span> à <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>Traitées</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => setSupplierForm(prev => ({ ...prev, autofactures: !prev.autofactures }))}
                        className={`relative rounded-full transition-colors flex-shrink-0 mt-0.5 ${supplierForm.autofactures ? '' : 'bg-gray-200'}`}
                        style={{
                          width: '36px',
                          height: '20px',
                          backgroundColor: supplierForm.autofactures ? '#006666' : undefined
                        }}
                      >
                        <span
                          className="absolute bg-white rounded-full shadow transition-all"
                          style={{
                            width: '16px',
                            height: '16px',
                            top: '2px',
                            left: supplierForm.autofactures ? '18px' : '2px'
                          }}
                        />
                      </button>
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium" style={{ color: '#141A1F' }}>Création d'autofactures</p>
                        <svg className="w-4 h-4" style={{ color: '#9CA3AF' }} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border space-y-4" style={{ borderColor: '#E4E5E7' }}>
                  <h3 className="text-base font-semibold flex items-center gap-1" style={{ color: '#141A1F' }}>
                    Visibilité
                    <svg className="w-4 h-4" style={{ color: '#9CA3AF' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </h3>

                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={supplierForm.visibiliteFactures}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, visibiliteFactures: e.target.checked }))}
                        className="w-5 h-5 rounded"
                        style={{ accentColor: '#006666' }}
                      />
                      <span className="text-sm" style={{ color: '#141A1F' }}>Factures fournisseurs</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={supplierForm.visibiliteNotes}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, visibiliteNotes: e.target.checked }))}
                        className="w-5 h-5 rounded"
                        style={{ accentColor: '#006666' }}
                      />
                      <span className="text-sm" style={{ color: '#141A1F' }}>Notes de frais</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Liste d'emails */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold" style={{ color: '#141A1F' }}>Liste d'emails</h3>
                <input
                  type="text"
                  value={supplierForm.emails}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, emails: e.target.value }))}
                  placeholder="Entrer une ou plusieurs adresses emails"
                  className="w-full px-3 py-2.5 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>

              {/* Catégories */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold" style={{ color: '#141A1F' }}>Catégories</h3>

                {showCategoriesBanner && (
                  <div className="p-4 rounded-lg border flex items-start justify-between" style={{ borderColor: '#E4E5E7', backgroundColor: '#F9FAFB' }}>
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#6C767F' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm" style={{ color: '#6C767F' }}>
                        Sélectionnez une ou plusieurs catégories, puis déterminez la part de chacune dans le montant total pour affiner votre analyse.
                      </p>
                    </div>
                    <button onClick={() => setShowCategoriesBanner(false)} className="p-1 hover:bg-gray-200 rounded flex-shrink-0">
                      <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                <select
                  className="w-full px-3 py-2.5 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB', color: '#9CA3AF' }}
                >
                  <option value="">Rechercher une catégorie</option>
                  <option value="logiciels">Logiciels & SaaS</option>
                  <option value="fournitures">Fournitures de bureau</option>
                  <option value="telecom">Télécommunications</option>
                  <option value="deplacement">Déplacements</option>
                  <option value="honoraires">Honoraires</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
