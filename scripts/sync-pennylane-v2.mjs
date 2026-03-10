#!/usr/bin/env node

/**
 * Script de synchronisation Pennylane -> Supabase (v2 avec meilleur rate limiting)
 * Usage: node scripts/sync-pennylane-v2.mjs
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

// Rate limiting: 2 requests per second for Pennylane (conservative)
const PENNYLANE_DELAY = 600; // 600ms between requests
const SUPABASE_DELAY = 100;  // 100ms between Supabase calls

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Fetch from Pennylane with retry
async function fetchPennylane(endpoint, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${PENNYLANE_API_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${PENNYLANE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 429) {
        console.log(`    Rate limited, waiting ${attempt * 2}s...`);
        await sleep(attempt * 2000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Pennylane API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`    Retry ${attempt}/${retries}...`);
      await sleep(1000);
    }
  }
}

// Insert into Supabase with retry
async function supabaseUpsert(table, data, onConflict) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': `resolution=merge-duplicates${onConflict ? `,on_conflict=${onConflict}` : ''}`,
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase error: ${error}`);
      }
      return true;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(500);
    }
  }
}

// Sync chart of accounts
async function syncAccounts() {
  console.log('📊 Synchronisation du plan comptable...');

  let page = 1;
  let totalSynced = 0;
  let hasMore = true;

  // First get total pages
  const first = await fetchPennylane('/ledger_accounts?limit=100&page=1');
  const totalPages = first.total_pages;
  console.log(`  Total: ${first.total_items} comptes sur ${totalPages} pages`);

  // Process first page
  const accounts1 = first.items.map(acc => ({
    company_id: COMPANY_ID,
    code: acc.number,
    label: acc.label,
    is_active: acc.enabled,
    pennylane_id: acc.id,
  }));

  try {
    await supabaseUpsert('chart_of_accounts', accounts1, 'company_id,code');
    totalSynced += accounts1.length;
  } catch (e) {
    console.error(`  Erreur page 1:`, e.message);
  }

  page = 2;
  while (page <= totalPages) {
    await sleep(PENNYLANE_DELAY);

    try {
      const response = await fetchPennylane(`/ledger_accounts?limit=100&page=${page}`);
      process.stdout.write(`\r  Page ${page}/${totalPages} - ${response.items.length} comptes`);

      const accounts = response.items.map(acc => ({
        company_id: COMPANY_ID,
        code: acc.number,
        label: acc.label,
        is_active: acc.enabled,
        pennylane_id: acc.id,
      }));

      await sleep(SUPABASE_DELAY);
      await supabaseUpsert('chart_of_accounts', accounts, 'company_id,code');
      totalSynced += accounts.length;
    } catch (error) {
      console.error(`\n  Erreur page ${page}:`, error.message);
    }

    page++;
  }

  console.log(`\n✅ ${totalSynced} comptes synchronisés`);
  return totalSynced;
}

// Sync accounting entries (limited to avoid timeout)
async function syncEntries(maxPages = 20) {
  console.log('\n📝 Synchronisation des écritures comptables...');

  // Get total count first
  const first = await fetchPennylane('/ledger_entries?limit=20&page=1');
  const totalPages = first.total_pages;
  const pagesToSync = Math.min(maxPages, totalPages);
  console.log(`  Total: ${first.total_items} écritures sur ${totalPages} pages`);
  console.log(`  Synchronisation des ${pagesToSync} premières pages...`);

  let page = 1;
  let totalSynced = 0;

  while (page <= pagesToSync) {
    await sleep(PENNYLANE_DELAY);

    try {
      const response = await fetchPennylane(`/ledger_entries?limit=20&page=${page}`);
      process.stdout.write(`\r  Page ${page}/${pagesToSync} - traitement...        `);

      for (const entry of response.items) {
        await sleep(PENNYLANE_DELAY);

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
              await sleep(SUPABASE_DELAY);
              await supabaseUpsert('accounting_entries', lines, 'company_id,pennylane_line_id');
              totalSynced += lines.length;
            }
          }
        } catch (error) {
          // Skip individual entry errors
        }
      }
    } catch (error) {
      console.error(`\n  Erreur page ${page}:`, error.message);
    }

    page++;
  }

  console.log(`\n✅ ${totalSynced} lignes d'écritures synchronisées`);
  return totalSynced;
}

// Main
async function main() {
  console.log('🚀 Démarrage de la synchronisation Pennylane -> Supabase (v2)\n');

  try {
    await syncAccounts();
    await syncEntries(30); // Sync 30 pages of entries
    console.log('\n🎉 Synchronisation terminée!');
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

main();
