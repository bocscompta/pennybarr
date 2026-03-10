-- =============================================================================
-- Pennybarr - Seed Data (Données de démonstration)
-- Logiciel de comptabilité française - Données réalistes PCG
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- 1. COMPANIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  slug text,
  siren text,
  siret text,
  vat_number text,
  address text,
  postal_code text,
  city text,
  country text DEFAULT 'FR',
  currency text DEFAULT 'EUR',
  fiscal_year_start integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.companies (id, name, slug, siren, siret, vat_number, address, postal_code, city)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Boulangerie Dupont',
  'boulangerie-dupont',
  '432156789',
  '43215678900014',
  'FR12432156789',
  '27 Rue du Faubourg Saint-Antoine',
  '75011',
  'Paris'
);

-- =============================================================================
-- 2. CHART OF ACCOUNTS (Plan Comptable Général - PCG)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  code text,
  label text,
  type text,
  parent_code text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  account_role text,
  pcg_type text,
  pennylane_id bigint
);

INSERT INTO public.chart_of_accounts (id, company_id, code, label, type, parent_code, pcg_type) VALUES
  ('c0a10000-0001-4000-8000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '101000', 'Capital social', 'passif', '10', 'capitaux'),
  ('c0a10000-0002-4000-8000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '164000', 'Emprunts auprès des établissements de crédit', 'passif', '16', 'capitaux'),
  ('c0a10000-0003-4000-8000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '215000', 'Installations techniques, matériel et outillage', 'actif', '21', 'immobilisations'),
  ('c0a10000-0004-4000-8000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '370000', 'Stocks de marchandises', 'actif', '37', 'stocks'),
  ('c0a10000-0005-4000-8000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '401000', 'Fournisseurs - Comptes de tiers', 'passif', '40', 'fournisseurs'),
  ('c0a10000-0006-4000-8000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '411000', 'Clients - Comptes de tiers', 'actif', '41', 'clients'),
  ('c0a10000-0007-4000-8000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '431000', 'Sécurité sociale et organismes sociaux', 'passif', '43', 'social'),
  ('c0a10000-0008-4000-8000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '445660', 'TVA déductible sur ABS', 'actif', '44', 'fiscal'),
  ('c0a10000-0009-4000-8000-000000000009', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '445710', 'TVA collectée', 'passif', '44', 'fiscal'),
  ('c0a10000-0010-4000-8000-000000000010', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '512000', 'Banque - Comptes courants', 'actif', '51', 'tresorerie'),
  ('c0a10000-0011-4000-8000-000000000011', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '512100', 'BNP Paribas - Compte courant', 'actif', '512', 'tresorerie'),
  ('c0a10000-0012-4000-8000-000000000012', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '512200', 'Qonto - Compte professionnel', 'actif', '512', 'tresorerie'),
  ('c0a10000-0013-4000-8000-000000000013', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '601000', 'Achats de matières premières', 'charge', '60', 'achats'),
  ('c0a10000-0014-4000-8000-000000000014', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '602200', 'Fournitures consommables', 'charge', '60', 'achats'),
  ('c0a10000-0015-4000-8000-000000000015', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '606100', 'Fournitures non stockables (eau, énergie)', 'charge', '60', 'achats'),
  ('c0a10000-0016-4000-8000-000000000016', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '607000', 'Achats de marchandises', 'charge', '60', 'achats'),
  ('c0a10000-0017-4000-8000-000000000017', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '613200', 'Locations immobilières', 'charge', '61', 'services_ext'),
  ('c0a10000-0018-4000-8000-000000000018', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '616000', 'Primes d''assurance', 'charge', '61', 'services_ext'),
  ('c0a10000-0019-4000-8000-000000000019', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '626000', 'Frais postaux et télécommunications', 'charge', '62', 'services_ext'),
  ('c0a10000-0020-4000-8000-000000000020', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '641000', 'Rémunérations du personnel', 'charge', '64', 'charges_personnel'),
  ('c0a10000-0021-4000-8000-000000000021', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '645000', 'Charges de sécurité sociale', 'charge', '64', 'charges_personnel'),
  ('c0a10000-0022-4000-8000-000000000022', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '701000', 'Ventes de produits finis', 'produit', '70', 'ventes'),
  ('c0a10000-0023-4000-8000-000000000023', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '706000', 'Prestations de services', 'produit', '70', 'ventes'),
  ('c0a10000-0024-4000-8000-000000000024', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '707000', 'Ventes de marchandises', 'produit', '70', 'ventes'),
  ('c0a10000-0025-4000-8000-000000000025', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '661000', 'Charges d''intérêts', 'charge', '66', 'charges_financieres');

-- =============================================================================
-- 3. ACCOUNTING JOURNALS (Journaux comptables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.accounting_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  code text,
  label text,
  journal_type text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.accounting_journals (id, company_id, code, label, journal_type) VALUES
  ('d0a10000-0001-4000-8000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'AC', 'Journal des Achats', 'achats'),
  ('d0a10000-0002-4000-8000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'VE', 'Journal des Ventes', 'ventes'),
  ('d0a10000-0003-4000-8000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'BQ', 'Journal de Banque', 'banque'),
  ('d0a10000-0004-4000-8000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'OD', 'Opérations Diverses', 'od');

-- =============================================================================
-- 4. BANK ACCOUNTS (Comptes bancaires)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  name text,
  bank_name text,
  account_number text,
  iban text,
  bic text,
  currency text DEFAULT 'EUR',
  initial_balance numeric DEFAULT 0,
  current_balance numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.bank_accounts (id, company_id, name, bank_name, account_number, iban, bic, initial_balance, current_balance) VALUES
  ('b0a10000-0001-4000-8000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Compte courant BNP', 'BNP Paribas', '00020456789',
   'FR76 3000 4000 0100 2045 6789 062', 'BNPAFRPPXXX',
   15000.00, 23847.56),
  ('b0a10000-0002-4000-8000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Compte pro Qonto', 'Qonto', 'FR761695600002',
   'FR76 1695 8000 0100 0782 3456 078', 'QNTOFRP1XXX',
   5000.00, 8234.12);

-- =============================================================================
-- 5. THIRD PARTIES (Tiers - Clients & Fournisseurs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.third_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  type text,
  name text,
  code text,
  email text,
  phone text,
  address text,
  postal_code text,
  city text,
  country text DEFAULT 'FR',
  siren text,
  siret text,
  vat_number text,
  payment_terms integer DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  pennylane_id bigint
);

INSERT INTO public.third_parties (id, company_id, type, name, code, email, phone, address, postal_code, city, siren, vat_number) VALUES
  -- Fournisseurs
  ('e0a10000-0001-4000-8000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'supplier', 'Grands Moulins de Paris', 'FO-001',
   'commandes@grandsmoulins.fr', '01 40 12 34 56',
   '38 Rue de Rivoli', '75004', 'Paris',
   '552100554', 'FR40552100554'),
  ('e0a10000-0002-4000-8000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'supplier', 'Metro Cash & Carry', 'FO-002',
   'pro@metro.fr', '01 55 67 89 00',
   'ZI Les Chanoux', '93330', 'Neuilly-sur-Marne',
   '399315613', 'FR26399315613'),
  ('e0a10000-0003-4000-8000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'supplier', 'URSSAF Île-de-France', 'FO-003',
   'contact@urssaf.fr', '3957',
   '21 Rue de la Vistule', '75013', 'Paris',
   '784718498', NULL),
  ('e0a10000-0004-4000-8000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'supplier', 'OVH Cloud', 'FO-004',
   'facturation@ovhcloud.com', '1007',
   '2 Rue Kellermann', '59100', 'Roubaix',
   '424761419', 'FR22424761419'),
  -- Clients
  ('e0a10000-0005-4000-8000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'customer', 'Restaurant Le Petit Cler', 'CL-001',
   'contact@lepetitcler.fr', '01 47 05 12 34',
   '29 Rue Cler', '75007', 'Paris',
   '812456789', 'FR98812456789'),
  ('e0a10000-0006-4000-8000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'customer', 'Hôtel du Marais', 'CL-002',
   'reception@hoteldumarais.fr', '01 42 72 34 56',
   '12 Rue des Archives', '75004', 'Paris',
   '823567890', 'FR67823567890');

-- =============================================================================
-- 6. PRODUCTS (Produits & Services)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  code text,
  name text,
  description text,
  type text DEFAULT 'product',
  sale_price_ht numeric DEFAULT 0,
  purchase_price_ht numeric,
  vat_rate text DEFAULT '20',
  unit text DEFAULT 'unite',
  accounting_code_sale text,
  accounting_code_purchase text,
  is_active boolean DEFAULT true,
  pennylane_id bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.products (id, company_id, code, name, description, type, sale_price_ht, purchase_price_ht, vat_rate, unit, accounting_code_sale, accounting_code_purchase) VALUES
  ('f0a10000-0001-4000-8000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'PAIN-TRAD', 'Pain Tradition', 'Baguette tradition 250g', 'product',
   1.10, 0.35, '5.5', 'unite', '701000', '601000'),
  ('f0a10000-0002-4000-8000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'CROISSANT', 'Croissant Beurre', 'Croissant pur beurre AOP', 'product',
   1.30, 0.40, '5.5', 'unite', '701000', '601000'),
  ('f0a10000-0003-4000-8000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'PAIN-CAMP', 'Pain de Campagne', 'Pain de campagne 500g', 'product',
   3.50, 1.10, '5.5', 'unite', '701000', '601000'),
  ('f0a10000-0004-4000-8000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'LIVRAISON', 'Livraison quotidienne', 'Service de livraison quotidienne', 'service',
   15.00, NULL, '20', 'forfait', '706000', NULL),
  ('f0a10000-0005-4000-8000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'FORMATION', 'Formation pâtisserie', 'Atelier formation pâtisserie (demi-journée)', 'service',
   250.00, NULL, '20', 'seance', '706000', NULL);

-- =============================================================================
-- 7. INVOICES (Factures)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  third_party_id uuid,
  type text,
  number text,
  date date,
  due_date date,
  status text DEFAULT 'draft',
  total_ht numeric DEFAULT 0,
  total_vat numeric DEFAULT 0,
  total_ttc numeric DEFAULT 0,
  currency text DEFAULT 'EUR',
  notes text,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  vat_regime text DEFAULT 'normal',
  is_autoliquidated boolean DEFAULT false,
  accounting_code text,
  entry_label text,
  exchange_rate numeric,
  base_currency varchar(3) DEFAULT 'EUR',
  payment_method text,
  pennylane_id bigint
);

CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid,
  description text,
  quantity numeric DEFAULT 1,
  unit_price numeric,
  vat_rate numeric DEFAULT 20.0,
  total_ht numeric,
  total_vat numeric,
  total_ttc numeric,
  accounting_code text,
  created_at timestamptz DEFAULT now()
);

-- Facture client 1 - payée
INSERT INTO public.invoices (id, company_id, third_party_id, type, number, date, due_date, status, total_ht, total_vat, total_ttc, payment_method) VALUES
  ('10a10000-0001-4000-8000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'e0a10000-0005-4000-8000-000000000005', 'out', 'FA-2026-001', '2026-01-15', '2026-02-14',
   'paid', 845.00, 46.48, 891.48, 'virement');

INSERT INTO public.invoice_lines (invoice_id, description, quantity, unit_price, vat_rate, total_ht, total_vat, total_ttc, accounting_code) VALUES
  ('10a10000-0001-4000-8000-000000000001', 'Pain Tradition x lot de 50', 10, 55.00, 5.5, 550.00, 30.25, 580.25, '701000'),
  ('10a10000-0001-4000-8000-000000000001', 'Croissant Beurre x lot de 30', 5, 39.00, 5.5, 195.00, 10.73, 205.73, '701000'),
  ('10a10000-0001-4000-8000-000000000001', 'Livraison quotidienne janvier', 1, 100.00, 20.0, 100.00, 5.50, 105.50, '706000');

-- Facture client 2 - envoyée
INSERT INTO public.invoices (id, company_id, third_party_id, type, number, date, due_date, status, total_ht, total_vat, total_ttc) VALUES
  ('10a10000-0002-4000-8000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'e0a10000-0006-4000-8000-000000000006', 'out', 'FA-2026-002', '2026-02-01', '2026-03-03',
   'sent', 1250.00, 68.75, 1318.75);

INSERT INTO public.invoice_lines (invoice_id, description, quantity, unit_price, vat_rate, total_ht, total_vat, total_ttc, accounting_code) VALUES
  ('10a10000-0002-4000-8000-000000000002', 'Pain de Campagne x lot de 20', 15, 70.00, 5.5, 1050.00, 57.75, 1107.75, '701000'),
  ('10a10000-0002-4000-8000-000000000002', 'Livraison février', 1, 200.00, 20.0, 200.00, 11.00, 211.00, '706000');

-- Facture client 3 - brouillon
INSERT INTO public.invoices (id, company_id, third_party_id, type, number, date, due_date, status, total_ht, total_vat, total_ttc) VALUES
  ('10a10000-0003-4000-8000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'e0a10000-0005-4000-8000-000000000005', 'out', 'FA-2026-003', '2026-03-01', '2026-03-31',
   'draft', 920.00, 50.60, 970.60);

INSERT INTO public.invoice_lines (invoice_id, description, quantity, unit_price, vat_rate, total_ht, total_vat, total_ttc, accounting_code) VALUES
  ('10a10000-0003-4000-8000-000000000003', 'Pain Tradition mars', 12, 55.00, 5.5, 660.00, 36.30, 696.30, '701000'),
  ('10a10000-0003-4000-8000-000000000003', 'Formation pâtisserie', 1, 250.00, 20.0, 250.00, 50.00, 300.00, '706000'),
  ('10a10000-0003-4000-8000-000000000003', 'Remise fidélité', 1, -90.00, 5.5, -90.00, -4.95, -94.95, '709000');

-- Facture fournisseur 1 (achat farine) - payée
INSERT INTO public.invoices (id, company_id, third_party_id, type, number, date, due_date, status, total_ht, total_vat, total_ttc, payment_method) VALUES
  ('10a10000-0004-4000-8000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'e0a10000-0001-4000-8000-000000000001', 'in', 'GMP-2026-00234', '2026-01-10', '2026-02-09',
   'paid', 2340.00, 468.00, 2808.00, 'virement');

INSERT INTO public.invoice_lines (invoice_id, description, quantity, unit_price, vat_rate, total_ht, total_vat, total_ttc, accounting_code) VALUES
  ('10a10000-0004-4000-8000-000000000004', 'Farine T65 tradition - palette 500kg', 3, 680.00, 20.0, 2040.00, 408.00, 2448.00, '601000'),
  ('10a10000-0004-4000-8000-000000000004', 'Levure fraîche - carton 10kg', 6, 50.00, 20.0, 300.00, 60.00, 360.00, '601000');

-- Facture fournisseur 2 (Metro) - envoyée
INSERT INTO public.invoices (id, company_id, third_party_id, type, number, date, due_date, status, total_ht, total_vat, total_ttc) VALUES
  ('10a10000-0005-4000-8000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'e0a10000-0002-4000-8000-000000000002', 'in', 'MET-93-2026-01567', '2026-02-05', '2026-03-07',
   'sent', 456.80, 91.36, 548.16);

INSERT INTO public.invoice_lines (invoice_id, description, quantity, unit_price, vat_rate, total_ht, total_vat, total_ttc, accounting_code) VALUES
  ('10a10000-0005-4000-8000-000000000005', 'Beurre AOP Charentes 10kg', 4, 89.20, 20.0, 356.80, 71.36, 428.16, '601000'),
  ('10a10000-0005-4000-8000-000000000005', 'Emballages papier kraft', 1, 100.00, 20.0, 100.00, 20.00, 120.00, '602200');

-- Facture fournisseur 3 (OVH) - payée
INSERT INTO public.invoices (id, company_id, third_party_id, type, number, date, due_date, status, total_ht, total_vat, total_ttc, payment_method) VALUES
  ('10a10000-0006-4000-8000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'e0a10000-0004-4000-8000-000000000004', 'in', 'FR-OVH-2026-9876', '2026-01-01', '2026-01-31',
   'paid', 29.99, 6.00, 35.99, 'prelevement');

INSERT INTO public.invoice_lines (invoice_id, description, quantity, unit_price, vat_rate, total_ht, total_vat, total_ttc, accounting_code) VALUES
  ('10a10000-0006-4000-8000-000000000006', 'Hébergement web + nom de domaine', 1, 29.99, 20.0, 29.99, 6.00, 35.99, '626000');

-- =============================================================================
-- 8. BANK TRANSACTIONS (Transactions bancaires)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  bank_account_id uuid,
  date date,
  value_date date,
  label text,
  amount numeric,
  type text,
  reference text,
  category text,
  is_reconciled boolean DEFAULT false,
  reconciled_at timestamptz,
  linked_invoice_id uuid,
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  category_id uuid,
  comments text,
  third_party_id uuid,
  draft_invoice_data jsonb,
  draft_document_url text,
  reconciliation_id uuid,
  statement_id uuid
);

-- Transactions sur BNP Paribas
INSERT INTO public.bank_transactions (id, company_id, bank_account_id, date, value_date, label, amount, type, reference, is_reconciled, linked_invoice_id, third_party_id) VALUES
  ('20a10000-0001-4000-8000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b0a10000-0001-4000-8000-000000000001', '2026-01-05', '2026-01-05',
   'VIR LOYER JANVIER - SCI FAUBOURG', -2200.00, 'debit', 'VIR-20260105-001', true, NULL, NULL),
  ('20a10000-0002-4000-8000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b0a10000-0001-4000-8000-000000000001', '2026-01-10', '2026-01-10',
   'VIR GRANDS MOULINS PARIS FA GMP-2026-00234', -2808.00, 'debit', 'VIR-20260110-001', true,
   '10a10000-0004-4000-8000-000000000004', 'e0a10000-0001-4000-8000-000000000001'),
  ('20a10000-0003-4000-8000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b0a10000-0001-4000-8000-000000000001', '2026-01-15', '2026-01-15',
   'PRLV URSSAF T4-2025', -1845.67, 'debit', 'PRLV-20260115-001', true, NULL,
   'e0a10000-0003-4000-8000-000000000003'),
  ('20a10000-0004-4000-8000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b0a10000-0001-4000-8000-000000000001', '2026-01-20', '2026-01-20',
   'VIR RECU RESTAURANT LE PETIT CLER FA-2026-001', 891.48, 'credit', 'VIR-20260120-001', true,
   '10a10000-0001-4000-8000-000000000001', 'e0a10000-0005-4000-8000-000000000005'),
  ('20a10000-0005-4000-8000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b0a10000-0001-4000-8000-000000000001', '2026-01-25', '2026-01-25',
   'PRLV EDF PRO JANVIER', -187.34, 'debit', 'PRLV-20260125-001', false, NULL, NULL),
  ('20a10000-0006-4000-8000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b0a10000-0001-4000-8000-000000000001', '2026-01-31', '2026-01-31',
   'VIR SALAIRES JANVIER 2026', -3450.00, 'debit', 'VIR-20260131-001', true, NULL, NULL),
  ('20a10000-0007-4000-8000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b0a10000-0001-4000-8000-000000000001', '2026-02-03', '2026-02-03',
   'CB METRO NEUILLY 030226', -548.16, 'debit', 'CB-20260203-001', false,
   '10a10000-0005-4000-8000-000000000005', 'e0a10000-0002-4000-8000-000000000002'),
  ('20a10000-0008-4000-8000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b0a10000-0001-4000-8000-000000000001', '2026-02-10', '2026-02-10',
   'REMISE CB CLIENTS SEMAINE 06', 2456.80, 'credit', 'RCB-20260210-001', false, NULL, NULL);

-- Transactions sur Qonto
INSERT INTO public.bank_transactions (id, company_id, bank_account_id, date, value_date, label, amount, type, reference, is_reconciled, linked_invoice_id, third_party_id) VALUES
  ('20a10000-0009-4000-8000-000000000009', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b0a10000-0002-4000-8000-000000000002', '2026-01-01', '2026-01-01',
   'PRLV OVH HEBERGEMENT WEB', -35.99, 'debit', 'QONTO-20260101-001', true,
   '10a10000-0006-4000-8000-000000000006', 'e0a10000-0004-4000-8000-000000000004'),
  ('20a10000-0010-4000-8000-000000000010', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b0a10000-0002-4000-8000-000000000002', '2026-01-15', '2026-01-15',
   'PRLV AXA ASSURANCE PRO', -156.00, 'debit', 'QONTO-20260115-001', false, NULL, NULL),
  ('20a10000-0011-4000-8000-000000000011', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b0a10000-0002-4000-8000-000000000002', '2026-02-01', '2026-02-01',
   'VIR RECU HOTEL DU MARAIS ACOMPTE', 500.00, 'credit', 'QONTO-20260201-001', false,
   NULL, 'e0a10000-0006-4000-8000-000000000006'),
  ('20a10000-0012-4000-8000-000000000012', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'b0a10000-0002-4000-8000-000000000002', '2026-02-10', '2026-02-10',
   'CB AMAZON FOURNITURES BUREAU', -67.45, 'debit', 'QONTO-20260210-001', false, NULL, NULL);

-- =============================================================================
-- 9. ACCOUNTING ENTRIES (Écritures comptables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  journal text,
  date date,
  piece_number text,
  label text,
  account_code text,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  linked_invoice_id uuid,
  linked_transaction_id uuid,
  is_validated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  lettrage_code text,
  lettrage_date timestamptz,
  lettrage_type text,
  pennylane_entry_id bigint,
  pennylane_line_id bigint,
  category_name text,
  pennylane_category_id bigint
);

-- Écriture 1: Facture vente Le Petit Cler (FA-2026-001)
INSERT INTO public.accounting_entries (company_id, journal, date, piece_number, label, account_code, debit, credit, linked_invoice_id, is_validated, lettrage_code) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'VE', '2026-01-15', 'FA-2026-001', 'Restaurant Le Petit Cler - Janvier', '411000', 891.48, 0, '10a10000-0001-4000-8000-000000000001', true, 'AA001'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'VE', '2026-01-15', 'FA-2026-001', 'Restaurant Le Petit Cler - Janvier', '701000', 0, 745.00, '10a10000-0001-4000-8000-000000000001', true, NULL),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'VE', '2026-01-15', 'FA-2026-001', 'Restaurant Le Petit Cler - Janvier', '706000', 0, 100.00, '10a10000-0001-4000-8000-000000000001', true, NULL),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'VE', '2026-01-15', 'FA-2026-001', 'Restaurant Le Petit Cler - Janvier', '445710', 0, 46.48, '10a10000-0001-4000-8000-000000000001', true, NULL);

-- Écriture 2: Règlement client Le Petit Cler
INSERT INTO public.accounting_entries (company_id, journal, date, piece_number, label, account_code, debit, credit, linked_transaction_id, is_validated, lettrage_code) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'BQ', '2026-01-20', 'BQ-2026-001', 'Règlement Le Petit Cler FA-2026-001', '512100', 891.48, 0, '20a10000-0004-4000-8000-000000000004', true, NULL),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'BQ', '2026-01-20', 'BQ-2026-001', 'Règlement Le Petit Cler FA-2026-001', '411000', 0, 891.48, '20a10000-0004-4000-8000-000000000004', true, 'AA001');

-- Écriture 3: Facture achat Grands Moulins (GMP-2026-00234)
INSERT INTO public.accounting_entries (company_id, journal, date, piece_number, label, account_code, debit, credit, linked_invoice_id, is_validated) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'AC', '2026-01-10', 'GMP-2026-00234', 'Grands Moulins de Paris - Farine et levure', '601000', 2340.00, 0, '10a10000-0004-4000-8000-000000000004', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'AC', '2026-01-10', 'GMP-2026-00234', 'Grands Moulins de Paris - Farine et levure', '445660', 468.00, 0, '10a10000-0004-4000-8000-000000000004', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'AC', '2026-01-10', 'GMP-2026-00234', 'Grands Moulins de Paris - Farine et levure', '401000', 0, 2808.00, '10a10000-0004-4000-8000-000000000004', true);

-- =============================================================================
-- 10. FISCAL YEARS (Exercices comptables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  name text,
  start_date date,
  end_date date,
  is_closed boolean DEFAULT false,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  is_current boolean DEFAULT false
);

INSERT INTO public.fiscal_years (id, company_id, name, start_date, end_date, is_closed, is_current) VALUES
  ('f1a10000-0001-4000-8000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Exercice 2025', '2025-01-01', '2025-12-31', true, false),
  ('f1a10000-0002-4000-8000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Exercice 2026', '2026-01-01', '2026-12-31', false, true);
