#!/usr/bin/env node

/**
 * Fetch Pennylane accounts and insert directly via Supabase REST API
 * with proper authentication and error handling
 */

const PENNYLANE_API_KEY = process.env.PENNYLANE_API_KEY;
if (!PENNYLANE_API_KEY) { console.error('Missing PENNYLANE_API_KEY env variable'); process.exit(1); }
const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v2';
// Use the correct Supabase project URL (matching src/lib/supabase.ts)
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL env variable'); process.exit(1); }
// Use service role key for direct database access
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY_ID = process.env.COMPANY_ID;
if (!COMPANY_ID) { console.error('Missing COMPANY_ID env variable'); process.exit(1); }

if (!SUPABASE_SERVICE_KEY) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.error('You can find it in the Supabase dashboard under Settings > API');
  process.exit(1);
}

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

async function upsertAccounts(accounts) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/chart_of_accounts`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(accounts),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${text}`);
  }

  return true;
}

async function main() {
  console.log('🚀 Starting Pennylane -> Supabase account sync...\n');

  const allAccounts = [];
  let page = 1;
  let hasMore = true;

  console.log('📊 Fetching accounts from Pennylane...');

  while (hasMore) {
    const response = await fetchPennylane(`/ledger_accounts?limit=100&page=${page}`);
    process.stdout.write(`\r  Page ${page}/${response.total_pages}`);

    allAccounts.push(...response.items);
    hasMore = page < response.total_pages;
    page++;

    await sleep(300);
  }

  console.log(`\n✅ Fetched ${allAccounts.length} accounts\n`);

  console.log('📤 Inserting into Supabase...');

  // Process in batches of 100
  const batchSize = 100;
  let totalInserted = 0;

  for (let i = 0; i < allAccounts.length; i += batchSize) {
    const batch = allAccounts.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(allAccounts.length / batchSize);

    const records = batch.map(acc => ({
      company_id: COMPANY_ID,
      code: acc.number,
      label: acc.label,
      type: getAccountType(acc.number),
      is_active: acc.enabled,
      pennylane_id: acc.id,
    }));

    try {
      await upsertAccounts(records);
      totalInserted += batch.length;
      process.stdout.write(`\r  Batch ${batchNum}/${totalBatches} - ${totalInserted} accounts`);
    } catch (error) {
      console.error(`\n  Error batch ${batchNum}:`, error.message);
    }

    await sleep(100);
  }

  console.log(`\n\n🎉 Done! ${totalInserted} accounts synchronized.`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
