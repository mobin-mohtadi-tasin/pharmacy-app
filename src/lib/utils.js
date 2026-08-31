/**
 * Shared utility functions
 */

/** Format a number as BDT currency */
export function formatBDT(amount) {
  if (amount == null) return '৳0.00';
  return '৳' + Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Generate invoice number: INV-YYYYMMDD-NNNN */
export function generateInvoiceNo(db) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `INV-${today}-`;
  const last = db.prepare(
    `SELECT invoice_no FROM invoices WHERE invoice_no LIKE ? ORDER BY invoice_no DESC LIMIT 1`
  ).get(`${prefix}%`);

  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.invoice_no.split('-').pop(), 10);
    seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/** Format a date string to DD/MM/YYYY */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-BD', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Compute new weighted average cost after stock-in */
export function computeNewAvgCost(oldStock, oldAvg, newQty, newCost) {
  const totalQty = oldStock + newQty;
  if (totalQty === 0) return newCost;
  return ((oldStock * oldAvg) + (newQty * newCost)) / totalQty;
}

/** Check if the new cost price differs significantly (>10%) from existing avg */
export function isPriceChangeSignificant(oldAvg, newCost) {
  if (!oldAvg || oldAvg === 0) return false;
  return Math.abs((newCost - oldAvg) / oldAvg) > 0.1;
}

/** Get today's date in YYYY-MM-DD */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** API response helpers */
export function ok(data, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function err(message, status = 400) {
  return Response.json({ success: false, error: message }, { status });
}
