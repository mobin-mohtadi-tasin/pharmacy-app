import { getDb } from '@/lib/db';
import { ok, err } from '@/lib/utils';

export async function GET(req) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const group_id = searchParams.get('group_id') || '';
  const low_stock = searchParams.get('low_stock') === 'true';

  let sql = `
    SELECT m.*, g.name as group_name
    FROM medicines m
    LEFT JOIN groups g ON g.id = m.group_id
    WHERE 1=1
  `;
  const args = [];

  if (search) {
    sql += ` AND (m.name LIKE ? OR m.generic_name LIKE ? OR m.manufacturer LIKE ?)`;
    const like = `%${search}%`;
    args.push(like, like, like);
  }
  if (group_id) {
    sql += ` AND m.group_id = ?`;
    args.push(group_id);
  }
  if (low_stock) {
    sql += ` AND m.current_stock <= m.low_stock_threshold`;
  }

  sql += ` ORDER BY m.name`;
  const medicines = db.prepare(sql).all(...args);
  return ok(medicines);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, generic_name, manufacturer, strength, dosage_form, unit_type, group_id, source_url, mrp, avg_cost_price, last_selling_price, low_stock_threshold } = body;
    if (!name?.trim()) return err('Medicine name is required');

    const db = getDb();

    // Check for duplicate
    const existing = db.prepare(`
      SELECT id FROM medicines WHERE name = ? AND strength IS ? AND manufacturer IS ?
    `).get(name.trim(), strength || null, manufacturer || null);
    if (existing) return err('A medicine with this name, strength, and manufacturer already exists', 409);

    const finalSellingPrice = last_selling_price != null && last_selling_price !== '' ? Number(last_selling_price) : (body.selling_price != null && body.selling_price !== '' ? Number(body.selling_price) : null);

    const result = db.prepare(`
      INSERT INTO medicines (name, generic_name, manufacturer, strength, dosage_form, unit_type, group_id, source_url, mrp, avg_cost_price, last_selling_price, low_stock_threshold)
      VALUES (@name, @generic_name, @manufacturer, @strength, @dosage_form, @unit_type, @group_id, @source_url, @mrp, @avg_cost_price, @last_selling_price, @low_stock_threshold)
    `).run({
      name: name.trim(), generic_name: generic_name || null, manufacturer: manufacturer || null,
      strength: strength || null, dosage_form: dosage_form || null,
      unit_type: unit_type || 'strip', group_id: group_id || null,
      source_url: source_url || null, mrp: mrp || null,
      avg_cost_price: avg_cost_price || 0, last_selling_price: finalSellingPrice,
      low_stock_threshold: low_stock_threshold || 10,
    });

    const med = db.prepare(`SELECT m.*, g.name as group_name FROM medicines m LEFT JOIN groups g ON g.id = m.group_id WHERE m.id = ?`).get(result.lastInsertRowid);
    return ok(med, 201);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return err('Medicine already exists', 409);
    return err(e.message, 500);
  }
}
