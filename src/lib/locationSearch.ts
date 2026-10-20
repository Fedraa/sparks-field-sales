/**
 * Location Search Adapter (Nominatim OpenStreetMap)
 *
 * Menyediakan fungsi pencarian lokasi bebas (free-text) untuk POC
 * "Find Sparks Near a Location" menggunakan API publik Nominatim.
 */

export interface LocationSearchResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  address?: string;
}

export const QUICK_SEARCH_CHIPS = [
  'Grand Indonesia',
  'Plaza Senayan',
  'BSD City',
  'Gading Serpong',
  'Tunjungan Plaza',
];

// In-memory cache sederhana untuk session saat ini
const searchCache = new Map<string, LocationSearchResult[]>();

/**
 * Mencari lokasi di Indonesia berdasarkan kata kunci bebas menggunakan Nominatim.
 *
 * @param query Kata kunci pencarian (minimal 3 karakter)
 * @param signal AbortSignal opsional untuk pembatalan request
 * @returns Array maksimal 5 LocationSearchResult dengan koordinat valid
 */
export async function searchLocations(
  query: string,
  signal?: AbortSignal
): Promise<LocationSearchResult[]> {
  const cleanQuery = query.trim();

  // Validasi panjang minimal query
  if (cleanQuery.length < 3) {
    return [];
  }

  const cacheKey = cleanQuery.toLowerCase();
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  const baseUrl = typeof window !== 'undefined' ? '' : 'http://localhost:3000';
  const proxyUrl = `${baseUrl}/api/geocode?q=${encodeURIComponent(cleanQuery)}`;
  const directUrl =
    `https://nominatim.openstreetmap.org/search?` +
    new URLSearchParams({
      q: cleanQuery,
      format: 'jsonv2',
      limit: '5',
      countrycodes: 'id',
      addressdetails: '1',
    }).toString();

  try {
    let data: any = null;

    // Coba proxy server internal terlebih dahulu (untuk menghindari rate-limiting / CORS)
    try {
      const pRes = await fetch(proxyUrl, { signal });
      if (pRes.ok) {
        data = await pRes.json();
      }
    } catch {
      // Fallback ke direct URL jika proxy tidak merespon
    }

    if (!data || !Array.isArray(data)) {
      const response = await fetch(directUrl, {
        headers: {
          Accept: 'application/json',
        },
        signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Batas request Nominatim tercapai (rate limit). Tunggu beberapa detik.');
        }
        throw new Error(`Nominatim error: HTTP ${response.status}`);
      }

      data = await response.json();
    }

    if (!Array.isArray(data)) {
      return [];
    }

    const results: LocationSearchResult[] = [];

    for (const item of data) {
      const lat = typeof item.lat === 'number' ? item.lat : parseFloat(item.lat);
      const lng = typeof item.lon === 'number' ? item.lon : parseFloat(item.lon);

      if (isNaN(lat) || isNaN(lng) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }

      const displayName = String(item.display_name || '').trim();
      const primaryName =
        String(item.name || '').trim() ||
        displayName.split(',')[0].trim() ||
        cleanQuery;

      results.push({
        id: String(item.place_id || `${lat},${lng}`),
        name: primaryName,
        displayName,
        lat,
        lng,
        address: displayName,
      });

      if (results.length >= 5) {
        break;
      }
    }

    searchCache.set(cacheKey, results);
    return results;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return [];
    }
    throw err;
  }
}

