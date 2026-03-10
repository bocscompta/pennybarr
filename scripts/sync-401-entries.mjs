#!/usr/bin/env node

/**
 * Script pour synchroniser uniquement les écritures fournisseurs (401xxx)
 * et calculer le solde correct
 */

const PENNYLANE_API_KEY = process.env.PENNYLANE_API_KEY;
if (!PENNYLANE_API_KEY) { console.error('Missing PENNYLANE_API_KEY env variable'); process.exit(1); }
const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v2';
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL env variable'); process.exit(1); }
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_ANON_KEY env variable'); process.exit(1); }
const COMPANY_ID = process.env.COMPANY_ID;
if (!COMPANY_ID) { console.error('Missing COMPANY_ID env variable'); process.exit(1); }

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchPennylane(endpoint) {
  const response = await fetch(`${PENNYLANE_API_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${PENNYLANE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    if (response.status === 429) {
      console.log('Rate limited, waiting 5s...');
      await sleep(5000);
      return fetchPennylane(endpoint);
    }
    throw new Error(`Pennylane API error: ${response.status}`);
  }
  return response.json();
}

async function supabaseUpsert(data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/accounting_entries`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,on_conflict=pennylane_line_id',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Supabase error:', error);
    return false;
  }
  return true;
}

async function main() {
  console.log('🔍 Recherche des écritures fournisseurs (401xxx) dans Pennylane...\n');

  let page = 1;
  let hasMore = true;
  let totalEntries = 0;
  let total401Entries = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const entries401 = [];

  // Get first page to know total
  const first = await fetchPennylane('/ledger_entries?limit=1&page=1');
  const totalPages = first.total_pages;
  console.log(`Total: ${first.total_items} écritures sur ${totalPages} pages\n`);

  // Process all pages
  while (hasMore && page <= totalPages) {
    process.stdout.write(`\rPage ${page}/${totalPages}...`);

    try {
      const response = await fetchPennylane(`/ledger_entries?limit=20&page=${page}`);

      for (const entry of response.items) {
        totalEntries++;

        // Fetch entry details
        const details = await fetchPennylane(`/ledger_entries/${entry.id}`);
        await sleep(300); // Rate limiting

        if (details.ledger_entry_lines) {
          for (const line of details.ledger_entry_lines) {
            // Check if it's a 401 account (fournisseurs)
            if (line.ledger_account.number.startsWith('401')) {
              const debit = parseFloat(line.debit) || 0;
              const credit = parseFloat(line.credit) || 0;

              totalDebit += debit;
              totalCredit += credit;
              total401Entries++;

              entries401.push({
                company_id: COMPANY_ID,
                date: entry.date,
                account_code: line.ledger_account.number,
                label: entry.label.substring(0, 255),
                debit: debit,
                credit: credit,
                piece_number: entry.piece_number,
                journal: `J${entry.journal?.id || 0}`,
                pennylane_entry_id: entry.id,
                pennylane_line_id: line.id,
              });
            }
          }
        }
      }

      hasMore = page < totalPages;
      page++;

    } catch (error) {
      console.error(`\nErreur page ${page}:`, error.message);
      await sleep(2000);
    }
  }

  console.log(`\n\n📊 Résultat de l'analyse:`);
  console.log(`   Total écritures Pennylane: ${totalEntries}`);
  console.log(`   Écritures 401xxx trouvées: ${total401Entries}`);
  console.log(`   Total Débit 401: ${totalDebit.toFixed(2)} €`);
  console.log(`   Total Crédit 401: ${totalCredit.toFixed(2)} €`);
  console.log(`   Solde fournisseurs: ${(totalCredit - totalDebit).toFixed(2)} €`);

  // Insert entries into Supabase
  if (entries401.length > 0) {
    console.log(`\n📤 Insertion de ${entries401.length} écritures dans Supabase...`);

    // Insert in batches of 50
    const batchSize = 50;
    let inserted = 0;

    for (let i = 0; i < entries401.length; i += batchSize) {
      const batch = entries401.slice(i, i + batchSize);
      process.stdout.write(`\r   Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(entries401.length/batchSize)}...`);

      const success = await supabaseUpsert(batch);
      if (success) {
        inserted += batch.length;
      }
      await sleep(200);
    }

    console.log(`\n✅ ${inserted} écritures insérées/mises à jour`);
  }

  console.log('\n🎉 Terminé!');
}

main().catch(console.error);
