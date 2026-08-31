import { getDb } from '@/lib/db';
import { ok, err, generateInvoiceNo } from '@/lib/utils';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  const db = getDb();
  let sql = `SELECT * FROM invoices WHERE 1=1`;
  const args = [];
  if (from) { sql += ` AND date >= ?`; args.push(from); }
  if (to) { sql += ` AND date <= ?`; args.push(to); }
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  args.push(limit, offset);

  const invoices = db.prepare(sql).all(...args);
  const total = db.prepare(`SELECT COUNT(*) as c FROM invoices WHERE 1=1${from ? ' AND date >= ?' : ''}${to ? ' AND date <= ?' : ''}`).get(...args.slice(0, -2)).c;

  return ok({ invoices, total, page, limit });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { items, payment_method, notes, date } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return err('At least one item is required');
    }
    if (!payment_method) return err('Payment method is required');

    const db = getDb();

    // Validate all items
    for (const item of items) {
      if (!item.medicine_id || !item.quantity || !item.selling_price) {
        return err('Each item requires medicine_id, quantity, and selling_price');
      }
      const med = db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(item.medicine_id);
      if (!med) return err(`Medicine ID ${item.medicine_id} not found`);
      if (med.current_stock < item.quantity) {
        return err(`Insufficient stock for "${med.name}" — available: ${med.current_stock}, requested: ${item.quantity}`);
      }
    }

    const invoice_no = generateInvoiceNo(db);
    const total_amount = items.reduce((s, i) => s + (i.quantity * i.selling_price), 0);
    const invoiceDate = date || new Date().toISOString().slice(0, 10);

    const createInvoice = db.transaction(() => {
      const inv = db.prepare(`
        INSERT INTO invoices (invoice_no, date, total_amount, payment_method, notes)
        VALUES (@invoice_no, @date, @total_amount, @payment_method, @notes)
      `).run({ invoice_no, date: invoiceDate, total_amount, payment_method, notes: notes || null });

      const invoice_id = inv.lastInsertRowid;

      for (const item of items) {
        const med = db.prepare(`SELECT avg_cost_price FROM medicines WHERE id = ?`).get(item.medicine_id);
        db.prepare(`
          INSERT INTO invoice_items (invoice_id, medicine_id, quantity, selling_price, cost_price_snapshot)
          VALUES (@invoice_id, @medicine_id, @quantity, @selling_price, @cost_price_snapshot)
        `).run({
          invoice_id,
          medicine_id: item.medicine_id,
          quantity: item.quantity,
          selling_price: item.selling_price,
          cost_price_snapshot: med.avg_cost_price,
        });

        // Deduct stock
        db.prepare(`UPDATE medicines SET current_stock = current_stock - ?, last_selling_price = ? WHERE id = ?`)
          .run(item.quantity, item.selling_price, item.medicine_id);
      }

      return invoice_id;
    });

    const invoice_id = createInvoice();
    const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(invoice_id);
    const invoiceItems = db.prepare(`
      SELECT ii.*, m.name as medicine_name, m.strength, m.dosage_form, m.unit_type
      FROM invoice_items ii
      JOIN medicines m ON m.id = ii.medicine_id
      WHERE ii.invoice_id = ?
    `).all(invoice_id);

    return ok({ invoice, items: invoiceItems }, 201);
  } catch (e) {
    return err(e.message, 500);
  }
}
