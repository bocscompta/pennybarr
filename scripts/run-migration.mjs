// Script to run RLS migration for chart_of_accounts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.log('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment')
  console.log('')
  console.log('Pour exécuter cette migration, tu dois:')
  console.log('1. Aller sur ton dashboard Supabase > Settings > API')
  console.log('2. Copier la "service_role" key (pas la anon key)')
  console.log('3. Exécuter: SUPABASE_URL="https://xxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="ta_clé" node scripts/run-migration.mjs')
  console.log('')
  console.log('OU exécuter ce SQL directement dans SQL Editor:')
  console.log('----------------------------------------')
  console.log(`
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select chart_of_accounts" ON chart_of_accounts;
DROP POLICY IF EXISTS "Allow anon insert chart_of_accounts" ON chart_of_accounts;

CREATE POLICY "Allow anon select chart_of_accounts"
ON chart_of_accounts FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert chart_of_accounts"
ON chart_of_accounts FOR INSERT TO anon WITH CHECK (true);
  `)
  console.log('----------------------------------------')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

async function runMigration() {
  console.log('🚀 Running RLS migration for chart_of_accounts...')

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Allow anon select chart_of_accounts" ON chart_of_accounts;
      DROP POLICY IF EXISTS "Allow anon insert chart_of_accounts" ON chart_of_accounts;

      CREATE POLICY "Allow anon select chart_of_accounts"
      ON chart_of_accounts FOR SELECT TO anon USING (true);

      CREATE POLICY "Allow anon insert chart_of_accounts"
      ON chart_of_accounts FOR INSERT TO anon WITH CHECK (true);
    `
  })

  if (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  console.log('✅ Migration completed successfully!')
}

runMigration()
