import React, { useMemo, useState } from 'react';
import { Search, Building2, X, ChevronRight } from 'lucide-react';
import type { Center } from '../../data/fieldData';

interface Props {
  centers: Center[];
  counts: Map<string, number>;
  current?: string | null;
  onPick: (code: string) => void;
  onClose?: () => void;
}

/** Full-screen (mobile) / modal (desktop) picker for the sales rep's Sparks Center. */
export const CenterPicker: React.FC<Props> = ({ centers, counts, current, onPick, onClose }) => {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const list = centers
      .filter((c) => c.active)
      .filter((c) => !q || `${c.name} ${c.code} ${c.city}`.toLowerCase().includes(q.toLowerCase()));
    const byRegion = new Map<string, Center[]>();
    list.forEach((c) => {
      const r = c.region || 'Lainnya';
      if (!byRegion.has(r)) byRegion.set(r, []);
      byRegion.get(r)!.push(c);
    });
    return [...byRegion.entries()];
  }, [centers, q]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-xl border border-[#DFEBE2] max-h-[90vh] flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-[#EEF4EF]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-[#173020]">Pilih Sparks Center Anda</h2>
              <p className="text-xs text-[#5A7766]">Anda hanya akan melihat lokasi yang ditugaskan ke Center ini.</p>
            </div>
            {onClose && (
              <button onClick={onClose} className="p-1.5 rounded-lg text-[#5A7766] hover:bg-[#F4F8F5]" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="mt-3 relative">
            <Search className="w-4 h-4 text-[#7E9787] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari Center atau kota…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5E5DA] bg-[#F8FAF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B7451]/30"
            />
          </div>
        </div>
        <div className="overflow-y-auto px-3 py-3">
          {groups.length === 0 && <p className="text-sm text-[#5A7766] px-2 py-6 text-center">Center tidak ditemukan.</p>}
          {groups.map(([region, list]) => (
            <div key={region} className="mb-3">
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#7E9787]">{region}</div>
              {list.map((c) => {
                const n = counts.get(c.code) || 0;
                return (
                  <button
                    key={c.code}
                    onClick={() => onPick(c.code)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[#F4F8F5] ${
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
        </div>
        <div className="px-5 py-3 border-t border-[#EEF4EF] text-[11px] text-[#7E9787] flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" /> Center dan penugasan lokasi berasal dari sheet POI Analysis.
        </div>
      </div>
    </div>
  );
};
