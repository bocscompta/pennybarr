#!/usr/bin/env node

/**
 * Import accounting entries from JSON to Supabase via REST API
 */

import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL env variable'); process.exit(1); }
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_ANON_KEY env variable'); process.exit(1); }

async function insertBatch(entries) {
  // Map to correct column names
  const mapped = entries.map(e => ({
    company_id: e.company_id,
    date: e.date,
    account_code: e.account_code,
    label: e.label,
    debit: e.debit,
    credit: e.credit,
    piece_number: e.piece_number,
    journal: e.journal_code, // journal_code -> journal
    pennylane_entry_id: parseInt(e.pennylane_entry_id, 10), // string -> bigint
    pennylane_line_id: parseInt(e.pennylane_line_id, 10),   // string -> bigint
  }));

  const response = await fetch(`${SUPABASE_URL}/rest/v1/accounting_entries`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(mapped),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Error: ${response.status} - ${text}`);
  }
  return true;
}

async function main() {
  console.log('📥 Importing accounting entries from JSON...\n');

  // Read JSON file
  const data = JSON.parse(readFileSync('/tmp/pennylane-entries.json', 'utf-8'));
  console.log(`📊 Total entries: ${data.length}\n`);

  // Insert in batches of 100
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(data.length / batchSize);

    try {
      await insertBatch(batch);
      inserted += batch.length;
      process.stdout.write(`\r  Batch ${batchNum}/${totalBatches} - ${inserted}/${data.length} entries inserted`);
    } catch (error) {
      console.error(`\n  Error batch ${batchNum}:`, error.message);
    }
  }

  console.log(`\n\n🎉 Done! ${inserted} entries imported.`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
