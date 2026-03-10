<p align="center">
  <img src="public/favicon.svg" width="80" alt="Pennybarr logo" />
</p>

<h1 align="center">Pennybarr</h1>

<p align="center">
  <strong>L'interface comptable moderne que Dolibarr méritait.</strong>
  <br />
  Un frontend open source inspiré de <a href="https://www.pennylane.com">Pennylane</a>, construit sur l'ERP open source <a href="https://www.dolibarr.org">Dolibarr</a>.
</p>

<p align="center">
  <a href="#démarrage-rapide">Démarrage rapide</a> &middot;
  <a href="#fonctionnalités">Fonctionnalités</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#contribuer">Contribuer</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License MIT" />
  <img src="https://img.shields.io/badge/react-19.2-61dafb.svg" alt="React 19" />
  <img src="https://img.shields.io/badge/vite-7.2-646cff.svg" alt="Vite 7" />
  <img src="https://img.shields.io/badge/tailwind-4.1-38bdf8.svg" alt="Tailwind 4" />
  <img src="https://img.shields.io/badge/typescript-5.9-3178c6.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/made_in-France-blue.svg" alt="Made in France" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
</p>

---

## Le problème

[Dolibarr](https://www.dolibarr.org) est un ERP/CRM open source puissant, utilisé par des milliers d'entreprises. Son API REST est riche. Mais soyons honnêtes : **son interface date d'une autre époque**.

De l'autre côté, [Pennylane](https://www.pennylane.com) propose une UX exemplaire pour la comptabilité, mais c'est un SaaS propriétaire, payant, et fermé.

**Pennybarr** comble ce fossé : une interface comptable moderne, rapide et élégante, 100% open source, qui se connecte à Dolibarr en backend.

> **Penny**(lane) + (Doli)**barr** = **Pennybarr**

### Statut du projet

Pennybarr est un projet **vibe codé** — entièrement généré par IA (Claude) en pair-programming avec un humain. Le résultat : **130 000+ lignes de code**, 50+ pages fonctionnelles, une interface complète qui tourne.

**Ce projet n'est pas utilisé en production pour l'instant.** C'est une base solide, fonctionnelle, prête à être reprise par quelqu'un de motivé qui veut construire une vraie alternative open source à Pennylane. Le gros du travail d'UI et de logique métier est fait — il reste à industrialiser (tests, CI/CD, auth multi-users, etc.).

Si vous êtes développeur, expert-comptable, ou simplement convaincu qu'un outil de compta moderne devrait être libre : ce repo est pour vous. Forkez, contribuez, faites-en quelque chose.

## Pourquoi Pennybarr ?

| | Dolibarr natif | Pennylane | **Pennybarr** |
|---|---|---|---|
| Open source | Oui | Non | **Oui** |
| Interface moderne | Non | Oui | **Oui** |
| Gratuit | Oui | Non | **Oui** |
| Self-hosted | Oui | Non | **Oui** |
| API comptable complète | Partiel | Oui | **Oui** (via Supabase) |
| Conformité fiscale FR | Basique | Complet | **En cours** |

---

## Fonctionnalités

### Comptabilité

- **Bilan** comptable complet avec actif/passif et export PDF
- **Compte de résultat** avec charges, produits et résultat net
- **Grand Livre** avec filtres par compte, période et lettrage
- **Journaux** comptables (achats, ventes, banque, opérations diverses)
- **Balance générale** avec soldes débiteurs/créditeurs
- **Balance fournisseurs** et **Balance clients** détaillées
- **Balance âgée** pour le suivi des échéances
- **Soldes Intermédiaires de Gestion (SIG)** : marge commerciale, VA, EBE, résultat courant
- **Capacité d'Auto-Financement (CAF)**
- **Plan comptable** PCG complet avec rôles et classification
- **Lettrage** manuel des écritures comptables
- **Rapprochement bancaire** avec import de relevés

### Fiscalité

- **Déclaration TVA CA3** avec calcul automatique par taux (20%, 10%, 5.5%, 2.1%)
- **Liasse fiscale** : création, suivi et détail par exercice
- **Clôture d'exercice** avec écritures de bilan et report à nouveau
- **Gestion des déclarations** fiscales

### Gestion commerciale

- **Factures clients** : création, envoi, suivi des paiements
- **Factures fournisseurs** : import, saisie, validation
- **Devis** avec conversion en facture
- **Avoirs clients**
- **Relances** automatiques pour factures impayées
- **Virements SEPA** avec génération de fichiers XML
- **Contrats & Abonnements**
- **Produits et Services** avec catalogue

### Achats

- **Commandes fournisseurs**
- **Notes de frais** des équipes
- **Import de factures** par upload

### Outils

- **GED** (Gestion Électronique de Documents) avec arborescence de dossiers
- **Import bancaire** (formats CFONB, CSV)
- **Immobilisations** et amortissements
- **Emprunts** avec tableaux d'amortissement
- **Familles analytiques** et rapports analytiques
- **Plan de trésorerie** prévisionnel
- **Historique des imports**
- **Export PDF** sur toutes les pages comptables
- **Recherche SIRET** via API (Edge Function)

### Intégrations

- **Pennylane** : synchronisation bidirectionnelle (comptes, écritures, clients, fournisseurs, factures, devis, produits, catégories, documents)
- **Dolibarr** : backend ERP via API REST
- **Supabase** : base de données PostgreSQL, auth et Edge Functions

---

## Architecture

```
                         Pennybarr
         ┌──────────────────────────────────────┐
         │         React 19 + Vite 7            │
         │     Tailwind CSS 4 + Zustand 5       │
         │                                      │
         │  ┌──────────┐ ┌───────────────────┐  │
         │  │  Pages   │ │    Services       │  │
         │  │  (50+)   │ │  - accounting     │  │
         │  │          │ │  - pennylane      │  │
         │  │ Bilan    │ │  - tva            │  │
         │  │ TVA      │ │  - rapprochement  │  │
         │  │ Factures │ │  - invoice        │  │
         │  │ GED      │ │  - ged            │  │
         │  │ ...      │ │  - ...            │  │
         │  └──────────┘ └───────────────────┘  │
         └───────┬──────────────┬───────────────┘
                 │              │
        HTTP/REST│              │ PostgreSQL
        (proxy)  │              │
    ┌────────────┘              └──────────────┐
    │                                          │
    ▼                                          ▼
┌─────────────┐  ┌────────────────┐  ┌────────────────┐
│  Dolibarr   │  │   Supabase     │  │  Pennylane     │
│  (Docker)   │  │                │  │  API v2        │
│             │  │ - PostgreSQL   │  │                │
│ - Tiers     │  │ - Auth         │  │ - Comptes      │
│ - Factures  │  │ - Edge Func.   │  │ - Écritures    │
│ - Banque    │  │ - Vault        │  │ - Factures     │
│ - Produits  │  │                │  │ - Tiers        │
│             │  │ 20+ migrations │  │                │
│  MariaDB    │  │                │  │                │
└─────────────┘  └────────────────┘  └────────────────┘
```

### Deux modes d'interface

Pennybarr propose **deux modes** accessibles via un toggle, inspirés de Pennylane :

**Mode Gestion** — Sidebar complète avec navigation par menus déroulants. Idéal pour la gestion quotidienne (factures, devis, transactions, documents).

**Mode Comptabilité** — Sidebar étroite avec icônes et panels latéraux. 5 sections spécialisées :
1. **Saisie** : factures, banque, écritures, imports
2. **Révision** : balances, grand livre, lettrage
3. **Fiscalité** : TVA, liasse fiscale, déclarations
4. **États de synthèse** : bilan, compte de résultat, SIG, CAF
5. **Dossier client** : GED, plan comptable, tiers

---

## Stack technique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| **Frontend** | React 19.2 | Composants UI |
| **Build** | Vite 7.2 | Dev server et bundler |
| **Styling** | Tailwind CSS 4.1 | Design system utility-first |
| **State** | Zustand 5.0 | État global |
| **Routing** | React Router 7.13 | Navigation SPA |
| **Charts** | Recharts 3.7 | Graphiques et visualisations |
| **PDF** | jsPDF + AutoTable | Export PDF natif |
| **Icons** | Lucide React | Icônes SVG |
| **HTTP** | Axios 1.13 | Appels API |
| **Backend** | Dolibarr 19 | ERP & API REST |
| **Database** | Supabase (PostgreSQL) | Données comptables, auth, vault |
| **Edge Functions** | Supabase Functions | Proxy Pennylane, recherche SIRET |
| **Deploy** | Netlify | Hébergement frontend |

---

## Démarrage rapide

### Prérequis

- [Node.js](https://nodejs.org) >= 20
- [Docker](https://www.docker.com) et Docker Compose
- Un compte [Supabase](https://supabase.com) (gratuit)

### Installation

```bash
# 1. Cloner le repo
git clone https://github.com/pennybarr/pennybarr.git
cd pennybarr

# 2. Installer les dépendances
npm install

# 3. Lancer Dolibarr (backend)
docker compose up -d

# 4. Lancer le frontend
npm run dev
```

L'application est accessible sur `http://localhost:5174`.

Dolibarr tourne sur `http://localhost:8080` (admin / changeme).

### Configuration Dolibarr

Au premier lancement, activez les modules nécessaires dans Dolibarr :
- Société (Tiers)
- Facture
- Fournisseur
- Banque
- Produits/Services
- API REST

Générez une clé API dans **Accueil > Configuration > Utilisateurs > admin > API**.

### Configuration Supabase (optionnel)

Pour les fonctionnalités avancées (plan comptable complet, sync Pennylane, vault) :

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Exécutez les migrations dans `supabase/migrations/` dans l'ordre chronologique
3. Mettez à jour `src/lib/supabase.ts` avec vos clés

### Configuration Pennylane (optionnel)

Pour la synchronisation avec un compte Pennylane :

1. Obtenez une clé API sur [pennylane.com](https://www.pennylane.com)
2. Stockez-la dans le Supabase Vault via la fonction `secure_vault`

---

## Structure du projet

```
pennybarr/
├── src/
│   ├── App.tsx                    # Layout principal + routing + 2 modes
│   ├── main.tsx                   # Point d'entrée React
│   ├── index.css                  # Design tokens Pennylane
│   ├── components/
│   │   ├── invoice/               # Composants facture (header, lignes, sidebar, totaux)
│   │   ├── invoice-settings/      # Paramétrage facturation (6 onglets)
│   │   ├── ged/                   # GED (sidebar, breadcrumb, table, dossiers)
│   │   ├── pennylane/             # Panneau de synchronisation Pennylane
│   │   ├── rapprochement/         # Rapprochement bancaire
│   │   ├── AuthGuard.tsx          # Protection des routes
│   │   └── ...
│   ├── pages/                     # 50+ pages (une par fonctionnalité)
│   │   ├── BilanPage.tsx          # Bilan comptable
│   │   ├── CompteResultatPage.tsx # Compte de résultat
│   │   ├── DeclarationTVAPage.tsx # Déclaration TVA CA3
│   │   ├── GrandLivrePage.tsx     # Grand livre
│   │   ├── FacturesClientsPage.tsx
│   │   ├── RapprochementBancairePage.tsx
│   │   └── ...
│   ├── services/
│   │   ├── accountingService.ts   # Service comptable principal
│   │   ├── tvaService.ts          # Calcul TVA et déclaration CA3
│   │   ├── balanceService.ts      # Balances (générale, fournisseurs, clients)
│   │   ├── invoiceService.ts      # Gestion des factures
│   │   ├── pennylaneService.ts    # Intégration API Pennylane
│   │   ├── pennylane/             # Orchestrateur de sync Pennylane (10 modules)
│   │   ├── rapprochementService.ts
│   │   ├── gedService.ts          # Gestion électronique de documents
│   │   ├── exportService.ts       # Export PDF/CSV
│   │   ├── parsers/cfonbParser.ts # Parser relevés bancaires CFONB
│   │   └── ...
│   ├── hooks/                     # Hooks React (auth, Dolibarr, Supabase)
│   ├── types/                     # Types TypeScript (database, invoices, achats)
│   ├── data/
│   │   └── planComptable.ts       # Plan comptable général PCG
│   ├── lib/
│   │   └── supabase.ts            # Client Supabase + Vault
│   └── utils/
│       └── lettrageColors.ts      # Couleurs pour le lettrage
├── scripts/                       # 20 scripts de sync et migration
│   ├── sync-pennylane-v2.mjs      # Sync complète Pennylane
│   ├── fetch-pennylane-accounts.mjs
│   ├── import-entries.mjs
│   ├── seed-ged-folders.mjs
│   └── ...
├── supabase/
│   ├── functions/                 # Edge Functions
│   │   ├── pennylane-proxy/       # Proxy API Pennylane
│   │   └── search-siret/          # Recherche SIRET entreprise
│   └── migrations/                # 20+ migrations SQL
├── docs/
│   ├── ARCHITECTURE.md            # Documentation d'architecture
│   └── UI-API-MAPPING.md          # Mapping complet UI → API Dolibarr
├── docker-compose.yml             # Dolibarr + MariaDB
├── netlify.toml                   # Config déploiement Netlify
├── vite.config.ts                 # Vite + proxy API + code splitting
└── package.json
```

---

## Design system

L'interface reprend les codes visuels de Pennylane :

- **Couleur primaire** : Teal (`#006666`) pour les actions et états actifs
- **Typographie** : Inter (Google Fonts)
- **Composants** : Cards, tables, modals, dropdowns, sidebars avec transitions fluides
- **Palette** : Tokens CSS custom (`--ui-primary-*`, `--ui-secondary-*`, `--ui-success-*`, etc.)
- **Layout** : Sidebar adaptative selon le mode (gestion 240px / compta 56px + panels 300px)

---

## Scripts utilitaires

| Script | Description |
|--------|-------------|
| `sync-pennylane-v2.mjs` | Synchronisation complète avec Pennylane |
| `fetch-pennylane-accounts.mjs` | Importer le plan comptable depuis Pennylane |
| `fetch-pennylane-entries.mjs` | Importer les écritures comptables |
| `import-entries.mjs` | Import en masse des écritures |
| `sync-categories.mjs` | Synchroniser les catégories analytiques |
| `seed-ged-folders.mjs` | Initialiser l'arborescence GED |
| `run-migration.mjs` | Exécuter les migrations Supabase |
| `test-pennylane-api.mjs` | Tester la connexion API Pennylane |
| `create-guide-pdf.py` | Générer le guide PDF |

---

## Roadmap

- [ ] Authentification multi-utilisateurs complète
- [ ] Multi-entreprise (sélecteur de société)
- [ ] Facturation électronique (Chorus Pro / Peppol)
- [ ] ComptAssistant (assistant IA pour la comptabilité)
- [ ] Import FEC (Fichier des Écritures Comptables)
- [ ] Export FEC réglementaire
- [ ] Calcul automatique IS (acomptes et solde)
- [ ] CVAE
- [ ] DAS2 (déclaration des honoraires)
- [ ] PWA et mode hors-ligne
- [ ] Tests unitaires et E2E (Vitest + Playwright)
- [ ] CI/CD GitHub Actions
- [ ] Documentation API complète
- [ ] Theming / dark mode

---

## Contribuer

Les contributions sont les bienvenues ! Pennybarr est un projet communautaire.

### Comment contribuer

1. **Fork** le repo
2. **Créez** une branche (`git checkout -b feature/ma-fonctionnalité`)
3. **Committez** vos changements (`git commit -m 'Ajout de ma fonctionnalité'`)
4. **Pushez** vers votre branche (`git push origin feature/ma-fonctionnalité`)
5. **Ouvrez** une Pull Request

### Idées de contribution

- Ajouter des tests
- Améliorer l'accessibilité (WCAG)
- Traduire l'interface en anglais
- Ajouter de nouvelles déclarations fiscales
- Améliorer le responsive mobile
- Écrire de la documentation

### Guidelines

- TypeScript strict, pas de `any`
- Tailwind CSS pour le styling (pas de CSS custom sauf tokens)
- Un composant = un fichier
- Les services métier dans `src/services/`
- Les pages dans `src/pages/`

---

## Documentation

- [Architecture détaillée](docs/ARCHITECTURE.md) — Vue d'ensemble technique, stack, design system, ADRs
- [Mapping UI → API](docs/UI-API-MAPPING.md) — Correspondance complète entre l'interface et les endpoints Dolibarr

---

## License

[MIT](LICENSE) — Utilisez Pennybarr librement, modifiez-le, distribuez-le.

---

## Remerciements

- [Dolibarr](https://www.dolibarr.org) — L'ERP open source qui fournit le moteur métier
- [Pennylane](https://www.pennylane.com) — L'inspiration pour l'interface et l'expérience utilisateur
- [Supabase](https://supabase.com) — Base de données, authentification et Edge Functions
- [React](https://react.dev), [Vite](https://vite.dev), [Tailwind CSS](https://tailwindcss.com) — La stack frontend moderne

---

<p align="center">
  Fait avec soin en France
  <br />
  <sub>Pennybarr n'est pas affilié à Pennylane SAS ni à Dolibarr. Les marques mentionnées appartiennent à leurs propriétaires respectifs.</sub>
</p>
