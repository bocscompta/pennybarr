// Script to check folder document counts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
if (!supabaseUrl) { console.error('Missing SUPABASE_URL env variable'); process.exit(1) }
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
if (!supabaseAnonKey) { console.error('Missing SUPABASE_ANON_KEY env variable'); process.exit(1) }

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const COMPANY_ID = process.env.COMPANY_ID
if (!COMPANY_ID) { console.error('Missing COMPANY_ID env variable'); process.exit(1) }

async function getDocumentCount(folderId) {
  let query = supabase
    .from('ged_documents')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('is_deleted', false)

  if (folderId === null) {
    query = query.is('folder_id', null)
  } else {
    query = query.eq('folder_id', folderId)
  }

  const { count } = await query
  return count ?? 0
}

async function getSubfolderCount(folderId) {
  const { count } = await supabase
    .from('ged_folders')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('parent_id', folderId)

  return count ?? 0
}

async function checkCounts() {
  // Get all folders
  const { data: folders } = await supabase
    .from('ged_folders')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('name')

  console.log('📊 Folder Counts:\n')

  for (const folder of folders) {
    const docCount = await getDocumentCount(folder.id)
    const subfolderCount = await getSubfolderCount(folder.id)

    console.log(`📁 ${folder.name}`)
    console.log(`   Documents: ${docCount}`)
    console.log(`   Sous-dossiers: ${subfolderCount}`)
    console.log('')
  }

  // Documents à classer (unfiled)
  const unfiledCount = await getDocumentCount(null)
  console.log(`📥 Documents à classer: ${unfiledCount}`)
}

checkCounts()
