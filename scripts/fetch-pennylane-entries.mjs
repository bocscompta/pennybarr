#!/usr/bin/env node

/**
 * Fetch Pennylane accounting entries and save to JSON file
 * Then the data can be inserted via Supabase MCP
 */

import { writeFileSync } from 'fs';

const PENNYLANE_API_KEY = process.env.PENNYLANE_API_KEY;
if (!PENNYLANE_API_KEY) { console.error('Missing PENNYLANE_API_KEY env variable'); process.exit(1); }
const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v2';
const COMPANY_ID = process.env.COMPANY_ID;
if (!COMPANY_ID) { console.error('Missing COMPANY_ID env variable'); process.exit(1); }

const DELAY_MS = 800; // Conservative delay to avoid rate limiting

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
        console.log(`    Rate limited, waiting ${attempt * 3}s...`);
        await sleep(attempt * 3000);
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

async function main() {
  console.log('🚀 Fetching accounting entries from Pennylane...\n');

  const allEntries = [];

  // First get total count
  const first = await fetchPennylane('/ledger_entries?limit=20&page=1');
  const totalPages = first.total_pages;
  console.log(`📊 Total: ${first.total_items} entries on ${totalPages} pages\n`);

  let page = 1;
  while (page <= totalPages) {
    await sleep(DELAY_MS);

    try {
      const response = await fetchPennylane(`/ledger_entries?limit=20&page=${page}`);
      process.stdout.write(`\r  Page ${page}/${totalPages} - ${response.items.length} entries`);

      for (const entry of response.items) {
        await sleep(DELAY_MS);

        try {
          // Fetch entry details with lines
          const details = await fetchPennylane(`/ledger_entries/${entry.id}`);

          if (details.ledger_entry_lines && details.ledger_entry_lines.length > 0) {
            for (const line of details.ledger_entry_lines) {
              const debit = parseFloat(line.debit) || 0;
              const credit = parseFloat(line.credit) || 0;

              if (debit > 0 || credit > 0) {
                allEntries.push({
                  company_id: COMPANY_ID,
                  date: entry.date,
                  account_code: line.ledger_account.number,
                  label: entry.label.substring(0, 255),
                  debit,
                  credit,
                  piece_number: entry.piece_number || null,
                  journal_code: `J${entry.journal?.id || 0}`,
                  pennylane_entry_id: entry.id,
                  pennylane_line_id: line.id,
                });
              }
            }
          }
        } catch (err) {
          console.error(`\n    Error fetching entry ${entry.id}:`, err.message);
        }
      }
    } catch (error) {
      console.error(`\n  Error page ${page}:`, error.message);
    }

    page++;
  }

  console.log(`\n\n✅ Fetched ${allEntries.length} entry lines`);

  // Save to JSON file
  const outputFile = '/tmp/pennylane-entries.json';
  writeFileSync(outputFile, JSON.stringify(allEntries, null, 2));
  console.log(`💾 Saved to ${outputFile}`);

  // Also output SQL INSERT statements in batches
  const sqlFile = '/tmp/pennylane-entries.sql';
  let sql = '-- Accounting entries from Pennylane\n';
  sql += `DELETE FROM accounting_entries WHERE company_id = '${COMPANY_ID}';\n\n`;

  // Insert in batches of 100
  for (let i = 0; i < allEntries.length; i += 100) {
    const batch = allEntries.slice(i, i + 100);
    sql += 'INSERT INTO accounting_entries (company_id, date, account_code, label, debit, credit, piece_number, journal_code, pennylane_entry_id, pennylane_line_id) VALUES\n';
    sql += batch.map(e =>
      `('${e.company_id}', '${e.date}', '${e.account_code}', '${e.label.replace(/'/g, "''")}', ${e.debit}, ${e.credit}, ${e.piece_number ? `'${e.piece_number}'` : 'NULL'}, '${e.journal_code}', '${e.pennylane_entry_id}', '${e.pennylane_line_id}')`
    ).join(',\n');
    sql += ';\n\n';
  }

  writeFileSync(sqlFile, sql);
  console.log(`📝 SQL saved to ${sqlFile}`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
