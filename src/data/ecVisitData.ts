/**
 * Modul data untuk kunjungan EC (Educational Consultant).
 *
 * Mengambil data dari endpoint `/api/ec-visits` yang membaca tab Clean_EC_Visits.
 * Hanya memproses data operasional dan BU (Business Unit), tanpa menyertakan
 * data pribadi (Parent, Phone, Child, DOB, Age).
 */

/**
 * Detail entri Business Unit (BU1 - BU8) pada setiap kunjungan.
 */
export interface ECBUDetail {
  bu: string;
  center: string;
  status: string;
  ageGroup: string;
  classDate: string;
  classTime: string;
  className: string;
  room: string;
}

/**
 * Record kunjungan EC tunggal dari endpoint /api/ec-visits.
 */
export interface ECVisitRecord {
  timestamp: string;
  ec: string;
  locationName: string;
  namaLokasiStandard?: string;
  center: string;
  centerNearest: string;
  buEntries: ECBUDetail[];
}

/**
 * Struktur respons mentah dari endpoint /api/ec-visits.
 */
export interface ECVisitsApiResponse {
  success: boolean;
  data?: ECVisitRecord[];
  cached?: boolean;
  error?: string;
}

/**
 * Opsi saat memanggil fetchECVisits.
 */
export interface FetchECVisitsOptions {
  /**
   * Jika true, meminta data terbaru langsung dari spreadsheet (bypass cache server).
   */
  refresh?: boolean;
}

/**
 * Mem-parsing string tanggal secara aman tanpa mengandalkan pengurutan string mentah.
 * Mendukung format:
 * - DD/MM/YYYY atau DD-MM-YYYY (contoh: "10/11/2026" diartikan 10 November 2026)
 * - ISO format (contoh: "2026-10-11" atau "2026-10-11T08:30:00Z")
 * - Format dengan jam opsional (contoh: "10/11/2026 14:30")
 * - Otomatis mendeteksi jika bagian kedua > 12 (MM/DD/YYYY, contoh: "10/25/2026" -> 25 Oktober 2026)
 *
 * Mengembalikan objek `Date` valid, atau `null` jika string kosong / format tidak valid.
 * Tidak pernah membuat tanggal tiruan/palsu.
 */
export function parseDateSafely(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const trimmed = dateStr.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Cek format ISO YYYY-MM-DD atau YYYY/MM/DD
  const isoPattern = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;
  const isoMatch = trimmed.match(isoPattern);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
    const minute = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    const second = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const parsed = new Date(year, month - 1, day, hour, minute, second);
      if (
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day
      ) {
        return parsed;
      }
    }
    return null;
  }

  // 2. Cek format DD/MM/YYYY atau D/M/YYYY (pemisah '/', '-', '.')
  const dmyPattern = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;
  const dmyMatch = trimmed.match(dmyPattern);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    let day: number;
    let month: number;

    // Jika bagian kedua > 12 (contoh: 10/25/2026), berarti p1 = bulan, p2 = tanggal
    if (p2 > 12 && p1 <= 12) {
      month = p1;
      day = p2;
    } else if (p1 > 12 && p2 <= 12) {
      // p1 > 12 (contoh: 25/10/2026), berarti p1 = tanggal, p2 = bulan
      day = p1;
      month = p2;
    } else {
      // Jika keduanya <= 12 (contoh: 10/11/2026), patuhi format standar DD/MM/YYYY
      day = p1;
      month = p2;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const parsed = new Date(year, month - 1, day, hour, minute, second);
      if (
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day
      ) {
        return parsed;
      }
    }
    return null;
  }

  // 3. Fallback jika string adalah ISO 8601 lengkap dengan offset/zona (mis. 2026-10-11T12:00:00Z)
  const nativeParsed = new Date(trimmed);
  if (!Number.isNaN(nativeParsed.getTime())) {
    return nativeParsed;
  }

  return null;
}

/**
 * Mengambil timestamp epoch (dalam milidetik) secara aman untuk kebutuhan perbandingan dan sorting.
 * Mengembalikan null jika tanggal tidak valid atau kosong.
 */
export function getDateTimestampSafely(dateStr: string | null | undefined): number | null {
  const parsed = parseDateSafely(dateStr);
  return parsed ? parsed.getTime() : null;
}

/**
 * Mengambil seluruh data kunjungan EC dari endpoint backend `/api/ec-visits`.
 *
 * Memeriksa status HTTP dan properti `success` pada respons JSON.
 * Menghasilkan pesan error informatif jika request gagal atau data tidak valid.
 *
 * @param options Opsi pemanggilan (misal `{ refresh: true }` untuk memicu refresh dari Google Sheets)
 * @returns Array dari `ECVisitRecord`
 */
export async function fetchECVisits(options?: FetchECVisitsOptions): Promise<ECVisitRecord[]> {
  const url = options?.refresh ? '/api/ec-visits?refresh=1' : '/api/ec-visits';

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Gagal menghubungi server untuk data kunjungan EC: ${message}`);
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      if (errJson && typeof errJson.error === 'string') {
        errorDetail = ` - ${errJson.error}`;
      }
    } catch {
      // Abaikan jika body respons bukan JSON
    }
    throw new Error(`Permintaan data kunjungan EC gagal (HTTP ${response.status}${errorDetail}).`);
  }

  let json: ECVisitsApiResponse;
  try {
    json = (await response.json()) as ECVisitsApiResponse;
  } catch {
    throw new Error('Respons dari server tidak berformat JSON yang valid.');
  }

  if (!json.success) {
    const errorMsg = json.error || 'Server melaporkan kegagalan saat memuat data kunjungan EC.';
    throw new Error(errorMsg);
  }

  if (!Array.isArray(json.data)) {
    throw new Error('Format data kunjungan EC dari server tidak sesuai (harus berupa array).');
  }

  return json.data;
}
