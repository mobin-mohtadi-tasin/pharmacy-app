import { ok, err } from '@/lib/utils';

export async function POST(req) {
  try {
    const { pin } = await req.json();
    const expectedPin = process.env.ADMIN_PIN || '1234';
    if (String(pin) === String(expectedPin)) {
      return ok({ authenticated: true, token: Buffer.from(`admin:${Date.now()}`).toString('base64') });
    }
    return err('Invalid PIN', 401);
  } catch {
    return err('Invalid request', 400);
  }
}
