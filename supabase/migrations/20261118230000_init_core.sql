-- =============================================================================
-- Pennybarr — socle de base (tables du noyau comptable)
-- Reconstruction depuis supabase/seed.sql et src/types/database.ts.
-- À exécuter une seule fois sur un projet Supabase vierge.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Sociétés (mono-société au démarrage : COMPANY_ID est fixé côté client)
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text,
  slug text,
  siren text,
  siret text,
  vat_number text,
  address text,
  postal_code text,
  city text,
  country text default 'FR',
  currency text default 'EUR',
  fiscal_year_start integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Plan comptable général
-- ---------------------------------------------------------------------------
create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  label text not null,
  type text,
  parent_code text,
  is_active boolean default true,
  created_at timestamptz default now(),
  account_role text,
  pcg_type text,
  pennylane_id bigint,
  unique (company_id, code)
);

-- ---------------------------------------------------------------------------
-- Journaux comptables
-- ---------------------------------------------------------------------------
create table if not exists public.accounting_journals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  label text,
  journal_type text,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (company_id, code)
);

-- ---------------------------------------------------------------------------
-- Comptes bancaires
-- ---------------------------------------------------------------------------
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text,
  bank_name text,
  account_number text,
  iban text,
  bic text,
  currency text default 'EUR',
  initial_balance numeric default 0,
  current_balance numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Tiers (clients et fournisseurs)
-- ---------------------------------------------------------------------------
create table if not exists public.third_parties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  type text check (type in ('customer', 'supplier')),
  name text not null,
  code text,
  email text,
  phone text,
  address text,
  postal_code text,
  city text,
  country text default 'FR',
  siren text,
  siret text,
  vat_number text,
  payment_terms integer default 30,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  pennylane_id bigint
);

-- ---------------------------------------------------------------------------
-- Produits et services
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  code text,
  name text not null,
  description text,
  type text default 'product',
  sale_price_ht numeric default 0,
  purchase_price_ht numeric,
  vat_rate text default '20',
  unit text default 'unite',
  accounting_code_sale text,
  accounting_code_purchase text,
  is_active boolean default true,
  pennylane_id bigint,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Factures (clients et fournisseurs)
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  third_party_id uuid references public.third_parties(id) on delete set null,
  type text check (type in ('in', 'out')),
  number text not null,
  date date not null,
  due_date date,
  status text default 'draft',
  total_ht numeric default 0,
  total_vat numeric default 0,
  total_ttc numeric default 0,
  currency text default 'EUR',
  notes text,
  pdf_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  vat_regime text default 'normal',
  is_autoliquidated boolean default false,
  accounting_code text,
  entry_label text,
  exchange_rate numeric,
  base_currency varchar(3) default 'EUR',
  payment_method text,
  pennylane_id bigint,
  unique (company_id, number)
);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  description text,
  quantity numeric default 1,
  unit_price numeric,
  vat_rate numeric default 20.0,
  total_ht numeric,
  total_vat numeric,
  total_ttc numeric,
  accounting_code text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Transactions bancaires
-- ---------------------------------------------------------------------------
create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  bank_account_id uuid references public.bank_accounts(id) on delete cascade,
  date date not null,
  value_date date,
  label text,
  amount numeric not null,
  type text,
  reference text,
  category text,
  is_reconciled boolean default false,
  reconciled_at timestamptz,
  linked_invoice_id uuid references public.invoices(id) on delete set null,
  raw_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  category_id uuid,
  comments text,
  third_party_id uuid references public.third_parties(id) on delete set null,
  draft_invoice_data jsonb,
  draft_document_url text,
  reconciliation_id uuid,
  statement_id uuid
);

-- ---------------------------------------------------------------------------
-- Écritures comptables (une ligne = un compte débité ou crédité)
-- ---------------------------------------------------------------------------
create table if not exists public.accounting_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  journal text,
  date date not null,
  piece_number text,
  label text,
  account_code text,
  debit numeric default 0 check (debit >= 0),
  credit numeric default 0 check (credit >= 0),
  linked_invoice_id uuid references public.invoices(id) on delete set null,
  linked_transaction_id uuid references public.bank_transactions(id) on delete set null,
  is_validated boolean default false,
  created_at timestamptz default now(),
  lettrage_code text,
  lettrage_date timestamptz,
  lettrage_type text,
  pennylane_entry_id bigint,
  pennylane_line_id bigint,
  category_name text,
  pennylane_category_id bigint,
  -- Une ligne ne peut pas être à la fois au débit et au crédit
  constraint one_side_only check (debit = 0 or credit = 0)
);

-- ---------------------------------------------------------------------------
-- Exercices comptables
-- ---------------------------------------------------------------------------
create table if not exists public.fiscal_years (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text,
  start_date date,
  end_date date,
  is_closed boolean default false,
  closed_at timestamptz,
  created_at timestamptz default now(),
  is_current boolean default false
);

-- ---------------------------------------------------------------------------
-- Index de lecture
-- ---------------------------------------------------------------------------
create index if not exists idx_entries_company_date on public.accounting_entries (company_id, date);
create index if not exists idx_entries_company_account on public.accounting_entries (company_id, account_code);
create index if not exists idx_entries_piece on public.accounting_entries (company_id, piece_number);
create index if not exists idx_invoices_company_date on public.invoices (company_id, date);
create index if not exists idx_invoices_third_party on public.invoices (third_party_id);
create index if not exists idx_invoice_lines_invoice on public.invoice_lines (invoice_id);
create index if not exists idx_transactions_company_date on public.bank_transactions (company_id, date);
create index if not exists idx_transactions_bank_account on public.bank_transactions (bank_account_id);
create index if not exists idx_third_parties_company_type on public.third_parties (company_id, type);

-- =============================================================================
-- Sécurité niveau ligne (RLS)
--
-- MVP mono-société : tout utilisateur authentifié a accès aux données.
-- À remplacer par un cloisonnement par société (table de rattachement
-- utilisateur → société) lors de la Phase multi-entreprises.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'chart_of_accounts', 'accounting_journals', 'bank_accounts',
    'third_parties', 'products', 'invoices', 'invoice_lines',
    'bank_transactions', 'accounting_entries', 'fiscal_years'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated_all" on public.%I', t);
    execute format(
      'create policy "authenticated_all" on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end
$$;
