<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/2f37fffc-69ac-403f-b592-a169ff9c6d0d

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Sparks Field Sales (current UI)

Sales reps pick their Sparks Center and get today's recommended locations, ranked, with distance,
pillar scores, best day / peak hour, a short "why", and an Open Google Maps button.

**Data source:** the *POI Analysis Sparks – Multi-Center* Google Sheet, read-only, through
`GET /api/sheet/:tab` in `server.ts` (5-minute cache, tabs: Centers, Master_POI, Scoring, Traffic,
Audiens, MAP_KATEGORI). Set `POI_SHEET_ID` to point to another sheet. The sheet must be shared as
"Anyone with the link can view".

- Scores, tiers and Popular Times are shown exactly as computed in the sheet. The app only ranks
  SKOR TOTAL *within* each center.
- Locations shown = `Relevan? = Ya` and `CENTER ASSIGNED = <selected center>` (Master_POI).
- "Visit today" = Popular Times slot for today ≥ 50 (Sat/Sun: 09–12 & 15–18, Mon–Fri: 15–18)
  or today is the location's "Hari Terbaik". Locations closed today (opening hours) are flagged.
  Locations without Popular Times are labelled "No crowd data" – nothing is estimated.
- Code: `src/data/fieldData.ts` (load & join), `src/lib/visitPlan.ts` (today logic, route order),
  `src/components/field/*` (UI). The previous strategy components are kept in `src/components/`
  but are no longer shown in the main interface.
