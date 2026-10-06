import { getDb } from '@/lib/db';
import { ok } from '@/lib/utils';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const medicine_id = searchParams.get('medicine_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const db = getDb();
  let sql = `
    SELECT s.*, m.name as medicine_name, m.strength, m.dosage_form
    FROM stock_ins s
    JOIN medicines m ON m.id = s.medicine_id
    WHERE 1=1
  `;
  const args = [];

  if (medicine_id) { sql += ` AND s.medicine_id = ?`; args.push(medicine_id); }
  if (from) { sql += ` AND s.date >= ?`; args.push(from); }
  if (to) { sql += ` AND s.date <= ?`; args.push(to); }

  sql += ` ORDER BY s.created_at DESC LIMIT 200`;

  const rows = await db.prepare(sql).all(...args);
  return ok(rows);
}
