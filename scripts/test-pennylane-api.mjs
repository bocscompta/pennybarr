#!/usr/bin/env node

/**
 * Test Pennylane API to find the best way to get balance data
 */

const PENNYLANE_API_KEY = process.env.PENNYLANE_API_KEY;
if (!PENNYLANE_API_KEY) { console.error('Missing PENNYLANE_API_KEY env variable'); process.exit(1); }
const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v2';

async function fetchPennylane(endpoint) {
  const response = await fetch(`${PENNYLANE_API_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${PENNYLANE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.log(`Error ${response.status}: ${text}`);
    return null;
  }

  return response.json();
}

async function main() {
  console.log('Testing Pennylane API endpoints...\n');

  // Test 1: Check if ledger_entries returns lines
  console.log('1. Testing /ledger_entries with include param...');
  const entries = await fetchPennylane('/ledger_entries?limit=1&page=1');
  if (entries && entries.items.length > 0) {
    console.log('Sample entry structure:');
    console.log(JSON.stringify(entries.items[0], null, 2));
  }

  // Test 2: Get a single entry with lines
  console.log('\n2. Testing single entry with lines...');
  if (entries && entries.items.length > 0) {
    const entryId = entries.items[0].id;
    const entry = await fetchPennylane(`/ledger_entries/${entryId}`);
    console.log('Entry with lines:');
    console.log(JSON.stringify(entry, null, 2));
  }

  // Test 3: Try ledger_account_balances endpoint
  console.log('\n3. Testing /ledger_account_balances...');
  const balances = await fetchPennylane('/ledger_account_balances?limit=10');
  if (balances) {
    console.log('Account balances response:');
    console.log(JSON.stringify(balances, null, 2));
  }

  // Test 4: Check ledger_accounts with balance info
  console.log('\n4. Testing /ledger_accounts with balance...');
  const accounts = await fetchPennylane('/ledger_accounts?limit=5&page=1');
  if (accounts && accounts.items.length > 0) {
    console.log('Sample account structure:');
    console.log(JSON.stringify(accounts.items[0], null, 2));
  }
}

main().catch(console.error);
