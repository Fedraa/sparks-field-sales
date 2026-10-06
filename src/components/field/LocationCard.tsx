import React, { useState } from 'react';
import {
  MapPin,
  ExternalLink,
  Clock,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Phone,
  Star,
  Lightbulb,
} from 'lucide-react';
import type { FieldLocation } from '../../data/fieldData';
import { allSlots, DAY_EN, whyRecommended, type TodayInfo } from '../../lib/visitPlan';
import { ScoreBar, StatusPill, TierBadge, fmt, openExternal } from './ui';

interface Props {
  loc: FieldLocation;
  info: TodayInfo;
  day: number;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export const LocationCard: React.FC<Props> = ({ loc, info, day, selected, onSelect }) => {
  const [open, setOpen] = useState(false);
  const why = whyRecommended(loc, info, day);

  const timeLine =
    info.status === 'today' && info.todaySlot
      ? `Today ${info.todaySlot.window}`
      : info.bestSlot
        ? info.bestSlot.label
        : null;

  return (
    <article
      onClick={() => onSelect?.(loc.id)}
      className={`bg-white rounded-2xl border transition-shadow ${
        selected ? 'border-[#3B7451] shadow-md ring-2 ring-[#3B7451]/15' : 'border-[#DCE8DE] hover:shadow-sm'
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Row 1: name / badges / distance */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <TierBadge tier={loc.tier} />
              <StatusPill info={info} />
            </div>
            <h3 className="text-[15px] sm:text-base font-bold text-[#173020] leading-snug">{loc.name}</h3>
            <p className="text-xs text-[#5A7766] mt-0.5">
              {loc.category || 'Category not available'}
              {loc.group && loc.group !== loc.category ? ` · ${loc.group}` : ''}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-xs font-semibold text-[#865E0C] flex items-center justify-end gap-1 bg-[#FDF8EB] px-2.5 py-1 rounded-lg border border-[#F5E6BE]">
              <MapPin className="w-3.5 h-3.5 text-[#B87A14]" />
              {loc.distanceKm !== null ? `${loc.distanceKm.toFixed(1)} km` : 'Distance n/a'}
            </div>
          </div>
        </div>

        {/* Row 2: when to go */}
        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-start gap-2 rounded-xl bg-[#F4F8F5] border border-[#E3EDE5] px-3 py-2">
            <CalendarDays className="w-4 h-4 text-[#356B48] shrink-0 mt-0.5" />
            <div>
              <div className="text-[#5A7766]">Best day</div>
              <div className="font-bold text-[#1E3A28]">{loc.popular.bestDay || 'No data'}</div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-[#F4F8F5] border border-[#E3EDE5] px-3 py-2">
            <Clock className="w-4 h-4 text-[#356B48] shrink-0 mt-0.5" />
            <div>
              <div className="text-[#5A7766]">Best time · Peak hour</div>
              <div className="font-bold text-[#1E3A28]">
                {timeLine || 'No data'}
                <span className="font-medium text-[#5A7766]"> · Peak {loc.popular.peakNote || 'n/a'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {loc.mapsUrl ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openExternal(loc.mapsUrl);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#254C33] hover:bg-[#1E3A28] text-white text-xs font-bold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Google Maps
            </button>
          ) : (
            <span className="text-xs text-[#8AA092]">Maps link not available</span>
          )}
          {loc.phone && (
            <a
              href={`tel:${loc.phone.replace(/[^\d+]/g, '')}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D5E5DA] text-[#295637] text-xs font-bold hover:bg-[#EFF6F1]"
            >
              <Phone className="w-3.5 h-3.5" />
              Call
            </a>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-[#3B6A4B] text-xs font-semibold hover:bg-[#EFF6F1]"
          >
            {open ? 'Less' : 'Details'}
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[#EEF4EF] px-4 sm:px-5 py-4 text-xs text-[#2F4939] space-y-3.5 bg-[#FBFCFB] rounded-b-2xl">
          {/* Why recommended */}
          {why.length > 0 && (
            <div className="p-3 rounded-xl bg-[#F4F8F5] border border-[#E3EDE5] text-[13px] text-[#2F4939] leading-relaxed">
              <span className="font-bold text-[#1E3A28]">Why recommended: </span>
              {why.join(' ')}
            </div>
          )}

          {/* Pillar scores */}
          <div>
            <div className="font-bold text-[#1E3A28] mb-1.5">Scoring Breakdown</div>
            <div className="grid grid-cols-3 gap-3">
              <ScoreBar label="Traffic" value={loc.trafficScore} />
              <ScoreBar label="Family" value={loc.familyScore} />
              <ScoreBar label="Middle segment" value={loc.segmentScore} />
            </div>
          </div>

          {/* Popular times */}
          <div>
            <div className="font-bold text-[#1E3A28] mb-1.5">Crowd level by time slot (Google Popular Times, 0–100)</div>
            <div className="grid grid-cols-5 gap-1.5">
              {allSlots(loc).map((s) => {
                const isToday = s.day === day || (s.day === -1 && day >= 1 && day <= 5);
                return (
                  <div
                    key={s.label}
                    className={`rounded-lg border px-1.5 py-1.5 text-center ${
                      isToday ? 'border-[#3B7451] bg-[#EFF6F1]' : 'border-[#E3EDE5] bg-white'
                    }`}
                  >
                    <div className="text-[10px] text-[#5A7766] leading-tight">{s.label}</div>
                    <div className="font-extrabold text-[#1E3A28] tabular-nums">{fmt(s.value)}</div>
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-[#8AA092]">
              Weekday data covers 15–18 only (after-school hours). Highlighted = today ({DAY_EN[day]}).
            </p>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <dt className="text-[#5A7766]">Opening hours today</dt>
              <dd className="font-semibold">
                {info.hoursToday ? (info.hoursToday.closed ? 'Closed' : info.hoursToday.text) : 'Not available'}
              </dd>
            </div>
            <div>
              <dt className="text-[#5A7766]">Google rating</dt>
              <dd className="font-semibold flex items-center gap-1">
                {loc.rating !== null ? (
                  <>
                    <Star className="w-3 h-3 text-[#C4951B]" />
                    {loc.rating.toFixed(1)} · {loc.reviewCount !== null ? `${loc.reviewCount.toLocaleString('id-ID')} reviews` : 'review count n/a'}
                  </>
                ) : (
                  'Not available'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[#5A7766]">Area status</dt>
              <dd className="font-semibold">{loc.statusWilayah || 'Not available'}</dd>
            </div>
            <div>
              <dt className="text-[#5A7766]">Kids facilities</dt>
              <dd className="font-semibold">
                {loc.kidsFacility === 'Y' ? 'Yes' : loc.kidsFacility === 'T' ? 'No' : 'Not assessed'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[#5A7766]">Address</dt>
              <dd className="font-semibold">{loc.address || 'Not available'}</dd>
            </div>
            {loc.segmentReason && (
              <div className="sm:col-span-2">
                <dt className="text-[#5A7766]">Segment notes{loc.segmentLabel ? ` (${loc.segmentLabel})` : ''}</dt>
                <dd>{loc.segmentReason}</dd>
              </div>
            )}
          </dl>

          {loc.tactic && (
            <div className="flex items-start gap-2 rounded-xl bg-[#FEF9E8] border border-[#F4E1A3] px-3 py-2">
              <Lightbulb className="w-4 h-4 text-[#C4951B] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-[#865E0C]">Suggested approach</div>
                <div className="text-[#5B4511]">{loc.tactic}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
};
