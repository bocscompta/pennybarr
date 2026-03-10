#!/usr/bin/env node

/**
 * Fetch Pennylane accounts and output as individual JSON batches
 * for insertion via Supabase MCP tool
 */

const PENNYLANE_API_KEY = process.env.PENNYLANE_API_KEY;
if (!PENNYLANE_API_KEY) { console.error('Missing PENNYLANE_API_KEY env variable'); process.exit(1); }
const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v2';
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
    throw new Error(`Pennylane API error: ${response.status}`);
  }

  return response.json();
}

function getAccountType(code) {
  const firstChar = code.charAt(0);
  switch (firstChar) {
    case '1': return 'equity';
    case '2': return 'asset';
    case '3': return 'asset';
    case '4': return 'liability';
    case '5': return 'asset';
    case '6': return 'expense';
    case '7': return 'income';
    case '8': return 'special';
    default: return 'other';
  }
}

function escapeSQL(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

async function main() {
  const allAccounts = [];
  let page = 1;
  let hasMore = true;

  console.error('Fetching Pennylane accounts...');

  while (hasMore) {
    const response = await fetchPennylane(`/ledger_accounts?limit=100&page=${page}`);
    console.error(`Page ${page}/${response.total_pages}`);

    allAccounts.push(...response.items);
    hasMore = page < response.total_pages;
    page++;

    await sleep(300);
  }

  console.error(`Total: ${allAccounts.length} accounts\n`);

  // Generate SQL INSERT statements - one big batch
  const values = allAccounts.map(acc => {
    const type = getAccountType(acc.number);
    const label = escapeSQL(acc.label);
    return `('${COMPANY_ID}', '${escapeSQL(acc.number)}', '${label}', '${type}', ${acc.enabled}, ${acc.id})`;
  });

  // Output as single INSERT with all values
  console.log(`INSERT INTO chart_of_accounts (company_id, code, label, type, is_active, pennylane_id)
VALUES
${values.join(',\n')}
ON CONFLICT (company_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  type = EXCLUDED.type,
  is_active = EXCLUDED.is_active,
  pennylane_id = EXCLUDED.pennylane_id;`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
