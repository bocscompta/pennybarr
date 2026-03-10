// Script to seed GED folders for Pennylane-style structure
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
if (!supabaseUrl) { console.error('Missing SUPABASE_URL env variable'); process.exit(1) }
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
if (!supabaseAnonKey) { console.error('Missing SUPABASE_ANON_KEY env variable'); process.exit(1) }

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const COMPANY_ID = process.env.COMPANY_ID
if (!COMPANY_ID) { console.error('Missing COMPANY_ID env variable'); process.exit(1) }

async function createSubfolders(parentId, parentName, folders) {
  for (const folder of folders) {
    const { data: existing } = await supabase
      .from('ged_folders')
      .select('id')
      .eq('company_id', COMPANY_ID)
      .eq('parent_id', parentId)
      .eq('name', folder.name)
      .single()

    if (existing) {
      console.log(`   ✅ ${folder.name} already exists`)
      continue
    }

    const { data: created, error } = await supabase
      .from('ged_folders')
      .insert({
        company_id: COMPANY_ID,
        parent_id: parentId,
        name: folder.name,
        folder_type: folder.folder_type || 'user',
        is_locked: folder.is_locked || false,
        sort_order: folder.sort_order
      })
      .select()
      .single()

    if (error) {
      console.error(`   ❌ Error creating ${folder.name}:`, error.message)
    } else {
      console.log(`   ✅ Created ${folder.name}`)
    }
  }
}

async function seedGedFolders() {
  console.log('🚀 Seeding GED folders...')

  // 1. Get or create "Dossier annuel"
  let { data: existingDossierAnnuel } = await supabase
    .from('ged_folders')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .is('parent_id', null)
    .eq('name', 'Dossier annuel')
    .single()

  let dossierAnnuelId

  if (existingDossierAnnuel) {
    dossierAnnuelId = existingDossierAnnuel.id
    console.log('✅ Found existing Dossier annuel:', dossierAnnuelId)
  } else {
    const { data: newDossierAnnuel, error } = await supabase
      .from('ged_folders')
      .insert({
        company_id: COMPANY_ID,
        parent_id: null,
        name: 'Dossier annuel',
        folder_type: 'system',
        is_locked: true,
        sort_order: 1
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating Dossier annuel:', error.message)
      return
    }
    dossierAnnuelId = newDossierAnnuel.id
    console.log('✅ Created Dossier annuel:', dossierAnnuelId)
  }

  // 2. Get or create "Dossier permanent"
  let { data: existingDossierPermanent } = await supabase
    .from('ged_folders')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .is('parent_id', null)
    .eq('name', 'Dossier permanent')
    .single()

  let dossierPermanentId

  if (existingDossierPermanent) {
    dossierPermanentId = existingDossierPermanent.id
    console.log('✅ Found existing Dossier permanent:', dossierPermanentId)
  } else {
    const { data: newDossierPermanent, error } = await supabase
      .from('ged_folders')
      .insert({
        company_id: COMPANY_ID,
        parent_id: null,
        name: 'Dossier permanent',
        folder_type: 'system',
        is_locked: true,
        sort_order: 2
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating Dossier permanent:', error.message)
      return
    }
    dossierPermanentId = newDossierPermanent.id
    console.log('✅ Created Dossier permanent:', dossierPermanentId)
  }

  // 3. Create exercise folders under Dossier annuel
  console.log('\n📂 Dossier annuel subfolders:')
  const exerciseFolders = [
    { name: 'Exercice 2024-2025', sort_order: 1, folder_type: 'system', is_locked: true },
    { name: 'Exercice 2026', sort_order: 2, folder_type: 'system', is_locked: true },
    { name: 'Exercice 2027', sort_order: 3, folder_type: 'system', is_locked: true },
    { name: 'Exercice 2028', sort_order: 4, folder_type: 'system', is_locked: true }
  ]
  await createSubfolders(dossierAnnuelId, 'Dossier annuel', exerciseFolders)

  // 4. Create folders under Dossier permanent (like Pennylane)
  console.log('\n📂 Dossier permanent subfolders:')
  const permanentFolders = [
    { name: '10_Status', sort_order: 1 },
    { name: '11_Contrats_Longs_Terme', sort_order: 2 },
    { name: '12_RH_Permanent', sort_order: 3 },
    { name: '13_Archives_Exercices Clos', sort_order: 4 },
    { name: '14_Connaissance client', sort_order: 5 },
    { name: '15_Fiscal', sort_order: 6 },
    { name: '16_Apports/CCA associés', sort_order: 7 },
    { name: 'Autres', sort_order: 8, is_locked: true },
    { name: 'Lettre de mission', sort_order: 9, is_locked: true }
  ]
  await createSubfolders(dossierPermanentId, 'Dossier permanent', permanentFolders)

  // 5. Get 10_Status folder ID and create subfolders
  const { data: statusFolder } = await supabase
    .from('ged_folders')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .eq('parent_id', dossierPermanentId)
    .eq('name', '10_Status')
    .single()

  if (statusFolder) {
    console.log('\n📂 10_Status subfolders:')
    const statusSubfolders = [
      { name: '101_Greffe & Kbis', sort_order: 1 },
      { name: '102_Statuts Société', sort_order: 2 },
      { name: '103_Procès-verbal (AG/AGE)', sort_order: 3 },
      { name: '104_Pactes Associés', sort_order: 4 },
      { name: '105_Constitution', sort_order: 5 },
      { name: '106_Annonces légales', sort_order: 6 }
    ]
    await createSubfolders(statusFolder.id, '10_Status', statusSubfolders)
  }

  console.log('')
  console.log('🎉 GED folders seeded successfully!')
  console.log('Refresh the Documents page to see the new folder structure.')
}

seedGedFolders()
