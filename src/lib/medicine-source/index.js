/**
 * Medicine Source Adapter Factory
 * Reads MEDICINE_SOURCE_URL from env and returns the correct adapter.
 * To swap sources: set MEDICINE_SOURCE_URL to a different base URL and create a new adapter.
 */
import { MedexAdapter } from './medex-adapter.js';

let _adapter = null;

export function getMedicineAdapter() {
  if (!_adapter) {
    const sourceUrl = process.env.MEDICINE_SOURCE_URL || 'https://medex.com.bd';
    if (sourceUrl.includes('medex.com.bd')) {
      _adapter = new MedexAdapter(sourceUrl);
    } else {
      // Default fallback to MedEx
      _adapter = new MedexAdapter(sourceUrl);
    }
  }
  return _adapter;
}
