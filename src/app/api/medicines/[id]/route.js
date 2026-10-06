import { getDb } from '@/lib/db';
import { ok, err } from '@/lib/utils';

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const db = getDb();
    const med = await db.prepare(`
      SELECT m.*, g.name as group_name,
        COALESCE(m.expiry_date, (SELECT MIN(s.expiry_date) FROM stock_ins s WHERE s.medicine_id = m.id AND s.expiry_date IS NOT NULL AND TRIM(s.expiry_date) != '')) as expiry_date
      FROM medicines m
      LEFT JOIN groups g ON g.id = m.group_id
      WHERE m.id = ?
    `).get(id);
    if (!med) return err('Medicine not found', 404);
    return ok(med);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, generic_name, manufacturer, strength, dosage_form, unit_type, group_id, source_url, mrp, last_selling_price, low_stock_threshold, expiry_date } = body;
    if (!name?.trim()) return err('Medicine name is required');
    const finalSellingPrice = last_selling_price != null && last_selling_price !== '' ? Number(last_selling_price) : (body.selling_price != null && body.selling_price !== '' ? Number(body.selling_price) : null);
    const db = getDb();
    await db.prepare(`
      UPDATE medicines SET
        name=@name, generic_name=@generic_name, manufacturer=@manufacturer,
        strength=@strength, dosage_form=@dosage_form, unit_type=@unit_type,
        group_id=@group_id, source_url=@source_url, mrp=@mrp,
        last_selling_price=@last_selling_price, low_stock_threshold=@low_stock_threshold,
        expiry_date=@expiry_date
      WHERE id=@id
    `).run({
      id, name: name.trim(), generic_name: generic_name || null,
      manufacturer: manufacturer || null, strength: strength || null,
      dosage_form: dosage_form || null, unit_type: unit_type || 'strip',
      group_id: group_id || null, source_url: source_url || null,
      mrp: mrp || null, last_selling_price: finalSellingPrice,
      low_stock_threshold: low_stock_threshold || 10,
      expiry_date: expiry_date || null,
    });
    const med = await db.prepare(`
      SELECT m.*, g.name as group_name,
        COALESCE(m.expiry_date, (SELECT MIN(s.expiry_date) FROM stock_ins s WHERE s.medicine_id = m.id AND s.expiry_date IS NOT NULL AND TRIM(s.expiry_date) != '')) as expiry_date
      FROM medicines m
      LEFT JOIN groups g ON g.id = m.group_id
      WHERE m.id = ?
    `).get(id);
    return ok(med);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true';

    const db = getDb();
    const existing = await db.prepare(`SELECT id, name FROM medicines WHERE id = ?`).get(id);
    if (!existing) return err('Medicine not found', 404);

    const used = await db.prepare(`SELECT COUNT(*) as c FROM invoice_items WHERE medicine_id = ?`).get(id);
    if (used && used.c > 0 && !force) {
      return err(`Cannot delete: "${existing.name}" has ${used.c} sales invoice record(s).`, 409);
    }

    // Cascade delete in transaction: remove stock-ins, invoice items (if force), and the medicine
    await db.transaction(async (txDb) => {
      await txDb.prepare(`DELETE FROM stock_ins WHERE medicine_id = ?`).run(id);
      if (force && used && used.c > 0) {
        await txDb.prepare(`DELETE FROM invoice_items WHERE medicine_id = ?`).run(id);
      }
      await txDb.prepare(`DELETE FROM medicines WHERE id = ?`).run(id);
    });

    return ok({ deleted: true, id: Number(id) });
  } catch (e) {
    return err(e.message || 'Failed to delete medicine', 500);
  }
}
