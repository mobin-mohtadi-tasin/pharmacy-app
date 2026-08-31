import { getMedicineAdapter } from '@/lib/medicine-source';
import { ok, err } from '@/lib/utils';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  if (!query || query.trim().length < 2) {
    return err('Search query must be at least 2 characters', 400);
  }

  try {
    const adapter = getMedicineAdapter();
    const result = await adapter.search(query);
    return ok(result);
  } catch (e) {
    return err(e.message, 500);
  }
}
