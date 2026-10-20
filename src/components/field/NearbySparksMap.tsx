import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { FieldLocation } from '../../data/fieldData';
import type { NearbyCenter, NearbyLocation } from '../../lib/nearbySparks';

interface Props {
  /** Lokasi patokan yang dipilih user */
  referenceLocation: FieldLocation;
  /** Daftar Sparks Center terdekat hasil kalkulasi */
  nearbyCenters: NearbyCenter[];
  /** Daftar POI di sekitar lokasi patokan (maks 50 untuk performa) */
  nearbyLocations?: NearbyLocation[];
  /** Radius pencarian dalam km (default 7) */
  radiusKm?: number;
  /** Center yang sedang di-highlight/dipilih */
  selectedCenterCode?: string | null;
  /** Callback saat Center dipilih dari marker / popup peta */
  onSelectCenter: (code: string) => void;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || c);

/**
 * Peta visual untuk fitur "Find Sparks Near a Location".
 * Menampilkan:
 * 1. Marker lokasi patokan (warna merah)
 * 2. Lingkaran visualisasi radius (default 7 km)
 * 3. Marker Sparks Center terdekat (warna hijau dengan kode Center)
 * 4. Marker POI di sekitar lokasi patokan (warna biru/teal)
 */
export const NearbySparksMap: React.FC<Props> = ({
  referenceLocation,
  nearbyCenters,
  nearbyLocations = [],
  radiusKm = 7,
  selectedCenterCode,
  onSelectCenter,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Inisialisasi Map (hanya sekali saat mount)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const m = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });

    // Basemap Carto Voyager (bebas API key)
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(m);

    const layer = L.layerGroup().addTo(m);
    layerRef.current = layer;
    mapRef.current = m;

    // Handle resize otomatis agar rendering tile tidak abu-abu di dalam modal
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => m.invalidateSize())
        : null;
    ro?.observe(containerRef.current);

    // Initial invalidateSize setelah modal render
    setTimeout(() => {
      m.invalidateSize();
    }, 100);

    return () => {
      ro?.disconnect();
      m.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Layers (Marker & Radius) ketika data berubah
  useEffect(() => {
    const m = mapRef.current;
    const layer = layerRef.current;
    if (!m || !layer) return;

    if (
      referenceLocation.lat == null ||
      referenceLocation.lng == null ||
      !Number.isFinite(referenceLocation.lat) ||
      !Number.isFinite(referenceLocation.lng)
    ) {
      return;
    }

    layer.clearLayers();

    const refLat = referenceLocation.lat;
    const refLng = referenceLocation.lng;
    const pts: L.LatLngExpression[] = [[refLat, refLng]];

    // 1. Lingkaran radius visual (default 7 km)
    L.circle([refLat, refLng], {
      radius: radiusKm * 1000,
      color: '#254C33',
      weight: 1.5,
      dashArray: '5, 5',
      fillColor: '#254C33',
      fillOpacity: 0.05,
    }).addTo(layer);

    // 2. Marker POI di sekitar (Biru/Teal - zIndex lebih rendah agar Center & Patokan terlihat jelas)
    nearbyLocations.forEach((loc) => {
      if (
        loc.lat == null ||
        loc.lng == null ||
        !Number.isFinite(loc.lat) ||
        !Number.isFinite(loc.lng)
      ) {
        return;
      }

      pts.push([loc.lat, loc.lng]);

      const poiIconHtml = `
        <div style="width:20px;height:20px;border-radius:9999px;background:#1D5D9B;border:2px solid #FFFFFF;box-shadow:0 1px 4px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700">
          •
        </div>
      `;

      const poiMarker = L.marker([loc.lat, loc.lng], {
        icon: L.divIcon({
          className: '',
          html: poiIconHtml,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
        zIndexOffset: 250,
      }).addTo(layer);

      const poiPopupContent = `
        <div style="padding: 10px; min-width: 190px; font-family: inherit;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px;">
            <span style="font-size: 10px; font-weight: 700; color: #1D5D9B; text-transform: uppercase;">
              ${esc(loc.category || 'POI')}
            </span>
            <span style="font-size: 11px; font-weight: 700; color: #173020; background: #F1F5F2; padding: 2px 6px; border-radius: 6px;">
              ${loc.distanceKm.toFixed(1)} km
            </span>
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #173020; line-height: 1.3;">
            ${esc(loc.name)}
          </div>
          ${
            loc.group && loc.group !== loc.category
              ? `<div style="font-size: 10px; color: #5A7766; margin-top: 2px;">Grup: ${esc(loc.group)}</div>`
              : ''
          }
          ${
            loc.address
              ? `<div style="font-size: 10px; color: #7E9787; margin-top: 3px; line-height: 1.3;">${esc(loc.address)}</div>`
              : ''
          }
          ${
            loc.rating
              ? `<div style="font-size: 10px; font-weight: 600; color: #865E0C; margin-top: 4px;">★ ${loc.rating.toFixed(1)}${
                  loc.reviewCount ? ` (${loc.reviewCount} ulasan)` : ''
                }</div>`
              : ''
          }
          ${
            loc.mapsUrl
              ? `<div style="margin-top: 6px;"><a href="${esc(loc.mapsUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 10px; color: #1D5D9B; text-decoration: underline; font-weight: 600;">Lihat di Google Maps ↗</a></div>`
              : ''
          }
        </div>
      `;
      poiMarker.bindPopup(poiPopupContent);
    });

    // 3. Marker Sparks Center Terdekat (Hijau Sparks - zIndex tinggi)
    nearbyCenters.forEach((c) => {
      if (
        c.lat == null ||
        c.lng == null ||
        !Number.isFinite(c.lat) ||
        !Number.isFinite(c.lng)
      ) {
        return;
      }

      pts.push([c.lat, c.lng]);
      const isSelected = selectedCenterCode === c.code;

      const centerIconHtml = `
        <div style="width:32px;height:32px;border-radius:9999px;background:#254C33;border:${
          isSelected ? '3px solid #3B7451' : '3px solid #FDF099'
        };box-shadow:0 3px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800">
          ${esc(c.code)}
        </div>
      `;

      const centerMarker = L.marker([c.lat, c.lng], {
        icon: L.divIcon({
          className: '',
          html: centerIconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
        zIndexOffset: isSelected ? 800 : 500,
      }).addTo(layer);

      const centerPopupContent = document.createElement('div');
      centerPopupContent.style.padding = '10px';
      centerPopupContent.style.minWidth = '200px';
      centerPopupContent.style.fontFamily = 'inherit';

      centerPopupContent.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; background: #254C33; color: #fff;">
            ${esc(c.code)}
          </span>
          <span style="font-size: 11px; font-weight: 700; color: #865E0C; background: #FEF6DC; padding: 2px 6px; border-radius: 6px; border: 1px solid #F4E1A3;">
            ${c.distanceKm.toFixed(1)} km
          </span>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #173020; line-height: 1.3;">
          ${esc(c.name.replace('Sparks Center - ', ''))}
        </div>
        <div style="font-size: 11px; color: #5A7766; margin-top: 2px;">
          ${esc(c.city)} · ${esc(c.region)}
        </div>
        ${
          c.buAvailable
            ? `<div style="font-size: 10px; color: #295637; margin-top: 6px; padding-top: 6px; border-top: 1px solid #EEF4EF;">
                <strong>BU:</strong> ${esc(c.buAvailable)}
               </div>`
            : ''
        }
        <button type="button" class="sparks-pick-btn" style="width: 100%; margin-top: 8px; padding: 6px 10px; border-radius: 8px; background: #254C33; color: #fff; font-size: 11px; font-weight: 700; border: none; cursor: pointer;">
          Pilih Center Ini
        </button>
      `;

      const btn = centerPopupContent.querySelector('.sparks-pick-btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectCenter(c.code);
        });
      }

      centerMarker.bindPopup(centerPopupContent);
    });

    // 4. Marker Lokasi Patokan (Merah mencolok - zIndex 1000 paling atas)
    const refIconHtml = `
      <div style="width:32px;height:32px;border-radius:9999px;background:#D9381E;border:3px solid #FFFFFF;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;line-height:1">
        📍
      </div>
    `;

    const refMarker = L.marker([refLat, refLng], {
      icon: L.divIcon({
        className: '',
        html: refIconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
      zIndexOffset: 1000,
    }).addTo(layer);

    const refPopupContent = `
      <div style="padding: 10px; min-width: 180px; font-family: inherit;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #D9381E; margin-bottom: 2px;">
          Lokasi Patokan
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #173020; line-height: 1.3;">
          ${esc(referenceLocation.name)}
        </div>
        ${
          referenceLocation.address
            ? `<div style="font-size: 11px; color: #5A7766; margin-top: 4px; line-height: 1.3;">${esc(referenceLocation.address)}</div>`
            : ''
        }
      </div>
    `;
    refMarker.bindPopup(refPopupContent);

    // 5. Fit Bounds otomatis mencakup titik patokan, center terdekat, dan POI sekitar
    if (pts.length > 1) {
      m.fitBounds(L.latLngBounds(pts), {
        padding: [35, 35],
        maxZoom: 14,
      });
    } else {
      m.setView([refLat, refLng], 12);
    }
  }, [
    referenceLocation,
    nearbyCenters,
    nearbyLocations,
    radiusKm,
    selectedCenterCode,
    onSelectCenter,
  ]);

  return (
    <div className="bg-white rounded-2xl border border-[#DCE8DE] overflow-hidden mb-3.5 shadow-xs">
      <div ref={containerRef} className="h-52 sm:h-60 w-full" />
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-[10px] text-[#5A7766] border-t border-[#EEF4EF] bg-[#F8FAF8]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D9381E] inline-block" />
            <span>Lokasi Patokan</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#254C33] inline-block" />
            <span>Sparks Center</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1D5D9B] inline-block" />
            <span>POI Sekitar ({nearbyLocations.length})</span>
          </span>
        </div>
        <div className="text-[10px] text-[#7E9787]">
          Garis putus-putus: Radius {radiusKm} km
        </div>
      </div>
    </div>
  );
};
