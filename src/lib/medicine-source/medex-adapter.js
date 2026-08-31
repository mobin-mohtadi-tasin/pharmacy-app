import * as cheerio from 'cheerio';
import { getDb } from '../db/index.js';

const CACHE_TTL_HOURS = 24;
const RATE_LIMIT_MS = 2000; // 1 request per 2 seconds

export class MedexAdapter {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this._lastFetchAt = 0;
  }

  /**
   * Search for medicines by name.
   * Returns: [{ name, strength, generic_name, manufacturer, dosage_form, source_url }]
   */
  async search(query) {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return { results: [], error: null, fromCache: false };

    // Check cache first
    const db = getDb();
    const cached = db.prepare(
      `SELECT results_json, fetched_at FROM medicine_search_cache WHERE query = ?`
    ).get(q);

    if (cached) {
      const ageHours = (Date.now() - new Date(cached.fetched_at).getTime()) / 3600000;
      if (ageHours < CACHE_TTL_HOURS) {
        return { results: JSON.parse(cached.results_json), error: null, fromCache: true };
      }
    }

    // Rate limiting
    const now = Date.now();
    const sinceLastFetch = now - this._lastFetchAt;
    if (sinceLastFetch < RATE_LIMIT_MS) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS - sinceLastFetch));
    }
    this._lastFetchAt = Date.now();

    // Fetch from MedEx
    try {
      const url = `${this.baseUrl}/search?search=${encodeURIComponent(query)}&type=brands`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'PharmacyBillingSystem/1.0 (local business tool; not for redistribution)',
          'Accept': 'text/html',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const html = await res.text();
      const results = this._parseSearchResults(html, query);

      // Cache results
      db.prepare(`
        INSERT OR REPLACE INTO medicine_search_cache (query, results_json, fetched_at)
        VALUES (?, ?, datetime('now'))
      `).run(q, JSON.stringify(results));

      return { results, error: null, fromCache: false };
    } catch (err) {
      // Graceful degradation — return cached stale data if available, else empty
      if (cached) {
        return { results: JSON.parse(cached.results_json), error: 'Offline — showing cached results', fromCache: true };
      }
      return { results: [], error: 'Cannot reach medicine database — enter details manually', fromCache: false };
    }
  }

  _parseSearchResults(html, query) {
    const $ = cheerio.load(html);
    const results = [];

    // Parse .search-result-row elements (non-ad results)
    $('.search-result-row:not(.ad)').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('.search-result-title a');
      const sourceUrl = linkEl.attr('href') || '';
      const fullText = linkEl.text().trim(); // e.g. "Napa 500 mg (Tablet)"
      const descText = $el.find('p').text().trim(); // e.g. "Napa 500 mg (Paracetamol) is manufactured by Beximco..."

      // Parse name + strength + dosage_form from title
      // Pattern: "Brand Strength (DosageForm)" e.g. "Napa Extra 500 mg+65 mg (Tablet)"
      const titleMatch = fullText.match(/^(.+?)\s+(\d[\d.,+\/ ]*(?:mg|mcg|g|iu|ml|%|IU)[^\s()]*(?:\s*\+\s*\d[\d.,+\/ ]*(?:mg|mcg|g|iu|ml|%|IU)[^\s()]*)*)\s*\(([^)]+)\)$/i);
      let name = fullText;
      let strength = '';
      let dosageForm = '';

      if (titleMatch) {
        name = titleMatch[1].trim();
        strength = titleMatch[2].trim();
        dosageForm = titleMatch[3].trim();
      }

      // Parse generic name from description: "(GenericName)"
      const genericMatch = descText.match(/\(([^)]+)\)\s+is manufactured by/i);
      const generic_name = genericMatch ? genericMatch[1].trim() : '';

      // Parse manufacturer
      const mfgMatch = descText.match(/is manufactured by\s+(.+?)\.?\s*$/i);
      const manufacturer = mfgMatch ? mfgMatch[1].trim() : '';

      if (name && sourceUrl) {
        results.push({ name, strength, dosage_form: dosageForm, generic_name, manufacturer, source_url: sourceUrl });
      }
    });

    return results;
  }
}
