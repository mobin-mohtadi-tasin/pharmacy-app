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

  /**
   * Fetch complete brand details from MedEx brand page.
   * Extracts unit price, strip price, MRP, calculated trade cost price,
   * therapeutic class, and suggested unit type.
   */
  async fetchBrandDetails(sourceUrl) {
    if (!sourceUrl || !sourceUrl.startsWith('http')) {
      return { error: 'Invalid URL' };
    }

    const cacheKey = `brand:${sourceUrl.toLowerCase()}`;
    const db = getDb();
    const cached = db.prepare(
      `SELECT results_json, fetched_at FROM medicine_search_cache WHERE query = ?`
    ).get(cacheKey);

    if (cached) {
      const ageHours = (Date.now() - new Date(cached.fetched_at).getTime()) / 3600000;
      if (ageHours < CACHE_TTL_HOURS) {
        return JSON.parse(cached.results_json);
      }
    }

    // Rate limiting
    const now = Date.now();
    const sinceLastFetch = now - this._lastFetchAt;
    if (sinceLastFetch < RATE_LIMIT_MS) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS - sinceLastFetch));
    }
    this._lastFetchAt = Date.now();

    try {
      const res = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'PharmacyBillingSystem/1.0 (local business tool; not for redistribution)',
          'Accept': 'text/html',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const $ = cheerio.load(html);

      const pkgText = $('.package-container').text().replace(/\s+/g, ' ').trim();

      // Extract Unit Price
      let unitPrice = null;
      const unitMatch = pkgText.match(/unit price:\s*(?:৳|tk\.?)?\s*([\d,.]+)/i);
      if (unitMatch) {
        unitPrice = parseFloat(unitMatch[1].replace(/,/g, ''));
      }

      // Extract Strip Price
      let stripPrice = null;
      const stripMatch = pkgText.match(/strip price:\s*(?:৳|tk\.?)?\s*([\d,.]+)/i);
      if (stripMatch) {
        stripPrice = parseFloat(stripMatch[1].replace(/,/g, ''));
      }

      // If unit price not found, check bottle/tube/vial/ampoule/pack price or first ৳ match
      if (unitPrice == null) {
        const bottleMatch = pkgText.match(/(?:bottle|tube|vial|ampoule|pack|box)?:\s*(?:৳|tk\.?)?\s*([\d,.]+)/i) ||
                            pkgText.match(/(?:৳|tk\.?)\s*([\d,.]+)/i);
        if (bottleMatch) {
          unitPrice = parseFloat(bottleMatch[1].replace(/,/g, ''));
        }
      }

      // Extract Therapeutic Class
      let therapeuticClass = '';
      $('.ac-header').each((_, el) => {
        if (/therapeutic class/i.test($(el).text())) {
          therapeuticClass = $(el).parent().next().text().replace(/\s+/g, ' ').trim();
        }
      });

      // Standard wholesale / trade cost price in Bangladesh (~88% of MRP)
      const costPrice = unitPrice != null
        ? Number((unitPrice * 0.88).toFixed(2))
        : (stripPrice != null ? Number((stripPrice * 0.88).toFixed(2)) : null);
      const mrp = unitPrice != null ? unitPrice : (stripPrice != null ? stripPrice : null);
      const sellingPrice = unitPrice != null ? unitPrice : (stripPrice != null ? stripPrice : null);

      // Guess unit type based on brand title, package container, and URL
      let unitType = 'strip';
      const dosageText = ($('h1').text() + ' ' + $('.package-container').text() + ' ' + sourceUrl).toLowerCase();
      if (/tablet|capsule|cap\b|tab\b/.test(dosageText)) {
        unitType = 'strip';
      } else if (/syrup|suspension|oral solution|drop|elixir|liquid|lotion/.test(dosageText)) {
        unitType = 'bottle';
      } else if (/cream|ointment|gel|inhaler|injection|vial|ampoule|spray|sachet|suppository|powder|patch/.test(dosageText)) {
        unitType = 'piece';
      } else if (/bottle/.test(dosageText)) {
        unitType = 'bottle';
      }

      const result = {
        unit_price: unitPrice,
        strip_price: stripPrice,
        mrp,
        cost_price: costPrice,
        selling_price: sellingPrice,
        therapeutic_class: therapeuticClass,
        unit_type: unitType,
      };

      // Cache result
      db.prepare(`
        INSERT OR REPLACE INTO medicine_search_cache (query, results_json, fetched_at)
        VALUES (?, ?, datetime('now'))
      `).run(cacheKey, JSON.stringify(result));

      return result;
    } catch (err) {
      if (cached) return JSON.parse(cached.results_json);
      return { error: err.message };
    }
  }
}

/**
 * Maps MedEx therapeutic class, generic name, and brand name to an existing pharmacy group.
 */
export function mapToGroupId(therapeuticClass = '', genericName = '', medicineName = '', groups = []) {
  if (!groups || groups.length === 0) return null;

  const tc = (therapeuticClass || '').toLowerCase();
  const gen = (genericName || '').toLowerCase();
  const name = (medicineName || '').toLowerCase();
  const combined = `${tc} ${gen} ${name}`;

  const findId = (pattern) => {
    const g = groups.find(x => pattern.test(x.name.toLowerCase()));
    return g ? g.id : null;
  };

  // 1. Antacid / GI
  if (
    /anti-?ulcerant|proton pump|antacid|h2 receptor|gastrointestinal|anti-?emetic|laxative|\bgi\b/i.test(tc) ||
    /esomeprazole|omeprazole|pantoprazole|rabeprazole|lansoprazole|famotidine|ranitidine|domperidone|ondansetron|sucralfate|magaldrate|simethicone|lactulose|loperamide|hyoscine/i.test(gen) ||
    /sergel|seclo|maxpro|pantonix|nexum|finix|alacot|gastral/i.test(name)
  ) {
    const id = findId(/antacid|gi/);
    if (id) return id;
  }

  // 2. Painkiller / Antipyretic
  if (
    /analgesic|antipyretic|nsaid|anti-inflammatory|opioid/i.test(tc) ||
    /paracetamol|acetaminophen|ibuprofen|naproxen|diclofenac|aceclofenac|ketorolac|tramadol|indomethacin|mefenamic|aspirin|celecoxib|etoricoxib/i.test(gen) ||
    /napa|ace|fast|pyrex|renova|torax|xfin/i.test(name)
  ) {
    const id = findId(/painkiller|antipyretic|analgesic/);
    if (id) return id;
  }

  // 3. Antibiotic
  if (
    /antibiotic|antibacterial|cephalosporin|macrolide|quinolone|penicillin|carbapenem/i.test(tc) ||
    /azithromycin|ciprofloxacin|cefixime|amoxicillin|clavulanic|ceftriaxone|cefuroxime|clarithromycin|doxycycline|levofloxacin|moxifloxacin|metronidazole|flucloxacillin|erythromycin/i.test(gen) ||
    /ciprocin|zithrox|azithro|moxacil|ceftron|cef-3/i.test(name)
  ) {
    const id = findId(/antibiotic/);
    if (id) return id;
  }

  // 4. Antihistamine
  if (
    /antihistamine|allergy|anti-allergic/i.test(tc) ||
    /cetirizine|levocetirizine|fexofenadine|loratadine|desloratadine|chlorpheniramine|histacin|bilastine|rupatadine|ketotifen/i.test(gen) ||
    /histacin|alatrol|fexo|deslor|fenadin/i.test(name)
  ) {
    const id = findId(/antihistamine/);
    if (id) return id;
  }

  // 5. Respiratory
  if (
    /respiratory|bronchodilator|anti-asthmatic|cough|expectorant|leukotriene/i.test(tc) ||
    /salbutamol|montelukast|budesonide|fluticasone|formoterol|ipratropium|theophylline|doxofylline|ambroxol|bromhexine|guaifenesin|dextromethorphan/i.test(gen) ||
    /monas|ventolin|bextram|sinacof|advaspray|pulmoclear/i.test(name)
  ) {
    const id = findId(/respiratory/);
    if (id) return id;
  }

  // 6. Insulin & Diabetes
  if (
    /diabetes|antidiabetic|hypoglycemic|insulin/i.test(tc) ||
    /metformin|gliclazide|glimepiride|glipizide|vildagliptin|sitagliptin|linagliptin|empagliflozin|dapagliflozin|insulin|pioglitazone/i.test(gen) ||
    /mixtard|lantus|comet|glucophage|diamicron/i.test(name)
  ) {
    const id = findId(/insulin|diabetes/);
    if (id) return id;
  }

  // 7. Cardiovascular
  if (
    /cardiovascular|antihypertensive|beta-blocker|calcium channel|ace inhibitor|\barb\b|statin|lipid/i.test(tc) ||
    /amlodipine|losartan|valsartan|telmisartan|bisoprolol|atenolol|metoprolol|carvedilol|atorvastatin|rosuvastatin|clopidogrel|diltiazem|verapamil|enalapril|ramipril/i.test(gen) ||
    /angilock|osartil|camlosart|atova|rosuva|cardizen/i.test(name)
  ) {
    const id = findId(/cardiovascular/);
    if (id) return id;
  }

  // 8. Antifungal
  if (
    /antifungal/i.test(tc) ||
    /fluconazole|itraconazole|ketoconazole|clotrimazole|terbinafine|miconazole|nystatin/i.test(gen) ||
    /diflucan|lucan|fungidal|daktarin/i.test(name)
  ) {
    const id = findId(/antifungal/);
    if (id) return id;
  }

  // 9. Dermatology
  if (
    /dermatolog|topical|skin/i.test(tc) ||
    /hydrocortisone|betamethasone|clobetasol|fusidic|permethrin|adapalene|isotretinoin/i.test(gen) ||
    /betnovate|dermasol|fucidin|lorinden/i.test(name)
  ) {
    const id = findId(/dermatology/);
    if (id) return id;
  }

  // 10. Vitamins & Supplements
  if (
    /vitamin|mineral|supplement|nutritional/i.test(tc) ||
    /vitamin|calcium|zinc|iron|folic acid|multivitamin|cod liver|cholecalciferol|tocopherol|ascorbic/i.test(gen) ||
    /ceevit|bicozin|coralcal|calbo|ostocal/i.test(name)
  ) {
    const id = findId(/vitamin/);
    if (id) return id;
  }

  // Direct keyword matching with any group name in the database
  for (const g of groups) {
    const parts = g.name.toLowerCase().split(/[\s/&,]+/);
    for (const part of parts) {
      if (part.length >= 4 && combined.includes(part)) {
        return g.id;
      }
    }
  }

  return null;
}
