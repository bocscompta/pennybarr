#!/usr/bin/env node

/**
 * Sync Pennylane categories to accounting entries
 * Fetches supplier invoices with categories and updates accounting_entries
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
        const text = await response.text();
        throw new Error(`API error: ${response.status} - ${text}`);
      }

      return response.json();
    } catch (error) {
      if (attempt === retries) {
        console.error(`Failed after ${retries} attempts:`, error.message);
        return null;
      }
      await sleep(500);
    }
  }
  return null;
}

async function updateSupabase(updates) {
  // Update in batches
  const batchSize = 50;
  let updated = 0;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);

    for (const update of batch) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/accounting_entries?pennylane_entry_id=eq.${update.pennylane_entry_id}&company_id=eq.${COMPANY_ID}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            category_name: update.category_name,
            pennylane_category_id: update.pennylane_category_id,
          }),
        }
      );

      if (!response.ok) {
        console.error(`Failed to update entry ${update.pennylane_entry_id}`);
      } else {
        updated++;
      }
    }

    process.stdout.write(`\r  Updated ${Math.min(i + batchSize, updates.length)}/${updates.length} entries`);
    await sleep(100);
  }

  return updated;
}

async function main() {
  console.log('🔄 Syncing Pennylane categories to accounting entries\n');

  // Step 1: Fetch all supplier invoices with categories
  console.log('📋 Fetching supplier invoices from Pennylane...');
  const allInvoices = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    await sleep(500);
    const response = await fetchPennylane(`/supplier_invoices?limit=100&page=${page}`);

    if (!response || !response.items) {
      hasMore = false;
      break;
    }

    allInvoices.push(...response.items);
    process.stdout.write(`\r  Page ${page}/${response.total_pages || '?'} - ${allInvoices.length} invoices`);

    hasMore = response.items.length === 100 && page < (response.total_pages || 999);
    page++;
  }

  console.log(`\n  Got ${allInvoices.length} supplier invoices\n`);

  // Step 2: Build mapping of ledger_entry_id -> category
  console.log('🔗 Building category mapping...');
  const categoryMap = new Map();
  let invoicesWithCategory = 0;

  for (const invoice of allInvoices) {
    if (invoice.categories && invoice.categories.length > 0) {
      // Get the first category (main category)
      const category = invoice.categories[0];

      if (invoice.ledger_entry_id) {
        categoryMap.set(invoice.ledger_entry_id, {
          category_name: category.name || category.label,
          pennylane_category_id: category.id,
        });
        invoicesWithCategory++;
      }
    }
  }

  console.log(`  Found ${invoicesWithCategory} invoices with categories\n`);

  // Step 3: Fetch ledger entries to get line IDs
  console.log('📥 Fetching ledger entry details...');
  const updates = [];
  const entryIds = Array.from(categoryMap.keys());

  for (let i = 0; i < entryIds.length; i++) {
    const entryId = entryIds[i];
    const categoryInfo = categoryMap.get(entryId);

    await sleep(300);
    const entry = await fetchPennylane(`/ledger_entries/${entryId}`);

    if (entry) {
      // Apply category to all charge lines (6xxx accounts)
      if (entry.ledger_entry_lines) {
        for (const line of entry.ledger_entry_lines) {
          const accountNumber = line.ledger_account?.number || '';
          // Only apply to expense accounts (class 6) and income accounts (class 7)
          if (accountNumber.startsWith('6') || accountNumber.startsWith('7')) {
            updates.push({
              pennylane_entry_id: entryId,
              pennylane_line_id: line.id,
              category_name: categoryInfo.category_name,
              pennylane_category_id: categoryInfo.pennylane_category_id,
            });
          }
        }
      }
    }

    process.stdout.write(`\r  Processed ${i + 1}/${entryIds.length} entries`);
  }

  console.log(`\n  Prepared ${updates.length} updates\n`);

  // Step 4: Update Supabase
  console.log('💾 Updating accounting entries in Supabase...');

  // Group updates by pennylane_entry_id to update all lines at once
  const groupedUpdates = new Map();
  for (const update of updates) {
    if (!groupedUpdates.has(update.pennylane_entry_id)) {
      groupedUpdates.set(update.pennylane_entry_id, update);
    }
  }

  const uniqueUpdates = Array.from(groupedUpdates.values());
  const updatedCount = await updateSupabase(uniqueUpdates);

  console.log(`\n\n🎉 Done! Updated ${updatedCount} accounting entries with categories.`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
