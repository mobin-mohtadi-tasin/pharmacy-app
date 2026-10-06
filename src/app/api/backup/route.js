import { ok, err } from '@/lib/utils';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'pharmacy.db');
    if (!fs.existsSync(dbPath)) return err('Database file not found', 404);

    const fileBuffer = fs.readFileSync(dbPath);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `pharmacy_backup_${date}.db`;

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return err(e.message, 500);
  }
}
