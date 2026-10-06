/**
 * "Today" logic for the Field Sales Planner.
 *
 * Uses only data already in the sheet:
 *  - Popular Times slots (Traffic tab): Sat 09–12, Sat 15–18, Sun 09–12, Sun 15–18, Weekday 15–18
 *  - Hari Terbaik & Jam Puncak (Traffic tab)
 *  - Opening hours text (Master_POI "Jam Tutup/Buka")
 * Nothing is estimated: if a slot has no data, the UI says so.
 */
import type { FieldLocation } from '../data/fieldData';

export const DAY_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']; // JS getDay() order
export const DAY_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Popular Times value (0–100) at/above which a slot counts as "strong traffic". */
export const STRONG_TRAFFIC = 50;

export interface Slot {
  label: string; // e.g. "Sat 15–18"
  day: number; // 0..6, or -1 for "Mon–Fri"
  window: string; // "09–12"
  value: number | null;
}

export function allSlots(l: FieldLocation): Slot[] {
  const p = l.popular;
  return [
    { label: 'Sat 09–12', day: 6, window: '09–12', value: p.sat0912 },
    { label: 'Sat 15–18', day: 6, window: '15–18', value: p.sat1518 },
    { label: 'Sun 09–12', day: 0, window: '09–12', value: p.sun0912 },
    { label: 'Sun 15–18', day: 0, window: '15–18', value: p.sun1518 },
    { label: 'Mon–Fri 15–18', day: -1, window: '15–18', value: p.weekday1518 },
  ];
}

export function slotsForDay(l: FieldLocation, day: number): Slot[] {
  return allSlots(l).filter((s) => (day === 0 || day === 6 ? s.day === day : s.day === -1));
}

export function hasPopularTimes(l: FieldLocation): boolean {
  return allSlots(l).some((s) => s.value !== null);
}

/** Opening hours for a given day. Returns null if hours are unknown. */
export function hoursForDay(hours: string, day: number): { text: string; closed: boolean } | null {
  const h = (hours || '').trim();
  if (!h) return null;
  if (/^setiap hari/i.test(h)) {
    const text = h.replace(/^setiap hari\s*/i, '');
    return { text, closed: /tutup|closed/i.test(text) };
  }
  // Format from the notebook: "Sab 9.00–18.00 | Min 9.00–18.00 | Sen–Jum 10.00–17.30"
  const parts = h.split('|').map((x) => x.trim());
  const key = day === 6 ? /^sab/i : day === 0 ? /^min/i : /^sen/i;
  const part = parts.find((x) => key.test(x));
  if (!part) return null;
  const text = part.replace(/^(sab|min|sen–jum|sen-jum)\s*/i, '');
  return { text, closed: /tutup|closed/i.test(text) };
}

export type PlanDayStatus = 'recommended' | 'otherDay' | 'noData' | 'closed';

export interface PlanDayInfo {
  status: PlanDayStatus;
  planDaySlot: Slot | null; // strongest slot today (with data)
  bestSlot: Slot | null; // strongest slot of the week (with data)
  hoursForPlanDay: { text: string; closed: boolean } | null;
  isBestDay: boolean;
}

export function planDayInfo(l: FieldLocation, day: number): PlanDayInfo {
  const hoursForPlanDay = hoursForDay(l.hours, day);
  const withData = allSlots(l).filter((s) => s.value !== null);
  const bestSlot = withData.length ? withData.reduce((a, b) => (b.value! > a.value! ? b : a)) : null;
  const planDaySlots = slotsForDay(l, day).filter((s) => s.value !== null);
  const planDaySlot = today.length ? today.reduce((a, b) => (b.value! > a.value! ? b : a)) : null;
  const isBestDay = !!l.popular.bestDay && l.popular.bestDay.toLowerCase() === DAY_ID[day].toLowerCase();

  let status: PlanDayStatus;
  if (hoursForPlanDay?.closed) status = 'closed';
  else if (!withData.length) status = 'noData';
  else if ((planDaySlot && planDaySlot.value! >= STRONG_TRAFFIC) || isBestDay) status = 'recommended';
  else status = 'otherDay';
  return { status, planDaySlot, bestSlot, hoursForPlanDay, isBestDay };
}

const fmt = (v: number | null) => (v === null ? '–' : Math.round(v).toString());

/** Short, data-based explanation of why the location is recommended. */
export function whyRecommended(l: FieldLocation, info: PlanDayInfo, day: number): string[] {
  const out: string[] = [];
  if (l.rankInCenter !== null && l.scoreTotal !== null) {
    out.push(
      `Ranked #${l.rankInCenter} of ${l.centerTotal} in ${l.centerCode} with a total score of ${fmt(l.scoreTotal)}` +
        (l.tier ? ` (Tier ${l.tier})` : '') +
        '.'
    );
  }
  const pillars: [string, number | null][] = [
    ['traffic', l.trafficScore],
    ['family fit', l.familyScore],
    ['middle-segment fit', l.segmentScore],
  ];
  const strong = pillars.filter(([, v]) => v !== null && v >= 75).map(([k, v]) => `${k} ${fmt(v)}`);
  if (strong.length) out.push(`Strong ${strong.join(', ')}.`);
  if (info.status === 'recommended' && info.planDaySlot) {
    out.push(`Busy on ${DAY_ID[day]} ${info.planDaySlot.window} (${fmt(info.planDaySlot.value)}/100)${info.isBestDay ? ` — ${DAY_ID[day]} is its best day` : ''}.`);
  } else if (info.status === 'recommended' && info.isBestDay) {
    out.push(`${DAY_ID[day]} is its busiest day.`);
  } else if (info.status === 'otherDay' && info.bestSlot) {
    out.push(`Quieter on ${DAY_ID[day]}; busiest at ${info.bestSlot.label} (${fmt(info.bestSlot.value)}/100).`);
  }
  if (l.distanceKm !== null && l.distanceKm <= 2) out.push(`Close to the center (${l.distanceKm.toFixed(1)} km).`);
  return out;
}

/** Order stops by nearest-neighbour from the center (simple, transparent route order). */
export function orderRoute<T extends { lat: number | null; lng: number | null }>(
  start: { lat: number | null; lng: number | null },
  stops: T[]
): T[] {
  const pts = stops.filter((s) => s.lat !== null && s.lng !== null);
  const rest = stops.filter((s) => s.lat === null || s.lng === null);
  const out: T[] = [];
  let cur = start;
  const left = [...pts];
  while (left.length && cur.lat !== null && cur.lng !== null) {
    let bi = 0;
    let bd = Infinity;
    left.forEach((s, i) => {
      const d = (s.lat! - cur.lat!) ** 2 + ((s.lng! - cur.lng!) * Math.cos((cur.lat! * Math.PI) / 180)) ** 2;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    cur = left[bi];
    out.push(left.splice(bi, 1)[0]);
  }
  return [...out, ...left, ...rest];
}

/** Google Maps multi-stop URL (same format the app already used). */
export function routeUrl(
  start: { lat: number | null; lng: number | null },
  stops: { lat: number | null; lng: number | null }[]
): string | null {
  const pts = stops.filter((s) => s.lat !== null && s.lng !== null);
  if (!pts.length || start.lat === null || start.lng === null) return null;
  return `https://www.google.com/maps/dir/${start.lat},${start.lng}/${pts.map((s) => `${s.lat},${s.lng}`).join('/')}`;
}
