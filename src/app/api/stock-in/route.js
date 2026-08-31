import { getDb } from '@/lib/db';
import { ok, err, computeNewAvgCost, isPriceChangeSignificant } from '@/lib/utils';

export async function POST(req) {
  try {
    const body = await req.json();
    const { medicine_id, quantity, cost_price, batch_no, expiry_date, supplier, date } = body;

    if (!medicine_id) return err('medicine_id is required');
    if (!quantity || quantity <= 0) return err('quantity must be positive');
    if (!cost_price || cost_price <= 0) return err('cost_price must be positive');

    const db = getDb();
    const medicine = db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(medicine_id);
    if (!medicine) return err('Medicine not found', 404);

    // Compute new weighted average cost
    const newAvg = computeNewAvgCost(
      medicine.current_stock,
      medicine.avg_cost_price,
      quantity,
      cost_price
    );
    const priceChangeWarning = medicine.current_stock > 0 && isPriceChangeSignificant(medicine.avg_cost_price, cost_price);

    // Transaction: insert stock-in + update medicine
    const doStockIn = db.transaction(() => {
      db.prepare(`
        INSERT INTO stock_ins (medicine_id, quantity, cost_price, batch_no, expiry_date, supplier, date)
        VALUES (@medicine_id, @quantity, @cost_price, @batch_no, @expiry_date, @supplier, @date)
      `).run({
        medicine_id,
        quantity,
        cost_price,
        batch_no: batch_no || null,
        expiry_date: expiry_date || null,
        supplier: supplier || null,
        date: date || new Date().toISOString().slice(0, 10),
      });

      db.prepare(`
        UPDATE medicines
        SET current_stock = current_stock + @qty, avg_cost_price = @avg
        WHERE id = @id
      `).run({ qty: quantity, avg: newAvg, id: medicine_id });
    });

    doStockIn();

    const updated = db.prepare(`SELECT m.*, g.name as group_name FROM medicines m LEFT JOIN groups g ON g.id = m.group_id WHERE m.id = ?`).get(medicine_id);

    return ok({
      medicine: updated,
      new_avg_cost: newAvg,
      price_change_warning: priceChangeWarning,
      old_avg_cost: medicine.avg_cost_price,
    }, 201);
  } catch (e) {
    return err(e.message, 500);
  }
}
