# Pennybarr - Document d'Architecture

## Vue d'ensemble

**Pennybarr** est une application de gestion comptable inspirée de Pennylane, connectée à un backend Dolibarr via API REST.

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                    React 19 + Vite 7                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   App.tsx   │  │   Pages     │  │      Services           │  │
│  │  (Router &  │  │ - Dashboard │  │  - dolibarr.ts (API)    │  │
│  │   Layout)   │  │ - Factures  │  │  - useDolibarr.ts       │  │
│  │             │  │ - Documents │  │    (React hooks)        │  │
│  │  2 Modes:   │  │ - Transac.  │  │                         │  │
│  │  - Gestion  │  │             │  │                         │  │
│  │  - Compta   │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST (via Vite proxy)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│                    Dolibarr (Docker)                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     REST API                                 ││
│  │  /api/thirdparties  - Tiers (clients, fournisseurs)         ││
│  │  /api/invoices      - Factures clients                      ││
│  │  /api/supplierinvoices - Factures fournisseurs              ││
│  │  /api/bankaccounts  - Comptes bancaires                     ││
│  │  /api/products      - Produits & Services                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    MariaDB/MySQL                            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Stack Technique

| Couche | Technologie | Version | Rôle |
|--------|-------------|---------|------|
| Frontend | React | 19.2 | UI Components |
| Build | Vite | 7.2 | Dev server & bundler |
| Styling | Tailwind CSS | 4.1 | Utility-first CSS |
| State | Zustand | 5.0 | Global state management |
| Routing | React Router | 7.13 | Navigation SPA |
| HTTP | Axios | 1.13 | API calls |
| Backend | Dolibarr | Latest | ERP & API |
| DB | MariaDB | Latest | Persistence |

---

## Structure des Fichiers

```
pennybarr/
├── src/
│   ├── App.tsx              # Layout principal + routing
│   ├── main.tsx             # Entry point React
│   ├── index.css            # Styles globaux + design tokens
│   ├── hooks/
│   │   └── useDolibarr.ts   # React hooks pour l'API
│   ├── pages/
│   │   ├── TransactionsPage.tsx
│   │   ├── DocumentsPage.tsx
│   │   └── FacturesFournisseursPage.tsx
│   └── services/
│       └── dolibarr.ts      # Client API Dolibarr
├── vite.config.ts           # Config Vite + proxy API
├── package.json
└── docs/
    └── ARCHITECTURE.md      # Ce fichier
```

---

## Modes d'Interface

L'application propose **deux modes** distincts accessibles via un toggle :

### Mode Gestion (sidebar complète)
- Sidebar de 240px (`w-60`)
- Navigation complète avec dropdowns
- Pages : Accueil, Transactions, Achats, Ventes, Analytique, Rapports, Documents

### Mode Comptabilité (sidebar icônes)
- Sidebar étroite de 56px (`w-14`) avec icônes
- Panels secondaires de 300px
- 5 sections principales :
  1. **Saisie** (crayon) - Factures, Banque, Écritures
  2. **Révision** (horloge) - Balances, Grand livre, Dossiers de travail
  3. **Fiscalité** (euro) - TVA, Liasse fiscale, IS, CVAE
  4. **États de synthèse** (document) - Bilan, Compte de résultat
  5. **Dossier client** (dossier) - GED, Plan comptable, Tiers

---

## Design System

### Palette de couleurs (Pennylane)

```css
/* Primary - Teal */
--ui-primary-700: #006666;  /* Actions, active states */
--ui-primary-50: #D9EFEB;   /* Backgrounds actifs */

/* Secondary - Grays */
--ui-secondary-900: #141A1F; /* Texte principal */
--ui-secondary-500: #6C767F; /* Texte secondaire */
--ui-secondary-100: #E4E5E7; /* Borders */
--ui-secondary-25: #FAFAFB;  /* Background page */

/* Semantic */
--ui-success-500: #23A84B;
--ui-warning-500: #FF993F;
--ui-danger-500: #D8314A;
--ui-info-500: #1C73FF;
```

### Typographie
- Font: Inter (Google Fonts)
- Tailles: 12px (xs), 14px (sm), 16px (base), 18px (lg)

---

## API Dolibarr

### Configuration

```typescript
// vite.config.ts - Proxy
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}

// services/dolibarr.ts - Headers
headers: {
  'DOLAPIKEY': 'YOUR_DOLIBARR_API_KEY',
  'Content-Type': 'application/json',
}
```

### Endpoints utilisés

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/thirdparties` | GET | Liste des tiers |
| `/api/thirdparties?mode=1` | GET | Clients uniquement |
| `/api/thirdparties?mode=2` | GET | Fournisseurs uniquement |
| `/api/invoices` | GET/POST | Factures clients |
| `/api/supplierinvoices` | GET | Factures fournisseurs |
| `/api/bankaccounts` | GET | Comptes bancaires |
| `/api/products` | GET | Produits & services |
| `/api/status` | GET | Test de connexion |

---

## State Management

### Pattern utilisé
- **Local state** (useState) pour l'UI
- **Zustand** prévu pour le state global (auth, user, company)
- **React Query-like hooks** (`useDolibarr.ts`) pour les données API

### États principaux

```typescript
// App.tsx
const [mode, setMode] = useState<'comptabilite' | 'gestion'>('gestion')
const [currentPage, setCurrentPage] = useState<Page>('accueil')
const [openDropdown, setOpenDropdown] = useState<string | null>(null)
const [comptaActiveIcon, setComptaActiveIcon] = useState<string>('saisie')
const [comptaSelectedItem, setComptaSelectedItem] = useState<string>('...')
```

---

## Décisions d'Architecture

### ADR-001: SPA vs MPA
**Décision**: Single Page Application (React)
**Raison**: Expérience utilisateur fluide, transitions instantanées entre modes

### ADR-002: CSS Framework
**Décision**: Tailwind CSS v4 (utility-first)
**Raison**: Développement rapide, cohérence visuelle, proche du design Pennylane

### ADR-003: Backend
**Décision**: Dolibarr comme backend via API REST
**Raison**: ERP open-source mature, API complète, évite de recréer la logique métier

### ADR-004: Proxy API
**Décision**: Vite dev proxy vers Dolibarr
**Raison**: Évite les problèmes CORS en développement

---

## Évolutions Futures

1. **Authentification** - OAuth2 ou JWT avec Dolibarr
2. **Multi-entreprise** - Sélecteur de société
3. **PWA** - Mode offline pour consultation
4. **Tests** - Vitest + Testing Library
5. **CI/CD** - GitHub Actions pour build/deploy

---

## Commandes

```bash
# Développement
npm run dev        # Démarre sur http://localhost:5175

# Build production
npm run build      # Compile dans dist/

# Preview build
npm run preview    # Teste le build de production

# Lint
npm run lint       # Vérifie le code avec ESLint
```

---

*Document créé le 25 janvier 2026*
*Architecte: Winston 🏗️*
