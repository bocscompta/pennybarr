#!/usr/bin/env node

/**
 * Fetch Pennylane accounts and output as JSON
 */

const PENNYLANE_API_KEY = process.env.PENNYLANE_API_KEY;
if (!PENNYLANE_API_KEY) { console.error('Missing PENNYLANE_API_KEY env variable'); process.exit(1); }
const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v2';

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

  console.error(`Total: ${allAccounts.length} accounts`);

  // Output JSON to stdout
  console.log(JSON.stringify(allAccounts, null, 2));
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
