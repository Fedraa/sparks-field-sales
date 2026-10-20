/**
 * Nearby Center & POI Geographic Engine.
 *
 * Bertanggung jawab menghitung dan menemukan Sparks Center serta POI terdekat
 * berdasarkan koordinat geografis (latitude & longitude) menggunakan formula Haversine.
 */

import type { Center, FieldLocation } from '../data/fieldData';
import { calculateDistanceKm } from '../data/sparksLocations';

export interface NearbyCenter extends Center {
  /** Jarak geografis dari titik referensi ke Center dalam kilometer */
  distanceKm: number;
}

export interface NearbyLocation extends FieldLocation {
  /** Jarak geografis dari titik referensi ke lokasi POI dalam kilometer */
  distanceKm: number;
}

/** Radius pencarian default (dalam kilometer) */
export const DEFAULT_NEARBY_RADIUS_KM = 7;

/** Batas maksimal POI terdekat yang dirender di peta & daftar untuk performa optimal */
export const MAX_NEARBY_POIS = 50;

/**
 * Mencari Sparks Center terdekat dari sebuah titik koordinat referensi.
 *
 * Filter ketat:
 * 1. Center harus berstatus aktif (c.active === true)
 * 2. Center harus memiliki koordinat lat & lng numerik yang valid (tidak null / NaN / infinite)
 * 3. Parameter koordinat referensi harus valid dan finite
 * 4. Jarak geografis <= radiusKm
 *
 * Pengurutan:
 * 1. distanceKm ascending (terdekat di urutan pertama)
 * 2. Secondary sort deterministik: name ascending jika jarak sama
 *
 * @param centers Daftar seluruh Center dari dataset
 * @param latitude Latitude titik referensi
 * @param longitude Longitude titik referensi
 * @param radiusKm Radius maksimum pencarian dalam km (default: 7 km)
 * @returns Array NearbyCenter yang terurut
 */
export function findNearbyCenters(
  centers: Center[],
  latitude: number,
  longitude: number,
  radiusKm: number = DEFAULT_NEARBY_RADIUS_KM
): NearbyCenter[] {
  // Validasi koordinat referensi
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    return [];
  }

  // Validasi radius pencarian
  if (
    typeof radiusKm !== 'number' ||
    !Number.isFinite(radiusKm) ||
    Number.isNaN(radiusKm) ||
    radiusKm <= 0
  ) {
    return [];
  }

  const results: NearbyCenter[] = [];

  for (const center of centers) {
    // 1. Center harus aktif
    if (!center.active) {
      continue;
    }

    // 2 & 3. Koordinat Center harus ada dan valid numerik
    if (
      center.lat == null ||
      center.lng == null ||
      typeof center.lat !== 'number' ||
      typeof center.lng !== 'number' ||
      !Number.isFinite(center.lat) ||
      !Number.isFinite(center.lng) ||
      Number.isNaN(center.lat) ||
      Number.isNaN(center.lng)
    ) {
      continue;
    }

    // Hitung jarak Haversine ke Center
    const distanceKm = calculateDistanceKm(latitude, longitude, center.lat, center.lng);

    // Filter berdasarkan radius
    if (distanceKm <= radiusKm) {
      results.push({
        ...center,
        distanceKm,
      });
    }
  }

  // Urutkan: distanceKm ascending, secondary sort by name ascending
  results.sort((a, b) => {
    const diff = a.distanceKm - b.distanceKm;
    if (Math.abs(diff) > 1e-6) {
      return diff;
    }
    return a.name.localeCompare(b.name);
  });

  return results;
}

/**
 * Mencari POI/lokasi terdekat dari sebuah titik koordinat referensi.
 *
 * Kriteria filter:
 * 1. POI harus memiliki koordinat lat & lng numerik yang valid (tidak null / NaN / infinite)
 * 2. Mengecualikan titik referensi itu sendiri jika excludeId diberikan
 * 3. Jarak geografis <= radiusKm (default 7 km)
 *
 * Pengurutan:
 * 1. distanceKm ascending (terdekat di urutan pertama)
 * 2. Secondary sort deterministik: name ascending jika jarak sama
 *
 * @param locations Daftar master seluruh lokasi dari dataset (data.locations)
 * @param latitude Latitude titik referensi
 * @param longitude Longitude titik referensi
 * @param radiusKm Radius pencarian dalam km (default: 7 km)
 * @param limit Batas maksimal hasil yang dikembalikan (0 = semua)
 * @param excludeId ID lokasi referensi yang dikecualikan dari hasil
 * @returns Array NearbyLocation yang terurut
 */
export function findNearbyLocations(
  locations: FieldLocation[],
  latitude: number,
  longitude: number,
  radiusKm: number = DEFAULT_NEARBY_RADIUS_KM,
  limit: number = MAX_NEARBY_POIS,
  excludeId?: string
): NearbyLocation[] {
  // Validasi koordinat referensi
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    return [];
  }

  // Validasi radius pencarian
  if (
    typeof radiusKm !== 'number' ||
    !Number.isFinite(radiusKm) ||
    Number.isNaN(radiusKm) ||
    radiusKm <= 0
  ) {
    return [];
  }

  const results: NearbyLocation[] = [];

  for (const loc of locations) {
    // Kecualikan lokasi referensi itu sendiri
    if (excludeId && loc.id === excludeId) {
      continue;
    }

    // Koordinat POI harus ada dan valid numerik
    if (
      loc.lat == null ||
      loc.lng == null ||
      typeof loc.lat !== 'number' ||
      typeof loc.lng !== 'number' ||
      !Number.isFinite(loc.lat) ||
      !Number.isFinite(loc.lng) ||
      Number.isNaN(loc.lat) ||
      Number.isNaN(loc.lng)
    ) {
      continue;
    }

    // Hitung jarak Haversine
    const distanceKm = calculateDistanceKm(latitude, longitude, loc.lat, loc.lng);

    // Filter berdasarkan radius
    if (distanceKm <= radiusKm) {
      results.push({
        ...loc,
        distanceKm,
      });
    }
  }

  // Urutkan: distanceKm ascending, secondary sort by name ascending
  results.sort((a, b) => {
    const diff = a.distanceKm - b.distanceKm;
    if (Math.abs(diff) > 1e-6) {
      return diff;
    }
    return a.name.localeCompare(b.name);
  });

  return limit > 0 ? results.slice(0, limit) : results;
}
