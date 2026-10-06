import { getDb } from '../src/lib/db/index.js';
import { MedexAdapter, mapToGroupId } from '../src/lib/medicine-source/medex-adapter.js';

const db = getDb();
const adapter = new MedexAdapter('https://medex.com.bd');

const MED_URL_MAP = {
  1: 'https://medex.com.bd/brands/10452/napa-500-mg-tablet',
  2: 'https://medex.com.bd/brands/10592/napa-extra-500-mg-tablet',
  3: 'https://medex.com.bd/brands/2103/sergel-20-mg-ec-capsule',
  4: 'https://medex.com.bd/brands/2076/maxpro-20-mg-ec-tablet',
  5: 'https://medex.com.bd/brands/9192/ciprocin-500-mg-tablet',
  6: 'https://medex.com.bd/brands/8604/azithro-500-mg-tablet',
  7: 'https://medex.com.bd/brands/26177/ceevit-ds-500-mg-chewable-tablet',
  8: 'https://medex.com.bd/brands/11819/histacin-4-mg-tablet',
  9: 'https://medex.com.bd/brands/4014/dexpoten-10-mg-syrup',
  10: 'https://medex.com.bd/brands/16821/mixtard-30-30-70-sc-injection',
  11: 'https://medex.com.bd/brands/5359/comet-500-mg-tablet',
  12: 'https://medex.com.bd/brands/9875/flugal-150-mg-capsule',
  13: 'https://medex.com.bd/brands/32576/atova-ez-20-mg-tablet',
  14: 'https://medex.com.bd/brands/10461/napa-10-mg-injection',
  15: 'https://medex.com.bd/brands/29028/emjard-10-mg-tablet',
};

async function syncAll() {
  console.log('🔄 Syncing inventory with live MedEx online data...');
  const groups = db.prepare(`SELECT id, name FROM groups`).all();

  const updateMed = db.prepare(`
    UPDATE medicines
    SET
      name = coalesce(@name, name),
      generic_name = coalesce(@generic_name, generic_name),
      manufacturer = coalesce(@manufacturer, manufacturer),
      strength = coalesce(@strength, strength),
      dosage_form = coalesce(@dosage_form, dosage_form),
      unit_type = coalesce(@unit_type, unit_type),
      group_id = coalesce(@group_id, group_id),
      source_url = @source_url,
      mrp = coalesce(@mrp, mrp),
      last_selling_price = coalesce(@last_selling_price, last_selling_price)
    WHERE id = @id
  `);

  for (const [idStr, url] of Object.entries(MED_URL_MAP)) {
    const id = parseInt(idStr, 10);
    const existing = db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(id);
    if (!existing) {
      console.log(`⚠️ Medicine ID ${id} not found in DB, skipping`);
      continue;
    }

    console.log(`\nFetching online data for ID ${id} (${existing.name}): ${url}`);
    const details = await adapter.fetchBrandDetails(url);

    if (details.error) {
      console.error(`❌ Failed to fetch: ${details.error}`);
      continue;
    }

    const matchedGroupId = mapToGroupId(
      details.therapeutic_class,
      details.generic_name || existing.generic_name,
      details.name || existing.name,
      groups
    ) || existing.group_id;

    updateMed.run({
      id,
      name: details.name || existing.name,
      generic_name: details.generic_name || existing.generic_name,
      manufacturer: details.manufacturer || existing.manufacturer,
      strength: details.strength || existing.strength,
      dosage_form: details.dosage_form || existing.dosage_form,
      unit_type: details.unit_type || existing.unit_type,
      group_id: matchedGroupId,
      source_url: url,
      mrp: details.mrp != null ? details.mrp : existing.mrp,
      last_selling_price: details.selling_price != null ? details.selling_price : existing.last_selling_price,
    });

    console.log(`✅ Updated ID ${id}: ${details.name} (${details.strength}) | MRP: ৳${details.mrp} | Generic: ${details.generic_name}`);
  }

  console.log('\n✨ Database sync complete!');
}

syncAll().catch(console.error);
