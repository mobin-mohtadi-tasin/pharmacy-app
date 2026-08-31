import { getDb } from '@/lib/db';
import { ok, err } from '@/lib/utils';

export async function GET(req, { params }) {
  const { id } = await params;
  const db = getDb();
  const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(id);
  if (!invoice) return err('Invoice not found', 404);
  const items = db.prepare(`
    SELECT ii.*, m.name as medicine_name, m.strength, m.dosage_form, m.unit_type, m.generic_name, g.name as group_name
    FROM invoice_items ii
    JOIN medicines m ON m.id = ii.medicine_id
    LEFT JOIN groups g ON g.id = m.group_id
    WHERE ii.invoice_id = ?
  `).all(id);
  return ok({ invoice, items });
}
