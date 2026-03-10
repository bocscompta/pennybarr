// Script to list GED folders to verify structure
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
if (!supabaseUrl) { console.error('Missing SUPABASE_URL env variable'); process.exit(1) }
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
if (!supabaseAnonKey) { console.error('Missing SUPABASE_ANON_KEY env variable'); process.exit(1) }

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const COMPANY_ID = process.env.COMPANY_ID
if (!COMPANY_ID) { console.error('Missing COMPANY_ID env variable'); process.exit(1) }

async function listFolders() {
  const { data, error } = await supabase
    .from('ged_folders')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('sort_order')
    .order('name')

  if (error) {
    console.error('Error:', error.message)
    return
  }

  console.log('📁 GED Folder Structure:')
  console.log('')

  // Build tree
  const rootFolders = data.filter(f => !f.parent_id)

  for (const root of rootFolders) {
    console.log(`📂 ${root.name} ${root.is_locked ? '🔒' : ''} (${root.folder_type})`)

    const children = data.filter(f => f.parent_id === root.id)
    for (const child of children) {
      console.log(`   └── 📁 ${child.name} ${child.is_locked ? '🔒' : ''}`)

      // Level 3 - subfolders of children
      const grandchildren = data.filter(f => f.parent_id === child.id)
      for (const gc of grandchildren) {
        console.log(`       └── 📁 ${gc.name} ${gc.is_locked ? '🔒' : ''}`)
      }
    }
  }
}

listFolders()
