/**
 * Modul pengolahan dan perhitungan data Laporan EC (Educational Consultant).
 *
 * Mengolah data kunjungan EC (dari `ecVisitData.ts`) dan mencocokkannya
 * dengan daftar lokasi dan center yang tersedia di aplikasi (`fieldData.ts`).
 *
 * Murni memproses data (pure business logic) tanpa dependensi UI.
 */

import { ECVisitRecord, parseDateSafely } from './ecVisitData';
import { FieldLocation, Center } from './fieldData';

/**
 * Statistik performa EC individual pada satu lokasi.
 */
export interface ECPerformerStat {
  /** Nama EC */
  ec: string;
  /** Jumlah kunjungan oleh EC ini di lokasi */
  totalVisits: number;
  /** Jumlah leads yang didapat oleh EC ini di lokasi */
  leads: number;
  /** Jumlah booking yang didapat oleh EC ini di lokasi */
  booking: number;
  /** Tanggal kunjungan terbaru oleh EC ini (string asli) atau null jika tidak ada */
  latestVisitDate: string | null;
}

/**
 * Ringkasan performa kunjungan EC untuk satu lokasi.
 */
export interface ECLocationSummary {
  /** ID lokasi jika cocok dengan FieldLocation, atau empty string jika tidak ada ID */
  locationId: string;
  /** Nama lokasi standar (mengikuti FieldLocation atau nama lokasi kunjungan) */
  locationName: string;
  /** Kode center terkait (FieldLocation.centerCode) */
  centerCode: string;
  /** Nama center terkait jika diketahui */
  centerName: string;
  /** Referensi ke FieldLocation asli jika berhasil dicocokkan */
  locationRef: FieldLocation | null;

  /** Total baris kunjungan EC pada lokasi ini */
  totalVisits: number;
  /** Total leads (semua entri BU dengan status 'Leads') */
  leads: number;
  /** Total booking (semua entri BU dengan status 'Booking') */
  booking: number;

  /** Tanggal kunjungan paling awal (format string asli) atau null */
  firstVisitDate: string | null;
  /** Tanggal kunjungan paling akhir (format string asli) atau null */
  latestVisitDate: string | null;

  /** Daftar EC unik yang pernah mengunjungi lokasi ini (terurut alfabet) */
  uniqueECs: string[];

  /** Detail performa per EC di lokasi ini */
  ecBreakdown: ECPerformerStat[];

  /** Daftar seluruh kunjungan EC yang tercatat pada lokasi ini */
  rawVisits: ECVisitRecord[];
}

/**
 * Ringkasan menyeluruh Laporan EC untuk sebuah center atau global.
 */
export interface ECCenterReportSummary {
  /** Kode center yang dipilih, atau 'ALL' */
  centerCode: string;
  /** Nama center yang dipilih, atau label representatif */
  centerName: string;

  /** Total seluruh baris kunjungan EC dalam cakupan */
  totalVisits: number;
  /** Total seluruh leads dalam cakupan */
  totalLeads: number;
  /** Total seluruh booking dalam cakupan */
  totalBooking: number;

  /** Jumlah lokasi unik yang pernah dikunjungi EC */
  visitedLocationsCount: number;
  /** Jumlah seluruh lokasi master di center ini (jika centerCode spesifik) */
  totalMasterLocationsCount: number;
  /** Jumlah lokasi master di center ini yang BELUM pernah dikunjungi */
  unvisitedLocationsCount: number;

  /** Rata-rata leads per kunjungan (2 desimal, 0 jika kunjungan 0) */
  leadsPerVisitRate: number;
  /** Rasio konversi booking terhadap leads dalam persen (2 desimal, 0 jika leads 0) */
  bookingToLeadsPercent: number;

  /** Rincian performa per lokasi yang dikunjungi (terurut berdasarkan kriteria default: visits desc) */
  locationSummaries: ECLocationSummary[];

  /** Daftar lokasi master yang belum pernah dikunjungi */
  unvisitedLocations: FieldLocation[];

  /** Rincian performa per EC di seluruh lokasi dalam cakupan */
  ecOverallBreakdown: ECPerformerStat[];
}

/**
 * Opsi filtering untuk pembuatan laporan EC.
 */
export interface ECReportFilterOptions {
  /**
   * Filter rentang tanggal awal (inklusif). Format string dapat berupa DD/MM/YYYY atau ISO.
   */
  startDate?: string | null;
  /**
   * Filter rentang tanggal akhir (inklusif). Format string dapat berupa DD/MM/YYYY atau ISO.
   */
  endDate?: string | null;
  /**
   * Filter nama EC spesifik (opsional). Jika tidak diberikan, mencakup semua EC.
   */
  ecName?: string | null;
}

/**
 * Normalisasi string nama untuk perbandingan yang andal dan konsisten:
 * - Menghilangkan spasi berlebih di awal/akhir dan di tengah
 * - Huruf kecil (case-insensitive)
 * - Menghilangkan tanda diakritik (é -> e, dsb)
 */
export function normalizeLocationName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') {
    return '';
  }
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Mengambil nama lokasi dari record kunjungan EC:
 * Menggunakan `namaLokasiStandard` sebagai prioritas utama, dengan fallback ke `locationName`.
 */
export function getVisitLocationName(visit: ECVisitRecord): string {
  if (visit.namaLokasiStandard && visit.namaLokasiStandard.trim()) {
    return visit.namaLokasiStandard.trim();
  }
  if (visit.locationName && visit.locationName.trim()) {
    return visit.locationName.trim();
  }
  return '';
}

/**
 * Memeriksa apakah status BU merupakan status 'Leads' (case-insensitive).
 */
export function isLeadStatus(status: string | null | undefined): boolean {
  if (!status || typeof status !== 'string') return false;
  return status.trim().toLowerCase() === 'leads';
}

/**
 * Memeriksa apakah status BU merupakan status 'Booking' (case-insensitive).
 */
export function isBookingStatus(status: string | null | undefined): boolean {
  if (!status || typeof status !== 'string') return false;
  return status.trim().toLowerCase() === 'booking';
}

/**
 * Membentuk kunci gabungan unik untuk memetakan nama lokasi dan kode center.
 * Menghindari tumpang-tindih (collision) jika ada nama lokasi yang sama di dua center berbeda.
 */
export function makeLocationCenterKey(locName: string, centerCode: string): string {
  const normName = normalizeLocationName(locName);
  const normCenter = (centerCode || '').trim().toUpperCase();
  return `${normName}:::${normCenter}`;
}

/**
 * Mencari dan memvalidasi kode center (misal 'TGC', 'MRG') dari record kunjungan EC.
 * Membandingkan secara berurutan terhadap daftar master Center dan FieldLocation.
 * Mengembalikan kode center huruf kapital (uppercase), atau null jika tidak dapat diverifikasi.
 */
export function resolveVisitCenterCode(
  visit: ECVisitRecord,
  centersList: Center[] = [],
  locationsList: FieldLocation[] = [],
): string | null {
  const rawCenter = (visit.center || visit.centerNearest || '').trim();
  if (!rawCenter) {
    return null;
  }

  const rawUpper = rawCenter.toUpperCase();
  const rawNorm = normalizeLocationName(rawCenter);

  // 1. Cek langsung ke master centers (berdasarkan code atau nama)
  for (const c of centersList) {
    if (c.code && c.code.toUpperCase() === rawUpper) {
      return c.code.toUpperCase();
    }
    if (c.name && normalizeLocationName(c.name) === rawNorm) {
      return c.code.toUpperCase();
    }
  }

  // 2. Cek containment nama center (misal "Sparks Center - Tangerang city" vs "Tangerang city")
  for (const c of centersList) {
    if (c.name) {
      const cNorm = normalizeLocationName(c.name);
      if (rawNorm.includes(cNorm) || cNorm.includes(rawNorm)) {
        return c.code.toUpperCase();
      }
    }
  }

  // 3. Fallback ke master locations jika centersList tidak tersedia atau tidak lengkap
  for (const loc of locationsList) {
    if (loc.centerCode && loc.centerCode.toUpperCase() === rawUpper) {
      return loc.centerCode.toUpperCase();
    }
    if (loc.centerName && normalizeLocationName(loc.centerName) === rawNorm) {
      return loc.centerCode.toUpperCase();
    }
  }

  return null;
}

/**
 * Memeriksa apakah tanggal kunjungan berada di dalam rentang filter tanggal.
 */
function isDateWithinRange(
  dateStr: string | null | undefined,
  startDateStr?: string | null,
  endDateStr?: string | null,
): boolean {
  if (!startDateStr && !endDateStr) {
    return true;
  }

  const visitDate = parseDateSafely(dateStr);
  if (!visitDate) {
    // Tanggal kunjungan tidak valid/kosong, tidak dapat dipastikan masuk ke rentang tanggal
    return false;
  }

  // Bandingkan berdasarkan awal hari tanggal (00:00:00) dan akhir hari tanggal (23:59:59)
  const visitTime = visitDate.getTime();

  if (startDateStr) {
    const start = parseDateSafely(startDateStr);
    if (start) {
      start.setHours(0, 0, 0, 0);
      if (visitTime < start.getTime()) {
        return false;
      }
    }
  }

  if (endDateStr) {
    const end = parseDateSafely(endDateStr);
    if (end) {
      end.setHours(23, 59, 59, 999);
      if (visitTime > end.getTime()) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Menghitung ringkasan untuk satu kelompok kunjungan di satu lokasi.
 */
function computeLocationSummary(
  locName: string,
  matchedLocation: FieldLocation | null,
  visits: ECVisitRecord[],
): ECLocationSummary {
  let leads = 0;
  let booking = 0;

  const ecMap = new Map<string, { totalVisits: number; leads: number; booking: number; latestDate: string | null; latestTime: number }>();
  let earliestDateStr: string | null = null;
  let earliestDateTime = Infinity;
  let latestDateStr: string | null = null;
  let latestDateTime = -Infinity;

  for (const v of visits) {
    const ecName = (v.ec || 'Unknown EC').trim();
    if (!ecMap.has(ecName)) {
      ecMap.set(ecName, { totalVisits: 0, leads: 0, booking: 0, latestDate: null, latestTime: -Infinity });
    }
    const ecStat = ecMap.get(ecName)!;
    ecStat.totalVisits += 1;

    // Periksa status BU
    const buList = v.buEntries || [];
    for (const b of buList) {
      if (isLeadStatus(b.status)) {
        leads += 1;
        ecStat.leads += 1;
      } else if (isBookingStatus(b.status)) {
        booking += 1;
        ecStat.booking += 1;
      }
    }

    // Tanggal
    const parsed = parseDateSafely(v.timestamp);
    if (parsed) {
      const time = parsed.getTime();
      if (time < earliestDateTime) {
        earliestDateTime = time;
        earliestDateStr = v.timestamp;
      }
      if (time > latestDateTime) {
        latestDateTime = time;
        latestDateStr = v.timestamp;
      }
      if (time > ecStat.latestTime) {
        ecStat.latestTime = time;
        ecStat.latestDate = v.timestamp;
      }
    } else if (v.timestamp) {
      // Fallback jika tidak ter-parse
      if (!earliestDateStr) earliestDateStr = v.timestamp;
      if (!latestDateStr) latestDateStr = v.timestamp;
      if (!ecStat.latestDate) ecStat.latestDate = v.timestamp;
    }
  }

  const uniqueECs = Array.from(ecMap.keys()).sort((a, b) => a.localeCompare(b));
  const ecBreakdown: ECPerformerStat[] = uniqueECs.map((ecName) => {
    const s = ecMap.get(ecName)!;
    return {
      ec: ecName,
      totalVisits: s.totalVisits,
      leads: s.leads,
      booking: s.booking,
      latestVisitDate: s.latestDate,
    };
  });

  return {
    locationId: matchedLocation ? matchedLocation.id : '',
    locationName: matchedLocation ? matchedLocation.name : locName,
    centerCode: matchedLocation ? matchedLocation.centerCode : '',
    centerName: matchedLocation ? matchedLocation.centerName : '',
    locationRef: matchedLocation,
    totalVisits: visits.length,
    leads,
    booking,
    firstVisitDate: earliestDateStr,
    latestVisitDate: latestDateStr,
    uniqueECs,
    ecBreakdown,
    rawVisits: visits,
  };
}

/**
 * Menghasilkan Laporan EC komprehensif untuk sebuah Center tertentu (atau seluruh center jika centerCode='ALL').
 *
 * @param centerCode Kode center tujuan (misal 'TGC', 'MRG') atau 'ALL' untuk semua center
 * @param allLocations Daftar master lokasi (FieldLocation[]) dari `fieldData.ts`
 * @param allVisits Daftar seluruh kunjungan EC (ECVisitRecord[]) dari `ecVisitData.ts`
 * @param centersList Daftar center master (opsional, untuk melengkapi nama center)
 * @param filters Opsi filter tanggal dan nama EC (opsional)
 */
export function generateECCenterReport(
  centerCode: string,
  allLocations: FieldLocation[],
  allVisits: ECVisitRecord[],
  centersList: Center[] = [],
  filters?: ECReportFilterOptions,
): ECCenterReportSummary {
  const isAllCenters = !centerCode || centerCode.toUpperCase() === 'ALL';
  const targetCode = centerCode ? centerCode.toUpperCase() : 'ALL';

  // Cari nama center
  let centerName = isAllCenters ? 'Semua Center' : targetCode;
  if (!isAllCenters) {
    const foundCenter = centersList.find((c) => c.code.toUpperCase() === targetCode);
    if (foundCenter) {
      centerName = foundCenter.name;
    } else {
      const locSample = allLocations.find((l) => l.centerCode.toUpperCase() === targetCode);
      if (locSample) centerName = locSample.centerName;
    }
  }

  // 1. Buat lookup map dari Master POI: norm(name) + ':::' + centerCode -> FieldLocation
  // Memastikan lokasi dengan nama sama di dua center berbeda dipetakan secara terpisah
  const locationLookup = new Map<string, FieldLocation>();
  for (const loc of allLocations) {
    if (loc && loc.name && loc.centerCode) {
      const key = makeLocationCenterKey(loc.name, loc.centerCode);
      if (!locationLookup.has(key)) {
        locationLookup.set(key, loc);
      }
    }
  }

  // 2. Filter visits berdasarkan rentang tanggal & nama EC
  const filteredVisits = allVisits.filter((visit) => {
    if (filters?.ecName && filters.ecName.trim()) {
      const filterEc = filters.ecName.trim().toLowerCase();
      const visitEc = (visit.ec || '').trim().toLowerCase();
      if (visitEc !== filterEc) {
        return false;
      }
    }

    if (filters?.startDate || filters?.endDate) {
      if (!isDateWithinRange(visit.timestamp, filters.startDate, filters.endDate)) {
        return false;
      }
    }

    return true;
  });

  // 3. Kelompokkan kunjungan berdasarkan lokasi dan center
  // Hanya masukkan kunjungan yang center-nya terverifikasi dan sesuai dengan target centerCode (jika bukan 'ALL')
  const visitsByLocationKey = new Map<string, { locName: string; matchedLocation: FieldLocation | null; visits: ECVisitRecord[] }>();

  for (const visit of filteredVisits) {
    const visitLocName = getVisitLocationName(visit);
    if (!visitLocName) continue;

    const visitCenterCode = resolveVisitCenterCode(visit, centersList, allLocations);
    // Jangan memasukkan kunjungan yang center-nya tidak dapat diverifikasi ke lokasi tertentu secara sembarangan
    if (!visitCenterCode) continue;

    if (!isAllCenters && visitCenterCode !== targetCode) {
      continue;
    }

    const key = makeLocationCenterKey(visitLocName, visitCenterCode);
    const matchedLoc = locationLookup.get(key) || null;

    // Jika center spesifik dipilih, pastikan matchedLoc (jika ada) sesuai dengan target center
    if (!isAllCenters && matchedLoc && matchedLoc.centerCode.toUpperCase() !== targetCode) {
      continue;
    }

    if (!visitsByLocationKey.has(key)) {
      visitsByLocationKey.set(key, {
        locName: matchedLoc ? matchedLoc.name : visitLocName,
        matchedLocation: matchedLoc,
        visits: [],
      });
    }

    visitsByLocationKey.get(key)!.visits.push(visit);
  }

  // 4. Hitung ringkasan per lokasi
  const locationSummaries: ECLocationSummary[] = [];
  const visitedMasterLocIds = new Set<string>();

  visitsByLocationKey.forEach((group) => {
    const summary = computeLocationSummary(group.locName, group.matchedLocation, group.visits);
    locationSummaries.push(summary);
    if (group.matchedLocation && group.matchedLocation.id) {
      visitedMasterLocIds.add(group.matchedLocation.id);
    }
  });

  // Urutkan lokasi berdasarkan: Total Visits descending, lalu Leads descending, lalu Nama ascending
  locationSummaries.sort((a, b) => {
    if (b.totalVisits !== a.totalVisits) return b.totalVisits - a.totalVisits;
    if (b.leads !== a.leads) return b.leads - a.leads;
    return a.locationName.localeCompare(b.locationName);
  });

  // 5. Lokasi master di center ini yang belum pernah dikunjungi
  const relevantMasterLocations = isAllCenters
    ? allLocations
    : allLocations.filter((l) => l.centerCode.toUpperCase() === targetCode);

  const unvisitedLocations = relevantMasterLocations.filter((l) => !visitedMasterLocIds.has(l.id));

  // 6. Ringkasan agregat keseluruhan
  let totalVisits = 0;
  let totalLeads = 0;
  let totalBooking = 0;

  const ecOverallMap = new Map<string, { totalVisits: number; leads: number; booking: number; latestDate: string | null; latestTime: number }>();

  for (const locSummary of locationSummaries) {
    totalVisits += locSummary.totalVisits;
    totalLeads += locSummary.leads;
    totalBooking += locSummary.booking;

    for (const ecStat of locSummary.ecBreakdown) {
      if (!ecOverallMap.has(ecStat.ec)) {
        ecOverallMap.set(ecStat.ec, { totalVisits: 0, leads: 0, booking: 0, latestDate: null, latestTime: -Infinity });
      }
      const agg = ecOverallMap.get(ecStat.ec)!;
      agg.totalVisits += ecStat.totalVisits;
      agg.leads += ecStat.leads;
      agg.booking += ecStat.booking;

      const parsed = parseDateSafely(ecStat.latestVisitDate);
      if (parsed && parsed.getTime() > agg.latestTime) {
        agg.latestTime = parsed.getTime();
        agg.latestDate = ecStat.latestVisitDate;
      } else if (!agg.latestDate && ecStat.latestVisitDate) {
        agg.latestDate = ecStat.latestVisitDate;
      }
    }
  }

  const ecOverallBreakdown: ECPerformerStat[] = Array.from(ecOverallMap.entries())
    .map(([ec, s]) => ({
      ec,
      totalVisits: s.totalVisits,
      leads: s.leads,
      booking: s.booking,
      latestVisitDate: s.latestDate,
    }))
    .sort((a, b) => {
      if (b.totalVisits !== a.totalVisits) return b.totalVisits - a.totalVisits;
      return b.leads - a.leads;
    });

  const leadsPerVisitRate = totalVisits > 0 ? Number((totalLeads / totalVisits).toFixed(2)) : 0;
  const bookingToLeadsPercent = totalLeads > 0 ? Number(((totalBooking / totalLeads) * 100).toFixed(2)) : 0;

  return {
    centerCode: targetCode,
    centerName,
    totalVisits,
    totalLeads,
    totalBooking,
    visitedLocationsCount: locationSummaries.length,
    totalMasterLocationsCount: relevantMasterLocations.length,
    unvisitedLocationsCount: unvisitedLocations.length,
    leadsPerVisitRate,
    bookingToLeadsPercent,
    locationSummaries,
    unvisitedLocations,
    ecOverallBreakdown,
  };
}

/**
 * Mengambil daftar nama EC unik dari dataset kunjungan EC.
 */
export function getUniqueECNames(visits: ECVisitRecord[]): string[] {
  const set = new Set<string>();
  for (const v of visits) {
    if (v.ec && v.ec.trim()) {
      set.add(v.ec.trim());
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
