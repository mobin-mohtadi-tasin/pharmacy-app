import { getMedicineAdapter } from '@/lib/medicine-source';
import { mapToGroupId } from '@/lib/medicine-source/medex-adapter';
import { getDb } from '@/lib/db';
import { ok, err } from '@/lib/utils';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') || '';
  const name = searchParams.get('name') || '';
  const generic_name = searchParams.get('generic_name') || '';

  if (!url || !url.startsWith('http')) {
    return err('A valid MedEx source URL is required', 400);
  }

  try {
    const adapter = getMedicineAdapter();
    const details = await adapter.fetchBrandDetails(url);

    if (details.error) {
      return err(details.error, 502);
    }

    // Match group from local database
    const db = getDb();
    const groups = await db.prepare(`SELECT id, name FROM groups ORDER BY name ASC`).all();
    const matchedGroupId = mapToGroupId(
      details.therapeutic_class,
      generic_name || details.generic_name,
      name || details.name,
      groups
    );

    const matchedGroup = groups.find(g => g.id === matchedGroupId);

    return ok({
      ...details,
      group_id: matchedGroupId || null,
      group_name: matchedGroup ? matchedGroup.name : null,
    });
  } catch (e) {
    return err(e.message, 500);
  }
}
