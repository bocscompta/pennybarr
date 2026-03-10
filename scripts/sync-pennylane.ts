#!/usr/bin/env npx ts-node

/**
 * Script de synchronisation Pennylane -> Supabase
 * Usage: npx ts-node scripts/sync-pennylane.ts
 */

import { createClient } from '@supabase/supabase-js'

// Configuration
const PENNYLANE_API_KEY = process.env.PENNYLANE_API_KEY
if (!PENNYLANE_API_KEY) { console.error('Missing PENNYLANE_API_KEY env variable'); process.exit(1) }
const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v2'

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY env variables'); process.exit(1) }
const COMPANY_ID = process.env.COMPANY_ID
if (!COMPANY_ID) { console.error('Missing COMPANY_ID env variable'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Types
interface PennylaneLedgerAccount {
  id: number
  number: string
  label: string
  enabled: boolean
  type: string
}

interface PennylaneLedgerEntryLine {
  id: number
  debit: string
  credit: string
  label: string
  ledger_account: {
    id: number
    number: string
  }
}

interface PennylaneLedgerEntry {
  id: number
  label: string
  date: string
  piece_number: string
  journal: { id: number }
  ledger_entry_lines?: PennylaneLedgerEntryLine[]
}

// Fetch helper
async function fetchPennylane<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${PENNYLANE_API_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${PENNYLANE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Pennylane API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Sync chart of accounts
async function syncChartOfAccounts() {
  console.log('📊 Synchronisation du plan comptable...')

  let page = 1
  let totalSynced = 0
  let hasMore = true

  while (hasMore) {
    const response = await fetchPennylane<{
      items: PennylaneLedgerAccount[]
      total_pages: number
      total_items: number
    }>(`/ledger_accounts?limit=100&page=${page}`)

    console.log(`  Page ${page}/${response.total_pages} - ${response.items.length} comptes`)

    for (const account of response.items) {
      // Upsert into chart_of_accounts
      const { error } = await supabase
        .from('chart_of_accounts')
        .upsert({
          company_id: COMPANY_ID,
          code: account.number,
          label: account.label,
          is_active: account.enabled,
          pennylane_id: account.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'company_id,code',
        })

      if (error) {
        console.error(`    Erreur compte ${account.number}:`, error.message)
      } else {
        totalSynced++
      }
    }

    hasMore = page < response.total_pages
    page++
  }

  console.log(`✅ ${totalSynced} comptes synchronisés`)
  return totalSynced
}

// Sync accounting entries
async function syncAccountingEntries() {
  console.log('📝 Synchronisation des écritures comptables...')

  let page = 1
  let totalSynced = 0
  let hasMore = true

  while (hasMore) {
    const response = await fetchPennylane<{
      items: PennylaneLedgerEntry[]
      total_pages: number
      total_items: number
    }>(`/ledger_entries?limit=50&page=${page}`)

    console.log(`  Page ${page}/${response.total_pages} - ${response.items.length} écritures`)

    for (const entry of response.items) {
      // Fetch entry details with lines
      const entryDetails = await fetchPennylane<PennylaneLedgerEntry>(`/ledger_entries/${entry.id}`)

      if (entryDetails.ledger_entry_lines) {
        for (const line of entryDetails.ledger_entry_lines) {
          const debit = parseFloat(line.debit) || 0
          const credit = parseFloat(line.credit) || 0

          if (debit === 0 && credit === 0) continue

          // Upsert into accounting_entries
          const { error } = await supabase
            .from('accounting_entries')
            .upsert({
              company_id: COMPANY_ID,
              date: entry.date,
              account_code: line.ledger_account.number,
              label: entry.label,
              debit,
              credit,
              piece_number: entry.piece_number,
              journal_code: `J${entry.journal.id}`,
              pennylane_entry_id: entry.id,
              pennylane_line_id: line.id,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'company_id,pennylane_line_id',
              ignoreDuplicates: false,
            })

          if (error) {
            // If conflict on pennylane_line_id doesn't work, try insert
            if (error.code === '23505') {
              // Already exists, skip
            } else {
              console.error(`    Erreur ligne ${line.id}:`, error.message)
            }
          } else {
            totalSynced++
          }
        }
      }
    }

    hasMore = page < response.total_pages
    page++

    // Rate limiting - wait 250ms between pages
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  console.log(`✅ ${totalSynced} lignes d'écritures synchronisées`)
  return totalSynced
}

// Main sync function
async function main() {
  console.log('🚀 Démarrage de la synchronisation Pennylane -> Supabase')
  console.log(`   Company ID: ${COMPANY_ID}`)
  console.log('')

  try {
    // First, add pennylane columns if they don't exist
    console.log('🔧 Vérification de la structure de la base...')

    // Sync accounts first
    await syncChartOfAccounts()
    console.log('')

    // Then sync entries
    await syncAccountingEntries()
    console.log('')

    console.log('🎉 Synchronisation terminée avec succès!')

  } catch (error) {
    console.error('❌ Erreur de synchronisation:', error)
    process.exit(1)
  }
}

main()
