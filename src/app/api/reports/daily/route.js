import { getDb } from '@/lib/db';
import { ok } from '@/lib/utils';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') || new Date().toISOString().slice(0, 10);
  const to = searchParams.get('to') || from;

  const db = getDb();

  // Sales detail
  const items = db.prepare(`
    SELECT
      ii.id, i.invoice_no, i.date, i.payment_method,
      m.name as medicine_name, g.name as group_name,
      ii.quantity, ii.selling_price, ii.cost_price_snapshot,
      (ii.quantity * ii.selling_price) as revenue,
      (ii.quantity * ii.cost_price_snapshot) as cost,
      ((ii.quantity * ii.selling_price) - (ii.quantity * ii.cost_price_snapshot)) as profit
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    JOIN medicines m ON m.id = ii.medicine_id
    LEFT JOIN groups g ON g.id = m.group_id
    WHERE i.date >= ? AND i.date <= ?
    ORDER BY i.created_at DESC
  `).all(from, to);

  // Payment summary
  const paymentSummary = db.prepare(`
    SELECT payment_method, COUNT(*) as invoice_count, SUM(total_amount) as total
    FROM invoices
    WHERE date >= ? AND date <= ?
    GROUP BY payment_method
    ORDER BY total DESC
  `).all(from, to);

  // Profit summary
  const summary = db.prepare(`
    SELECT
      SUM(ii.quantity * ii.selling_price) as total_revenue,
      SUM(ii.quantity * ii.cost_price_snapshot) as total_cost,
      SUM((ii.quantity * ii.selling_price) - (ii.quantity * ii.cost_price_snapshot)) as total_profit,
      COUNT(DISTINCT i.id) as invoice_count,
      SUM(ii.quantity) as total_units_sold
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.date >= ? AND i.date <= ?
  `).get(from, to);

  const margin = summary.total_revenue > 0
    ? (summary.total_profit / summary.total_revenue * 100).toFixed(2)
    : 0;

  // Stock snapshot
  const stock = db.prepare(`
    SELECT m.name, m.strength, m.dosage_form, m.unit_type, g.name as group_name,
           m.current_stock, m.avg_cost_price, m.low_stock_threshold
    FROM medicines m
    LEFT JOIN groups g ON g.id = m.group_id
    ORDER BY m.name
  `).all();

  return ok({
    from, to,
    items,
    payment_summary: paymentSummary,
    summary: { ...summary, margin_percent: parseFloat(margin) },
    stock_snapshot: stock,
  });
}
