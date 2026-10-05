/**
 * Field Sales data layer.
 *
 * Reads the POI Analysis Google Sheet (via the server proxy /api/sheet/:tab) and joins
 * the tabs into one record per location. Nothing is re-scored here: every score, tier and
 * Popular Times value is taken as-is from the sheet. The only thing computed in the app is
 * the ranking of SKOR TOTAL *within* each center (a sort, not a new score).
 *
 * Column positions follow the sheet layout. Headers are matched by name first and fall back
 * to the known column letter, because Google's CSV export blanks header labels that sit
 * above numeric columns.
 */

export interface Center {
  code: string;
  name: string;
  city: string;
  region: string;
  lat: number | null;
  lng: number | null;
  active: boolean;
}

export interface PopularTimes {
  sat0912: number | null;
  sat1518: number | null;
  sun0912: number | null;
  sun1518: number | null;
  weekday1518: number | null;
  peakNote: string; // "Jam Puncak (catatan)", e.g. "Sabtu 19.00"
  bestDay: string; // "Hari Terbaik", e.g. "Minggu"
}

export interface FieldLocation {
  id: string;
  name: string;
  category: string; // Kategori (Maps)
  group: string; // Grup
  relevant: boolean;
  centerCode: string; // CENTER ASSIGNED (code)
  centerName: string;
  statusWilayah: string;
  distanceKm: number | null;
  lat: number | null;
  lng: number | null;
  address: string;
  hours: string;
  rating: number | null;
  reviewCount: number | null;
  phone: string;
  mapsUrl: string;
  // Scoring tab
  scoreTotal: number | null;
  trafficScore: number | null;
  familyScore: number | null;
  segmentScore: number | null;
  distanceScore: number | null;
  tier: string; // A / B / C
  globalRank: number | null;
  completeness: string;
  // Traffic tab
  popular: PopularTimes;
  // Audiens tab
  kidsFacility: string; // Y / T / ''
  segmentLabel: string; // Saran Segmen
  segmentReason: string; // Alasan Claude
  // Tactic
  tactic: string;
  // Computed in app
  rankInCenter: number | null;
  centerTotal: number;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const num = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  const s = String(v).trim().replace('%', '');
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const str = (v: string | undefined) => (v === undefined ? '' : String(v).trim());

interface Table {
  header: string[];
  rows: string[][];
  col: (names: string[], fallbackIndex: number) => number;
}

/** Find the header row (first cell equals one of `firstCells`) and build a column resolver. */
function toTable(csv: string, firstCells: string[]): Table {
  const all = parseCsv(csv);
  const wanted = firstCells.map((s) => s.toLowerCase());
  let h = all.findIndex((r) => r[0] && wanted.includes(r[0].trim().toLowerCase()));
  if (h < 0) h = 0;
  const header = (all[h] || []).map((c) => c.trim());
  const rows = all.slice(h + 1).filter((r) => r[0] && r[0].trim() !== '');
  const lower = header.map((c) => c.toLowerCase());
  const col = (names: string[], fallbackIndex: number) => {
    for (const n of names) {
      const i = lower.indexOf(n.toLowerCase());
      if (i >= 0) return i;
    }
    for (const n of names) {
      const i = lower.findIndex((c) => c && c.startsWith(n.toLowerCase()));
      if (i >= 0) return i;
    }
    return fallbackIndex;
  };
  return { header, rows, col };
}

async function fetchTab(tab: string, refresh = false): Promise<string> {
  const r = await fetch(`/api/sheet/${encodeURIComponent(tab)}${refresh ? '?refresh=1' : ''}`);
  if (!r.ok) {
    let msg = `Failed to load "${tab}" (HTTP ${r.status}).`;
    try {
      const j = await r.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return r.text();
}

// ---------------------------------------------------------------------------
// Load + join
// ---------------------------------------------------------------------------
export interface FieldDataset {
  centers: Center[];
  locations: FieldLocation[];
  loadedAt: Date;
}

export async function loadFieldData(refresh = false): Promise<FieldDataset> {
  const [centersCsv, masterCsv, scoringCsv, trafficCsv, audiensCsv, mapCsv] = await Promise.all([
    fetchTab('Centers', refresh),
    fetchTab('Master_POI', refresh),
    fetchTab('Scoring', refresh),
    fetchTab('Traffic', refresh),
    fetchTab('Audiens', refresh).catch(() => ''), // optional
    fetchTab('MAP_KATEGORI', refresh).catch(() => ''), // optional
  ]);

  // --- Centers (A Kode, B Nama Center, C Kota, D Region, E Lat, F Lng, G Aktif?)
  const ct = toTable(centersCsv, ['Kode']);
  const c = {
    code: ct.col(['Kode'], 0),
    name: ct.col(['Nama Center'], 1),
    city: ct.col(['Kota'], 2),
    region: ct.col(['Region'], 3),
    lat: ct.col(['Lat'], 4),
    lng: ct.col(['Lng'], 5),
    active: ct.col(['Aktif?', 'Aktif'], 6),
  };
  const centers: Center[] = ct.rows.map((r) => ({
    code: str(r[c.code]),
    name: str(r[c.name]),
    city: str(r[c.city]),
    region: str(r[c.region]),
    lat: num(r[c.lat]),
    lng: num(r[c.lng]),
    active: str(r[c.active]).toUpperCase() !== 'FALSE',
  }));
  const centerByName = new Map(centers.map((x) => [x.name.toLowerCase(), x]));
  const centerByCode = new Map(centers.map((x) => [x.code.toUpperCase(), x]));

  // --- Master_POI
  const mt = toTable(masterCsv, ['ID']);
  const m = {
    id: mt.col(['ID'], 0),
    name: mt.col(['Nama Lokasi'], 1),
    cat: mt.col(['Kategori (Maps)', 'Kategori'], 2),
    group: mt.col(['Grup'], 3),
    rel: mt.col(['Relevan?', 'Relevan'], 4),
    rating: mt.col(['Rating'], 6),
    reviews: mt.col(['Jumlah Review'], 7),
    hours: mt.col(['Jam Tutup/Buka'], 8),
    address: mt.col(['Alamat'], 9),
    lat: mt.col(['Lat'], 11),
    lng: mt.col(['Lng'], 12),
    nearest: mt.col(['Center Terdekat'], 13),
    nearestKm: mt.col(['Jarak ke Center Terdekat (km)'], 14),
    second: mt.col(['Center Kedua Terdekat'], 15),
    secondKm: mt.col(['Jarak ke Center Kedua (km)'], 16),
    status: mt.col(['Status Wilayah'], 17),
    assigned: mt.col(['CENTER ASSIGNED'], 19),
    link: mt.col(['Link Maps'], 21),
    phone: mt.col(['Telepon'], 23),
    tactic: mt.col(['Taktik (override)'], 25),
  };

  // --- Scoring (A ID, B Nama, C Kategori, D Traffic, E Keluarga, F Segmen, G Skor Jarak,
  //              H SKOR TOTAL, I Ranking, J Tier, K Kelengkapan, L Jarak, M CENTER ASSIGNED, N Link)
  const st = toTable(scoringCsv, ['ID']);
  const s = {
    id: st.col(['ID'], 0),
    traffic: st.col(['Traffic'], 3),
    family: st.col(['Keluarga'], 4),
    segment: st.col(['Segmen Menengah'], 5),
    distScore: st.col(['Skor Jarak'], 6),
    total: st.col(['SKOR TOTAL'], 7),
    rank: st.col(['Ranking'], 8),
    tier: st.col(['Tier'], 9),
    complete: st.col(['Kelengkapan Data'], 10),
    km: st.col(['Jarak dari Sparks (km)'], 11),
    center: st.col(['CENTER ASSIGNED'], 12),
    link: st.col(['Link Maps'], 13),
  };
  const scoring = new Map(st.rows.map((r) => [str(r[s.id]), r]));

  // --- Traffic (F..J popular slots, K Jam Puncak, L Hari Terbaik)
  const tt = toTable(trafficCsv, ['ID']);
  const t = {
    id: tt.col(['ID'], 0),
    sat0912: tt.col(['Sabtu 09–12'], 5),
    sat1518: tt.col(['Sabtu 15–18'], 6),
    sun0912: tt.col(['Minggu 09–12'], 7),
    sun1518: tt.col(['Minggu 15–18'], 8),
    wk1518: tt.col(['Weekday 15–18 (pulang sekolah)'], 9),
    peak: tt.col(['Jam Puncak (catatan)'], 10),
    best: tt.col(['Hari Terbaik'], 11),
  };
  const traffic = new Map(tt.rows.map((r) => [str(r[t.id]), r]));

  // --- Audiens (I Ada Fasilitas Anak, L Saran Segmen, O Alasan Claude)
  const audiens = new Map<string, string[]>();
  let a = { id: 0, kids: 8, segLabel: 11, reason: 14 };
  if (audiensCsv) {
    const at = toTable(audiensCsv, ['ID']);
    a = {
      id: at.col(['ID'], 0),
      kids: at.col(['Ada Fasilitas Anak? (Y/T)'], 8),
      segLabel: at.col(['Saran Segmen (review)'], 11),
      reason: at.col(['Alasan Claude'], 14),
    };
    at.rows.forEach((r) => audiens.set(str(r[a.id]), r));
  }

  // --- MAP_KATEGORI (A Grup, D Taktik default)
  const tacticByGroup = new Map<string, string>();
  if (mapCsv) {
    const kt = toTable(mapCsv, ['Grup']);
    const kg = kt.col(['Grup'], 0);
    const kd = kt.col(['Taktik default'], 3);
    kt.rows.forEach((r) => tacticByGroup.set(str(r[kg]).toLowerCase(), str(r[kd])));
  }

  const locations: FieldLocation[] = [];
  for (const r of mt.rows) {
    const id = str(r[m.id]);
    if (!/^P\d+/i.test(id)) continue;
    const sr = scoring.get(id);
    const tr = traffic.get(id);
    const ar = audiens.get(id);

    // Center: CENTER ASSIGNED in Master (code). Fall back to the Scoring tab (center name).
    let centerCode = str(r[m.assigned]).toUpperCase();
    let centerObj = centerByCode.get(centerCode);
    if (!centerObj && sr) {
      centerObj = centerByName.get(str(sr[s.center]).toLowerCase());
      centerCode = centerObj?.code || centerCode;
    }
    const centerName = centerObj?.name || str(sr?.[s.center]) || centerCode;

    // Distance to the ASSIGNED center: Scoring "Jarak dari Sparks (km)", else Master when assigned = nearest/second.
    let distanceKm = sr ? num(sr[s.km]) : null;
    if (distanceKm === null && centerObj) {
      const nm = str(r[m.nearest]).toLowerCase();
      const sc = str(r[m.second]).toLowerCase();
      if (nm === centerObj.name.toLowerCase()) distanceKm = num(r[m.nearestKm]);
      else if (sc === centerObj.name.toLowerCase()) distanceKm = num(r[m.secondKm]);
    }

    const group = str(r[m.group]);
    locations.push({
      id,
      name: str(r[m.name]),
      category: str(r[m.cat]),
      group,
      relevant: str(r[m.rel]).toLowerCase() === 'ya',
      centerCode,
      centerName,
      statusWilayah: str(r[m.status]),
      distanceKm,
      lat: num(r[m.lat]),
      lng: num(r[m.lng]),
      address: str(r[m.address]),
      hours: str(r[m.hours]),
      rating: num(r[m.rating]),
      reviewCount: num(r[m.reviews]),
      phone: str(r[m.phone]),
      mapsUrl: str(r[m.link]) || str(sr?.[s.link]),
      scoreTotal: sr ? num(sr[s.total]) : null,
      trafficScore: sr ? num(sr[s.traffic]) : null,
      familyScore: sr ? num(sr[s.family]) : null,
      segmentScore: sr ? num(sr[s.segment]) : null,
      distanceScore: sr ? num(sr[s.distScore]) : null,
      tier: sr ? str(sr[s.tier]).toUpperCase() : '',
      globalRank: sr ? num(sr[s.rank]) : null,
      completeness: sr ? str(sr[s.complete]) : '',
      popular: {
        sat0912: tr ? num(tr[t.sat0912]) : null,
        sat1518: tr ? num(tr[t.sat1518]) : null,
        sun0912: tr ? num(tr[t.sun0912]) : null,
        sun1518: tr ? num(tr[t.sun1518]) : null,
        weekday1518: tr ? num(tr[t.wk1518]) : null,
        peakNote: tr ? str(tr[t.peak]) : '',
        bestDay: tr ? str(tr[t.best]) : '',
      },
      kidsFacility: ar ? str(ar[a.kids]).toUpperCase() : '',
      segmentLabel: ar ? str(ar[a.segLabel]) : '',
      segmentReason: ar ? str(ar[a.reason]) : '',
      tactic: str(r[m.tactic]) || tacticByGroup.get(group.toLowerCase()) || '',
      rankInCenter: null,
      centerTotal: 0,
    });
  }

  // Rank SKOR TOTAL within each center (relevant locations only).
  const byCenter = new Map<string, FieldLocation[]>();
  for (const l of locations) {
    if (!l.relevant || !l.centerCode) continue;
    if (!byCenter.has(l.centerCode)) byCenter.set(l.centerCode, []);
    byCenter.get(l.centerCode)!.push(l);
  }
  for (const list of byCenter.values()) {
    const scored = list.filter((l) => l.scoreTotal !== null).sort((x, y) => y.scoreTotal! - x.scoreTotal!);
    scored.forEach((l, i) => {
      // ties share the same rank
      l.rankInCenter = i > 0 && scored[i - 1].scoreTotal === l.scoreTotal ? scored[i - 1].rankInCenter : i + 1;
    });
    list.forEach((l) => (l.centerTotal = scored.length));
  }

  return { centers, locations, loadedAt: new Date() };
}
