import React from 'react';
import { Route, ExternalLink, MapPin, Clock } from 'lucide-react';
import type { Center, FieldLocation } from '../../data/fieldData';
import { DAY_EN, routeUrl, type TodayInfo } from '../../lib/visitPlan';
import { fmt, openExternal } from './ui';

interface Props {
  center: Center;
  day: number;
  stops: { loc: FieldLocation; info: TodayInfo }[];
  onSelect: (id: string) => void;
}

/** Ordered list of the stops for today + one-click multi-stop Google Maps route. */
export const VisitPlan: React.FC<Props> = ({ center, day, stops, onSelect }) => {
  const url = routeUrl(center, stops.map((s) => s.loc));
  return (
    <section className="bg-white rounded-2xl border border-[#DCE8DE] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#EFF6F1] flex items-center justify-center">
            <Route className="w-4 h-4 text-[#356B48]" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#173020]">{DAY_EN[day]}'s visit plan</h2>
            <p className="text-[11px] text-[#5A7766]">Top-scoring locations busy today, in driving order</p>
          </div>
        </div>
      </div>

      {stops.length === 0 ? (
        <p className="mt-4 text-xs text-[#5A7766] bg-[#F4F8F5] rounded-xl px-3 py-3">
          No location has strong crowd data for {DAY_EN[day]}. Use the <b>Highest Score</b> or <b>Closest</b> view to plan,
          or check locations marked "No crowd data".
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
                    <span>Score {fmt(loc.scoreTotal)}{loc.tier ? ` · Tier ${loc.tier}` : ''}</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {loc.distanceKm !== null ? `${loc.distanceKm.toFixed(1)} km` : 'n/a'}
                    </span>
                    {info.todaySlot && (
                      <span className="inline-flex items-center gap-1 text-[#1E5A33] font-semibold">
                        <Clock className="w-3 h-3" />
                        {info.todaySlot.window} ({fmt(info.todaySlot.value)})
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {url && (
        <button
          onClick={() => openExternal(url)}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#254C33] hover:bg-[#1E3A28] text-white text-sm font-bold"
        >
          <ExternalLink className="w-4 h-4" />
          Open route in Google Maps
        </button>
      )}
      <p className="mt-2 text-[10px] text-[#8AA092] leading-snug">
        Route starts at {center.name.replace('Sparks Center - ', 'Sparks ')}. Order = nearest next stop.
      </p>
    </section>
  );
};
