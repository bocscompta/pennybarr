#!/usr/bin/env node

/**
 * Fast sync of Pennylane entries with parallel requests
 * Outputs SQL file for direct import via Supabase
 */

import { writeFileSync } from 'fs';

const PENNYLANE_API_KEY = process.env.PENNYLANE_API_KEY;
if (!PENNYLANE_API_KEY) { console.error('Missing PENNYLANE_API_KEY env variable'); process.exit(1); }
const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v2';
const COMPANY_ID = process.env.COMPANY_ID;
if (!COMPANY_ID) { console.error('Missing COMPANY_ID env variable'); process.exit(1); }

const CONCURRENCY = 2; // 2 parallel requests
const DELAY_BETWEEN_BATCHES = 1200; // 1.2s between batches of 2

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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
        console.log(`  Rate limited, waiting ${attempt * 2}s...`);
        await sleep(attempt * 2000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (attempt === retries) return null;
      await sleep(500);
    }
  }
  return null;
}

async function fetchEntriesParallel(entryIds) {
  const results = [];

  for (let i = 0; i < entryIds.length; i += CONCURRENCY) {
    const batch = entryIds.slice(i, i + CONCURRENCY);
    const promises = batch.map(id => fetchPennylane(`/ledger_entries/${id}`));
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(r => r !== null));

    if (i + CONCURRENCY < entryIds.length) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }

    process.stdout.write(`\r  Fetched ${Math.min(i + CONCURRENCY, entryIds.length)}/${entryIds.length} entries`);
  }

  return results;
}

async function main() {
  console.log('🚀 Fast sync Pennylane -> Supabase\n');

  // Step 1: Get all entry IDs
  console.log('📋 Getting entry list...');
  const allEntryIds = [];

  const first = await fetchPennylane('/ledger_entries?limit=100&page=1');
  if (!first) {
    console.error('Failed to fetch entries');
    process.exit(1);
  }

  const totalPages = first.total_pages;
  console.log(`  Total: ${first.total_items} entries on ${totalPages} pages`);

  // Collect IDs from first page
  allEntryIds.push(...first.items.map(e => e.id));

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    await sleep(500);
    const response = await fetchPennylane(`/ledger_entries?limit=100&page=${page}`);
    if (response) {
      allEntryIds.push(...response.items.map(e => e.id));
    }
    process.stdout.write(`\r  Page ${page}/${totalPages}`);
  }
  console.log(`\n  Got ${allEntryIds.length} entry IDs\n`);

  // Step 2: Fetch entry details in parallel
  console.log('📥 Fetching entry details...');
  const entries = await fetchEntriesParallel(allEntryIds);
  console.log(`\n  Got ${entries.length} entries with details\n`);

  // Step 3: Extract all lines
  console.log('📊 Processing lines...');
  const allLines = [];

  for (const entry of entries) {
    if (entry.ledger_entry_lines) {
      for (const line of entry.ledger_entry_lines) {
        const debit = parseFloat(line.debit) || 0;
        const credit = parseFloat(line.credit) || 0;

        if (debit > 0 || credit > 0) {
          allLines.push({
            company_id: COMPANY_ID,
            date: entry.date,
            account_code: line.ledger_account.number,
            label: (entry.label || '').substring(0, 255).replace(/'/g, "''"),
            debit,
            credit,
            piece_number: entry.piece_number || null,
            journal_code: `J${entry.journal?.id || 0}`,
            pennylane_entry_id: String(entry.id),
            pennylane_line_id: String(line.id),
          });
        }
      }
    }
  }

  console.log(`  Extracted ${allLines.length} lines\n`);

  // Step 4: Generate SQL
  console.log('💾 Generating SQL...');

  let sql = '-- Pennylane accounting entries sync\n';
  sql += '-- Generated: ' + new Date().toISOString() + '\n\n';
  sql += `DELETE FROM accounting_entries WHERE company_id = '${COMPANY_ID}';\n\n`;

  // Insert in batches of 50
  const batchSize = 50;
  for (let i = 0; i < allLines.length; i += batchSize) {
    const batch = allLines.slice(i, i + batchSize);
    sql += 'INSERT INTO accounting_entries (company_id, date, account_code, label, debit, credit, piece_number, journal_code, pennylane_entry_id, pennylane_line_id) VALUES\n';
    sql += batch.map(e =>
      `('${e.company_id}', '${e.date}', '${e.account_code}', '${e.label}', ${e.debit}, ${e.credit}, ${e.piece_number ? `'${e.piece_number}'` : 'NULL'}, '${e.journal_code}', '${e.pennylane_entry_id}', '${e.pennylane_line_id}')`
    ).join(',\n');
    sql += ';\n\n';
  }

  const sqlFile = '/tmp/pennylane-sync.sql';
  writeFileSync(sqlFile, sql);
  console.log(`  SQL saved to ${sqlFile}`);

  // Also save JSON for reference
  const jsonFile = '/tmp/pennylane-entries.json';
  writeFileSync(jsonFile, JSON.stringify(allLines, null, 2));
  console.log(`  JSON saved to ${jsonFile}`);

  console.log(`\n🎉 Done! ${allLines.length} lines ready to import`);
  console.log(`\nTo import, run the SQL file via Supabase dashboard or CLI.`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
