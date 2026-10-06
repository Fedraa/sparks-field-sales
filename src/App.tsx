import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  MapPin,
  ChevronDown,
  RefreshCw,
  Search,
  CalendarCheck,
  Trophy,
  Navigation,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { loadFieldData, type FieldDataset } from './data/fieldData';
import { DAY_EN, orderRoute, todayInfo } from './lib/visitPlan';
import { CenterPicker } from './components/field/CenterPicker';
import { LocationCard } from './components/field/LocationCard';
import { VisitPlan } from './components/field/VisitPlan';

type View = 'best' | 'closest' | 'score';
const PLAN_SIZE = 5;
const PAGE = 20;
const CENTER_KEY = 'sparks.fieldSales.center';

const storage = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable – selection just won't be remembered */
    }
  },
};

const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'best', label: 'Best for Day', icon: <CalendarCheck className="w-3.5 h-3.5" /> },
  { id: 'closest', label: 'Closest', icon: <Navigation className="w-3.5 h-3.5" /> },
  { id: 'score', label: 'Highest Score', icon: <Trophy className="w-3.5 h-3.5" /> },
];

const byScore = (a: { scoreTotal: number | null }, b: { scoreTotal: number | null }) =>
  (b.scoreTotal ?? -1) - (a.scoreTotal ?? -1);
const byDistance = (a: { distanceKm: number | null }, b: { distanceKm: number | null }) =>
  (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);

export default function App() {
  const [data, setData] = useState<FieldDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [centerCode, setCenterCode] = useState<string | null>(() => storage.get(CENTER_KEY));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [day, setDay] = useState<number>(() => new Date().getDay());
  const [view, setView] = useState<View>('best');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);

  const todayIdx = new Date().getDay();

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadFieldData(refresh));
    } catch (e: any) {
      setError(e?.message || 'Could not load location data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Location counts per center (relevant locations only) for the picker.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    data?.locations.forEach((l) => {
      if (l.relevant) m.set(l.centerCode, (m.get(l.centerCode) || 0) + 1);
    });
    return m;
  }, [data]);

  const center = useMemo(
    () => data?.centers.find((c) => c.code === centerCode) || null,
    [data, centerCode]
  );

  // Open the picker when no (valid) center is selected yet.
  useEffect(() => {
    if (data && !center) setPickerOpen(true);
  }, [data, center]);

  const pickCenter = (code: string) => {
    setCenterCode(code);
    storage.set(CENTER_KEY, code);
    setPickerOpen(false);
    setSelectedId(null);
    setVisible(PAGE);
    setView('best');
    setQuery('');
  };

  // All relevant locations of this center + today's status.
  const items = useMemo(() => {
    if (!data || !center) return [];
    return data.locations
      .filter((l) => l.relevant && l.centerCode === center.code)
      .map((loc) => ({ loc, info: todayInfo(loc, day) }));
  }, [data, center, day]);

  const stats = useMemo(() => {
    const s = { recommended: 0, otherDay: 0, noData: 0, closed: 0, tierA: 0 };
    items.forEach(({ loc, info }) => {
      s[info.status]++;
      if (loc.tier === 'A') s.tierA++;
    });
    return s;
  }, [items]);

  // Today's plan: top-scoring locations that are busy today, in nearest-next order.
  const plan = useMemo(() => {
    if (!center) return [];
    const top = items
      .filter((x) => x.info.status === 'recommended' && x.loc.scoreTotal !== null)
      .sort((a, b) => byScore(a.loc, b.loc))
      .slice(0, PLAN_SIZE);
    const ordered = orderRoute(center, top.map((x) => x.loc));
    return ordered.map((loc) => top.find((x) => x.loc.id === loc.id)!);
  }, [items, center]);
  const planIds = useMemo(() => plan.map((p) => p.loc.id), [plan]);

  // List for the selected view + search.
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = items.filter(
      ({ loc }) =>
        !q || `${loc.name} ${loc.category} ${loc.group} ${loc.address}`.toLowerCase().includes(q)
    );
    switch (view) {
      case 'best':
        arr = arr.filter((x) => x.info.status === 'recommended').sort((a, b) => byScore(a.loc, b.loc));
        break;
      case 'closest':
        arr = [...arr].sort((a, b) => byDistance(a.loc, b.loc));
        break;
      case 'score':
        arr = [...arr].sort((a, b) => byScore(a.loc, b.loc));
        break;
    }
    return arr;
  }, [items, view, query]);

  useEffect(() => setVisible(PAGE), [view, query, day, centerCode]);

  const selectFromPlanOrMap = useCallback((id: string) => {
    setSelectedId(id);
    // the card is rendered (pinned on top if outside the current list), then scrolled into view
    setTimeout(() => document.getElementById(`loc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }, []);

  // If the selected location is not in the current list, show it at the top so the scroll target exists.
  const shown = useMemo(() => {
    const base = list.slice(0, visible);
    if (selectedId && !base.some((x) => x.loc.id === selectedId)) {
      const extra = items.find((x) => x.loc.id === selectedId);
      if (extra) return [extra, ...base];
    }
    return base;
  }, [list, visible, selectedId, items]);

  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen bg-[#F7F9F6] text-[#1E2E24] flex flex-col selection:bg-[#D5EADB] selection:text-[#183622]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#DCE8DE]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#316041] to-[#20452E] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#FDF099]" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <div className="text-base font-extrabold text-[#173020] leading-tight">Sparks Field Sales</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#63806F]">Where to go today</div>
          </div>

          <button
            onClick={() => setPickerOpen(true)}
            disabled={!data}
            className="ml-auto sm:ml-4 flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-[#D5E5DA] bg-[#F4F8F5] hover:bg-[#EFF6F1] min-w-0 disabled:opacity-60"
          >
            <span className="w-7 h-7 rounded-lg bg-[#254C33] text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
              {center?.code || <MapPin className="w-3.5 h-3.5" />}
            </span>
            <span className="text-left min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[#6B8574] leading-none">Your center</span>
              <span className="block text-sm font-bold text-[#1E3A28] truncate max-w-[42vw] sm:max-w-[260px]">
                {center ? center.name.replace('Sparks Center - ', '') : 'Select center'}
              </span>
            </span>
            <ChevronDown className="w-4 h-4 text-[#5A7766] shrink-0" />
          </button>

          <div className="hidden md:flex items-center gap-2 ml-auto">
            <label className="text-[11px] font-semibold text-[#5A7766]" htmlFor="day">
              Plan for
            </label>
            <select
              id="day"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="text-sm font-semibold text-[#1E3A28] bg-white border border-[#D5E5DA] rounded-lg px-2 py-1.5"
            >
              {DAY_EN.map((d, i) => (
                <option key={d} value={i}>
                  {i === todayIdx ? `Today (${d})` : d}
                </option>
              ))}
            </select>
            <button
              onClick={() => load(true)}
              title="Reload data from the sheet"
              className="p-2 rounded-lg border border-[#D5E5DA] text-[#356B48] hover:bg-[#EFF6F1]"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Loading / error */}
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-24 text-[#5A7766]">
            <Loader2 className="w-7 h-7 animate-spin text-[#356B48]" />
            <p className="mt-3 text-sm">Loading locations from the POI sheet…</p>
          </div>
        )}
        {error && (
          <div className="max-w-xl mx-auto mt-10 bg-white border border-[#F1D2D2] rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#B85C5C] shrink-0 mt-0.5" />
              <div>
                <h2 className="font-bold text-[#7A2E2E]">Couldn't load location data</h2>
                <p className="text-sm text-[#5A4A4A] mt-1">{error}</p>
                <button
                  onClick={() => load(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#254C33] text-white text-xs font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {data && center && (
          <>
            {/* Title + day (mobile) */}
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold text-[#5A7766]">{dateLabel}</p>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#173020]">
                  Best locations for {DAY_EN[day]} near{' '}
                  {center.name.replace('Sparks Center - ', '')}
                </h1>
              </div>
              <div className="md:hidden flex items-center gap-2">
                <select
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value))}
                  className="text-sm font-semibold bg-white border border-[#D5E5DA] rounded-lg px-2 py-1.5"
                >
                  {DAY_EN.map((d, i) => (
                    <option key={d} value={i}>
                      {i === todayIdx ? `Today (${d})` : d}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => load(true)}
                  className="p-2 rounded-lg border border-[#D5E5DA] bg-white text-[#356B48]"
                  aria-label="Reload data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
              <Stat label="Best for day" value={stats.recommended} accent onClick={() => setView('best')} />
              <Stat label="Tier A locations" value={stats.tierA} onClick={() => setView('score')} />
              <Stat label="Better another day" value={stats.otherDay} onClick={() => setView('score')} />
              <Stat label="All locations" value={items.length} sub={`${stats.noData} without crowd data`} onClick={() => setView('score')} />
            </div>

            {items.length === 0 ? (
              <div className="bg-white border border-[#DCE8DE] rounded-2xl p-8 text-center text-sm text-[#5A7766]">
                No relevant locations are assigned to this center yet in the POI sheet.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-5 items-start">
                {/* Left: plan */}
                <aside className="space-y-4 lg:sticky lg:top-20">
                  <VisitPlan center={center} day={day} stops={plan} onSelect={selectFromPlanOrMap} />
                </aside>

                {/* Right: filters + list */}
                <section className="min-w-0">
                  <div className="bg-white rounded-2xl border border-[#DCE8DE] p-2 sm:p-3 mb-3 flex flex-col sm:flex-row gap-2 sm:items-center">
                    <div className="flex gap-1.5 overflow-x-auto -mx-0.5 px-0.5 pb-0.5">
                      {VIEWS.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setView(v.id)}
                          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                            view === v.id
                              ? 'bg-[#254C33] text-white border-[#254C33]'
                              : 'bg-white text-[#295637] border-[#D5E5DA] hover:bg-[#EFF6F1]'
                          }`}
                        >
                          {v.icon}
                          {v.label}
                        </button>
                      ))}
                    </div>
                    <div className="relative sm:ml-auto sm:w-64">
                      <Search className="w-4 h-4 text-[#7E9787] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search location…"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#D5E5DA] bg-[#F8FAF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B7451]/30"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-[#5A7766] mb-3 px-1">
                    {list.length} location{list.length === 1 ? '' : 's'}
                    {view === 'best' && ` with strong crowd data for ${DAY_EN[day]} (Popular Times ≥ 50 or busiest day)`}
                    {view === 'closest' && ' sorted by distance from the center'}
                    {view === 'score' && ' sorted by total score'}
                  </p>

                  {list.length === 0 && (
                    <div className="bg-white border border-[#DCE8DE] rounded-2xl p-6 text-sm text-[#5A7766]">
                      {view === 'best'
                        ? `No location has strong crowd data for ${DAY_EN[day]}. Try "Highest Score" or "Closest".`
                        : 'No locations match this filter.'}
                    </div>
                  )}

                  <div className="space-y-3">
                    {shown.map(({ loc, info }) => (
                      <div id={`loc-${loc.id}`} key={loc.id}>
                        <LocationCard
                          loc={loc}
                          info={info}
                          day={day}
                          selected={selectedId === loc.id}
                          onSelect={setSelectedId}
                        />
                      </div>
                    ))}
                  </div>

                  {list.length > visible && (
                    <button
                      onClick={() => setVisible((v) => v + PAGE)}
                      className="mt-4 w-full px-4 py-2.5 rounded-xl border border-[#D5E5DA] bg-white text-[#295637] text-sm font-bold hover:bg-[#EFF6F1]"
                    >
                      Show more ({list.length - visible} remaining)
                    </button>
                  )}
                </section>
              </div>
            )}

            <p className="mt-8 text-[11px] text-[#8AA092] text-center">
              Scores, tiers and crowd data come from the POI Analysis sheet · loaded{' '}
              {data.loadedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </>
        )}
      </main>

      {pickerOpen && data && (
        <CenterPicker
          centers={data.centers}
          counts={counts}
          current={centerCode}
          onPick={pickCenter}
          onClose={center ? () => setPickerOpen(false) : undefined}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
        accent
          ? 'bg-[#254C33] border-[#254C33] text-white hover:bg-[#1E3A28]'
          : 'bg-white border-[#DCE8DE] hover:bg-[#F4F8F5]'
      }`}
    >
      <div className={`text-[11px] font-semibold ${accent ? 'text-[#CFE6D6]' : 'text-[#5A7766]'}`}>{label}</div>
      <div className={`text-2xl font-extrabold tabular-nums ${accent ? 'text-white' : 'text-[#173020]'}`}>{value}</div>
      {sub && <div className={`text-[10px] ${accent ? 'text-[#CFE6D6]' : 'text-[#8AA092]'}`}>{sub}</div>}
    </button>
  );
}
