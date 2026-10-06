import { getDb } from '@/lib/db';
import { ok, err } from '@/lib/utils';

export async function GET() {
  const db = getDb();
  const groups = await db.prepare(`
    SELECT g.*, COUNT(m.id) as medicine_count
    FROM groups g
    LEFT JOIN medicines m ON m.group_id = g.id
    GROUP BY g.id
    ORDER BY g.name
  `).all();
  return ok(groups);
}

export async function POST(req) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) return err('Group name is required');
    const db = getDb();
    const result = await db.prepare(`INSERT INTO groups (name) VALUES (?)`).run(name.trim());
    const group = await db.prepare(`SELECT * FROM groups WHERE id = ?`).get(result.lastInsertRowid);
    return ok(group, 201);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return err('Group name already exists', 409);
    return err(e.message, 500);
  }
}
