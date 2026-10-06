import { getDb } from '../src/lib/db/index.js';
import { MedexAdapter, mapToGroupId } from '../src/lib/medicine-source/medex-adapter.js';

const db = getDb();
const adapter = new MedexAdapter('https://medex.com.bd');

const CATALOG = [
  // Painkiller / Antipyretic
  { url: 'https://medex.com.bd/brands/10452/napa-500-mg-tablet', defaultStock: 200, supplier: 'Beximco Central Depot' },
  { url: 'https://medex.com.bd/brands/10592/napa-extra-500-mg-tablet', defaultStock: 150, supplier: 'Beximco Central Depot' },
  { url: 'https://medex.com.bd/brands/28573/ace-power-1000-mg-tablet', defaultStock: 120, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/15394/torax-10-mg-tablet', defaultStock: 80, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/26645/rolac-60-mg-imiv-injection', defaultStock: 30, supplier: 'Renata Distribution' },
  { url: 'https://medex.com.bd/brands/10461/napa-10-mg-injection', defaultStock: 25, supplier: 'Beximco Central Depot' },

  // Antacid / GI
  { url: 'https://medex.com.bd/brands/2103/sergel-20-mg-ec-capsule', defaultStock: 130, supplier: 'Healthcare Pharma Depot' },
  { url: 'https://medex.com.bd/brands/2076/maxpro-20-mg-ec-tablet', defaultStock: 110, supplier: 'Renata Distribution' },
  { url: 'https://medex.com.bd/brands/2199/pantonix-20-mg-ec-tablet', defaultStock: 95, supplier: 'Incepta Distribution' },
  { url: 'https://medex.com.bd/brands/1958/seclo-20-mg-ec-capsule', defaultStock: 100, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/2257/finix-20-mg-ec-tablet', defaultStock: 85, supplier: 'Opsonin Distribution' },

  // Antibiotics
  { url: 'https://medex.com.bd/brands/9192/ciprocin-500-mg-tablet', defaultStock: 75, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/8604/azithro-500-mg-tablet', defaultStock: 60, supplier: 'Astra Biopharm Depot' },
  { url: 'https://medex.com.bd/brands/916/moxaclav-875-mg-tablet', defaultStock: 45, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/7955/ceftron-250-mg-im-injection', defaultStock: 20, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/7491/cef-3-200-mg-capsule', defaultStock: 50, supplier: 'Square Pharma Distribution' },

  // Vitamins & Supplements
  { url: 'https://medex.com.bd/brands/26177/ceevit-ds-500-mg-chewable-tablet', defaultStock: 180, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/14682/bicozin-tablet', defaultStock: 90, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/14438/coralcal-d-500-mg-tablet', defaultStock: 120, supplier: 'Radiant Pharmaceuticals' },

  // Antihistamine
  { url: 'https://medex.com.bd/brands/11819/histacin-4-mg-tablet', defaultStock: 160, supplier: 'Jayson Pharma Depot' },
  { url: 'https://medex.com.bd/brands/11914/alatrol-10-mg-tablet', defaultStock: 140, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/12094/fexo-60-mg-tablet', defaultStock: 85, supplier: 'Square Pharma Distribution' },

  // Respiratory
  { url: 'https://medex.com.bd/brands/4014/dexpoten-10-mg-syrup', defaultStock: 35, supplier: 'Eskayef Distribution' },
  { url: 'https://medex.com.bd/brands/3800/monas-4-mg-chewable-tablet', defaultStock: 65, supplier: 'Acme Distribution' },
  { url: 'https://medex.com.bd/brands/3823/montene-4-mg-dispersible-tablet', defaultStock: 55, supplier: 'Square Pharma Distribution' },

  // Cardiovascular
  { url: 'https://medex.com.bd/brands/32576/atova-ez-20-mg-tablet', defaultStock: 50, supplier: 'Beximco Central Depot' },
  { url: 'https://medex.com.bd/brands/2697/angilock-25-mg-tablet', defaultStock: 75, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/38918/rosuva-ez-10-mg-tablet', defaultStock: 60, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/3077/bizoran-5-mg-tablet', defaultStock: 70, supplier: 'Square Pharma Distribution' },

  // Insulin & Diabetes
  { url: 'https://medex.com.bd/brands/5359/comet-500-mg-tablet', defaultStock: 130, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/29028/emjard-10-mg-tablet', defaultStock: 65, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/16821/mixtard-30-30-70-sc-injection', defaultStock: 25, supplier: 'Novo Nordisk Depot' },

  // Antifungal
  { url: 'https://medex.com.bd/brands/9875/flugal-150-mg-capsule', defaultStock: 40, supplier: 'Square Pharma Distribution' },

  // Dermatology
  { url: 'https://medex.com.bd/brands/12571/dermasol-005-cream', defaultStock: 35, supplier: 'Square Pharma Distribution' },
  { url: 'https://medex.com.bd/brands/31704/betnova-01-cream', defaultStock: 40, supplier: 'GlaxoSmithKline Depot' },
];

/**
 * Generate a date in YYYY-MM-DD format offset by a given number of days from today.
 */
function getDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Generate random expiry date between 2 to 6 months (approx 60 to 180 days),
 * with balanced intervals to test critical, warning, and safe statuses.
 */
function generateExpiryDate(index) {
  // We want a clear distribution between 2 and 6 months:
  // - 2.0 to 2.3 months (~60-70 days)  -> Warning: Expires in ~2 mos (< 3 months)
  // - 2.5 to 2.8 months (~75-85 days)  -> Warning: Expires in ~2-3 mos (< 3 months)
  // - 1 month (~28 days)              -> Critical: Expires in < 30 days
  // - 3.5 to 4.0 months (~105-120 days)-> Safe
  // - 4.5 to 5.0 months (~135-150 days)-> Safe
  // - 5.5 to 6.0 months (~165-180 days)-> Safe

  // Spread predictably based on index + small jitter
  const buckets = [
    62,  // ~2.0 mos (warning)
    72,  // ~2.4 mos (warning)
    84,  // ~2.8 mos (warning)
    28,  // ~0.9 mos (critical test)
    105, // ~3.5 mos (safe)
    125, // ~4.1 mos (safe)
    145, // ~4.8 mos (safe)
    165, // ~5.5 mos (safe)
    180, // ~6.0 mos (safe)
  ];

  const baseDays = buckets[index % buckets.length];
  // Add 1-4 days jitter
  const jitter = (index * 3) % 5;
  return getDateOffset(baseDays + jitter);
}

async function inhouseAll() {
  console.log(`🚀 Starting In-Housing of ${CATALOG.length} Medicines from MedEx...\n`);

  const groups = db.prepare(`SELECT id, name FROM groups ORDER BY name ASC`).all();

  // Prepared statements
  const findExisting = db.prepare(`SELECT * FROM medicines WHERE source_url = ? OR (name = ? AND strength = ?)`);
  const insertMed = db.prepare(`
    INSERT INTO medicines (
      name, generic_name, manufacturer, strength, dosage_form, unit_type,
      group_id, source_url, mrp, current_stock, avg_cost_price, last_selling_price,
      low_stock_threshold, expiry_date
    ) VALUES (
      @name, @generic_name, @manufacturer, @strength, @dosage_form, @unit_type,
      @group_id, @source_url, @mrp, @current_stock, @avg_cost_price, @last_selling_price,
      @low_stock_threshold, @expiry_date
    )
  `);

  const updateMed = db.prepare(`
    UPDATE medicines SET
      name = @name,
      generic_name = @generic_name,
      manufacturer = @manufacturer,
      strength = @strength,
      dosage_form = @dosage_form,
      unit_type = @unit_type,
      group_id = @group_id,
      source_url = @source_url,
      mrp = @mrp,
      current_stock = @current_stock,
      avg_cost_price = @avg_cost_price,
      last_selling_price = @last_selling_price,
      low_stock_threshold = @low_stock_threshold,
      expiry_date = @expiry_date
    WHERE id = @id
  `);

  const insertStockIn = db.prepare(`
    INSERT INTO stock_ins (
      medicine_id, quantity, cost_price, batch_no, expiry_date, supplier, date
    ) VALUES (
      @medicine_id, @quantity, @cost_price, @batch_no, @expiry_date, @supplier, @date
    )
  `);

  const todayStr = new Date().toISOString().slice(0, 10);
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < CATALOG.length; i++) {
    const item = CATALOG[i];
    console.log(`[${i + 1}/${CATALOG.length}] Fetching MedEx: ${item.url}`);

    try {
      const details = await adapter.fetchBrandDetails(item.url);
      if (details.error) {
        console.error(`  ❌ Fetch error for ${item.url}: ${details.error}`);
        failCount++;
        continue;
      }

      // Group matching
      const matchedGroupId = mapToGroupId(
        details.therapeutic_class,
        details.generic_name,
        details.name,
        groups
      );

      // Expiry date between 2 to 6 months
      const expiryDate = generateExpiryDate(i);
      const batchNo = `BX-${new Date().getFullYear()}-${100 + i}`;
      const costPrice = details.cost_price || (details.mrp ? +(details.mrp * 0.88).toFixed(2) : 5);
      const sellingPrice = details.selling_price || details.mrp || 10;
      const initialStock = item.defaultStock || 100;

      // Check if medicine already exists
      const existing = findExisting.get(item.url, details.name, details.strength);
      let medId;

      const medData = {
        name: details.name,
        generic_name: details.generic_name,
        manufacturer: details.manufacturer,
        strength: details.strength,
        dosage_form: details.dosage_form,
        unit_type: details.unit_type || 'strip',
        group_id: matchedGroupId,
        source_url: item.url,
        mrp: details.mrp,
        current_stock: initialStock,
        avg_cost_price: costPrice,
        last_selling_price: sellingPrice,
        low_stock_threshold: 15,
        expiry_date: expiryDate,
      };

      if (existing) {
        medId = existing.id;
        updateMed.run({ ...medData, id: medId });
        console.log(`  ↻ Updated existing Med ID #${medId}: ${details.name} (${details.strength})`);
      } else {
        const info = insertMed.run(medData);
        medId = info.lastInsertRowid;
        console.log(`  + Created new Med ID #${medId}: ${details.name} (${details.strength})`);
      }

      // Record a Stock-In record so stock history and audit logs reflect the inhouse batch
      insertStockIn.run({
        medicine_id: medId,
        quantity: initialStock,
        cost_price: costPrice,
        batch_no: batchNo,
        expiry_date: expiryDate,
        supplier: item.supplier,
        date: todayStr,
      });

      console.log(`    📦 In-Housed Stock: ${initialStock} units | Cost: ৳${costPrice} | MRP: ৳${details.mrp} | Batch: ${batchNo} | Expiry: ${expiryDate}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Exception processing ${item.url}:`, err.message);
      failCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`🎉 In-Housing Completed!`);
  console.log(`   Success: ${successCount} medicines`);
  console.log(`   Failed:  ${failCount} medicines`);
  console.log(`========================================\n`);
}

inhouseAll().catch(console.error);
