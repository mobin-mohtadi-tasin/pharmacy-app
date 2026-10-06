import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';

let _client = null;
let _schemaInitialized = false;

function normalizeArgs(args) {
  if (!args || args.length === 0) return [];
  if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0]) && args[0] !== null) {
    return args[0];
  }
  return args;
}

export function getClient() {
  if (!_client) {
    const isTurso = !!process.env.TURSO_DATABASE_URL;
    if (isTurso) {
      _client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    } else {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const localFile = path.join(dataDir, 'pharmacy.db');
      _client = createClient({
        url: `file:${localFile}`,
      });
    }
  }
  return _client;
}

export async function ensureSchema() {
  if (_schemaInitialized) return;
  const client = getClient();
  const schemaSql = `
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
    CREATE INDEX IF NOT EXISTS idx_cache_query ON medicine_search_cache(query);
  `;
  try {
    await client.executeMultiple(schemaSql);
    _schemaInitialized = true;
  } catch (err) {
    console.error('Schema initialization error:', err.message);
  }
}

export function getDb() {
  const client = getClient();
  // Ensure schema in background if not done
  ensureSchema().catch(() => {});

  return {
    client,
    prepare: (sql) => ({
      all: async (...args) => {
        await ensureSchema();
        const res = await client.execute({ sql, args: normalizeArgs(args) });
        return res.rows;
      },
      get: async (...args) => {
        await ensureSchema();
        const res = await client.execute({ sql, args: normalizeArgs(args) });
        return res.rows[0] || null;
      },
      run: async (...args) => {
        await ensureSchema();
        const res = await client.execute({ sql, args: normalizeArgs(args) });
        return {
          lastInsertRowid: Number(res.lastInsertRowid),
          changes: res.rowsAffected,
        };
      },
    }),
    transaction: async (callback) => {
      await ensureSchema();
      const tx = await client.transaction('write');
      const txDb = {
        prepare: (sql) => ({
          all: async (...args) => {
            const res = await tx.execute({ sql, args: normalizeArgs(args) });
            return res.rows;
          },
          get: async (...args) => {
            const res = await tx.execute({ sql, args: normalizeArgs(args) });
            return res.rows[0] || null;
          },
          run: async (...args) => {
            const res = await tx.execute({ sql, args: normalizeArgs(args) });
            return {
              lastInsertRowid: Number(res.lastInsertRowid),
              changes: res.rowsAffected,
            };
          },
        }),
      };
      try {
        const result = await callback(txDb);
        await tx.commit();
        return result;
      } catch (err) {
        await tx.rollback();
        throw err;
      }
    },
    exec: async (sql) => {
      return client.executeMultiple(sql);
    },
  };
}

export default getDb;
