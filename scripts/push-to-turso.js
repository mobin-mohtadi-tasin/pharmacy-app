import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function migrate() {
  console.log('🚀 Pharmacy App — Push Local Database to Turso Cloud\n');

  let tursoUrl = process.env.TURSO_DATABASE_URL;
  let tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    tursoUrl = await prompt('Enter your TURSO_DATABASE_URL (e.g. libsql://pharmacy-db-yourname.turso.io): ');
  }
  if (!tursoToken) {
    tursoToken = await prompt('Enter your TURSO_AUTH_TOKEN: ');
  }

  if (!tursoUrl || !tursoToken) {
    console.error('❌ Both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
    process.exit(1);
  }

  const localPath = path.resolve(process.cwd(), 'data/pharmacy.db');
  if (!fs.existsSync(localPath)) {
    console.error(`❌ Local database not found at: ${localPath}`);
    process.exit(1);
  }

  console.log('\n📡 Connecting to local SQLite database...');
  const localClient = createClient({ url: `file:${localPath}` });

  console.log('☁️ Connecting to Turso Cloud database...');
  const tursoClient = createClient({ url: tursoUrl, authToken: tursoToken });

  // Step 1: Initialize schema on Turso
  console.log('\n⚙️ 1. Initializing schema on Turso...');
  await tursoClient.executeMultiple(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      generic_name TEXT,
      manufacturer TEXT,
      strength TEXT,
      dosage_form TEXT,
      unit_type TEXT NOT NULL DEFAULT 'strip',
      group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
      source_url TEXT,
      mrp REAL,
      current_stock INTEGER NOT NULL DEFAULT 0,
      avg_cost_price REAL NOT NULL DEFAULT 0,
      last_selling_price REAL,
      low_stock_threshold INTEGER DEFAULT 10,
      expiry_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(name, strength, manufacturer)
    );

    CREATE TABLE IF NOT EXISTS stock_ins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      quantity INTEGER NOT NULL,
      cost_price REAL NOT NULL,
      batch_no TEXT,
      expiry_date TEXT,
      supplier TEXT,
      date TEXT DEFAULT (date('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL UNIQUE,
      date TEXT DEFAULT (date('now')),
      subtotal REAL NOT NULL DEFAULT 0,
      discount_percent REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      quantity INTEGER NOT NULL,
      selling_price REAL NOT NULL,
      cost_price_snapshot REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medicine_search_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL UNIQUE,
      results_json TEXT NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
    CREATE INDEX IF NOT EXISTS idx_medicines_group ON medicines(group_id);
    CREATE INDEX IF NOT EXISTS idx_medicines_expiry ON medicines(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_stock_ins_medicine ON stock_ins(medicine_id);
  `);
  console.log('   ✓ Schema ready on Turso.');

  // Step 2: Sync Groups
  console.log('\n📦 2. Syncing Groups...');
  const localGroups = (await localClient.execute('SELECT * FROM groups')).rows;
  for (const g of localGroups) {
    await tursoClient.execute({
      sql: 'INSERT OR IGNORE INTO groups (id, name, created_at) VALUES (?, ?, ?)',
      args: [g.id, g.name, g.created_at],
    });
  }
  console.log(`   ✓ Synced ${localGroups.length} groups.`);

  // Step 3: Sync Medicines
  console.log('\n💊 3. Syncing Medicines...');
  const localMeds = (await localClient.execute('SELECT * FROM medicines')).rows;
  for (const m of localMeds) {
    await tursoClient.execute({
      sql: `
        INSERT OR REPLACE INTO medicines (
          id, name, generic_name, manufacturer, strength, dosage_form, unit_type,
          group_id, source_url, mrp, current_stock, avg_cost_price, last_selling_price,
          low_stock_threshold, expiry_date, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `,
      args: [
        m.id, m.name, m.generic_name, m.manufacturer, m.strength, m.dosage_form,
        m.unit_type, m.group_id, m.source_url, m.mrp, m.current_stock, m.avg_cost_price,
        m.last_selling_price, m.low_stock_threshold, m.expiry_date, m.created_at
      ],
    });
  }
  console.log(`   ✓ Synced ${localMeds.length} medicines.`);

  // Step 4: Sync Stock-Ins
  console.log('\n📥 4. Syncing Stock History...');
  const localStocks = (await localClient.execute('SELECT * FROM stock_ins')).rows;
  for (const s of localStocks) {
    await tursoClient.execute({
      sql: `
        INSERT OR REPLACE INTO stock_ins (
          id, medicine_id, quantity, cost_price, batch_no, expiry_date, supplier, date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [s.id, s.medicine_id, s.quantity, s.cost_price, s.batch_no, s.expiry_date, s.supplier, s.date, s.created_at],
    });
  }
  console.log(`   ✓ Synced ${localStocks.length} stock-in records.`);

  // Step 5: Verification
  console.log('\n🔍 5. Verifying Turso Cloud Database...');
  const countMeds = (await tursoClient.execute('SELECT COUNT(*) as c FROM medicines')).rows[0].c;
  const countGroups = (await tursoClient.execute('SELECT COUNT(*) as c FROM groups')).rows[0].c;
  const countStocks = (await tursoClient.execute('SELECT COUNT(*) as c FROM stock_ins')).rows[0].c;

  console.log('\n======================================================');
  console.log('🎉 Turso Database Upload Complete!');
  console.log(`   • Groups on Turso:    ${countGroups}`);
  console.log(`   • Medicines on Turso: ${countMeds}`);
  console.log(`   • Stock-Ins on Turso: ${countStocks}`);
  console.log('======================================================\n');
  console.log('You are now ready to deploy to Vercel!');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
