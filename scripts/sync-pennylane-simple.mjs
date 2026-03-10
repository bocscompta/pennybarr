#!/usr/bin/env node

/**
 * Script de synchronisation Pennylane -> Supabase (ESM version)
 * Usage: node scripts/sync-pennylane-simple.mjs
 */

const PENNYLANE_API_KEY = process.env.PENNYLANE_API_KEY;
if (!PENNYLANE_API_KEY) { console.error('Missing PENNYLANE_API_KEY env variable'); process.exit(1); }
const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v2';
// Use the correct Supabase project URL (matching src/lib/supabase.ts)
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL env variable'); process.exit(1); }
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_ANON_KEY env variable'); process.exit(1); }
const COMPANY_ID = process.env.COMPANY_ID;
if (!COMPANY_ID) { console.error('Missing COMPANY_ID env variable'); process.exit(1); }

// Fetch from Pennylane
async function fetchPennylane(endpoint) {
  const response = await fetch(`${PENNYLANE_API_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${PENNYLANE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Pennylane API error: ${response.status}`);
  }
  return response.json();
}

// Insert into Supabase
async function supabaseInsert(table, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${error}`);
  }
  return response.json();
}

// Sync chart of accounts
async function syncAccounts() {
  console.log('📊 Synchronisation du plan comptable...');

  let page = 1;
  let totalSynced = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetchPennylane(`/ledger_accounts?limit=100&page=${page}`);
    process.stdout.write(`\r  Page ${page}/${response.total_pages} - ${response.items.length} comptes`);

    // Prepare batch for upsert
    const accounts = response.items.map(acc => ({
      company_id: COMPANY_ID,
      code: acc.number,
      label: acc.label,
      is_active: acc.enabled,
      pennylane_id: acc.id,
    }));

    // Insert in batches
    try {
      await supabaseInsert('chart_of_accounts', accounts);
      totalSynced += accounts.length;
    } catch (error) {
      console.error(`\n    Erreur page ${page}:`, error.message);
    }

    hasMore = page < response.total_pages;
    page++;

    // Rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n✅ ${totalSynced} comptes synchronisés`);
  return totalSynced;
}

// Sync accounting entries
async function syncEntries() {
  console.log('\n📝 Synchronisation des écritures comptables...');

  let page = 1;
  let totalSynced = 0;
  let hasMore = true;

  // First, get total count
  const firstPage = await fetchPennylane('/ledger_entries?limit=1&page=1');
  const totalPages = firstPage.total_pages;
  console.log(`  Total: ${firstPage.total_items} écritures sur ${totalPages} pages`);

  while (hasMore && page <= Math.min(totalPages, 60)) { // Limit to 60 pages for now
    const response = await fetchPennylane(`/ledger_entries?limit=20&page=${page}`);
    process.stdout.write(`\r  Page ${page}/${totalPages} - traitement...        `);

    for (const entry of response.items) {
      try {
        // Fetch entry details with lines
        const details = await fetchPennylane(`/ledger_entries/${entry.id}`);

        if (details.ledger_entry_lines && details.ledger_entry_lines.length > 0) {
          const lines = details.ledger_entry_lines
            .map(line => ({
              company_id: COMPANY_ID,
              date: entry.date,
              account_code: line.ledger_account.number,
              label: entry.label.substring(0, 255),
              debit: parseFloat(line.debit) || 0,
              credit: parseFloat(line.credit) || 0,
              piece_number: entry.piece_number,
              journal_code: `J${entry.journal.id}`,
              pennylane_entry_id: entry.id,
              pennylane_line_id: line.id,
            }))
            .filter(l => l.debit > 0 || l.credit > 0);

          if (lines.length > 0) {
            await supabaseInsert('accounting_entries', lines);
            totalSynced += lines.length;
          }
        }

        // Rate limiting - 4 requests per second max for Pennylane
        await new Promise(r => setTimeout(r, 260));

      } catch (error) {
        // Skip errors for individual entries
        console.error(`\n    Erreur entrée ${entry.id}:`, error.message.substring(0, 50));
      }
    }

    hasMore = page < totalPages;
    page++;
  }

  console.log(`\n✅ ${totalSynced} lignes d'écritures synchronisées`);
  return totalSynced;
}

// Main
async function main() {
  console.log('🚀 Démarrage de la synchronisation Pennylane -> Supabase\n');

  try {
    await syncAccounts();
    await syncEntries();
    console.log('\n🎉 Synchronisation terminée!');
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

main();
