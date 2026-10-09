import React from 'react';
import { Route, MapPin, Clock } from 'lucide-react';
import type { Center, FieldLocation } from '../../data/fieldData';
import { DAY_ID, type PlanDayInfo } from '../../lib/visitPlan';
import { fmt } from './ui';

interface Props {
  center: Center;
  day: number;
  stops: { loc: FieldLocation; info: PlanDayInfo }[];
  onSelect: (id: string) => void;
}

/** Ordered list of the stops for today. */
export const VisitPlan: React.FC<Props> = ({ center, day, stops, onSelect }) => {
  return (
    <section className="bg-white rounded-2xl border border-[#DCE8DE] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#EFF6F1] flex items-center justify-center">
            <Route className="w-4 h-4 text-[#356B48]" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#173020]">Rencana Kunjungan {DAY_ID[day]}</h2>
            <p className="text-[11px] text-[#5A7766]">Lokasi yang direkomendasikan untuk {DAY_ID[day]}, sesuai urutan kunjungan</p>
          </div>
        </div>
      </div>

      {stops.length === 0 ? (
        <p className="mt-4 text-xs text-[#5A7766] bg-[#F4F8F5] rounded-xl px-3 py-3">
          Tidak ada lokasi dengan data keramaian yang kuat untuk {DAY_ID[day]}. Gunakan tampilan <b>Skor Tertinggi</b> atau <b>Terdekat</b> untuk merencanakan,
          atau periksa lokasi dengan tanda "Tidak ada data keramaian".
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {stops.map(({ loc, info }, i) => (
            <li key={loc.id}>
              <button
                onClick={() => onSelect(loc.id)}
                className="w-full text-left flex items-start gap-3 rounded-xl px-2.5 py-2 hover:bg-[#F4F8F5]"
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#254C33] text-white text-[11px] font-extrabold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-[#1E3A28] truncate">{loc.name}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#5A7766]">
                    <span>Skor {fmt(loc.scoreTotal)}{loc.tier ? ` · Tier ${loc.tier}` : ''}</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {loc.distanceKm !== null ? `${loc.distanceKm.toFixed(1)} km` : 't/a'}
                    </span>
                    {info.planDaySlot && (
                      <span className="inline-flex items-center gap-1 text-[#1E5A33] font-semibold">
                        <Clock className="w-3 h-3" />
                        {info.planDaySlot.window} ({fmt(info.planDaySlot.value)})
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-2 text-[10px] text-[#8AA092] leading-snug">
        Rute dimulai dari {center.name.replace('Sparks Center - ', 'Sparks ')}. Urutan = pemberhentian terdekat berikutnya.
      </p>
    </section>
  );
};
