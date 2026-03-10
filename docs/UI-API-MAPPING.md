# Pennybarr - Mapping UI → API Dolibarr

## Légende

| Statut | Signification |
|--------|---------------|
| ✅ | API Dolibarr disponible |
| ⚠️ | API partielle ou workaround nécessaire |
| ❌ | Non disponible dans Dolibarr API |
| 🔧 | Nécessite développement custom |

---

## MODE GESTION - Sidebar principale

### Navigation principale

| Bouton/Menu | Route API Dolibarr | Méthode | Statut |
|-------------|-------------------|---------|--------|
| **Accueil** (Dashboard) | Agrégation de plusieurs endpoints | GET | ✅ |
| └─ Solde des comptes | `/bankaccounts` | GET | ✅ |
| └─ Encaissements | `/invoices` + calcul | GET | ✅ |
| └─ Décaissements | `/supplierinvoices` + calcul | GET | ✅ |
| └─ Total facturé | `/invoices` + somme | GET | ✅ |
| └─ Total achats | `/supplierinvoices` + somme | GET | ✅ |
| **Transactions** | `/bankaccounts/{id}/lines` | GET | ✅ |
| **Documents partagés** | `/documents` | GET/POST | ✅ |
| **Paramètres** | `/setup` (limité) | GET | ⚠️ |

---

### Menu ACHATS

| Bouton/Menu | Route API Dolibarr | Méthode | Statut |
|-------------|-------------------|---------|--------|
| **Importer des factures** | `/documents/upload` | POST | ✅ |
| Factures fournisseurs | `/supplierinvoices` | GET | ✅ |
| └─ Créer facture fournisseur | `/supplierinvoices` | POST | ✅ |
| └─ Modifier facture | `/supplierinvoices/{id}` | PUT | ✅ |
| └─ Supprimer facture | `/supplierinvoices/{id}` | DELETE | ✅ |
| └─ Valider facture | `/supplierinvoices/{id}/validate` | POST | ✅ |
| └─ Payer facture | `/supplierinvoices/{id}/payments` | POST | ✅ |
| Notes de frais des équipes | `/expensereports` | GET | ✅ |
| └─ Créer note de frais | `/expensereports` | POST | ✅ |
| Vos notes de frais | `/expensereports?user_id={id}` | GET | ✅ |
| Demandes d'achat | Non prévu | - | ❌ |
| Demandes de paiement | Non prévu | - | ❌ |
| Liste des fournisseurs | `/thirdparties?mode=2` | GET | ✅ |
| └─ Créer fournisseur | `/thirdparties` + `fournisseur=1` | POST | ✅ |
| Circuits d'approbation | Non prévu (workflow externe) | - | ❌ |

---

### Menu VENTES

| Bouton/Menu | Route API Dolibarr | Méthode | Statut |
|-------------|-------------------|---------|--------|
| **Nouvelle facture** | `/invoices` | POST | ✅ |
| **Nouveau devis** | `/proposals` | POST | ✅ |
| Factures clients | `/invoices` | GET | ✅ |
| └─ Détail facture | `/invoices/{id}` | GET | ✅ |
| └─ Modifier facture | `/invoices/{id}` | PUT | ✅ |
| └─ Valider facture | `/invoices/{id}/validate` | POST | ✅ |
| └─ Envoyer par email | `/invoices/{id}/sendbyemail` | POST | ✅ |
| └─ Générer PDF | `/documents/builddoc` | POST | ✅ |
| └─ Ajouter ligne | `/invoices/{id}/lines` | POST | ✅ |
| └─ Paiement reçu | `/invoices/{id}/payments` | POST | ✅ |
| Devis | `/proposals` | GET | ✅ |
| └─ Détail devis | `/proposals/{id}` | GET | ✅ |
| └─ Valider devis | `/proposals/{id}/validate` | POST | ✅ |
| └─ Convertir en facture | `/proposals/{id}/setinvoiced` | POST | ⚠️ |
| Documents commerciaux | `/documents?modulepart=propale,facture` | GET | ✅ |
| Abonnements | Non prévu nativement | - | ❌ |
| Relances en attente | `/invoices?status=1` (impayées) + calcul | GET | ⚠️ |
| Produits et services | `/products` | GET | ✅ |
| └─ Créer produit | `/products` | POST | ✅ |
| └─ Créer service | `/products` + `type=1` | POST | ✅ |
| Liste des clients | `/thirdparties?mode=1` | GET | ✅ |
| └─ Créer client | `/thirdparties` + `client=1` | POST | ✅ |

---

### Menu ANALYTIQUE

| Bouton/Menu | Route API Dolibarr | Méthode | Statut |
|-------------|-------------------|---------|--------|
| Plan de trésorerie | Non prévu (calcul custom) | - | 🔧 |
| Rapports analytiques | Non prévu (module compta) | - | ❌ |
| Tableau de bord | Agrégation custom | GET | 🔧 |

---

### Menu RAPPORTS COMPTABLES

| Bouton/Menu | Route API Dolibarr | Méthode | Statut |
|-------------|-------------------|---------|--------|
| **Balances** | | | |
| Balance générale | `/accountancy/bookkeeping` (limité) | GET | ⚠️ |
| Balance fournisseurs | `/supplierinvoices` + agrégation | GET | 🔧 |
| Balance clients | `/invoices` + agrégation | GET | 🔧 |
| Balance âgée | Calcul custom sur factures | GET | 🔧 |
| **Outils comptables** | | | |
| Journaux | Non prévu dans API REST | - | ❌ |
| Grand livre | Non prévu dans API REST | - | ❌ |
| **États financiers** | | | |
| Bilan | Non prévu dans API REST | - | ❌ |
| Compte de résultat | Non prévu dans API REST | - | ❌ |
| **Dossier de gestion** | | | |
| Soldes intermédiaires de gestion | Non prévu | - | ❌ |
| Analyse du bilan | Non prévu | - | ❌ |
| Tableau de financement | Non prévu | - | ❌ |
| Capacité d'auto-financement | Non prévu | - | ❌ |
| **Restitution** | | | |
| Rapports | `/documents?modulepart=reports` | GET | ⚠️ |

---

## MODE COMPTABILITÉ - Panels

### Panel SAISIE (icône crayon)

| Bouton/Menu | Route API Dolibarr | Méthode | Statut |
|-------------|-------------------|---------|--------|
| **Recherche d'écritures** | `/accountancy/bookkeeping` | GET | ⚠️ |
| **Nouvelle saisie** | Non prévu directement | - | ❌ |
| **Factures** | | | |
| Factures fournisseurs | `/supplierinvoices` | GET | ✅ |
| Factures clients | `/invoices` | GET | ✅ |
| **Banque** | | | |
| Transactions | `/bankaccounts/{id}/lines` | GET | ✅ |
| └─ Ajouter transaction | `/bankaccounts/{id}/lines` | POST | ✅ |
| Rapprochement bancaire | Non prévu dans API REST | - | ❌ |
| **Écritures** | | | |
| Journaux | Non prévu dans API REST | - | ❌ |
| Saisie en masse | Non prévu | - | ❌ |
| **Imports/Exports** | | | |
| Imports | `/imports` (module requis) | POST | ⚠️ |
| Exports | `/exports` | GET | ⚠️ |

---

### Panel RÉVISION (icône horloge)

| Bouton/Menu | Route API Dolibarr | Méthode | Statut |
|-------------|-------------------|---------|--------|
| **Exporter une balance** | Génération custom PDF/CSV | - | 🔧 |
| **Balances** | | | |
| Balance générale | Non prévu API | - | ❌ |
| Balance fournisseurs | `/thirdparties?mode=2` + `/supplierinvoices` | GET | 🔧 |
| Balance clients | `/thirdparties?mode=1` + `/invoices` | GET | 🔧 |
| Balance âgée | Calcul custom | - | 🔧 |
| Grand livre | Non prévu API | - | ❌ |
| **Dossiers de travail** | | | |
| Dossier de travail | Non prévu | - | ❌ |
| Historique | `/events` ou logs custom | GET | ⚠️ |
| **Écritures d'inventaire** | | | |
| Immobilisations | `/assets` (si module activé) | GET | ⚠️ |
| Emprunts | `/loans` | GET | ✅ |
| Crédits-bail | Non prévu | - | ❌ |
| Véhicules | Non prévu nativement | - | ❌ |
| Subventions | Non prévu | - | ❌ |
| **Écritures de régularisation** | | | |
| Charges constatées d'avance | Non prévu API | - | ❌ |
| Produits constatés d'avance | Non prévu API | - | ❌ |
| Charges à payer | Non prévu API | - | ❌ |
| Produits à recevoir | Non prévu API | - | ❌ |
| Factures non parvenues | Non prévu API | - | ❌ |
| Factures à établir | `/invoices?status=0` (brouillons) | GET | ⚠️ |
| Créances douteuses | Non prévu | - | ❌ |
| **Autres modules** | | | |
| Comptes courants | `/bankaccounts` | GET | ✅ |
| Intercos et réciprocités | Non prévu | - | ❌ |
| Impôt sur les sociétés | Non prévu | - | ❌ |

---

### Panel FISCALITÉ (icône euro)

| Bouton/Menu | Route API Dolibarr | Méthode | Statut |
|-------------|-------------------|---------|--------|
| Vos déclarations | Non prévu | - | ❌ |
| Statut des télédéclarations | Non prévu | - | ❌ |
| **TVA** | | | |
| TVA - Déclarations | Calcul custom sur factures | - | 🔧 |
| TVA - Remboursements (3519) | Non prévu | - | ❌ |
| TVA - Acomptes (3514) | Non prévu | - | ❌ |
| TVA - Cadrages | Non prévu | - | ❌ |
| Liasse fiscale | Non prévu | - | ❌ |
| **IS** | | | |
| IS - Acompte (2571) | Non prévu | - | ❌ |
| IS - Solde (2572) | Non prévu | - | ❌ |
| **CVAE** | | | |
| CVAE - Acompte (1329 AC) | Non prévu | - | ❌ |
| CVAE - Solde (1329 DEF) | Non prévu | - | ❌ |
| **Autres** | | | |
| PFU (RCM 2777) | Non prévu | - | ❌ |
| IFU (2561) | Non prévu | - | ❌ |
| DAS2 - Honoraires | Non prévu | - | ❌ |
| Decloyer | Non prévu | - | ❌ |

---

### Panel ÉTATS DE SYNTHÈSE (icône document)

| Bouton/Menu | Route API Dolibarr | Méthode | Statut |
|-------------|-------------------|---------|--------|
| **Télécharger** | `/documents/builddoc` | POST | ⚠️ |
| **États financiers** | | | |
| Bilan | Non prévu API | - | ❌ |
| Compte de résultat | Non prévu API | - | ❌ |
| **Dossier de gestion** | | | |
| Soldes intermédiaires de gestion | Non prévu | - | ❌ |
| Analyse du bilan | Non prévu | - | ❌ |
| Tableau de financement | Non prévu | - | ❌ |
| Capacité d'auto-financement | Non prévu | - | ❌ |
| **Restitution** | | | |
| Synthèse financière | Non prévu | - | ❌ |
| Rapports | `/documents?modulepart=reports` | GET | ⚠️ |
| Plaquettes | Non prévu | - | ❌ |

---

### Panel DOSSIER DU CLIENT (icône dossier)

| Bouton/Menu | Route API Dolibarr | Méthode | Statut |
|-------------|-------------------|---------|--------|
| **Enregistrer un temps** | `/timespent` (module projet) | POST | ⚠️ |
| GED | `/documents` | GET | ✅ |
| └─ Upload document | `/documents/upload` | POST | ✅ |
| └─ Download document | `/documents/download` | GET | ✅ |
| └─ Supprimer document | `/documents` | DELETE | ✅ |
| Documents demandés | Non prévu (workflow custom) | - | ❌ |
| Plan comptable | `/accountancy/chartofaccounts` | GET | ⚠️ |
| **Liste des tiers** | | | |
| Fournisseurs | `/thirdparties?mode=2` | GET | ✅ |
| Clients | `/thirdparties?mode=1` | GET | ✅ |

---

### Icônes secondaires (comptabilité)

| Bouton | Route API Dolibarr | Méthode | Statut |
|--------|-------------------|---------|--------|
| Vue client | `/thirdparties/{id}` | GET | ✅ |
| Facturation électronique | Non prévu (Chorus Pro externe) | - | ❌ |
| ComptAssistant | Non prévu (IA custom) | - | ❌ |
| Recherche rapide | `/search` (multi-endpoint) | GET | ⚠️ |
| Paramètres | `/setup` | GET | ⚠️ |
| Outils | Divers | - | ⚠️ |
| Aide et support | Non prévu | - | ❌ |

---

## Actions Dashboard (Accueil)

| Bouton/Action | Route API Dolibarr | Méthode | Statut |
|---------------|-------------------|---------|--------|
| + Ajouter (Factures fournisseurs) | `/supplierinvoices` | POST | ✅ |
| + Ajouter (Factures clients) | `/invoices` | POST | ✅ |
| + Créer (Factures clients) | `/invoices` | POST | ✅ |
| + Ajouter (Autres documents) | `/documents/upload` | POST | ✅ |
| Sélecteur période | Paramètre `?date_start=&date_end=` | - | ✅ |
| Sélecteur entreprise | Header `DOLAPIENTITY` | - | ✅ |

---

## RÉSUMÉ

| Catégorie | Disponible API | Partiel/Workaround | Non disponible |
|-----------|----------------|-------------------|----------------|
| **Achats** | 8 | 0 | 3 |
| **Ventes** | 14 | 2 | 1 |
| **Analytique** | 0 | 0 | 3 |
| **Rapports comptables** | 0 | 2 | 9 |
| **Saisie** | 4 | 2 | 4 |
| **Révision** | 2 | 3 | 14 |
| **Fiscalité** | 0 | 0 | 14 |
| **États de synthèse** | 0 | 2 | 7 |
| **Dossier client** | 5 | 2 | 1 |
| **TOTAL** | **33** | **13** | **56** |

### Conclusion

- **33 fonctionnalités** sont directement supportées par l'API Dolibarr
- **13 fonctionnalités** nécessitent des workarounds ou calculs custom
- **56 fonctionnalités** ne sont pas disponibles dans l'API REST Dolibarr

Les fonctionnalités **comptables avancées** (fiscalité, états financiers, écritures de régularisation) ne sont **pas exposées** via l'API REST de Dolibarr. Ces fonctionnalités existent dans l'interface web Dolibarr mais nécessiteraient :
1. Un développement d'endpoints custom côté Dolibarr
2. Une solution externe (logiciel comptable dédié)
3. Des calculs/agrégations côté frontend

---

## Sources

- [Dolibarr Wiki - Module Web Services API REST](https://wiki.dolibarr.org/index.php/Module_Web_Services_API_REST_(developer))
- [Dolibarr Forum - Accounting API Discussion](https://www.dolibarr.org/forum/t/request-for-dolibarr-accounting-compta-rest-api-documentation/30325)
- [Dolibarr GitHub - API Source](https://github.com/Dolibarr/dolibarr/tree/develop/htdocs/api)

*Document généré le 25 janvier 2026*
