// Script to run purchase_requests migration
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
if (!supabaseUrl) { console.error('Missing SUPABASE_URL env variable'); process.exit(1) }
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
if (!supabaseAnonKey) { console.error('Missing SUPABASE_ANON_KEY env variable'); process.exit(1) }

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runMigration() {
  console.log('Running purchase_requests migration...\n')

  // Create purchase_requests table
  const { error: error1 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id),
        reference VARCHAR(50),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'ordered', 'received', 'invoiced')),
        supplier_id UUID REFERENCES third_parties(id),
        supplier_name VARCHAR(255),
        motif TEXT,
        delivery_address TEXT,
        estimated_delivery_date DATE,
        currency VARCHAR(3) DEFAULT 'EUR',
        total_ht DECIMAL(12,2) DEFAULT 0,
        total_tva DECIMAL(12,2) DEFAULT 0,
        total_ttc DECIMAL(12,2) DEFAULT 0,
        created_by UUID,
        approved_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  })

  if (error1) {
    console.log('Note: purchase_requests table may already exist or RPC not available')
    console.log('Error:', error1.message)
  } else {
    console.log('✓ purchase_requests table created')
  }

  // Try direct insert to test if table exists
  const { error: testError } = await supabase
    .from('purchase_requests')
    .select('id')
    .limit(1)

  if (testError) {
    console.log('\n⚠️  Tables do not exist yet. Please run the SQL migration manually in Supabase Dashboard:')
    console.log('   1. Go to https://supabase.com/dashboard')
    console.log('   2. Select your project')
    console.log('   3. Go to SQL Editor')
    console.log('   4. Copy and paste the contents of supabase/migrations/20260130_purchase_requests.sql')
    console.log('   5. Click Run')
  } else {
    console.log('\n✓ purchase_requests table exists and is accessible')
  }
}

runMigration()
