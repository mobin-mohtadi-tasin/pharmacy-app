import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || './data/pharmacy.db';
const resolvedPath = path.resolve(process.cwd(), DB_PATH);

// Ensure the data directory exists
const dir = path.dirname(resolvedPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Singleton instance
let _db = null;

export function getDb() {
  if (!_db) {
    _db = new Database(resolvedPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db) {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_stock_ins_medicine ON stock_ins(medicine_id);
    CREATE INDEX IF NOT EXISTS idx_cache_query ON medicine_search_cache(query);
  `);

  // Safe migrations for discount columns
  try { db.exec(`ALTER TABLE invoices ADD COLUMN subtotal REAL NOT NULL DEFAULT 0;`); } catch {}
  try { db.exec(`ALTER TABLE invoices ADD COLUMN discount_percent REAL NOT NULL DEFAULT 0;`); } catch {}
  try { db.exec(`ALTER TABLE invoices ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0;`); } catch {}
  try { db.exec(`UPDATE invoices SET subtotal = total_amount WHERE subtotal = 0 AND total_amount > 0;`); } catch {}
}

export default getDb;
