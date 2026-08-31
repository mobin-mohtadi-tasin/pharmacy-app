// Seed script — run with: node src/lib/db/seed.js
import { getDb } from './index.js';

const db = getDb();

function seed() {
  console.log('🌱 Seeding database...');

  // ── Groups ──────────────────────────────────────────────────────────
  const groupInsert = db.prepare(`
    INSERT OR IGNORE INTO groups (name) VALUES (?)
  `);
  const groups = [
    'Antibiotic',
    'Painkiller / Antipyretic',
    'Antacid / GI',
    'Vitamins & Supplements',
    'Antihistamine',
    'Antifungal',
    'Insulin & Diabetes',
    'Cardiovascular',
    'Respiratory',
    'Dermatology',
  ];
  groups.forEach(g => groupInsert.run(g));
  console.log(`  ✓ Inserted ${groups.length} groups`);

  // ── Medicines ────────────────────────────────────────────────────────
  const medInsert = db.prepare(`
    INSERT OR IGNORE INTO medicines
      (name, generic_name, manufacturer, strength, dosage_form, unit_type, group_id, source_url, mrp, current_stock, avg_cost_price, last_selling_price)
    VALUES
      (@name, @generic_name, @manufacturer, @strength, @dosage_form, @unit_type, @group_id, @source_url, @mrp, @current_stock, @avg_cost_price, @last_selling_price)
  `);

  const g = {};
  const allGroups = db.prepare('SELECT id, name FROM groups').all();
  allGroups.forEach(row => (g[row.name] = row.id));

  const medicines = [
    {
      name: 'Napa', generic_name: 'Paracetamol', manufacturer: 'Beximco Pharmaceuticals Ltd.',
      strength: '500 mg', dosage_form: 'Tablet', unit_type: 'strip',
      group_id: g['Painkiller / Antipyretic'],
      source_url: 'https://medex.com.bd/brands/10452/napa-500-mg-tablet',
      mrp: 1.5, current_stock: 200, avg_cost_price: 1.0, last_selling_price: 1.5,
    },
    {
      name: 'Napa Extra', generic_name: 'Paracetamol + Caffeine', manufacturer: 'Beximco Pharmaceuticals Ltd.',
      strength: '500 mg+65 mg', dosage_form: 'Tablet', unit_type: 'strip',
      group_id: g['Painkiller / Antipyretic'],
      source_url: 'https://medex.com.bd/brands/10592/napa-extra-500-mg-tablet',
      mrp: 2.0, current_stock: 150, avg_cost_price: 1.4, last_selling_price: 2.0,
    },
    {
      name: 'Sergel', generic_name: 'Omeprazole', manufacturer: 'Square Pharmaceuticals Ltd.',
      strength: '20 mg', dosage_form: 'Capsule', unit_type: 'strip',
      group_id: g['Antacid / GI'],
      source_url: 'https://medex.com.bd/brands/sergel',
      mrp: 5.0, current_stock: 100, avg_cost_price: 3.5, last_selling_price: 5.0,
    },
    {
      name: 'Maxpro', generic_name: 'Esomeprazole', manufacturer: 'ACI Limited',
      strength: '20 mg', dosage_form: 'Capsule', unit_type: 'strip',
      group_id: g['Antacid / GI'],
      source_url: 'https://medex.com.bd/brands/maxpro',
      mrp: 8.0, current_stock: 80, avg_cost_price: 5.5, last_selling_price: 8.0,
    },
    {
      name: 'Ciprocin', generic_name: 'Ciprofloxacin', manufacturer: 'Square Pharmaceuticals Ltd.',
      strength: '500 mg', dosage_form: 'Tablet', unit_type: 'strip',
      group_id: g['Antibiotic'],
      source_url: 'https://medex.com.bd/brands/ciprocin',
      mrp: 12.0, current_stock: 60, avg_cost_price: 8.5, last_selling_price: 12.0,
    },
    {
      name: 'Azithro', generic_name: 'Azithromycin', manufacturer: 'Beximco Pharmaceuticals Ltd.',
      strength: '500 mg', dosage_form: 'Tablet', unit_type: 'piece',
      group_id: g['Antibiotic'],
      source_url: 'https://medex.com.bd/brands/azithro',
      mrp: 35.0, current_stock: 40, avg_cost_price: 25.0, last_selling_price: 35.0,
    },
    {
      name: 'Ceevit', generic_name: 'Ascorbic Acid (Vitamin C)', manufacturer: 'Square Pharmaceuticals Ltd.',
      strength: '500 mg', dosage_form: 'Tablet', unit_type: 'strip',
      group_id: g['Vitamins & Supplements'],
      source_url: 'https://medex.com.bd/brands/ceevit',
      mrp: 3.0, current_stock: 5, avg_cost_price: 2.0, last_selling_price: 3.0,
    },
    {
      name: 'Histacin', generic_name: 'Chlorpheniramine Maleate', manufacturer: 'Square Pharmaceuticals Ltd.',
      strength: '4 mg', dosage_form: 'Tablet', unit_type: 'strip',
      group_id: g['Antihistamine'],
      source_url: 'https://medex.com.bd/brands/histacin',
      mrp: 1.5, current_stock: 120, avg_cost_price: 0.8, last_selling_price: 1.5,
    },
    {
      name: 'Sinacof', generic_name: 'Pseudoephedrine + Triprolidine', manufacturer: 'Beximco Pharmaceuticals Ltd.',
      strength: '60 mg+2.5 mg', dosage_form: 'Tablet', unit_type: 'strip',
      group_id: g['Respiratory'],
      source_url: 'https://medex.com.bd/brands/sinacof',
      mrp: 3.5, current_stock: 8, avg_cost_price: 2.2, last_selling_price: 3.5,
    },
    {
      name: 'Mixtard 30', generic_name: 'Insulin (Human, Biphasic)', manufacturer: 'Novo Nordisk',
      strength: '100 IU/ml', dosage_form: 'Injection', unit_type: 'bottle',
      group_id: g['Insulin & Diabetes'],
      source_url: 'https://medex.com.bd/brands/mixtard',
      mrp: 450.0, current_stock: 12, avg_cost_price: 320.0, last_selling_price: 450.0,
    },
    {
      name: 'Metformin', generic_name: 'Metformin HCl', manufacturer: 'ACI Limited',
      strength: '500 mg', dosage_form: 'Tablet', unit_type: 'strip',
      group_id: g['Insulin & Diabetes'],
      source_url: 'https://medex.com.bd/brands/metformin',
      mrp: 4.0, current_stock: 90, avg_cost_price: 2.8, last_selling_price: 4.0,
    },
    {
      name: 'Fluconazole', generic_name: 'Fluconazole', manufacturer: 'Square Pharmaceuticals Ltd.',
      strength: '150 mg', dosage_form: 'Capsule', unit_type: 'piece',
      group_id: g['Antifungal'],
      source_url: 'https://medex.com.bd/brands/fluconazole',
      mrp: 25.0, current_stock: 30, avg_cost_price: 17.0, last_selling_price: 25.0,
    },
  ];

  medicines.forEach(m => medInsert.run(m));
  console.log(`  ✓ Inserted ${medicines.length} medicines`);

  // ── Sample Invoices (today) ──────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const invoiceInsert = db.prepare(`
    INSERT OR IGNORE INTO invoices (invoice_no, date, total_amount, payment_method)
    VALUES (@invoice_no, @date, @total_amount, @payment_method)
  `);
  const itemInsert = db.prepare(`
    INSERT INTO invoice_items (invoice_id, medicine_id, quantity, selling_price, cost_price_snapshot)
    VALUES (@invoice_id, @medicine_id, @quantity, @selling_price, @cost_price_snapshot)
  `);
  const updateStock = db.prepare(`
    UPDATE medicines SET current_stock = current_stock - @qty WHERE id = @id
  `);

  const napaId = db.prepare("SELECT id FROM medicines WHERE name = 'Napa'").get()?.id;
  const cipId = db.prepare("SELECT id FROM medicines WHERE name = 'Ciprocin'").get()?.id;
  const sergelId = db.prepare("SELECT id FROM medicines WHERE name = 'Sergel'").get()?.id;

  if (napaId && cipId && sergelId) {
    const sampleInvoices = [
      {
        invoice_no: `INV-${today.replace(/-/g, '')}-0001`,
        date: today,
        total_amount: 63,
        payment_method: 'Cash',
        items: [
          { medicine_id: napaId, quantity: 2, selling_price: 1.5, cost_price_snapshot: 1.0 },
          { medicine_id: cipId, quantity: 5, selling_price: 12.0, cost_price_snapshot: 8.5 },
        ],
      },
      {
        invoice_no: `INV-${today.replace(/-/g, '')}-0002`,
        date: today,
        total_amount: 13,
        payment_method: 'bKash',
        items: [
          { medicine_id: napaId, quantity: 1, selling_price: 1.5, cost_price_snapshot: 1.0 },
          { medicine_id: sergelId, quantity: 1, selling_price: 5.0, cost_price_snapshot: 3.5 },
          { medicine_id: napaId, quantity: 3, selling_price: 1.5, cost_price_snapshot: 1.0 },
        ],
      },
    ];

    const seedInvoices = db.transaction(() => {
      for (const inv of sampleInvoices) {
        const existing = db.prepare('SELECT id FROM invoices WHERE invoice_no = ?').get(inv.invoice_no);
        if (existing) continue;
        invoiceInsert.run({ invoice_no: inv.invoice_no, date: inv.date, total_amount: inv.total_amount, payment_method: inv.payment_method });
        const invoiceId = db.prepare('SELECT last_insert_rowid() as id').get().id;
        for (const item of inv.items) {
          itemInsert.run({ invoice_id: invoiceId, ...item });
          updateStock.run({ qty: item.quantity, id: item.medicine_id });
        }
      }
    });
    seedInvoices();
    console.log(`  ✓ Inserted ${sampleInvoices.length} sample invoices`);
  }

  console.log('✅ Seed complete!');
}

seed();
