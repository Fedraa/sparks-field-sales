import React from 'react';
import { CalendarCheck, CalendarClock, Ban, Info } from 'lucide-react';
import type { TodayInfo } from '../../lib/visitPlan';

export const fmt = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined ? '–' : v.toFixed(digits);

export function TierBadge({ tier }: { tier: string }) {
  if (!tier) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F1F4F2] text-[#6B7F72] border border-[#E1E8E3]">
        No tier
      </span>
    );
  }
  const style =
    tier === 'A'
      ? 'bg-[#254C33] text-white border-[#254C33]'
      : tier === 'B'
        ? 'bg-[#FEF6DC] text-[#865E0C] border-[#F4E1A3]'
        : 'bg-[#F1F4F2] text-[#5A6E61] border-[#E1E8E3]';
  const label = tier === 'A' ? 'Tier A · Priority' : tier === 'B' ? 'Tier B · Backup' : `Tier ${tier} · Later`;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${style}`}>{label}</span>;
}

export function ScoreBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-[#5A7766] font-medium truncate">{label}</span>
        <span className="font-bold text-[#1E3A28] tabular-nums">{fmt(value)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-[#E6EFE8] overflow-hidden">
        {value !== null && (
          <div
            className="h-full rounded-full bg-[#3B7451]"
            style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function StatusPill({ info, compact = false }: { info: TodayInfo; compact?: boolean }) {
  const map = {
    today: {
      cls: 'bg-[#E3F2E7] text-[#1E5A33] border-[#BFE0C9]',
      icon: <CalendarCheck className="w-3.5 h-3.5" />,
      text: 'Visit today',
    },
    otherDay: {
      cls: 'bg-[#FEF6DC] text-[#865E0C] border-[#F4E1A3]',
      icon: <CalendarClock className="w-3.5 h-3.5" />,
      text: 'Better another day',
    },
    noData: {
      cls: 'bg-[#F1F4F2] text-[#5A6E61] border-[#E1E8E3]',
      icon: <Info className="w-3.5 h-3.5" />,
      text: 'No crowd data',
    },
    closed: {
      cls: 'bg-[#FBECEC] text-[#9B3B3B] border-[#F1D2D2]',
      icon: <Ban className="w-3.5 h-3.5" />,
      text: 'Closed today',
    },
  }[info.status];
  return (
    <span
      className={`inline-flex items-center gap-1 ${compact ? 'px-1.5' : 'px-2'} py-0.5 rounded-md border text-[11px] font-bold whitespace-nowrap ${map.cls}`}
    >
      {map.icon}
      {map.text}
    </span>
  );
}

/** Opens a URL in a new tab (same robust pattern the app used before). */
export function openExternal(url: string) {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
