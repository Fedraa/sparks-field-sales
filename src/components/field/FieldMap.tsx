import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Center, FieldLocation } from '../../data/fieldData';
import type { TodayStatus } from '../../lib/visitPlan';

interface Props {
  center: Center;
  items: { loc: FieldLocation; status: TodayStatus }[];
  planIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const COLORS: Record<TodayStatus, string> = {
  today: '#2E7D4F',
  otherDay: '#C4951B',
  noData: '#8FA597',
  closed: '#B85C5C',
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Compact map: center + the locations currently listed. Plan stops are numbered. */
export const FieldMap: React.FC<Props> = ({ center, items, planIds, selectedId, onSelect }) => {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitKey = useRef('');

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // The map can start hidden (mobile "Show map" toggle) – recalc size when it becomes visible.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => m.invalidateSize()) : null;
    ro?.observe(box.current);
    return () => {
      ro?.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g || center.lat === null || center.lng === null) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [[center.lat, center.lng]];

    L.marker([center.lat, center.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:30px;height:30px;border-radius:9999px;background:#234932;border:3px solid #FDF099;box-shadow:0 3px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800">${esc(center.code)}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
      zIndexOffset: 1000,
    })
      .bindTooltip(esc(center.name))
      .addTo(g);

    items.slice(0, 300).forEach(({ loc, status }) => {
      if (loc.lat === null || loc.lng === null) return;
      const planNo = planIds.indexOf(loc.id);
      const sel = loc.id === selectedId;
      const size = planNo >= 0 || sel ? 24 : 14;
      const html =
        planNo >= 0
          ? `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:#254C33;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center">${planNo + 1}</div>`
          : `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${COLORS[status]};border:2px solid ${sel ? '#173020' : '#fff'};box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>`;
      L.marker([loc.lat, loc.lng], {
        icon: L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
        zIndexOffset: planNo >= 0 ? 500 : sel ? 400 : 0,
      })
        .bindTooltip(esc(loc.name))
        .on('click', () => onSelect(loc.id))
        .addTo(g);
      pts.push([loc.lat, loc.lng]);
    });

    // Re-fit only when the center or the listed set changes (not on every selection).
    const key = `${center.code}|${items.length}|${items[0]?.loc.id || ''}|${planIds.join(',')}`;
    if (key !== fitKey.current) {
      fitKey.current = key;
      if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [24, 24], maxZoom: 15 });
      else m.setView([center.lat, center.lng], 13);
    }
  }, [center, items, planIds, selectedId, onSelect]);

  return (
    <div className="bg-white rounded-2xl border border-[#DCE8DE] overflow-hidden">
      <div ref={box} className="h-64 lg:h-72 w-full" />
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 text-[10px] text-[#5A7766] border-t border-[#EEF4EF]">
        <Legend color="#254C33" label="Today's plan" />
        <Legend color={COLORS.today} label="Visit today" />
        <Legend color={COLORS.otherDay} label="Another day" />
        <Legend color={COLORS.noData} label="No crowd data" />
        <Legend color={COLORS.closed} label="Closed today" />
      </div>
    </div>
  );
};

const Legend = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1">
    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
    {label}
  </span>
);
