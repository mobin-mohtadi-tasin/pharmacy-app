import { getDb } from '@/lib/db';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') || new Date().toISOString().slice(0, 10);
  const to = searchParams.get('to') || from;

  const db = getDb();

  const items = await db.prepare(`
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
    ORDER BY i.date, i.created_at
  `).all(from, to);

  const paymentSummary = await db.prepare(`
    SELECT payment_method, COUNT(*) as invoice_count, SUM(total_amount) as total
    FROM invoices WHERE date >= ? AND date <= ?
    GROUP BY payment_method ORDER BY total DESC
  `).all(from, to);

  const summary = (await db.prepare(`
    SELECT
      SUM(ii.quantity * ii.selling_price) as total_revenue,
      SUM(ii.quantity * ii.cost_price_snapshot) as total_cost,
      SUM((ii.quantity * ii.selling_price) - (ii.quantity * ii.cost_price_snapshot)) as total_profit,
      COUNT(DISTINCT i.id) as invoice_count
    FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.date >= ? AND i.date <= ?
  `).get(from, to)) || {};

  const stock = await db.prepare(`
    SELECT m.name, m.strength, m.dosage_form, m.unit_type, g.name as group_name,
           m.current_stock, m.avg_cost_price, m.last_selling_price, m.low_stock_threshold
    FROM medicines m LEFT JOIN groups g ON g.id = m.group_id ORDER BY m.name
  `).all();

  // ── Build Excel ──────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Pharmacy Billing System';
  wb.created = new Date();

  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a7f5e' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: { bottom: { style: 'thin', color: { argb: 'FF000000' } } },
  };

  const currencyFmt = '৳#,##0.00';
  const pctFmt = '0.00"%"';

  // Sheet 1: Sales Detail
  const ws1 = wb.addWorksheet('Sales Detail');
  ws1.columns = [
    { header: 'Invoice No', key: 'invoice_no', width: 20 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Medicine', key: 'medicine_name', width: 25 },
    { header: 'Group', key: 'group_name', width: 18 },
    { header: 'Qty', key: 'quantity', width: 8 },
    { header: 'Cost Price', key: 'cost_price_snapshot', width: 14 },
    { header: 'Selling Price', key: 'selling_price', width: 14 },
    { header: 'Revenue', key: 'revenue', width: 14 },
    { header: 'Cost', key: 'cost', width: 14 },
    { header: 'Profit', key: 'profit', width: 14 },
    { header: 'Payment', key: 'payment_method', width: 14 },
  ];
  ws1.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
  ws1.getRow(1).height = 22;

  items.forEach((item, i) => {
    const row = ws1.addRow(item);
    ['cost_price_snapshot','selling_price','revenue','cost','profit'].forEach(k => {
      row.getCell(ws1.columns.findIndex(c => c.key === k) + 1).numFmt = currencyFmt;
    });
    if (i % 2 === 1) row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FBF7' } };
    });
  });

  // Sheet 2: Payment Summary
  const ws2 = wb.addWorksheet('Payment Summary');
  ws2.columns = [
    { header: 'Payment Method', key: 'payment_method', width: 20 },
    { header: 'Invoice Count', key: 'invoice_count', width: 15 },
    { header: 'Total (৳)', key: 'total', width: 16 },
  ];
  ws2.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
  ws2.getRow(1).height = 22;
  paymentSummary.forEach(row => {
    const r = ws2.addRow(row);
    r.getCell(3).numFmt = currencyFmt;
  });
  // Total row
  const totalRow = ws2.addRow({ payment_method: 'TOTAL', invoice_count: paymentSummary.reduce((s, r) => s + r.invoice_count, 0), total: paymentSummary.reduce((s, r) => s + r.total, 0) });
  totalRow.eachCell(cell => { cell.font = { bold: true }; });
  totalRow.getCell(3).numFmt = currencyFmt;

  // Sheet 3: Profit Summary
  const ws3 = wb.addWorksheet('Profit Summary');
  const margin = summary.total_revenue > 0 ? (summary.total_profit / summary.total_revenue * 100) : 0;
  const profitData = [
    ['Report Period', `${from} to ${to}`],
    ['Total Invoices', summary.invoice_count || 0],
    ['Total Revenue', summary.total_revenue || 0],
    ['Total Cost', summary.total_cost || 0],
    ['Total Profit', summary.total_profit || 0],
    ['Profit Margin', margin / 100],
  ];
  ws3.getColumn(1).width = 20;
  ws3.getColumn(2).width = 20;
  profitData.forEach(([label, value], i) => {
    const row = ws3.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    if (i >= 2 && i <= 4) row.getCell(2).numFmt = currencyFmt;
    if (i === 5) row.getCell(2).numFmt = pctFmt;
  });
  ws3.getColumn(1).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }; });

  // Sheet 4: Stock Snapshot
  const ws4 = wb.addWorksheet('Stock Snapshot');
  ws4.columns = [
    { header: 'Medicine', key: 'name', width: 25 },
    { header: 'Strength', key: 'strength', width: 14 },
    { header: 'Form', key: 'dosage_form', width: 12 },
    { header: 'Group', key: 'group_name', width: 18 },
    { header: 'Unit', key: 'unit_type', width: 10 },
    { header: 'Stock', key: 'current_stock', width: 10 },
    { header: 'Avg Cost', key: 'avg_cost_price', width: 12 },
    { header: 'Selling Price', key: 'last_selling_price', width: 14 },
    { header: 'Low Stock?', key: 'low', width: 12 },
  ];
  ws4.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
  ws4.getRow(1).height = 22;
  stock.forEach(med => {
    const isLow = med.current_stock <= med.low_stock_threshold;
    const row = ws4.addRow({ ...med, low: isLow ? 'YES ⚠️' : 'No' });
    row.getCell(7).numFmt = currencyFmt;
    row.getCell(8).numFmt = currencyFmt;
    if (isLow) {
      row.getCell(9).font = { bold: true, color: { argb: 'FFDC2626' } };
      row.getCell(6).font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  });

  // Save to /reports folder
  const reportsDir = path.resolve(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const label = from === to ? from : `${from}_to_${to}`;
  const filename = `report_${label}.xlsx`;
  const filepath = path.join(reportsDir, filename);
  await wb.xlsx.writeFile(filepath);

  // Stream to browser
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
