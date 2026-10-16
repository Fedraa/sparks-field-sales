import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Search,
  ExternalLink,
  MapPin,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Phone,
  Flame,
} from 'lucide-react';
import {
  fetchECVisits,
  parseDateSafely,
  type ECVisitRecord,
} from '../../data/ecVisitData';
import {
  normalizeLocationName,
  getVisitLocationName,
  isLeadStatus,
  isBookingStatus,
  makeLocationCenterKey,
  resolveVisitCenterCode,
} from '../../data/ecVisitReport';
import {
  type FieldLocation,
  type Center,
} from '../../data/fieldData';
import { TierBadge, openExternal } from './ui';

export interface ECReportDashboardProps {
  /**
   * Kode center yang sedang aktif/dipilih (misal 'TGC', 'MRG', 'ALL').
   */
  centerCode: string;
  /**
   * Daftar seluruh lokasi master dari dataset aplikasi (`dataset.locations`).
   */
  locations: FieldLocation[];
  /**
   * Daftar seluruh master center (`dataset.centers`), opsional.
   */
  centers?: Center[];
}

export type ECSortOption = 'leads' | 'booking' | 'latest' | 'name' | 'unvisited';

export interface LocationECStat {
  /** Referensi ke master FieldLocation */
  location: FieldLocation;
  /** Apakah lokasi ini sudah pernah tercatat memiliki kunjungan EC */
  hasReport: boolean;
  /** Total Leads kumulatif sepanjang waktu */
  totalLeads: number;
  /** Total Booking kumulatif sepanjang waktu */
  totalBooking: number;
  /** Total baris kunjungan */
  totalVisits: number;
  /** Tanggal laporan terakhir (string asli) atau null jika belum ada */
  latestDateStr: string | null;
  /** Timestamp numerik tanggal laporan terakhir (untuk sorting) */
  latestDateTime: number | null;
  /** Daftar seluruh entri kunjungan mentah di lokasi ini */
  visits: ECVisitRecord[];
}

const PAGE_SIZE = 20;

export const ECReportDashboard: React.FC<ECReportDashboardProps> = ({
  centerCode,
  locations,
  centers = [],
}) => {
  // State data kunjungan EC mentah dari /api/ec-visits
  const [allVisits, setAllVisits] = useState<ECVisitRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State Kontrol Tampilan: Pencarian, Sorting, dan Paginasi
  const [query, setQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<ECSortOption>('leads');
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // State Accordion detail riwayat per lokasi
  const [expandedLocId, setExpandedLocId] = useState<string | null>(null);

  // Fungsi memuat data kunjungan EC
  const loadVisits = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await fetchECVisits({ refresh: isRefresh });
      setAllVisits(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data kunjungan EC';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Muat data saat pertama kali komponen di-mount
  useEffect(() => {
    loadVisits(false);
  }, [loadVisits]);

  // Reset pagination saat center, search query, atau sorting berubah
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [centerCode, query, sortOption]);

  // Cari nama center yang aktif
  const currentCenterName = useMemo(() => {
    if (!centerCode || centerCode === 'ALL') return 'Semua Center';
    const found = centers.find((c) => c.code.toUpperCase() === centerCode.toUpperCase());
    if (found) return found.name;
    const loc = locations.find((l) => l.centerCode.toUpperCase() === centerCode.toUpperCase());
    return loc ? loc.centerName : centerCode;
  }, [centerCode, centers, locations]);

  // Master lokasi yang termasuk dalam center terpilih (dan relevan)
  const centerLocations = useMemo(() => {
    const isAll = !centerCode || centerCode.toUpperCase() === 'ALL';
    return locations.filter((loc) => {
      if (!loc.relevant) return false;
      if (isAll) return true;
      return loc.centerCode.toUpperCase() === centerCode.toUpperCase();
    });
  }, [locations, centerCode]);

  // Map agregasi kunjungan berdasarkan kunci gabungan (nama lokasi + kode center)
  // Menghindari tertautnya kunjungan dari center lain atau nama lokasi sama di dua center berbeda
  const visitsByLocCenterKey = useMemo(() => {
    const map = new Map<string, ECVisitRecord[]>();
    for (const v of allVisits) {
      const name = getVisitLocationName(v);
      if (!name) continue;

      const visitCenterCode = resolveVisitCenterCode(v, centers, locations);
      // Ketentuan B.4: Jangan memasukkan kunjungan yang center-nya tidak dapat diverifikasi
      if (!visitCenterCode) continue;

      const key = makeLocationCenterKey(name, visitCenterCode);
      const existing = map.get(key);
      if (existing) {
        existing.push(v);
      } else {
        map.set(key, [v]);
      }
    }
    return map;
  }, [allVisits, centers, locations]);

  // Gabungkan master lokasi dengan statistik riwayat EC yang telah diverifikasi centernya
  const leaderboardItems: LocationECStat[] = useMemo(() => {
    return centerLocations.map((loc) => {
      const key = makeLocationCenterKey(loc.name, loc.centerCode);
      const visits = visitsByLocCenterKey.get(key) || [];

      let totalLeads = 0;
      let totalBooking = 0;
      let latestDateStr: string | null = null;
      let latestDateTime: number | null = null;

      for (const v of visits) {
        for (const b of v.buEntries || []) {
          if (isLeadStatus(b.status)) totalLeads += 1;
          else if (isBookingStatus(b.status)) totalBooking += 1;
        }

        const parsed = parseDateSafely(v.timestamp);
        if (parsed) {
          const t = parsed.getTime();
          if (latestDateTime === null || t > latestDateTime) {
            latestDateTime = t;
            latestDateStr = v.timestamp;
          }
        } else if (v.timestamp && !latestDateStr) {
          latestDateStr = v.timestamp;
        }
      }

      return {
        location: loc,
        hasReport: visits.length > 0,
        totalLeads,
        totalBooking,
        totalVisits: visits.length,
        latestDateStr,
        latestDateTime,
        visits,
      };
    });
  }, [centerLocations, visitsByLocCenterKey]);

  // Filter teks pencarian (nama lokasi, alamat, kategori, group)
  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = leaderboardItems;

    if (q) {
      result = result.filter(({ location: loc }) => {
        const hay = `${loc.name} ${loc.category || ''} ${loc.group || ''} ${loc.address || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }

    // Pengurutan (Sorting)
    const sorted = [...result];
    sorted.sort((a, b) => {
      switch (sortOption) {
        case 'leads':
          // Leads terbanyak ke paling sedikit, lalu booking, lalu nama
          if (b.totalLeads !== a.totalLeads) return b.totalLeads - a.totalLeads;
          if (b.totalBooking !== a.totalBooking) return b.totalBooking - a.totalBooking;
          return a.location.name.localeCompare(b.location.name);

        case 'booking':
          // Booking terbanyak ke paling sedikit, lalu leads, lalu nama
          if (b.totalBooking !== a.totalBooking) return b.totalBooking - a.totalBooking;
          if (b.totalLeads !== a.totalLeads) return b.totalLeads - a.totalLeads;
          return a.location.name.localeCompare(b.location.name);

        case 'latest':
          // Tanggal terbaru ke terlama; belum ada laporan ditaruh di bawah
          if (a.hasReport && !b.hasReport) return -1;
          if (!a.hasReport && b.hasReport) return 1;
          const timeA = a.latestDateTime ?? 0;
          const timeB = b.latestDateTime ?? 0;
          if (timeB !== timeA) return timeB - timeA;
          return a.location.name.localeCompare(b.location.name);

        case 'name':
          // Alfabetis A-Z
          return a.location.name.localeCompare(b.location.name);

        case 'unvisited':
          // Belum ada laporan di paling atas, lalu urutkan nama A-Z
          if (!a.hasReport && b.hasReport) return -1;
          if (a.hasReport && !b.hasReport) return 1;
          return a.location.name.localeCompare(b.location.name);

        default:
          return 0;
      }
    });

    return sorted;
  }, [leaderboardItems, query, sortOption]);

  // Hitung ringkasan statistik cepat
  const summaryStats = useMemo(() => {
    let visited = 0;
    let unvisited = 0;
    let leads = 0;
    let bookings = 0;

    leaderboardItems.forEach((item) => {
      if (item.hasReport) visited += 1;
      else unvisited += 1;
      leads += item.totalLeads;
      bookings += item.totalBooking;
    });

    return { visited, unvisited, leads, bookings, total: leaderboardItems.length };
  }, [leaderboardItems]);

  const shownList = filteredList.slice(0, visibleCount);

  return (
    <div>
      {/* Kontrol Atas: Sorting, Search, dan Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        {/* Dropdown Sorting */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-[#295637]">
            Urutkan berdasarkan
          </span>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as ECSortOption)}
            className="text-xs font-bold text-[#295637] bg-white border border-[#D5E5DA] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3B7451]/30 cursor-pointer shadow-sm"
            aria-label="Urutkan Laporan EC"
          >
            <option value="leads">Total Leads Terbanyak</option>
            <option value="booking">Total Booking Terbanyak</option>
            <option value="latest">Tanggal Laporan Terbaru</option>
            <option value="unvisited">Belum Ada Laporan Teratas</option>
            <option value="name">Nama Lokasi (A-Z)</option>
          </select>
        </div>

        {/* Input Pencarian */}
        <div className="relative sm:ml-auto w-full sm:w-64">
          <Search className="w-4 h-4 text-[#7E9787] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari lokasi…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#D5E5DA] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3B7451]/30"
          />
        </div>

        {/* Tombol Perbarui Data */}
        <button
          onClick={() => loadVisits(true)}
          disabled={loading || refreshing}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#D5E5DA] bg-white text-xs font-bold text-[#295637] hover:bg-[#EFF6F1] active:bg-[#E5EFE8] transition-colors disabled:opacity-50 shadow-sm"
          title="Perbarui log kunjungan EC dari spreadsheet"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Memperbarui…' : 'Perbarui'}</span>
        </button>
      </div>

      {/* Baris Ringkasan & Subtitle */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1 text-xs text-[#5A7766]">
        <div>
          <span className="font-semibold text-[#1E3A28]">{filteredList.length} lokasi</span>
          {' · '}
          <span>{summaryStats.visited} sudah ada laporan, {summaryStats.unvisited} belum ada laporan</span>
          {' · '}
          <span className="text-[#2E7D32] font-semibold">{summaryStats.leads} leads</span>
          {' · '}
          <span className="text-[#D97706] font-semibold">{summaryStats.bookings} booking</span>
        </div>
      </div>

      {/* Banner Error jika fetch gagal */}
      {error && (
        <div className="mb-4 p-4 rounded-2xl bg-[#FDF2F2] border border-[#F8D7D7] flex items-start justify-between gap-3 text-xs sm:text-sm text-[#9B2C2C]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#E53E3E] mt-0.5" />
            <div>
              <div className="font-bold">Gagal memperbarui data kunjungan EC:</div>
              <div className="mt-0.5">{error}</div>
            </div>
          </div>
          <button
            onClick={() => loadVisits(false)}
            className="shrink-0 px-3 py-1 text-xs font-bold rounded-lg bg-white border border-[#E53E3E] text-[#9B2C2C] hover:bg-[#FDF2F2]"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* State Loading Pertama Kali */}
      {loading && (
        <div className="bg-white border border-[#DCE8DE] rounded-2xl p-8 text-center text-sm text-[#5A7766]">
          <RefreshCw className="w-5 h-5 animate-spin text-[#3B7451] mx-auto mb-2" />
          <span>Memuat data riwayat laporan EC…</span>
        </div>
      )}

      {/* State Kosong (Tidak ada lokasi yang cocok) */}
      {!loading && filteredList.length === 0 && (
        <div className="bg-white border border-[#DCE8DE] rounded-2xl p-6 text-sm text-[#5A7766]">
          {query
            ? `Tidak ada lokasi di ${currentCenterName} yang cocok dengan pencarian "${query}".`
            : `Tidak ada data lokasi yang tersedia untuk ${currentCenterName}.`}
        </div>
      )}

      {/* Daftar Kartu Lokasi (Leaderboard EC) */}
      {!loading && (
        <div className="space-y-3">
          {shownList.map((item) => {
            const { location: loc } = item;
            const isExpanded = expandedLocId === loc.id;

            return (
              <article
                key={loc.id}
                className="bg-white rounded-2xl border border-[#DCE8DE] hover:shadow-sm transition-shadow overflow-hidden"
              >
                <div className="p-4 sm:p-5">
                  {/* Row 1: Nama, Badges, Jarak */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <TierBadge tier={loc.tier} />

                        {/* Status Laporan Badge */}
                        {item.hasReport ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold whitespace-nowrap bg-[#E3F2E7] text-[#1E5A33] border-[#BFE0C9]">
                            <FileText className="w-3.5 h-3.5" />
                            Sudah Ada Laporan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold whitespace-nowrap bg-[#F1F4F2] text-[#5A6E61] border-[#E1E8E3]">
                            Belum Ada Laporan
                          </span>
                        )}
                      </div>

                      <h3 className="text-[15px] sm:text-base font-bold text-[#173020] leading-snug">
                        {loc.name}
                      </h3>

                      <p className="text-xs text-[#5A7766] mt-0.5">
                        {loc.category || 'Kategori tidak tersedia'}
                        {loc.group && loc.group !== loc.category ? ` · ${loc.group}` : ''}
                      </p>

                      {loc.address && (
                        <p className="text-xs text-[#7E9787] mt-1 line-clamp-1">
                          {loc.address}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-xs font-semibold text-[#865E0C] flex items-center justify-end gap-1 bg-[#FDF8EB] px-2.5 py-1 rounded-lg border border-[#F5E6BE]">
                        <MapPin className="w-3.5 h-3.5 text-[#B87A14]" />
                        {loc.distanceKm !== null ? `${loc.distanceKm.toFixed(1)} km` : 'Jarak t/a'}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Statistik Laporan EC & Tanggal Terakhir */}
                  <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* Statistik Leads & Booking */}
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F4F8F5] border border-[#E3EDE5] px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-[#2E7D32] shrink-0" />
                        <div>
                          <div className="text-[11px] text-[#5A7766]">Total Perolehan</div>
                          <div className="font-bold text-[#1E3A28]">
                            <span className="text-[#2E7D32] font-black">{item.totalLeads} Leads</span>
                            <span className="text-[#8DA395] mx-1.5">·</span>
                            <span className="text-[#D97706] font-black">{item.totalBooking} Booking</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-[#5A7766]">Kunjungan</div>
                        <div className="text-xs font-black text-[#173020]">
                          {item.totalVisits}x
                        </div>
                      </div>
                    </div>

                    {/* Tanggal Terakhir */}
                    <div className="flex items-center gap-2.5 rounded-xl bg-[#F4F8F5] border border-[#E3EDE5] px-3.5 py-2.5">
                      <Calendar className="w-4 h-4 text-[#356B48] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-[#5A7766]">Laporan Terakhir</div>
                        <div className="font-bold text-[#1E3A28] truncate">
                          {item.latestDateStr || 'Belum pernah dikunjungi'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Aksi (Google Maps & Accordion Detail) */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {loc.mapsUrl ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openExternal(loc.mapsUrl);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#254C33] hover:bg-[#1E3A28] text-white text-xs font-bold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Buka Google Maps
                      </button>
                    ) : (
                      <span className="inline-flex items-center px-3.5 py-2 rounded-xl bg-[#F1F4F2] text-[#8DA395] text-xs font-semibold">
                        Maps tidak tersedia
                      </span>
                    )}

                    {loc.phone && (
                      <a
                        href={`tel:${loc.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DCE8DE] bg-white hover:bg-[#EFF6F1] text-[#254C33] text-xs font-bold transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#3B7451]" />
                        {loc.phone}
                      </a>
                    )}

                    {/* Tombol Tampilkan Riwayat Kunjungan jika ada data */}
                    {item.hasReport && (
                      <button
                        onClick={() =>
                          setExpandedLocId(isExpanded ? null : loc.id)
                        }
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#295637] hover:bg-[#EFF6F1] border border-[#D5E5DA] transition-colors"
                      >
                        <span>
                          {isExpanded ? 'Tutup Riwayat' : `Riwayat Kunjungan (${item.visits.length})`}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Bagian Riwayat Kunjungan (Accordion) */}
                {isExpanded && item.visits.length > 0 && (
                  <div className="border-t border-[#DCE8DE] bg-[#F8FAF8] p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-bold text-[#254C33] flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Riwayat Kunjungan di {loc.name}</span>
                      </h4>
                      <span className="text-[11px] text-[#5A7766]">
                        {item.visits.length} laporan tercatat
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-[#DCE8DE] bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F2F7F4] text-[#446650] font-semibold border-b border-[#DCE8DE]">
                          <tr>
                            <th className="py-2 px-3 w-12 text-[#5A7766]">No</th>
                            <th className="py-2 px-3">Tanggal Kunjungan</th>
                            <th className="py-2 px-3 text-center">Leads</th>
                            <th className="py-2 px-3 text-center">Booking</th>
                            <th className="py-2 px-3 text-right">Hasil Perolehan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EEF4F0] text-[#173020]">
                          {item.visits.map((v, idx) => {
                            const rowLeads = (v.buEntries || []).filter((b) =>
                              isLeadStatus(b.status)
                            ).length;
                            const rowBooking = (v.buEntries || []).filter((b) =>
                              isBookingStatus(b.status)
                            ).length;

                            return (
                              <tr key={idx} className="hover:bg-[#FAFDFB]">
                                <td className="py-2 px-3 text-[#5A7766] font-mono text-[11px]">
                                  #{idx + 1}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-[#173020] whitespace-nowrap">
                                  {v.timestamp || '-'}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-[#2E7D32]">
                                  {rowLeads}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-[#D97706]">
                                  {rowBooking}
                                </td>
                                <td className="py-2 px-3 text-right whitespace-nowrap">
                                  <span className="text-[#2E7D32] font-bold mr-2">
                                    {rowLeads} Leads
                                  </span>
                                  <span className="text-[#D97706] font-bold">
                                    {rowBooking} Booking
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Tombol Paginasi: Tampilkan Lebih Banyak */}
      {!loading && filteredList.length > visibleCount && (
        <button
          onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
          className="mt-4 w-full px-4 py-2.5 rounded-xl border border-[#D5E5DA] bg-white text-[#295637] text-sm font-bold hover:bg-[#EFF6F1] transition-colors shadow-sm"
        >
          Tampilkan lebih banyak ({filteredList.length - visibleCount} tersisa)
        </button>
      )}
    </div>
  );
};

export default ECReportDashboard;
