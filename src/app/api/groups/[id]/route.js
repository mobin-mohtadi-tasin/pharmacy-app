import { getDb } from '@/lib/db';
import { ok, err } from '@/lib/utils';

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const { name } = await req.json();
    if (!name?.trim()) return err('Group name is required');
    const db = getDb();
    const result = db.prepare(`UPDATE groups SET name = ? WHERE id = ?`).run(name.trim(), id);
    if (result.changes === 0) return err('Group not found', 404);
    return ok(db.prepare(`SELECT * FROM groups WHERE id = ?`).get(id));
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return err('Group name already exists', 409);
    return err(e.message, 500);
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const db = getDb();
  const count = db.prepare(`SELECT COUNT(*) as c FROM medicines WHERE group_id = ?`).get(id);
  if (count.c > 0) return err(`Cannot delete — ${count.c} medicines are in this group`, 409);
  const result = db.prepare(`DELETE FROM groups WHERE id = ?`).run(id);
  if (result.changes === 0) return err('Group not found', 404);
  return ok({ deleted: true });
}
