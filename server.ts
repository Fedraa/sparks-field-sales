import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Google GenAI client (User-Agent header set for telemetry as required)
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API endpoint for generating tailored Sparks EC PoI & Location Strategy
app.post('/api/generate-strategy', async (req, res) => {
  try {
    const {
      location = 'BSD City, Tangerang',
      categoryIds = [],
      objective = 'New Outlet Grand Opening & Trial Acquisition',
      targetAge = 'Toddlers & Early Elementary (Ages 1.5 - 8)',
      budgetLevel = 'Medium (Rp 15M - 30M / month)',
      customNotes = '',
    } = req.body;

    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel.',
      });
    }

    const systemPrompt = `You are the Senior Retail Expansion & Offline Growth Director for Sparks EC (Early Childhood & Enrichment Center), part of Seven Retail Group in Indonesia.
Sparks EC is a premium, playful, sensory-motor and cognitive early learning & enrichment center for young children (ages 1 to 9).
You specialize in hyper-local offline Point of Interest (PoI) strategy, B2B2C community partnerships, catchment radius dominance, and conversion funnels to drive trial bookings and recurring student enrolments.

The user wants a customized, actionable, realistic marketing and expansion strategy for Sparks EC in a specific location, targeting chosen PoI categories.
Always return structured JSON matching this exact format:
{
  "summary": "2-3 sentences executive summary of the localized strategy",
  "locationAnalysis": "Key demographic highlights, family density, and local competition dynamics for the requested area",
  "primaryPoiTactics": [
    {
      "categoryName": "string",
      "targetVenues": ["specific local venue 1", "specific local venue 2"],
      "activationMechanism": "Step-by-step mechanism",
      "expectedReachWeekly": "number / string",
      "pitchAngle": "Winning pitch hook to the partner management",
      "deliverables": ["flyer/standee/event"]
    }
  ],
  "roadmap4Weeks": [
    { "week": "Week 1", "title": "Phase title", "actions": ["action 1", "action 2", "action 3"] },
    { "week": "Week 2", "title": "Phase title", "actions": ["action 1", "action 2", "action 3"] },
    { "week": "Week 3", "title": "Phase title", "actions": ["action 1", "action 2", "action 3"] },
    { "week": "Week 4", "title": "Phase title", "actions": ["action 1", "action 2", "action 3"] }
  ],
  "kpiProjections": {
    "projectedLeads": "e.g. 250 - 350 leads",
    "trialBookings": "e.g. 120 - 160 trials",
    "projectedEnrolments": "e.g. 45 - 65 members",
    "estimatedCAC": "e.g. Rp 85.000 / lead"
  },
  "budgetBreakdown": [
    { "item": "e.g. B2B Printing & Standees", "percentage": 30, "costEst": "Rp 6.000.000" },
    { "item": "e.g. Event Pop-Up & Goodie Bags", "percentage": 40, "costEst": "Rp 8.000.000" },
    { "item": "e.g. Partner Commission / Staff Incentives", "percentage": 20, "costEst": "Rp 4.000.000" },
    { "item": "e.g. Digital Retargeting & Local Ads", "percentage": 10, "costEst": "Rp 2.000.000" }
  ],
  "secretWeaponTip": "An innovative, high-impact growth hack specific to this location and audience"
}`;

    const prompt = `Develop a comprehensive Sparks EC Offline PoI Strategy for:
- Location: ${location}
- Selected PoI Categories: ${JSON.stringify(categoryIds)}
- Primary Objective: ${objective}
- Target Age Group: ${targetAge}
- Budget Tier: ${budgetLevel}
- Specific Notes / Requests: ${customNotes || 'Focus on rapid trial booking conversion and high-trust mom community engagement.'}

Ensure the venues mentioned are authentic, localized landmarks and relevant hubs for this district in Indonesia. Return strict valid JSON only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const outputText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(outputText);
    } catch {
      // If parsing fails, wrap in json
      parsedData = { rawResponse: outputText };
    }

    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error generating Sparks EC strategy:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate strategy with Gemini.',
    });
  }
});

// ---------------------------------------------------------------------------
// Read-only proxy to the POI Google Sheet (Field Sales Planner data source).
// The sheet must be shared as "Anyone with the link can view".
// Returns the raw CSV of one tab (all rows, no header guessing: headers=0).
// ---------------------------------------------------------------------------
const POI_SHEET_ID = process.env.POI_SHEET_ID || '1IVSxzJd7mKjO6TAH8emDBWM_FZeks20TfJeHQ-AH4sY';
const ALLOWED_TABS = new Set(['Centers', 'Master_POI', 'Scoring_Rev', 'Traffic', 'Audiens', 'MAP_KATEGORI']);
const SHEET_CACHE_MS = 5 * 60 * 1000;
const sheetCache = new Map<string, { at: number; csv: string }>();

app.get('/api/sheet/:tab', async (req, res) => {
  const tab = String(req.params.tab || '');
  if (!ALLOWED_TABS.has(tab)) {
    return res.status(400).json({ error: `Tab "${tab}" is not allowed.` });
  }
  const fresh = req.query.refresh === '1';
  const hit = sheetCache.get(tab);
  if (hit && !fresh && Date.now() - hit.at < SHEET_CACHE_MS) {
    res.type('text/csv');
    return res.send(hit.csv);
  }
  try {
    const url =
      `https://docs.google.com/spreadsheets/d/${POI_SHEET_ID}/gviz/tq?tqx=out:csv&headers=0&sheet=` +
      encodeURIComponent(tab);
    const r = await fetch(url);
    const text = await r.text();
    if (!r.ok || text.trim().startsWith('<')) {
      return res.status(502).json({
        error: `Could not read tab "${tab}" from Google Sheets (HTTP ${r.status}). Check that the sheet is shared as "Anyone with the link can view".`,
      });
    }
    sheetCache.set(tab, { at: Date.now(), csv: text });
    res.type('text/csv');
    return res.send(text);
  } catch (error: any) {
    console.error('Sheet fetch failed:', error);
    return res.status(502).json({ error: error?.message || 'Sheet fetch failed.' });
  }
});

// ---------------------------------------------------------------------------
// OpenStreetMap Nominatim proxy for POC "Find Sparks Near a Location"
// Avoids rate limiting and satisfies Nominatim User-Agent requirement.
// ---------------------------------------------------------------------------
const geocodeCache = new Map<string, { at: number; data: any }>();
const GEOCODE_CACHE_MS = 60 * 60 * 1000; // 1 jam cache

app.get('/api/geocode', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    return res.json([]);
  }
  const cacheKey = q.toLowerCase();
  const hit = geocodeCache.get(cacheKey);
  if (hit && Date.now() - hit.at < GEOCODE_CACHE_MS) {
    return res.json(hit.data);
  }
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      new URLSearchParams({
        q,
        format: 'jsonv2',
        limit: '5',
        countrycodes: 'id',
        addressdetails: '1',
      }).toString();

    const r = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SparksFieldSalesApp/1.0 (retention.sparksports@seven-retail.com)',
      },
    });

    if (!r.ok) {
      return res.status(r.status).json({ error: `Nominatim HTTP ${r.status}` });
    }

    const data = await r.json();
    geocodeCache.set(cacheKey, { at: Date.now(), data });
    return res.json(data);
  } catch (error: any) {
    console.error('Geocode proxy failed:', error);
    return res.status(500).json({ error: error?.message || 'Geocoding failed.' });
  }
});



/* ---------------------------------------------------------------------------
 * Read-only EC visit report endpoint.
 *
 * Source: Clean_EC_Visits in POI_SHEET_ID.
 * Returns only fields needed by the Laporan EC frontend.
 * Does NOT return Parent, Phone, Child, DOB, Age, or raw response payloads.
 * --------------------------------------------------------------------------- */

const EC_VISITS_TAB = 'Clean_EC_Visits';
const EC_VISITS_CACHE_MS = 60 * 1000;

let ecVisitsCache: {
  at: number;
  data: ECVisitApiRow[];
} | null = null;

type ECVisitApiRow = {
  timestamp: string;
  ec: string;
  locationName: string;
  namaLokasiStandard?: string;
  center: string;
  centerNearest: string;
  buEntries: {
    bu: string;
    center: string;
    status: string;
    ageGroup: string;
    classDate: string;
    classTime: string;
    className: string;
    room: string;
  }[];
};

/**
 * Parse CSV safely, including quoted fields, commas, and line breaks.
 */
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];

    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && csv[i + 1] === '\n') i++;

      row.push(field);
      field = '';

      // Ignore completely empty rows.
      if (row.some((value) => value.trim() !== '')) {
        rows.push(row);
      }

      row = [];
    } else {
      field += char;
    }
  }

  // Include the final row if the CSV does not end with a newline.
  row.push(field);
  if (row.some((value) => value.trim() !== '')) {
    rows.push(row);
  }

  return rows;
}

function normalizeECHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
}

function getECValue(
  row: string[],
  headerIndexes: Map<string, number>,
  headerNames: string[],
  fallbackIndex?: number,
): string {
  for (const name of headerNames) {
    const index = headerIndexes.get(normalizeECHeader(name));
    if (index !== undefined && row[index] !== undefined) {
      return String(row[index] ?? '').trim();
    }
  }
  if (fallbackIndex !== undefined && fallbackIndex < row.length) {
    return String(row[fallbackIndex] ?? '').trim();
  }
  return '';
}

app.get('/api/ec-visits', async (req, res) => {
  try {
    const fresh = req.query.refresh === '1';

    if (
      ecVisitsCache &&
      !fresh &&
      Date.now() - ecVisitsCache.at < EC_VISITS_CACHE_MS
    ) {
      res.set('Cache-Control', 'no-store');
      return res.json({
        success: true,
        data: ecVisitsCache.data,
        cached: true,
      });
    }

    // Use headers=1 so Google Sheets returns canonical column labels (e.g. _source_timestamp, EC, BU1-8, Nama_Lokasi_Standard)
    const url =
      `https://docs.google.com/spreadsheets/d/${POI_SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=` +
      encodeURIComponent(EC_VISITS_TAB);

    const response = await fetch(url);
    const csv = await response.text();

    if (!response.ok || csv.trim().startsWith('<')) {
      console.error(
        `Could not read ${EC_VISITS_TAB}: HTTP ${response.status}`,
      );

      return res.status(502).json({
        success: false,
        error:
          'Could not read EC visit data. Check spreadsheet sharing and the Clean_EC_Visits tab.',
      });
    }

    const csvRows = parseCSV(csv);

    if (csvRows.length === 0) {
      ecVisitsCache = { at: Date.now(), data: [] };
      res.set('Cache-Control', 'no-store');
      return res.json({
        success: true,
        data: [],
        cached: false,
      });
    }

    // Clean_EC_Visits has a header row.
    const headers = csvRows[0].map(normalizeECHeader);
    const headerIndexes = new Map<string, number>();

    headers.forEach((header, index) => {
      if (header && !headerIndexes.has(header)) {
        headerIndexes.set(header, index);
      }
    });

    // Validate the columns required by the report.
    const requiredHeaderGroups = [
      { name: '_source_timestamp', candidates: ['_source_timestamp', 'source_timestamp', 'timestamp'], fallbackCol: 0 },
      { name: 'ec', candidates: ['ec', 'agent'], fallbackCol: 4 },
      { name: 'nama_lokasi_standard', candidates: ['nama_lokasi_standard', 'namalokasistandard'], fallbackCol: 78 },
      { name: 'center_terdekat', candidates: ['center_terdekat', 'centerterdekat'], fallbackCol: 79 },
    ];

    const missingHeaders = requiredHeaderGroups
      .filter((group) => {
        const foundByName = group.candidates.some((c) => headerIndexes.has(normalizeECHeader(c)));
        const foundByCol = group.fallbackCol < csvRows[0].length;
        return !foundByName && !foundByCol;
      })
      .map((g) => g.name);

    if (missingHeaders.length > 0) {
      console.error('EC report missing headers:', missingHeaders);

      return res.status(500).json({
        success: false,
        error:
          'Clean_EC_Visits is missing required columns. Check its header row.',
        missingHeaders,
      });
    }

    const data: ECVisitApiRow[] = csvRows
      .slice(1)
      .map((row): ECVisitApiRow => {
        const buEntries: ECVisitApiRow['buEntries'] = [];

        for (let i = 1; i <= 8; i++) {
          const bu = getECValue(
            row,
            headerIndexes,
            [`BU${i}`, `bu_${i}`, `bu${i}`],
            13 + (i - 1) * 8,
          );

          // Only return BU slots that contain an actual BU value.
          if (!bu) continue;

          buEntries.push({
            bu,
            center: getECValue(
              row,
              headerIndexes,
              [`Center${i}`, `center_${i}`, `center${i}`],
              14 + (i - 1) * 8,
            ),
            status: getECValue(
              row,
              headerIndexes,
              [`Status${i}`, `status_${i}`, `status${i}`],
              15 + (i - 1) * 8,
            ),
            ageGroup: getECValue(
              row,
              headerIndexes,
              [`AgeGroup${i}`, `age_group_${i}`, `agegroup${i}`],
              16 + (i - 1) * 8,
            ),
            classDate: getECValue(
              row,
              headerIndexes,
              [`ClassDate${i}`, `class_date_${i}`, `classdate${i}`],
              17 + (i - 1) * 8,
            ),
            classTime: getECValue(
              row,
              headerIndexes,
              [`ClassTime${i}`, `class_time_${i}`, `classtime${i}`],
              18 + (i - 1) * 8,
            ),
            className: getECValue(
              row,
              headerIndexes,
              [`Class${i}`, `class_${i}`, `className${i}`, `classname${i}`],
              19 + (i - 1) * 8,
            ),
            room: getECValue(
              row,
              headerIndexes,
              [`Room${i}`, `room_${i}`, `room${i}`],
              20 + (i - 1) * 8,
            ),
          });
        }

        const timestamp = getECValue(
          row,
          headerIndexes,
          ['_source_timestamp', 'source_timestamp', 'timestamp', 'date'],
          0,
        );
        const ec = getECValue(
          row,
          headerIndexes,
          ['EC', 'ec', 'agent'],
          4,
        );
        const locationName = getECValue(
          row,
          headerIndexes,
          ['Nama_Lokasi_Standard', 'nama_lokasi_standard', 'location_standard'],
          78,
        );
        const centerNearest = getECValue(
          row,
          headerIndexes,
          ['Center_Terdekat', 'center_terdekat', 'center_nearest', 'center'],
          79,
        );

        return {
          timestamp,
          ec,
          locationName,
          namaLokasiStandard: locationName,
          center: centerNearest,
          centerNearest,
          buEntries,
        };
      })
      // Exclude rows without a standardized location.
      .filter((row) => row.locationName !== '');

    ecVisitsCache = {
      at: Date.now(),
      data,
    };

    // Prevent browser/proxy caching; the server maintains its own short cache.
    res.set('Cache-Control', 'no-store');

    return res.json({
      success: true,
      data,
      cached: false,
    });
  } catch (error: any) {
    console.error('EC visits fetch failed:', error);

    return res.status(502).json({
      success: false,
      error: 'Failed to load EC visit data.',
    });
  }
});


// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = Number(PORT);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Sparks EC Strategy Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
