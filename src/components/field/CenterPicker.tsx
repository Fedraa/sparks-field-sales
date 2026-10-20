import React, { useMemo, useState } from 'react';
import {
  Search,
  Building2,
  X,
  ChevronRight,
  Compass,
  MapPin,
  Navigation,
} from 'lucide-react';
import type { Center, FieldLocation } from '../../data/fieldData';
import {
  findNearbyCenters,
  findNearbyLocations,
  DEFAULT_NEARBY_RADIUS_KM,
  MAX_NEARBY_POIS,
  type NearbyCenter,
  type NearbyLocation,
} from '../../lib/nearbySparks';
import { NearbySparksMap } from './NearbySparksMap';

interface Props {
  centers: Center[];
  locations?: FieldLocation[];
  counts: Map<string, number>;
  current?: string | null;
  onPick: (code: string) => void;
  onClose?: () => void;
}

type PickerMode = 'list' | 'nearby';

/**
 * Komponen pemilihan Sparks Center.
 * Mendukung 2 mode:
 * 1. 'list': Memilih langsung dari daftar Center berdasarkan region (existing).
 * 2. 'nearby': Menemukan Center terdekat & POI di sekitar lokasi patokan dari database.
 */
export const CenterPicker: React.FC<Props> = ({
  centers,
  locations = [],
  counts,
  current,
  onPick,
  onClose,
}) => {
  // Mode aktif
  const [mode, setMode] = useState<PickerMode>('list');

  // State untuk mode 'list' (existing)
  const [q, setQ] = useState('');

  // State untuk mode 'nearby'
  const [referenceQuery, setReferenceQuery] = useState('');
  const [selectedReference, setSelectedReference] = useState<FieldLocation | null>(null);

  // Grouping daftar Center berdasarkan Region (existing behavior)
  const groups = useMemo(() => {
    const list = centers
      .filter((c) => c.active)
      .filter(
        (c) =>
          !q ||
          `${c.name} ${c.code} ${c.city}`.toLowerCase().includes(q.toLowerCase())
      );
    const byRegion = new Map<string, Center[]>();
    list.forEach((c) => {
      const r = c.region || 'Lainnya';
      if (!byRegion.has(r)) byRegion.set(r, []);
      byRegion.get(r)!.push(c);
    });
    return [...byRegion.entries()];
  }, [centers, q]);

  // Pencarian lokasi patokan dari database (max 10 hasil relevan)
  const matchingLocations = useMemo(() => {
    const qClean = referenceQuery.trim().toLowerCase();
    if (!qClean || qClean.length < 2) return [];

    const candidates: { loc: FieldLocation; score: number }[] = [];

    for (const loc of locations) {
      // Syarat koordinat valid
      if (
        loc.lat == null ||
        loc.lng == null ||
        !Number.isFinite(loc.lat) ||
        !Number.isFinite(loc.lng)
      ) {
        continue;
      }

      const nameLower = loc.name.toLowerCase();
      let score = 0;

      if (nameLower.startsWith(qClean)) {
        score = 3;
      } else if (nameLower.includes(qClean)) {
        score = 2;
      } else {
        const otherText = `${loc.category} ${loc.group} ${loc.address}`.toLowerCase();
        if (otherText.includes(qClean)) {
          score = 1;
        }
      }

      if (score > 0) {
        candidates.push({ loc, score });
      }
    }

    // Urutkan relevansi: score descending, lalu nama ascending
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.loc.name.localeCompare(b.loc.name);
    });

    return candidates.slice(0, 10).map((c) => c.loc);
  }, [locations, referenceQuery]);

  // Kalkulasi Center terdekat berdasarkan koordinat lokasi patokan
  const nearbyCenters: NearbyCenter[] = useMemo(() => {
    if (
      !selectedReference ||
      selectedReference.lat == null ||
      selectedReference.lng == null ||
      !Number.isFinite(selectedReference.lat) ||
      !Number.isFinite(selectedReference.lng)
    ) {
      return [];
    }
    return findNearbyCenters(
      centers,
      selectedReference.lat,
      selectedReference.lng,
      DEFAULT_NEARBY_RADIUS_KM
    );
  }, [centers, selectedReference]);

  // Kalkulasi seluruh POI di sekitar titik referensi dalam radius 7 km
  const allNearbyLocations: NearbyLocation[] = useMemo(() => {
    if (
      !selectedReference ||
      selectedReference.lat == null ||
      selectedReference.lng == null ||
      !Number.isFinite(selectedReference.lat) ||
      !Number.isFinite(selectedReference.lng)
    ) {
      return [];
    }
    return findNearbyLocations(
      locations,
      selectedReference.lat,
      selectedReference.lng,
      DEFAULT_NEARBY_RADIUS_KM,
      0, // 0 = ambil seluruhnya untuk menghitung total
      selectedReference.id // kecualikan lokasi patokan itu sendiri
    );
  }, [locations, selectedReference]);

  // Batasi maksimal 50 POI terdekat untuk tampilan peta dan daftar
  const displayedNearbyLocations: NearbyLocation[] = useMemo(() => {
    return allNearbyLocations.slice(0, MAX_NEARBY_POIS);
  }, [allNearbyLocations]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-xl border border-[#DFEBE2] max-h-[90vh] flex flex-col">
        {/* Header Modal */}
        <div className="px-5 pt-5 pb-3 border-b border-[#EEF4EF]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-[#173020]">Pilih Sparks Center Anda</h2>
              <p className="text-xs text-[#5A7766]">
                {mode === 'list'
                  ? 'Anda hanya akan melihat lokasi yang ditugaskan ke Center ini.'
                  : 'Cari Center & POI di sekitar lokasi patokan (radius 7 km).'}
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#5A7766] hover:bg-[#F4F8F5]"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Mode Switcher Tabs */}
          <div className="mt-3.5 flex p-1 bg-[#F0F5F1] rounded-xl">
            <button
              type="button"
              onClick={() => setMode('list')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                mode === 'list'
                  ? 'bg-white text-[#173020] shadow-xs'
                  : 'text-[#5A7766] hover:text-[#173020]'
              }`}
            >
              Daftar Center
            </button>
            <button
              type="button"
              onClick={() => setMode('nearby')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'nearby'
                  ? 'bg-white text-[#173020] shadow-xs'
                  : 'text-[#5A7766] hover:text-[#173020]'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-[#254C33]" />
              <span>Cari Center Sparks Dekat Lokasi </span>
            </button>
          </div>

          {/* Search Bar untuk Mode 'list' (existing) */}
          {mode === 'list' && (
            <div className="mt-3 relative">
              <Search className="w-4 h-4 text-[#7E9787] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari Center atau kota…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5E5DA] bg-[#F8FAF8] text-sm text-[#173020] focus:outline-none focus:ring-2 focus:ring-[#3B7451]/30"
              />
            </div>
          )}

          {/* Search Bar untuk Mode 'nearby' saat belum memilih lokasi */}
          {mode === 'nearby' && !selectedReference && (
            <div className="mt-3 relative">
              <Search className="w-4 h-4 text-[#7E9787] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={referenceQuery}
                onChange={(e) => setReferenceQuery(e.target.value)}
                placeholder="Ketik nama tempat/mall patokan…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5E5DA] bg-[#F8FAF8] text-sm text-[#173020] focus:outline-none focus:ring-2 focus:ring-[#3B7451]/30"
              />
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto px-4 py-3 flex-1 min-h-[260px]">
          {/* =========================================
              MODE 1: DAFTAR CENTER EXISTING
             ========================================= */}
          {mode === 'list' && (
            <>
              {groups.length === 0 && (
                <p className="text-sm text-[#5A7766] px-2 py-6 text-center">
                  Center tidak ditemukan.
                </p>
              )}
              {groups.map(([region, list]) => (
                <div key={region} className="mb-3">
                  <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#7E9787]">
                    {region}
                  </div>
                  {list.map((c) => {
                    const n = counts.get(c.code) || 0;
                    return (
                      <button
                        key={c.code}
                        onClick={() => onPick(c.code)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[#F4F8F5] transition-colors ${
                          current === c.code ? 'bg-[#EFF6F1] ring-1 ring-[#BFE0C9]' : ''
                        }`}
                      >
                        <span className="w-9 h-9 rounded-xl bg-[#EFF6F1] text-[#254C33] text-[11px] font-extrabold flex items-center justify-center shrink-0">
                          {c.code}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-[#1E3A28] truncate">
                            {c.name.replace('Sparks Center - ', '')}
                          </span>
                          <span className="block text-[11px] text-[#5A7766]">
                            {c.city} · {n ? `${n} lokasi` : 'belum ada lokasi'}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#9AB2A2]" />
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {/* =========================================
              MODE 2: FIND SPARKS NEAR A LOCATION
             ========================================= */}
          {mode === 'nearby' && (
            <>
              {/* SUB-FLOW 2A: Pilih Lokasi Patokan */}
              {!selectedReference ? (
                <div>
                  {referenceQuery.trim().length < 2 ? (
                    <div className="py-8 px-4 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-[#E3F2E7] text-[#254C33] mx-auto flex items-center justify-center mb-3">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-[#173020]">
                        Cari Lokasi Patokan
                      </h3>
                      <p className="text-xs text-[#5A7766] mt-1 max-w-xs mx-auto">
                        Ketik minimal 2 huruf nama tempat, mall, atau jalan di database Sparks untuk mencari Center & POI di sekitarnya.
                      </p>
                    </div>
                  ) : matchingLocations.length === 0 ? (
                    <div className="py-8 px-4 text-center">
                      <p className="text-sm font-bold text-[#7A2E2E]">
                        Lokasi tidak ditemukan di database Sparks.
                      </p>
                      <p className="text-xs text-[#5A7766] mt-1 max-w-xs mx-auto">
                        Coba gunakan kata kunci yang lebih umum seperti nama mall, kawasan, atau nama jalan.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="px-1 pb-1 text-[11px] font-bold text-[#5A7766]">
                        Pilih lokasi patokan ({matchingLocations.length} hasil):
                      </div>
                      {matchingLocations.map((loc) => (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => setSelectedReference(loc)}
                          className="w-full p-2.5 rounded-xl border border-[#DCE8DE] hover:border-[#3B7451] hover:bg-[#F4F8F5] text-left transition-colors flex items-start gap-2.5"
                        >
                          <MapPin className="w-4 h-4 text-[#356B48] shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-[#173020] truncate">
                              {loc.name}
                            </div>
                            <div className="text-[11px] text-[#5A7766] truncate mt-0.5">
                              {loc.category}
                              {loc.group ? ` · ${loc.group}` : ''}
                              {loc.address ? ` · ${loc.address}` : ''}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[#9AB2A2] shrink-0 mt-0.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* SUB-FLOW 2B: Hasil Area Geografis (Peta, Center Terdekat, POI Sekitar) */
                <div>
                  {/* Summary Lokasi Patokan */}
                  <div className="mb-3.5 p-3 rounded-xl bg-[#EFF6F1] border border-[#BFE0C9] flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#254C33]">
                        Lokasi Patokan
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-[#173020] truncate mt-0.5">
                        {selectedReference.name}
                      </div>
                      {selectedReference.address && (
                        <div className="text-[11px] text-[#5A7766] truncate">
                          {selectedReference.address}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedReference(null)}
                      className="shrink-0 text-xs font-bold text-[#295637] hover:text-[#173020] px-2.5 py-1.5 rounded-lg border border-[#D5E5DA] bg-white hover:bg-[#F4F8F5] transition-colors"
                    >
                      Ganti
                    </button>
                  </div>

                  {/* Peta Visual: Lokasi Patokan + Sparks Center + POI Sekitar */}
                  <NearbySparksMap
                    referenceLocation={selectedReference}
                    nearbyCenters={nearbyCenters}
                    nearbyLocations={displayedNearbyLocations}
                    radiusKm={DEFAULT_NEARBY_RADIUS_KM}
                    selectedCenterCode={current}
                    onSelectCenter={onPick}
                  />

                  {/* =========================================
                      1. Sparks Center Terdekat
                     ========================================= */}
                  <div className="mb-4">
                    <div className="px-1 mb-2 flex items-center justify-between text-xs font-bold text-[#1E3A28]">
                      <span>
                        Sparks Center Terdekat (Radius {DEFAULT_NEARBY_RADIUS_KM} km)
                      </span>
                      <span className="text-[#5A7766] font-normal">
                        {nearbyCenters.length} ditemukan
                      </span>
                    </div>

                    {/* Empty State Jika Tidak Ada Center dalam Radius */}
                    {nearbyCenters.length === 0 ? (
                      <div className="bg-[#F8FAF8] border border-[#DFEBE2] rounded-xl p-4 text-center">
                        <p className="text-xs font-bold text-[#7A2E2E]">
                          Tidak ada Sparks Center dalam radius {DEFAULT_NEARBY_RADIUS_KM} km dari lokasi ini.
                        </p>
                        <p className="text-[11px] text-[#5A7766] mt-1 max-w-xs mx-auto">
                          Lokasi ini saat ini berada di luar jangkauan operasional Sparks Center terdekat.
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedReference(null)}
                          className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#254C33] hover:bg-[#1E3A28] text-white text-xs font-bold transition-colors"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Cari Lokasi Lain</span>
                        </button>
                      </div>
                    ) : (
                      /* Daftar Center Terdekat */
                      <div className="space-y-2">
                        {nearbyCenters.map((c) => {
                          return (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => onPick(c.code)}
                              className={`w-full p-3 rounded-xl border text-left transition-all hover:bg-[#F4F8F5] hover:border-[#3B7451] ${
                                current === c.code
                                  ? 'bg-[#EFF6F1] border-[#3B7451] ring-1 ring-[#3B7451]/30'
                                  : 'bg-white border-[#DFEBE2]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-lg bg-[#254C33] text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                                      {c.code}
                                    </span>
                                    <div className="min-w-0">
                                      <span className="block text-sm font-bold text-[#1E3A28] truncate">
                                        {c.name.replace('Sparks Center - ', '')}
                                      </span>
                                      <span className="block text-[11px] text-[#5A7766]">
                                        {c.city} · {c.region}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FEF6DC] text-[#865E0C] border border-[#F4E1A3] text-xs font-bold">
                                    <Navigation className="w-3 h-3 text-[#B87A14]" />
                                    <span>{c.distanceKm.toFixed(1)} km</span>
                                  </div>
                                </div>
                              </div>

                              {/* Info BU Available */}
                              {c.buAvailable && (
                                <div className="mt-2 pt-2 border-t border-[#F0F5F1] flex items-start gap-1.5 text-[11px]">
                                  <span className="font-bold text-[#295637] shrink-0">
                                    BU:
                                  </span>
                                  <span className="text-[#5A7766] leading-tight">
                                    {c.buAvailable}
                                  </span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* =========================================
                      2. POI di Sekitar Lokasi Patokan
                     ========================================= */}
                  <div className="mt-5 pt-4 border-t border-[#EEF4EF]">
                    <div className="px-1 mb-2.5 flex items-center justify-between text-xs font-bold text-[#1E3A28]">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#1D5D9B]" />
                        <span>POI di Sekitar Lokasi (Radius {DEFAULT_NEARBY_RADIUS_KM} km)</span>
                      </div>
                      <span className="text-[11px] font-normal text-[#5A7766]">
                        {allNearbyLocations.length > MAX_NEARBY_POIS
                          ? `Menampilkan ${displayedNearbyLocations.length} terdekat (${allNearbyLocations.length} total)`
                          : `${allNearbyLocations.length} ditemukan`}
                      </span>
                    </div>

                    {allNearbyLocations.length === 0 ? (
                      <div className="bg-[#F8FAF8] border border-[#DFEBE2] rounded-xl p-4 text-center">
                        <p className="text-xs font-bold text-[#5A7766]">
                          Tidak ada POI dalam radius {DEFAULT_NEARBY_RADIUS_KM} km dari lokasi ini.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {displayedNearbyLocations.map((loc) => (
                          <div
                            key={loc.id}
                            className="p-2.5 rounded-xl border border-[#DCE8DE] bg-[#FAFCFA] hover:bg-white transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EBF3FB] text-[#1D5D9B]">
                                    {loc.category || 'POI'}
                                  </span>
                                  {loc.rating && (
                                    <span className="text-[10px] font-bold text-[#865E0C] flex items-center gap-0.5">
                                      ★ {loc.rating.toFixed(1)}
                                      {loc.reviewCount ? ` (${loc.reviewCount})` : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-bold text-[#173020] truncate mt-1">
                                  {loc.name}
                                </div>
                                {loc.address && (
                                  <div className="text-[11px] text-[#7E9787] truncate mt-0.5">
                                    {loc.address}
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="inline-block px-2 py-0.5 rounded-lg bg-[#F0F5F1] text-[#1E3A28] text-[11px] font-bold">
                                  {loc.distanceKm.toFixed(1)} km
                                </span>
                                {loc.mapsUrl && (
                                  <div className="mt-1">
                                    <a
                                      href={loc.mapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] font-semibold text-[#1D5D9B] hover:underline"
                                    >
                                      Maps ↗
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-5 py-3 border-t border-[#EEF4EF] text-[11px] text-[#7E9787] flex items-center gap-1.5">
          {mode === 'list' ? (
            <>
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span>Center dan penugasan lokasi berasal dari sheet POI Analysis.</span>
            </>
          ) : (
            <>
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span>Jarak dihitung garis lurus (Haversine) dari koordinat lokasi patokan ke Center & POI.</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
