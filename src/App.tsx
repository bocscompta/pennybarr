import { useState, lazy, Suspense, FC } from 'react'
import './index.css'
import AuthGuard from './components/AuthGuard'
import { useDashboardStats, useUnreconciledTransactions } from './hooks/useSupabase'
import InvoiceUploadModal from './components/InvoiceUploadModal'
import TransactionsPage from './pages/TransactionsPage'
import DocumentsPage from './pages/DocumentsPage'
import FacturesFournisseursPage from './pages/FacturesFournisseursPage'
import BankImportPage from './pages/BankImportPage'
import PennylaneImportPage from './pages/PennylaneImportPage'
import GrandLivreImportPage from './pages/GrandLivreImportPage'
import GrandLivrePage from './pages/GrandLivrePage'
import BalanceGeneralePage from './pages/BalanceGeneralePage'
import JournauxPage from './pages/JournauxPage'
import PlanComptablePage from './pages/PlanComptablePage'
import TiersPage from './pages/TiersPage'
import InformationsEntreprisePage from './pages/InformationsEntreprisePage'
import ConnectivitePage from './pages/ConnectivitePage'
import DeclarationTVAPage from './pages/DeclarationTVAPage'
import FacturesClientsPage from './pages/FacturesClientsPage'
import ClotureExercicePage from './pages/ClotureExercicePage'
import RapprochementBancairePage from './pages/RapprochementBancairePage'
import NotesFraisPage from './pages/NotesFraisPage'
import DevisPage from './pages/DevisPage'
import ProduitsServicesPage from './pages/ProduitsServicesPage'
import RelancesPage from './pages/RelancesPage'
import ImmobilisationsPage from './pages/ImmobilisationsPage'
import EmpruntsPage from './pages/EmpruntsPage'
import FamillesAnalytiquesPage from './pages/FamillesAnalytiquesPage'
import HistoriqueImportsPage from './pages/HistoriqueImportsPage'
import LettragePage from './pages/LettragePage'
import CommandesFournisseursPage from './pages/CommandesFournisseursPage'
import ContratsPage from './pages/ContratsPage'
import AvoirsPage from './pages/AvoirsPage'
import PaiementsSEPAPage from './pages/PaiementsSEPAPage'
import CreateInvoicePage from './pages/CreateInvoicePage'
import CreateQuotePage from './pages/CreateQuotePage'
import ParametresFacturesClientsPage from './pages/ParametresFacturesClientsPage'
import { DisabledMenuItem } from './components/DisabledFeature'
import VosDeclarationsPage from './pages/VosDeclarationsPage'
import NouvelleLiasseFiscalePage from './pages/NouvelleLiasseFiscalePage'
import LiasseFiscaleDetailsPage from './pages/LiasseFiscaleDetailsPage'

// Lazy-loaded pages (heavy pages with charts/PDF export)
const BilanPage = lazy(() => import('./pages/BilanPage'))
const CompteResultatPage = lazy(() => import('./pages/CompteResultatPage'))
const SIGPage = lazy(() => import('./pages/SIGPage'))
const CAFPage = lazy(() => import('./pages/CAFPage'))
const PlanTresoreriePage = lazy(() => import('./pages/PlanTresoreriePage'))
const RapportsAnalytiquesPage = lazy(() => import('./pages/RapportsAnalytiquesPage'))
const BalanceFournisseursPage = lazy(() => import('./pages/BalanceFournisseursPage'))
const BalanceClientsPage = lazy(() => import('./pages/BalanceClientsPage'))
const BalanceAgeePage = lazy(() => import('./pages/BalanceAgeePage'))

// Loading spinner component for lazy-loaded pages
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-teal-600" />
    </div>
  )
}

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

// Icons SVG
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
)
const TransactionIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
)
const CartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
  </svg>
)
const SalesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
)
const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
)
const ReportIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
)
const FolderIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
  </svg>
)
const CogIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

type Page = 'accueil' | 'transactions' | 'import-bancaire' | 'compte-pro' | 'achats' | 'ventes' | 'analytique' | 'rapports' | 'documents' | 'parametres' | 'migration-pennylane' | 'grand-livre-import' | 'grand-livre' | 'balance-generale' | 'journaux' | 'plan-comptable' | 'fournisseurs' | 'clients' | 'informations-entreprise' | 'connectivite' | 'declaration-tva' | 'factures-clients' | 'factures-fournisseurs' | 'cloture-exercice' | 'rapports-analytiques' | 'balance-fournisseurs' | 'balance-clients' | 'balance-agee' | 'rapprochement-bancaire' | 'bilan' | 'compte-resultat' | 'notes-frais' | 'devis' | 'produits-services' | 'relances' | 'immobilisations' | 'emprunts' | 'sig' | 'caf' | 'plan-tresorerie' | 'familles-analytiques' | 'historique-imports' | 'lettrage' | 'commandes-fournisseurs' | 'contrats' | 'avoirs-clients' | 'virements-sepa' | 'creer-facture' | 'creer-devis' | 'parametres-factures-clients' | 'vos-declarations' | 'nouvelle-liasse-fiscale' | 'liasse-fiscale-details'

function App() {
  const [mode, setMode] = useState<'comptabilite' | 'gestion'>('gestion')
  const [currentPage, setCurrentPage] = useState<Page>('accueil')
  const [previousPage, setPreviousPage] = useState<Page>('accueil')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Custom setCurrentPage qui sauvegarde la page précédente
  const navigateToPage = (page: Page) => {
    setPreviousPage(currentPage)
    setCurrentPage(page)
  }
  const [comptaActiveIcon, setComptaActiveIcon] = useState<string>('saisie')
  const [comptaSelectedItem, setComptaSelectedItem] = useState<string>('factures-fournisseurs')
  const { stats, loading: statsLoading } = useDashboardStats()
  const { transactions: unreconciledTx, loading: txLoading } = useUnreconciledTransactions(4)
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [invoiceModalType, setInvoiceModalType] = useState<'supplier' | 'customer'>('supplier')

  // Format date for transactions
  const formatTxDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const navItems: { label: string; icon: FC; page: Page; hasDropdown?: boolean }[] = [
    { label: 'Accueil', icon: HomeIcon, page: 'accueil' },
    { label: 'Transactions', icon: TransactionIcon, page: 'transactions' },
    { label: 'Achats', icon: CartIcon, page: 'achats', hasDropdown: true },
    { label: 'Ventes', icon: SalesIcon, page: 'ventes', hasDropdown: true },
    { label: 'Analytique', icon: ChartIcon, page: 'analytique', hasDropdown: true },
    { label: 'Rapports comptables', icon: ReportIcon, page: 'rapports', hasDropdown: true },
    { label: 'Documents partagés', icon: FolderIcon, page: 'documents' },
    { label: 'Paramètres', icon: CogIcon, page: 'parametres', hasDropdown: true },
  ]

  const achatsMenuItems = [
    { label: 'Factures fournisseurs', section: 'main', disabled: false, page: 'factures-fournisseurs' as Page },
    { label: 'Commandes fournisseurs', section: 'main', disabled: false, page: 'commandes-fournisseurs' as Page },
    { label: 'Notes de frais des équipes', section: 'main', disabled: false, page: 'notes-frais' as Page },
    { label: 'Vos notes de frais', section: 'main', disabled: false, page: 'notes-frais' as Page },
    { label: 'Demandes d\'achat', section: 'main', disabled: true },
    { label: 'Demandes de paiement', section: 'main', disabled: true },
    { label: 'Liste des fournisseurs', section: 'secondary', disabled: false, page: 'fournisseurs' as Page },
    { label: 'Circuits d\'approbation', section: 'secondary', disabled: true },
  ]

  const ventesMenuItems = [
    { label: 'Factures clients', section: 'main', disabled: false, page: 'factures-clients' as Page },
    { label: 'Avoirs clients', section: 'main', disabled: false, page: 'avoirs-clients' as Page },
    { label: 'Devis', section: 'main', disabled: false, page: 'devis' as Page },
    { label: 'Documents commerciaux', section: 'main', disabled: false },
    { label: 'Contrats & Abonnements', section: 'secondary', disabled: false, page: 'contrats' as Page },
    { label: 'Relances en attente', section: 'secondary', disabled: false, page: 'relances' as Page },
    { label: 'Produits et services', section: 'secondary', disabled: false, page: 'produits-services' as Page },
    { label: 'Liste des clients', section: 'secondary', disabled: false, page: 'clients' as Page },
  ]

  const analytiqueMenuItems = [
    { label: 'Plan de trésorerie', section: 'main', disabled: false, page: 'plan-tresorerie' as Page },
    { label: 'Virements SEPA', section: 'main', disabled: false, page: 'virements-sepa' as Page },
    { label: 'Rapports analytiques', section: 'main', disabled: false, page: 'rapports-analytiques' as Page },
    { label: 'Tableau de bord', section: 'main', disabled: false, partial: true },
  ]

  const rapportsMenuSections = [
    {
      title: 'Balances',
      items: [
        { label: 'Balance générale', disabled: false, page: 'balance-generale' as Page },
        { label: 'Balance fournisseurs', disabled: false, page: 'balance-fournisseurs' as Page },
        { label: 'Balance clients', disabled: false, page: 'balance-clients' as Page },
        { label: 'Balance âgée', disabled: false, page: 'balance-agee' as Page }
      ]
    },
    {
      title: 'Outils comptables',
      items: [
        { label: 'Journaux', disabled: false, page: 'journaux' as Page },
        { label: 'Grand livre', disabled: false, page: 'grand-livre' as Page },
        { label: 'Plan comptable', disabled: false, page: 'plan-comptable' as Page },
        { label: 'Rapprochement bancaire', disabled: false, page: 'rapprochement-bancaire' as Page },
        { label: 'Lettrage manuel', disabled: false, page: 'lettrage' as Page }
      ]
    },
    {
      title: 'États financiers',
      items: [
        { label: 'Bilan', disabled: false, page: 'bilan' as Page },
        { label: 'Compte de résultat', disabled: false, page: 'compte-resultat' as Page }
      ]
    },
    {
      title: 'Dossier de gestion',
      items: [
        { label: 'Soldes intermédiaires de gestion', disabled: false, page: 'sig' as Page },
        { label: 'Analyse du bilan', disabled: true },
        { label: 'Tableau de financement', disabled: true },
        { label: 'Capacité d\'auto-financement', disabled: false, page: 'caf' as Page }
      ]
    },
    {
      title: 'Restitution',
      items: [
        { label: 'Rapports', disabled: true }
      ]
    }
  ]

  const parametresMenuSections = [
    {
      title: null,
      items: [
        { label: 'Connexions bancaires', disabled: true },
        { label: 'Transmission de factures', disabled: true },
        { label: 'Facturation client', disabled: false, page: 'parametres-factures-clients' as Page },
        { label: 'Familles analytiques', disabled: false, page: 'familles-analytiques' as Page },
        { label: 'Centre de règles', disabled: true },
        { label: 'Autopilot', disabled: true, badge: 'Nouv' },
        { label: 'Connectivité', disabled: false, page: 'connectivite' as Page },
        { label: 'Fonctionnalités avancées', disabled: true },
        { label: 'Intelligence artificielle', disabled: true, badge: 'Nouv' },
        { label: 'Plan comptable', disabled: false, page: 'plan-comptable' as Page },
      ]
    },
    {
      title: null,
      items: [
        { label: 'Informations entreprise', disabled: false, page: 'informations-entreprise' as Page },
        { label: 'Gestion de l\'équipe', disabled: true },
        { label: 'Gestion d\'abonnement', disabled: true },
      ]
    },
    {
      title: 'Historique',
      items: [
        { label: 'Imports', disabled: false, page: 'historique-imports' as Page },
        { label: 'Exports', disabled: true },
      ]
    },
    {
      title: 'Exercice',
      items: [
        { label: 'Clôture exercice', disabled: false, page: 'cloture-exercice' as Page },
      ]
    }
  ]

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.hasDropdown) {
      setOpenDropdown(openDropdown === item.label ? null : item.label)
    } else {
      setCurrentPage(item.page)
      setOpenDropdown(null)
    }
  }

  // Comptabilité mode sidebar icons
  const comptaSidebarIcons = [
    { id: 'saisie', icon: 'edit' },
    { id: 'historique', icon: 'clock' },
    { id: 'euro', icon: 'euro' },
    { id: 'document', icon: 'document' },
    { id: 'folder', icon: 'folder' },
  ]

  // Dossier du client menu structure
  const dossierClientMenuSections = [
    {
      title: null,
      items: [
        { id: 'ged', label: 'GED', disabled: false },
        { id: 'documents-demandes', label: 'Documents demandés', disabled: true },
        { id: 'plan-comptable', label: 'Plan comptable', disabled: false, partial: true },
      ]
    },
    {
      title: 'Liste des tiers',
      items: [
        { id: 'fournisseurs', label: 'Fournisseurs', disabled: false },
        { id: 'clients', label: 'Clients', disabled: false },
      ]
    },
  ]

  // États de synthèse menu structure
  const etatsSyntheseMenuSections = [
    {
      title: 'États financiers',
      items: [
        { id: 'bilan', label: 'Bilan', disabled: false },
        { id: 'compte-resultat', label: 'Compte de résultat', disabled: false },
      ]
    },
    {
      title: 'Dossier de gestion',
      items: [
        { id: 'sig', label: 'Soldes intermédiaires de gestion', disabled: false },
        { id: 'analyse-bilan', label: 'Analyse du bilan', disabled: true },
        { id: 'tableau-financement', label: 'Tableau de financement', disabled: true },
        { id: 'caf', label: 'Capacité d\'auto-financement', disabled: false },
      ]
    },
    {
      title: 'Restitution',
      items: [
        { id: 'synthese-financiere', label: 'Synthèse financière', disabled: true },
        { id: 'rapports', label: 'Rapports', disabled: true },
        { id: 'plaquettes', label: 'Plaquettes', disabled: true },
      ]
    },
  ]

  // Fiscalité menu structure - ALL DISABLED (no Dolibarr API support)
  const fiscaliteMenuSections = [
    {
      items: [
        { id: 'vos-declarations', label: 'Vos déclarations', disabled: false },
        { id: 'statut-teledeclarations', label: 'Statut des télédéclarations', disabled: true },
      ]
    },
    {
      items: [
        { id: 'tva-declarations', label: 'TVA - Déclarations', disabled: false },
        { id: 'tva-remboursements', label: 'TVA - Remboursements (3519)', disabled: true },
        { id: 'tva-acomptes', label: 'TVA - Acomptes (3514)', disabled: true },
        { id: 'tva-cadrages', label: 'TVA - Cadrages', isNew: true, disabled: true },
      ]
    },
    {
      items: [
        { id: 'liasse-fiscale', label: 'Liasse fiscale', disabled: true },
      ]
    },
    {
      items: [
        { id: 'is-acompte', label: 'IS - Acompte (2571)', disabled: true },
        { id: 'is-solde', label: 'IS - Solde (2572)', disabled: true },
      ]
    },
    {
      items: [
        { id: 'cvae-acompte', label: 'CVAE - Acompte (1329 AC)', disabled: true },
        { id: 'cvae-solde', label: 'CVAE - Solde (1329 DEF)', disabled: true },
      ]
    },
    {
      items: [
        { id: 'pfu', label: 'PFU (RCM 2777)', disabled: true },
        { id: 'ifu', label: 'IFU (2561)', disabled: true },
        { id: 'das2', label: 'DAS2 - Honoraires', disabled: true },
        { id: 'decloyer', label: 'Decloyer', disabled: true },
      ]
    },
  ]

  // Révision menu structure
  const revisionMenuSections = [
    {
      title: 'Balances',
      items: [
        { id: 'balance-generale', label: 'Balance générale', disabled: false },
        { id: 'balance-fournisseurs', label: 'Balance fournisseurs', disabled: false },
        { id: 'balance-clients', label: 'Balance clients', disabled: false },
        { id: 'balance-agee', label: 'Balance âgée', disabled: false },
      ]
    },
    {
      title: null,
      items: [
        { id: 'grand-livre', label: 'Grand livre', disabled: false },
        { id: 'rapprochement-bancaire', label: 'Rapprochement bancaire', disabled: false },
        { id: 'lettrage', label: 'Lettrage manuel', disabled: false },
      ]
    },
    {
      title: 'Dossiers de travail',
      items: [
        { id: 'dossier-travail', label: 'Dossier de travail', disabled: true },
        { id: 'historique', label: 'Historique', disabled: true },
      ]
    },
    {
      title: 'Écritures d\'inventaire',
      items: [
        { id: 'immobilisations', label: 'Immobilisations', disabled: false },
        { id: 'emprunts', label: 'Emprunts', disabled: false },
        { id: 'credits-bail', label: 'Crédits-bail', disabled: true },
        { id: 'vehicules', label: 'Véhicules', disabled: true },
        { id: 'subventions', label: 'Subventions', disabled: true },
      ]
    },
    {
      title: 'Écritures de régularisation',
      items: [
        { id: 'charges-avance', label: 'Charges constatées d\'avance', disabled: true },
        { id: 'produits-avance', label: 'Produits constatés d\'avance', disabled: true },
        { id: 'charges-payer', label: 'Charges à payer', disabled: true },
        { id: 'produits-recevoir', label: 'Produits à recevoir', disabled: true },
        { id: 'factures-non-parvenues', label: 'Factures non parvenues', disabled: true },
        { id: 'factures-etablir', label: 'Factures à établir', disabled: true },
        { id: 'creances-douteuses', label: 'Créances douteuses', isNew: true, disabled: true },
      ]
    },
    {
      title: 'Autres modules',
      items: [
        { id: 'comptes-courants', label: 'Comptes courants', disabled: true },
        { id: 'intercos', label: 'Intercos et réciprocités', disabled: true },
        { id: 'impot-societes', label: 'Impôt sur les sociétés', disabled: true },
      ]
    },
  ]

  // Saisie menu structure
  const saisieMenuSections = [
    {
      title: 'Factures',
      items: [
        { id: 'factures-fournisseurs', label: 'Factures fournisseurs', hasLink: true, disabled: false },
        { id: 'factures-clients', label: 'Factures clients', hasLink: false, disabled: false },
      ]
    },
    {
      title: 'Banque',
      items: [
        { id: 'transactions', label: 'Transactions', hasLink: false, disabled: false },
        { id: 'rapprochement-bancaire', label: 'Rapprochement bancaire', hasLink: false, disabled: false },
      ]
    },
    {
      title: 'Écritures',
      items: [
        { id: 'journaux', label: 'Journaux', hasLink: false, disabled: false },
        { id: 'saisie-masse', label: 'Saisie en masse', hasLink: false, disabled: true },
      ]
    },
    {
      title: 'Imports/Exports',
      items: [
        { id: 'imports', label: 'Imports', hasLink: false, disabled: false },
        { id: 'exports', label: 'Exports', hasLink: false, disabled: false },
      ]
    },
  ]

  const comptaSidebarIcons2 = [
    { id: 'vue-client', icon: 'eye', hasDot: true },
    { id: 'facturation', icon: 'bolt' },
    { id: 'assistant', icon: 'sparkles' },
    { id: 'recherche', icon: 'search' },
    { id: 'parametres', icon: 'cog' },
    { id: 'outils', icon: 'wrench' },
    { id: 'aide', icon: 'question' },
  ]

  return (
    <AuthGuard>
    <div className="h-screen flex" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Comptabilité Mode - Slim Sidebar */}
      {mode === 'comptabilite' && (
        <aside className="w-14 flex flex-col items-center py-3" style={{ backgroundColor: '#141A1F' }}>
          {/* Logo */}
          <div className="mb-4 px-1">
            <img src="/pennybarr-logo.svg" alt="Pennybarr" className="h-5 w-auto" />
          </div>

          {/* Main icons */}
          <nav className="flex-1 flex flex-col items-center gap-1">
            {comptaSidebarIcons.map((item) => (
              <button
                key={item.id}
                onClick={() => setComptaActiveIcon(comptaActiveIcon === item.id ? '' : item.id)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${comptaActiveIcon === item.id ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                style={comptaActiveIcon === item.id ? { backgroundColor: '#006666' } : {}}
              >
                {item.icon === 'edit' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                )}
                {item.icon === 'clock' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {item.icon === 'euro' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {item.icon === 'document' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                )}
                {item.icon === 'folder' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                )}
              </button>
            ))}

            <div className="flex-1" />

            {/* Secondary icons */}
            {comptaSidebarIcons2.map((item) => (
              <button
                key={item.id}
                className="relative w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5"
              >
                {item.hasDot && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: '#23A84B' }}></span>
                )}
                {item.icon === 'eye' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                {item.icon === 'bolt' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                )}
                {item.icon === 'sparkles' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                )}
                {item.icon === 'search' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                )}
                {item.icon === 'cog' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                {item.icon === 'wrench' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                  </svg>
                )}
                {item.icon === 'question' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                  </svg>
                )}
              </button>
            ))}
          </nav>
        </aside>
      )}

      {/* Saisie Panel - appears when saisie icon is active */}
      {mode === 'comptabilite' && comptaActiveIcon === 'saisie' && (
        <aside className="bg-white border-r flex flex-col" style={{ borderColor: '#E4E5E7', width: '300px' }}>
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>Saisie</h2>

            {/* Search button */}
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm mb-2" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              Recherche d'écritures
            </button>

            {/* New entry button */}
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm mb-6" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
              Nouvelle saisie
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Menu sections */}
            {saisieMenuSections.map((section) => (
              <div key={section.title} className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6C767F' }}>{section.title}</p>
                {section.items.map((item) => (
                  item.disabled ? (
                    <DisabledMenuItem key={item.id} tooltip="API Dolibarr indisponible">
                      <div
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm whitespace-nowrap"
                        style={{ color: '#141A1F' }}
                      >
                        <span>{item.label}</span>
                      </div>
                    </DisabledMenuItem>
                  ) : (
                    <button
                      key={item.id}
                      onClick={() => setComptaSelectedItem(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                        comptaSelectedItem === item.id ? 'font-medium' : ''
                      }`}
                      style={{
                        backgroundColor: comptaSelectedItem === item.id ? '#D9EFEB' : 'transparent',
                        color: comptaSelectedItem === item.id ? '#006666' : '#141A1F'
                      }}
                    >
                      <span>{item.label}</span>
                      {item.hasLink && comptaSelectedItem === item.id && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      )}
                    </button>
                  )
                ))}
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Révision Panel - appears when historique icon is active */}
      {mode === 'comptabilite' && comptaActiveIcon === 'historique' && (
        <aside className="bg-white border-r flex flex-col overflow-y-auto" style={{ borderColor: '#E4E5E7', width: '300px' }}>
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>Révision</h2>

            {/* Export button */}
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm mb-6" style={{ borderColor: '#006666', color: '#006666' }}>
              Exporter une balance
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Menu sections */}
            {revisionMenuSections.map((section, idx) => (
              <div key={section.title || `section-${idx}`} className={section.title ? 'mb-4' : 'mb-4 pt-2 border-t'} style={{ borderColor: '#E4E5E7' }}>
                {section.title && (
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6C767F' }}>{section.title}</p>
                )}
                {section.items.map((item: { id: string; label: string; isNew?: boolean; disabled?: boolean }) => (
                  item.disabled ? (
                    <DisabledMenuItem key={item.id} tooltip="API Dolibarr indisponible">
                      <div
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm whitespace-nowrap"
                        style={{ color: '#141A1F' }}
                      >
                        <span>{item.label}</span>
                        {item.isNew && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#F2F2F3', color: '#9CA3AF' }}>
                            Nouv
                          </span>
                        )}
                      </div>
                    </DisabledMenuItem>
                  ) : (
                    <button
                      key={item.id}
                      onClick={() => setComptaSelectedItem(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                        comptaSelectedItem === item.id ? 'font-medium' : ''
                      }`}
                      style={{
                        backgroundColor: comptaSelectedItem === item.id ? '#D9EFEB' : 'transparent',
                        color: comptaSelectedItem === item.id ? '#006666' : '#141A1F'
                      }}
                    >
                      <span>{item.label}</span>
                      {item.isNew && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#D9EFEB', color: '#006666' }}>
                          Nouv
                        </span>
                      )}
                    </button>
                  )
                ))}
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Fiscalité Panel - appears when euro icon is active */}
      {mode === 'comptabilite' && comptaActiveIcon === 'euro' && (
        <aside className="bg-white border-r flex flex-col overflow-y-auto" style={{ borderColor: '#E4E5E7', width: '300px' }}>
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-2" style={{ color: '#141A1F' }}>Fiscalité</h2>
            <p className="text-xs mb-4 flex items-center gap-1" style={{ color: '#E65100' }}>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              Fonctionnalités non disponibles via API Dolibarr
            </p>

            {/* Menu sections */}
            {fiscaliteMenuSections.map((section, idx) => (
              <div key={`fiscalite-${idx}`} className={idx > 0 ? 'pt-3 mt-3 border-t' : ''} style={{ borderColor: '#E4E5E7' }}>
                {section.items.map((item: { id: string; label: string; isNew?: boolean; disabled?: boolean }) => (
                  item.disabled ? (
                    <DisabledMenuItem key={item.id} tooltip="API Dolibarr indisponible">
                      <div
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm whitespace-nowrap"
                        style={{ color: '#141A1F' }}
                      >
                        <span>{item.label}</span>
                        {item.isNew && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#F2F2F3', color: '#9CA3AF' }}>
                            Nouv
                          </span>
                        )}
                      </div>
                    </DisabledMenuItem>
                  ) : (
                    <button
                      key={item.id}
                      onClick={() => setComptaSelectedItem(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                        comptaSelectedItem === item.id ? 'font-medium' : ''
                      }`}
                      style={{
                        backgroundColor: comptaSelectedItem === item.id ? '#D9EFEB' : 'transparent',
                        color: comptaSelectedItem === item.id ? '#006666' : '#141A1F'
                      }}
                    >
                      <span>{item.label}</span>
                      {item.isNew && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#D9EFEB', color: '#006666' }}>
                          Nouv
                        </span>
                      )}
                    </button>
                  )
                ))}
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* États de synthèse Panel - appears when document icon is active */}
      {mode === 'comptabilite' && comptaActiveIcon === 'document' && (
        <aside className="bg-white border-r flex flex-col overflow-y-auto" style={{ borderColor: '#E4E5E7', width: '300px' }}>
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-2" style={{ color: '#141A1F' }}>États de synthèse</h2>
            <p className="text-xs mb-4 flex items-center gap-1" style={{ color: '#E65100' }}>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              Fonctionnalités non disponibles via API Dolibarr
            </p>

            {/* Download button - disabled */}
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm mb-6 opacity-50 cursor-not-allowed" style={{ borderColor: '#D6D9DB', color: '#9CA3AF' }}>
              Télécharger
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Menu sections */}
            {etatsSyntheseMenuSections.map((section, idx) => (
              <div key={section.title} className={idx > 0 ? 'pt-3 mt-3 border-t' : ''} style={{ borderColor: '#E4E5E7' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>{section.title}</p>
                {section.items.map((item: { id: string; label: string; disabled?: boolean }) => (
                  item.disabled ? (
                    <DisabledMenuItem key={item.id} tooltip="API Dolibarr indisponible">
                      <div
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm whitespace-nowrap"
                        style={{ color: '#141A1F' }}
                      >
                        <span>{item.label}</span>
                      </div>
                    </DisabledMenuItem>
                  ) : (
                    <button
                      key={item.id}
                      onClick={() => setComptaSelectedItem(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                        comptaSelectedItem === item.id ? 'font-medium' : ''
                      }`}
                      style={{
                        backgroundColor: comptaSelectedItem === item.id ? '#D9EFEB' : 'transparent',
                        color: comptaSelectedItem === item.id ? '#006666' : '#141A1F'
                      }}
                    >
                      <span>{item.label}</span>
                    </button>
                  )
                ))}
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Dossier du client Panel - appears when folder icon is active */}
      {mode === 'comptabilite' && comptaActiveIcon === 'folder' && (
        <aside className="bg-white border-r flex flex-col overflow-y-auto" style={{ borderColor: '#E4E5E7', width: '300px' }}>
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>Dossier du client</h2>

            {/* Record time button */}
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm mb-6" style={{ borderColor: '#006666', color: '#006666' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Enregistrer un temps
            </button>

            {/* Menu sections */}
            {dossierClientMenuSections.map((section, idx) => (
              <div key={`dossier-${idx}`} className={idx > 0 ? 'pt-3 mt-3 border-t' : ''} style={{ borderColor: '#E4E5E7' }}>
                {section.title && (
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6C767F' }}>{section.title}</p>
                )}
                {section.items.map((item: { id: string; label: string; disabled?: boolean; partial?: boolean }) => (
                  item.disabled ? (
                    <DisabledMenuItem key={item.id} tooltip="API Dolibarr indisponible">
                      <div
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm whitespace-nowrap"
                        style={{ color: '#141A1F' }}
                      >
                        <span>{item.label}</span>
                      </div>
                    </DisabledMenuItem>
                  ) : (
                    <button
                      key={item.id}
                      onClick={() => setComptaSelectedItem(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                        comptaSelectedItem === item.id ? 'font-medium' : ''
                      }`}
                      style={{
                        backgroundColor: comptaSelectedItem === item.id ? '#D9EFEB' : 'transparent',
                        color: comptaSelectedItem === item.id ? '#006666' : '#141A1F'
                      }}
                    >
                      <span>{item.label}</span>
                      {item.partial && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>partiel</span>
                      )}
                    </button>
                  )
                ))}
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Gestion Mode - Full Sidebar */}
      {mode === 'gestion' && (
      <aside className="w-60 flex flex-col z-50" style={{ backgroundColor: '#141A1F' }}>
        {/* Logo */}
        <div className="p-4 flex items-center gap-2">
          <img src="/pennybarr-logo.svg" alt="Pennybarr" className="h-6"  />
        </div>

        {/* Toggle */}
        <div className="px-3 mb-4">
          <div className="flex rounded-md overflow-hidden text-xs">
            <button
              onClick={() => setMode('comptabilite')}
              className="flex-1 py-1.5 font-medium transition text-gray-400"
              style={{ backgroundColor: '#22292F' }}
            >
              Comptabilité
            </button>
            <button
              onClick={() => setMode('gestion')}
              className="flex-1 py-1.5 font-medium transition text-white"
              style={{ backgroundColor: '#006666' }}
            >
              Gestion
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = openDropdown ? openDropdown === item.label : currentPage === item.page
            return (
            <div key={item.label}>
              <button
                onClick={() => handleNavClick(item)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition whitespace-nowrap cursor-pointer ${
                  isActive ? 'text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={isActive ? { backgroundColor: '#006666' } : {}}
              >
                <item.icon />
                <span className="truncate">{item.label}</span>
              </button>
            </div>
          )})}

          </nav>

      </aside>
      )}
      {/* End of Gestion Sidebar */}

      {/* Dropdown Menu Overlay */}
      {openDropdown && (
        <>
          {/* Invisible backdrop to close menu on click outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpenDropdown(null)}
          />
          {/* Menu */}
          <div
            className="fixed bg-white rounded-xl shadow-2xl border py-4 z-50"
            style={{
              borderColor: '#E4E5E7',
              left: '252px',
              top: '56px',
              width: '280px'
            }}
          >
            {/* Rapports comptables - special multi-section layout */}
            {openDropdown === 'Rapports comptables' && (
              <>
                <div className="px-5 pb-3">
                  <p className="font-semibold text-lg" style={{ color: '#141A1F' }}>Rapports comptables</p>
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#E65100' }}>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    API Dolibarr limitée pour ces fonctionnalités
                  </p>
                </div>
                {rapportsMenuSections.map((section, idx) => (
                  <div key={section.title} className={idx > 0 ? 'border-t pt-3 mt-2' : ''} style={{ borderColor: '#E4E5E7' }}>
                    <p className="px-5 text-sm font-medium mb-1" style={{ color: section.items.every(i => i.disabled) ? '#9CA3AF' : '#006666' }}>{section.title}</p>
                    {section.items.map((item) => (
                      item.disabled ? (
                        <DisabledMenuItem key={item.label} tooltip="API Dolibarr indisponible">
                          <div className="w-full text-left px-5 py-2 text-sm" style={{ color: '#141A1F' }}>
                            {item.label}
                          </div>
                        </DisabledMenuItem>
                      ) : (
                        <button
                          key={item.label}
                          onClick={() => {
                            setCurrentPage(item.page || 'rapports')
                            setOpenDropdown(null)
                          }}
                          className="w-full text-left px-5 py-2 text-sm hover:bg-gray-50"
                          style={{ color: '#141A1F' }}
                        >
                          {item.label}
                        </button>
                      )
                    ))}
                  </div>
                ))}
              </>
            )}
            {/* Paramètres dropdown */}
            {openDropdown === 'Paramètres' && (
              <>
                <div className="px-5 pb-3">
                  <p className="font-semibold text-lg" style={{ color: '#141A1F' }}>Paramètres</p>
                </div>
                {parametresMenuSections.map((section, idx) => (
                  <div key={idx} className={idx > 0 ? 'border-t pt-3 mt-2' : ''} style={{ borderColor: '#E4E5E7' }}>
                    {section.title && (
                      <p className="px-5 text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#6C767F' }}>{section.title}</p>
                    )}
                    {section.items.map((item: { label: string; disabled?: boolean; page?: Page; badge?: string }) => (
                      item.disabled ? (
                        <DisabledMenuItem key={item.label} tooltip="Fonctionnalité indisponible">
                          <div className="w-full flex items-center justify-between px-5 py-2 text-sm" style={{ color: '#141A1F' }}>
                            <span>{item.label}</span>
                            {item.badge && (
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E6F2F2', color: '#006666' }}>
                                {item.badge}
                              </span>
                            )}
                          </div>
                        </DisabledMenuItem>
                      ) : (
                        <button
                          key={item.label}
                          onClick={() => {
                            setCurrentPage(item.page || 'parametres')
                            setOpenDropdown(null)
                          }}
                          className="w-full flex items-center justify-between px-5 py-2 text-sm hover:bg-gray-50"
                          style={{ color: '#141A1F' }}
                        >
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E6F2F2', color: '#006666' }}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      )
                    ))}
                  </div>
                ))}
              </>
            )}
            {/* Header with buttons (only for Achats/Ventes) */}
            {(openDropdown === 'Achats' || openDropdown === 'Ventes') && (
              <div className="px-5 pb-4 border-b" style={{ borderColor: '#E4E5E7' }}>
                <p className="font-semibold text-lg mb-4" style={{ color: '#141A1F' }}>{openDropdown}</p>
                {openDropdown === 'Achats' ? (
                  <button
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium"
                    style={{ borderColor: '#006666', color: '#006666' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Importer des factures
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => { setCurrentPage('creer-facture'); setOpenDropdown(null) }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-teal-50 transition-colors"
                      style={{ borderColor: '#006666', color: '#006666' }}
                    >
                      Nouvelle facture
                    </button>
                    <button
                      onClick={() => { setCurrentPage('creer-devis'); setOpenDropdown(null) }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-teal-50 transition-colors"
                      style={{ borderColor: '#006666', color: '#006666' }}
                    >
                      Nouveau devis
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Title for Analytique (no buttons) */}
            {openDropdown === 'Analytique' && (
              <div className="px-5 pb-3">
                <p className="font-semibold text-lg" style={{ color: '#141A1F' }}>{openDropdown}</p>
              </div>
            )}
            {/* Menu items for Achats/Ventes/Analytique */}
            {(openDropdown === 'Achats' || openDropdown === 'Ventes' || openDropdown === 'Analytique') && (
              <div className={openDropdown === 'Analytique' ? 'py-1' : 'py-3'}>
                {(openDropdown === 'Achats' ? achatsMenuItems : openDropdown === 'Ventes' ? ventesMenuItems : analytiqueMenuItems)
                  .filter(m => m.section === 'main')
                  .map((menuItem) => (
                    menuItem.disabled ? (
                      <DisabledMenuItem key={menuItem.label} tooltip="API Dolibarr indisponible">
                        <div className="w-full text-left px-5 py-2.5 text-sm" style={{ color: '#141A1F' }}>
                          {menuItem.label}
                        </div>
                      </DisabledMenuItem>
                    ) : (
                      <button
                        key={menuItem.label}
                        onClick={() => {
                          const page = 'page' in menuItem ? (menuItem as { page?: Page }).page : undefined
                          setCurrentPage(page || (openDropdown === 'Achats' ? 'achats' : openDropdown === 'Ventes' ? 'ventes' : 'analytique'))
                          setOpenDropdown(null)
                        }}
                        className="w-full text-left px-5 py-2.5 text-sm hover:bg-gray-50"
                        style={{ color: '#141A1F' }}
                      >
                        {menuItem.label}
                        {'partial' in menuItem && (menuItem as { partial?: boolean }).partial && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>partiel</span>
                        )}
                      </button>
                    )
                  ))}
              </div>
            )}
            {/* Secondary items (only for Achats/Ventes) */}
            {(openDropdown === 'Achats' || openDropdown === 'Ventes') && (
              <div className="border-t py-3" style={{ borderColor: '#E4E5E7' }}>
                {(openDropdown === 'Achats' ? achatsMenuItems : ventesMenuItems)
                  .filter(m => m.section === 'secondary')
                  .map((menuItem) => (
                    menuItem.disabled ? (
                      <DisabledMenuItem key={menuItem.label} tooltip="API Dolibarr indisponible">
                        <div className="w-full text-left px-5 py-2.5 text-sm" style={{ color: '#141A1F' }}>
                          {menuItem.label}
                        </div>
                      </DisabledMenuItem>
                    ) : (
                      <button
                        key={menuItem.label}
                        onClick={() => {
                          const page = 'page' in menuItem ? (menuItem as { page?: Page }).page : undefined
                          setCurrentPage(page || (openDropdown === 'Achats' ? 'achats' : 'ventes'))
                          setOpenDropdown(null)
                        }}
                        className="w-full text-left px-5 py-2.5 text-sm hover:bg-gray-50"
                        style={{ color: '#141A1F' }}
                      >
                        {menuItem.label}
                      </button>
                    )
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-6" style={{ borderColor: '#E4E5E7' }}>
          {/* Toggle in header for comptabilité mode */}
          {mode === 'comptabilite' ? (
            <div className="flex rounded-md overflow-hidden text-xs border" style={{ borderColor: '#D6D9DB' }}>
              <button
                onClick={() => setMode('comptabilite')}
                className="px-3 py-1.5 font-medium bg-white"
                style={{ color: '#141A1F' }}
              >
                Comptabilité
              </button>
              <button
                onClick={() => setMode('gestion')}
                className="px-3 py-1.5 font-medium"
                style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}
              >
                Gestion
              </button>
            </div>
          ) : (
            <div></div>
          )}
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg" style={{ borderColor: '#D6D9DB' }}>
            <span className="font-semibold" style={{ color: '#141A1F' }}>Mon entreprise</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ backgroundColor: '#1C73FF' }}>
              NC
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          {/* Comptabilité Mode - Content based on selected item */}
          {mode === 'comptabilite' && comptaSelectedItem === 'factures-fournisseurs' && <FacturesFournisseursPage />}
          {mode === 'comptabilite' && comptaSelectedItem === 'factures-clients' && <FacturesClientsPage onNavigate={() => {}} />}
          {mode === 'comptabilite' && comptaSelectedItem === 'transactions' && <TransactionsPage onImportClick={() => {}} />}
          {mode === 'comptabilite' && comptaSelectedItem === 'tva-declarations' && <DeclarationTVAPage />}
          {mode === 'comptabilite' && comptaSelectedItem === 'balance-generale' && <BalanceGeneralePage onNavigate={() => {}} />}
          {mode === 'comptabilite' && comptaSelectedItem === 'balance-fournisseurs' && <Suspense fallback={<LoadingSpinner />}><BalanceFournisseursPage onNavigate={() => {}} /></Suspense>}
          {mode === 'comptabilite' && comptaSelectedItem === 'balance-clients' && <Suspense fallback={<LoadingSpinner />}><BalanceClientsPage onNavigate={() => {}} /></Suspense>}
          {mode === 'comptabilite' && comptaSelectedItem === 'balance-agee' && <Suspense fallback={<LoadingSpinner />}><BalanceAgeePage onNavigate={() => {}} /></Suspense>}
          {mode === 'comptabilite' && comptaSelectedItem === 'grand-livre' && <GrandLivrePage onNavigate={() => {}} />}
          {mode === 'comptabilite' && comptaSelectedItem === 'rapprochement-bancaire' && <RapprochementBancairePage onNavigate={() => {}} />}
          {mode === 'comptabilite' && comptaSelectedItem === 'journaux' && <JournauxPage onNavigate={() => {}} />}
          {mode === 'comptabilite' && comptaSelectedItem === 'imports' && <HistoriqueImportsPage onNavigate={() => {}} />}
          {mode === 'comptabilite' && comptaSelectedItem === 'bilan' && <Suspense fallback={<LoadingSpinner />}><BilanPage onNavigate={() => {}} /></Suspense>}
          {mode === 'comptabilite' && comptaSelectedItem === 'compte-resultat' && <Suspense fallback={<LoadingSpinner />}><CompteResultatPage onNavigate={() => {}} /></Suspense>}
          {mode === 'comptabilite' && comptaSelectedItem === 'sig' && <Suspense fallback={<LoadingSpinner />}><SIGPage onNavigate={() => {}} /></Suspense>}
          {mode === 'comptabilite' && comptaSelectedItem === 'caf' && <Suspense fallback={<LoadingSpinner />}><CAFPage onNavigate={() => {}} /></Suspense>}
          {mode === 'comptabilite' && comptaSelectedItem === 'immobilisations' && <ImmobilisationsPage onNavigate={() => {}} />}
          {mode === 'comptabilite' && comptaSelectedItem === 'emprunts' && <EmpruntsPage onNavigate={() => {}} />}
          {mode === 'comptabilite' && comptaSelectedItem === 'lettrage' && <LettragePage onNavigate={() => {}} />}
          {mode === 'comptabilite' && comptaSelectedItem === 'vos-declarations' && <VosDeclarationsPage onNavigate={(page) => setComptaSelectedItem(page)} />}
          {mode === 'comptabilite' && comptaSelectedItem === 'nouvelle-liasse-fiscale' && <NouvelleLiasseFiscalePage onNavigate={(page) => setComptaSelectedItem(page)} />}
          {mode === 'comptabilite' && comptaSelectedItem === 'liasse-fiscale-details' && <LiasseFiscaleDetailsPage onNavigate={(page) => setComptaSelectedItem(page)} />}

          {/* Gestion Mode Pages */}
          {mode === 'gestion' && (
            <>
              {/* Transactions Page */}
              {currentPage === 'transactions' && (
                <TransactionsPage onImportClick={() => setCurrentPage('import-bancaire')} />
              )}

              {/* Factures Fournisseurs Page */}
              {currentPage === 'factures-fournisseurs' && <FacturesFournisseursPage />}

              {/* Bank Import Page */}
              {currentPage === 'import-bancaire' && <BankImportPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Pennylane Migration Page */}
              {currentPage === 'migration-pennylane' && <PennylaneImportPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Grand Livre Import Page */}
              {currentPage === 'grand-livre-import' && <GrandLivreImportPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Grand Livre Page */}
              {currentPage === 'grand-livre' && <GrandLivrePage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Balance Generale Page */}
              {currentPage === 'balance-generale' && <BalanceGeneralePage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Journaux Page */}
              {currentPage === 'journaux' && <JournauxPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Plan Comptable Page */}
              {currentPage === 'plan-comptable' && <PlanComptablePage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Fournisseurs Page */}
              {currentPage === 'fournisseurs' && <TiersPage onNavigate={(page) => setCurrentPage(page as Page)} initialTab="suppliers" />}

              {/* Clients Page */}
              {currentPage === 'clients' && <TiersPage onNavigate={(page) => setCurrentPage(page as Page)} initialTab="customers" />}

              {/* Informations Entreprise Page */}
              {currentPage === 'informations-entreprise' && <InformationsEntreprisePage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Connectivité Page */}
              {currentPage === 'connectivite' && <ConnectivitePage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Declaration TVA Page */}
              {currentPage === 'declaration-tva' && <DeclarationTVAPage />}

              {/* Factures Clients Page */}
              {currentPage === 'factures-clients' && <FacturesClientsPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Paramètres Facturation Client Page */}
              {currentPage === 'parametres-factures-clients' && <ParametresFacturesClientsPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Create Invoice Page */}
              {currentPage === 'creer-facture' && (
                <CreateInvoicePage
                  onNavigate={(page) => setCurrentPage(page as Page)}
                  returnTo={previousPage === 'accueil' ? 'accueil' : 'factures-clients'}
                />
              )}

              {/* Create Quote Page */}
              {currentPage === 'creer-devis' && (
                <CreateQuotePage
                  onNavigate={(page) => setCurrentPage(page as Page)}
                  returnTo={previousPage === 'accueil' ? 'accueil' : 'devis'}
                />
              )}

              {/* Avoirs Clients Page */}
              {currentPage === 'avoirs-clients' && <AvoirsPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Cloture Exercice Page */}
              {currentPage === 'cloture-exercice' && <ClotureExercicePage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Rapports Analytiques Page (lazy-loaded) */}
              {currentPage === 'rapports-analytiques' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <RapportsAnalytiquesPage onNavigate={(page) => setCurrentPage(page as Page)} />
                </Suspense>
              )}

              {/* Balance Fournisseurs Page (lazy-loaded) */}
              {currentPage === 'balance-fournisseurs' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <BalanceFournisseursPage onNavigate={(page) => setCurrentPage(page as Page)} />
                </Suspense>
              )}

              {/* Balance Clients Page (lazy-loaded) */}
              {currentPage === 'balance-clients' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <BalanceClientsPage onNavigate={(page) => setCurrentPage(page as Page)} />
                </Suspense>
              )}

              {/* Balance Agee Page (lazy-loaded) */}
              {currentPage === 'balance-agee' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <BalanceAgeePage onNavigate={(page) => setCurrentPage(page as Page)} />
                </Suspense>
              )}

              {/* Rapprochement Bancaire Page */}
              {currentPage === 'rapprochement-bancaire' && <RapprochementBancairePage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Lettrage Page */}
              {currentPage === 'lettrage' && <LettragePage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Bilan Page (lazy-loaded) */}
              {currentPage === 'bilan' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <BilanPage onNavigate={(page) => setCurrentPage(page as Page)} />
                </Suspense>
              )}

              {/* Compte de Resultat Page (lazy-loaded) */}
              {currentPage === 'compte-resultat' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <CompteResultatPage onNavigate={(page) => setCurrentPage(page as Page)} />
                </Suspense>
              )}

              {/* Notes de Frais Page */}
              {currentPage === 'notes-frais' && <NotesFraisPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Commandes Fournisseurs Page */}
              {currentPage === 'commandes-fournisseurs' && <CommandesFournisseursPage />}

              {/* Devis Page */}
              {currentPage === 'devis' && <DevisPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Produits et Services Page */}
              {currentPage === 'produits-services' && <ProduitsServicesPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Relances Page */}
              {currentPage === 'relances' && <RelancesPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Contrats Page */}
              {currentPage === 'contrats' && <ContratsPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Immobilisations Page */}
              {currentPage === 'immobilisations' && <ImmobilisationsPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Emprunts Page */}
              {currentPage === 'emprunts' && <EmpruntsPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* SIG Page (lazy-loaded) */}
              {currentPage === 'sig' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <SIGPage onNavigate={(page) => setCurrentPage(page as Page)} />
                </Suspense>
              )}

              {/* CAF Page (lazy-loaded) */}
              {currentPage === 'caf' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <CAFPage onNavigate={(page) => setCurrentPage(page as Page)} />
                </Suspense>
              )}

              {/* Plan de Tresorerie Page (lazy-loaded) */}
              {currentPage === 'plan-tresorerie' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <PlanTresoreriePage onNavigate={(page) => setCurrentPage(page as Page)} />
                </Suspense>
              )}

              {/* Virements SEPA Page */}
              {currentPage === 'virements-sepa' && <PaiementsSEPAPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Familles Analytiques Page */}
              {currentPage === 'familles-analytiques' && <FamillesAnalytiquesPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Historique Imports Page */}
              {currentPage === 'historique-imports' && <HistoriqueImportsPage onNavigate={(page) => setCurrentPage(page as Page)} />}

              {/* Documents Page (GED) */}
              {currentPage === 'documents' && <DocumentsPage />}

              {/* Dashboard (Accueil) */}
              {currentPage === 'accueil' && (
          <>
          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-6">
            <h1 className="text-2xl font-semibold mb-2" style={{ color: '#141A1F' }}>
              👋 Bienvenue !
            </h1>
            <p className="text-sm mb-6" style={{ color: '#6C767F' }}>
              Collaborez efficacement et suivez vos performances.
            </p>

            {/* Documents section */}
            <section className="mb-8">
              <h2 className="font-semibold mb-4" style={{ color: '#141A1F' }}>Déposez vos documents</h2>
              <div className="grid grid-cols-3 gap-4">
                {/* Card 1 */}
                <div className="bg-white rounded-xl p-5 border-2 border-dashed" style={{ borderColor: '#D6D9DB' }}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded flex items-center justify-center" style={{ backgroundColor: '#F2F2F3' }}>
                      <svg className="w-8 h-8" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: '#141A1F' }}>Factures</p>
                      <p className="text-sm" style={{ color: '#6C767F' }}>fournisseurs</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setInvoiceModalType('supplier'); setInvoiceModalOpen(true) }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded border text-sm font-medium"
                    style={{ borderColor: '#006666', color: '#006666' }}
                  >
                    + Ajouter
                  </button>
                </div>

                {/* Card 2 */}
                <div className="bg-white rounded-xl p-5 border-2 border-dashed" style={{ borderColor: '#006666' }}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded flex items-center justify-center" style={{ backgroundColor: '#D9EFEB' }}>
                      <svg className="w-8 h-8" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                      </svg>
                    </div>
                    <p className="font-medium" style={{ color: '#141A1F' }}>Factures clients</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setInvoiceModalType('customer'); setInvoiceModalOpen(true) }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded border text-sm font-medium"
                      style={{ borderColor: '#006666', color: '#006666' }}
                    >
                      + Ajouter
                    </button>
                    <button
                      onClick={() => navigateToPage('creer-facture')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#006666' }}
                    >
                      + Créer
                    </button>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="bg-white rounded-xl p-5 border-2 border-dashed" style={{ borderColor: '#D6D9DB' }}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded flex items-center justify-center" style={{ backgroundColor: '#F2F2F3' }}>
                      <svg className="w-8 h-8" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <p className="font-medium" style={{ color: '#141A1F' }}>Autres documents</p>
                  </div>
                  <button
                    onClick={() => setCurrentPage('documents')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded border text-sm font-medium hover:bg-teal-50 transition-colors"
                    style={{ borderColor: '#006666', color: '#006666' }}
                  >
                    + Ajouter
                  </button>
                </div>
              </div>
            </section>

            {/* Stats section */}
            <section className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <h2 className="font-semibold" style={{ color: '#141A1F' }}>Analysez vos chiffres clés de</h2>
                <select className="border rounded-lg px-3 py-1.5 text-sm" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
                  <option>Cette année</option>
                </select>
              </div>
              <div className="bg-white rounded-xl p-6 border" style={{ borderColor: '#E4E5E7' }}>
                {statsLoading ? (
                  <div className="text-center py-4" style={{ color: '#6C767F' }}>Chargement...</div>
                ) : (
                  <>
                    {/* Row 1: Solde des comptes */}
                    <div className="mb-6">
                      <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Solde des comptes</p>
                      <div className="flex items-center gap-3">
                        <p className="text-2xl font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(stats?.bankBalance ?? 0)}</p>
                        <div className="flex items-center gap-1 px-2 py-1 rounded" style={{ backgroundColor: '#F2F2F3' }}>
                          <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                          </svg>
                          <div className="w-8 h-4 rounded-full flex items-center px-0.5" style={{ backgroundColor: '#006666' }}>
                            <div className="w-3 h-3 rounded-full bg-white ml-auto"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Encaissements, Décaissements, Balance */}
                    <div className="grid grid-cols-3 gap-6 mb-6">
                      <div>
                        <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Encaissements</p>
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#23A84B' }}>↗</span>
                          <p className="text-2xl font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(stats?.totalIncome ?? 0)}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Décaissements</p>
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#D8314A' }}>↘</span>
                          <p className="text-2xl font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(stats?.totalExpense ?? 0)}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Balance</p>
                        <p className="text-2xl font-semibold" style={{ color: stats?.balance && stats.balance >= 0 ? '#23A84B' : '#D8314A' }}>{formatCurrency(stats?.balance ?? 0)}</p>
                      </div>
                    </div>

                    {/* Row 3: Transactions à rapprocher et Factures en attente */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Transactions à rapprocher</p>
                        <p className="text-2xl font-semibold" style={{ color: '#141A1F' }}>{stats?.unreconciledTransactions ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-sm mb-1" style={{ color: '#6C767F' }}>Factures en attente</p>
                        <p className="text-2xl font-semibold" style={{ color: stats?.overdueInvoices && stats.overdueInvoices > 0 ? '#D8314A' : '#141A1F' }}>
                          {stats?.pendingInvoices ?? 0}
                          {stats?.overdueInvoices && stats.overdueInvoices > 0 && (
                            <span className="text-sm font-normal ml-2" style={{ color: '#D8314A' }}>({stats.overdueInvoices} en retard)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Gérez votre activité section */}
            <section className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <h2 className="font-semibold" style={{ color: '#141A1F' }}>Gérez votre activité de</h2>
                <select className="border rounded-lg px-3 py-1.5 text-sm flex items-center gap-2" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
                  <option>Cette année</option>
                  <option>2025</option>
                  <option>2024</option>
                </select>
              </div>

              {/* Two column layout */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left column */}
                <div className="space-y-4">
                  {/* Transactions à justifier */}
                  <div className="bg-white rounded-xl p-5 border" style={{ borderColor: '#E4E5E7' }}>
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="font-semibold" style={{ color: '#141A1F' }}>Transactions à justifier</h3>
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
                        {stats?.unreconciledTransactions ?? 0}
                      </span>
                    </div>

                    {/* Transaction list */}
                    <div className="space-y-3">
                      {txLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: '#006666' }} />
                        </div>
                      ) : unreconciledTx.length === 0 ? (
                        <p className="text-sm text-center py-4" style={{ color: '#6C767F' }}>
                          Aucune transaction à justifier
                        </p>
                      ) : (
                        unreconciledTx.map((tx, idx) => (
                          <div
                            key={tx.id}
                            className={`flex items-center justify-between py-2 ${idx < unreconciledTx.length - 1 ? 'border-b' : ''}`}
                            style={{ borderColor: '#F2F2F3' }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-5 rounded flex items-center justify-center" style={{ backgroundColor: '#F2F2F3' }}>
                                <svg className="w-4 h-4" style={{ color: '#6C767F' }} viewBox="0 0 24 24" fill="currentColor">
                                  <rect x="2" y="5" width="20" height="14" rx="2" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-medium truncate max-w-[250px]" style={{ color: '#141A1F' }} title={tx.label}>
                                  {tx.label.length > 35 ? tx.label.slice(0, 35) + '...' : tx.label}
                                </p>
                                <p className="text-xs" style={{ color: '#6C767F' }}>{formatTxDate(tx.date)}</p>
                              </div>
                            </div>
                            <p className="text-sm font-medium" style={{ color: tx.amount < 0 ? '#141A1F' : '#2E7D32' }}>
                              {formatCurrency(tx.amount)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      onClick={() => setCurrentPage('transactions')}
                      className="mt-4 text-sm font-medium"
                      style={{ color: '#006666' }}
                    >
                      Voir toutes
                    </button>
                  </div>

                  {/* Aucune facture fournisseur en retard */}
                  <div className="bg-white rounded-xl p-6 border" style={{ borderColor: '#E4E5E7' }}>
                    <div className="flex flex-col items-center text-center">
                      {/* Illustration */}
                      <div className="mb-4">
                        <svg className="w-24 h-24" viewBox="0 0 100 100">
                          {/* Document */}
                          <rect x="30" y="20" width="40" height="55" rx="4" fill="#D9EFEB" stroke="#006666" strokeWidth="2" />
                          <line x1="38" y1="35" x2="62" y2="35" stroke="#006666" strokeWidth="2" />
                          <line x1="38" y1="45" x2="58" y2="45" stroke="#006666" strokeWidth="2" />
                          <line x1="38" y1="55" x2="55" y2="55" stroke="#006666" strokeWidth="2" />
                          {/* Checkmark */}
                          <circle cx="65" cy="65" r="12" fill="#006666" />
                          <path d="M60 65 L63 68 L70 61" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <h3 className="font-semibold mb-2" style={{ color: '#141A1F' }}>Aucune facture fournisseur en retard</h3>
                      <p className="text-sm" style={{ color: '#6C767F' }}>
                        Il semble qu'il n'y ait aucune facture fournisseur en retard pour cette année.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div>
                  {/* Aucune facture client en retard */}
                  <div className="bg-white rounded-xl p-6 border" style={{ borderColor: '#E4E5E7' }}>
                    <div className="flex flex-col items-center text-center">
                      {/* Illustration */}
                      <div className="mb-4">
                        <svg className="w-24 h-24" viewBox="0 0 100 100">
                          {/* Document */}
                          <rect x="30" y="20" width="40" height="55" rx="4" fill="#D9EFEB" stroke="#006666" strokeWidth="2" />
                          <line x1="38" y1="35" x2="62" y2="35" stroke="#006666" strokeWidth="2" />
                          <line x1="38" y1="45" x2="58" y2="45" stroke="#006666" strokeWidth="2" />
                          <line x1="38" y1="55" x2="55" y2="55" stroke="#006666" strokeWidth="2" />
                          {/* Checkmark */}
                          <circle cx="65" cy="65" r="12" fill="#006666" />
                          <path d="M60 65 L63 68 L70 61" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <h3 className="font-semibold mb-2" style={{ color: '#141A1F' }}>Aucune facture client en retard</h3>
                      <p className="text-sm mb-4" style={{ color: '#6C767F' }}>
                        Il semble qu'il n'y ait aucune facture client en retard pour cette année.
                      </p>
                      <button className="px-4 py-2 rounded-lg border text-sm font-medium" style={{ borderColor: '#006666', color: '#006666' }}>
                        Voir toutes les factures clients
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </main>
          </>
          )}
            </>
          )}
        </div>
      </div>

      {/* Invoice Upload Modal */}
      <InvoiceUploadModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        type={invoiceModalType}
      />
    </div>
    </AuthGuard>
  )
}

export default App
