import { getDb } from '@/lib/db';
import { ok } from '@/lib/utils';

export async function GET() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  // Today's stats
  const todayStats = db.prepare(`
    SELECT
      COALESCE(SUM(ii.quantity * ii.selling_price), 0) as total_revenue,
      COALESCE(SUM(ii.quantity * ii.cost_price_snapshot), 0) as total_cost,
      COALESCE(SUM((ii.quantity * ii.selling_price) - (ii.quantity * ii.cost_price_snapshot)), 0) as total_profit,
      COUNT(DISTINCT i.id) as invoice_count
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.date = ?
  `).get(today);

  const margin = todayStats.total_revenue > 0
    ? (todayStats.total_profit / todayStats.total_revenue * 100).toFixed(1)
    : 0;

  // Low stock alerts
  const lowStockAlerts = db.prepare(`
    SELECT m.id, m.name, m.strength, m.dosage_form, m.current_stock, m.low_stock_threshold, g.name as group_name
    FROM medicines m
    LEFT JOIN groups g ON g.id = m.group_id
    WHERE m.current_stock <= m.low_stock_threshold
    ORDER BY m.current_stock ASC
    LIMIT 20
  `).all();

  // Expiring soon alerts (within 3 months)
  const expiringAlerts = db.prepare(`
    SELECT
      m.id, m.name, m.strength, m.dosage_form, m.current_stock,
      COALESCE(m.expiry_date, (SELECT MIN(s.expiry_date) FROM stock_ins s WHERE s.medicine_id = m.id AND s.expiry_date IS NOT NULL AND TRIM(s.expiry_date) != '')) as expiry_date,
      g.name as group_name
    FROM medicines m
    LEFT JOIN groups g ON g.id = m.group_id
    WHERE COALESCE(m.expiry_date, (SELECT MIN(s.expiry_date) FROM stock_ins s WHERE s.medicine_id = m.id AND s.expiry_date IS NOT NULL AND TRIM(s.expiry_date) != '')) IS NOT NULL
      AND TRIM(COALESCE(m.expiry_date, (SELECT MIN(s.expiry_date) FROM stock_ins s WHERE s.medicine_id = m.id AND s.expiry_date IS NOT NULL AND TRIM(s.expiry_date) != ''))) != ''
      AND COALESCE(m.expiry_date, (SELECT MIN(s.expiry_date) FROM stock_ins s WHERE s.medicine_id = m.id AND s.expiry_date IS NOT NULL AND TRIM(s.expiry_date) != '')) <= date('now', '+3 months')
      AND m.current_stock > 0
    ORDER BY expiry_date ASC
    LIMIT 20
  `).all();

  // Last 7 days sales chart data
  const sevenDayData = db.prepare(`
    SELECT i.date, COALESCE(SUM(i.total_amount), 0) as revenue
    FROM invoices i
    WHERE i.date >= date(?, '-6 days')
    GROUP BY i.date
    ORDER BY i.date
  `).all(today);

  // Today's recent invoices
  const recentInvoices = db.prepare(`
    SELECT * FROM invoices WHERE date = ? ORDER BY created_at DESC LIMIT 5
  `).all(today);

  return ok({
    today,
    stats: { ...todayStats, margin_percent: parseFloat(margin) },
    low_stock_alerts: lowStockAlerts,
    expiring_alerts: expiringAlerts,
    seven_day_sales: sevenDayData,
    recent_invoices: recentInvoices,
  });
}
