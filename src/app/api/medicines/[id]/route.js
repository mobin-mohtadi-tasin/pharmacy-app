import { getDb } from '@/lib/db';
import { ok, err } from '@/lib/utils';

export async function GET(req, { params }) {
  const { id } = await params;
  const db = getDb();
  const med = db.prepare(`
    SELECT m.*, g.name as group_name FROM medicines m LEFT JOIN groups g ON g.id = m.group_id WHERE m.id = ?
  `).get(id);
  if (!med) return err('Medicine not found', 404);
  return ok(med);
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, generic_name, manufacturer, strength, dosage_form, unit_type, group_id, source_url, mrp, last_selling_price, low_stock_threshold } = body;
    if (!name?.trim()) return err('Medicine name is required');
    const db = getDb();
    db.prepare(`
      UPDATE medicines SET
        name=@name, generic_name=@generic_name, manufacturer=@manufacturer,
        strength=@strength, dosage_form=@dosage_form, unit_type=@unit_type,
        group_id=@group_id, source_url=@source_url, mrp=@mrp,
        last_selling_price=@last_selling_price, low_stock_threshold=@low_stock_threshold
      WHERE id=@id
    `).run({
      id, name: name.trim(), generic_name: generic_name || null,
      manufacturer: manufacturer || null, strength: strength || null,
      dosage_form: dosage_form || null, unit_type: unit_type || 'strip',
      group_id: group_id || null, source_url: source_url || null,
      mrp: mrp || null, last_selling_price: last_selling_price || null,
      low_stock_threshold: low_stock_threshold || 10,
    });
    const med = db.prepare(`SELECT m.*, g.name as group_name FROM medicines m LEFT JOIN groups g ON g.id = m.group_id WHERE m.id = ?`).get(id);
    return ok(med);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const db = getDb();
  const used = db.prepare(`SELECT COUNT(*) as c FROM invoice_items WHERE medicine_id = ?`).get(id);
  if (used.c > 0) return err('Cannot delete — medicine has sales history', 409);
  const result = db.prepare(`DELETE FROM medicines WHERE id = ?`).run(id);
  if (result.changes === 0) return err('Medicine not found', 404);
  return ok({ deleted: true });
}
