<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/2f37fffc-69ac-403f-b592-a169ff9c6d0d

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Sparks Field Sales (current UI)

Sales reps pick their **Sparks Center** and a **Plan for Day** to get recommended locations for that day. Locations can then be prioritized based on total score, day fit, or crowd window.

The current interface supports:

* **Best for Day** — recommended locations for the selected planning day
* **Closest** — locations ranked by distance from the selected center
* **Highest Score** — locations ranked by total score
* **Best Day Fit** — combines location score, selected-day crowd, and Best Day
* **Crowd Window sorting** — earlier → later or later → earlier
* Location search
* Distance, score, tier, Best Day and Popular Times information
* Open Google Maps
* Multi-center selection
* EC reporting access

### Best for Day

"Best for Day" first filters locations that are recommended for the selected planning day.

A location is recommended when:

* the selected day has strong Popular Times / crowd data, or
* the selected day is the location's **Hari Terbaik**.

Locations that are closed on the selected planning day are flagged separately.

Locations without Popular Times data are labelled **"No crowd data"** — nothing is estimated.

### Best Day Fit

Best Day Fit is an operational ranking heuristic that combines:

* **60% Total Score**
* **30% crowd level on the selected planning day**
* **10% Best Day indicator**

The purpose is to balance the overall potential of a location with its suitability for the selected planning day.

The weights are configurable and may be adjusted after business validation.

### Crowd Window

Crowd Window sorting uses the strongest Popular Times window available for the selected planning day.

It can be sorted:

* **Morning → Evening**
* **Evening → Morning**

This is currently a **crowd-time reference**, not a finalized sales route schedule.

---

**Data source:** the *POI Analysis Sparks – Multi-Center* Google Sheet, read-only, through
`GET /api/sheet/:tab` in `server.ts` (5-minute cache, tabs: Centers, Master_POI, Scoring, Traffic,
Audiens, MAP_KATEGORI). Set `POI_SHEET_ID` to point to another sheet. The sheet must be shared as
"Anyone with the link can view".

* Scores, tiers and Popular Times are shown based on the values computed in the sheet.
* Locations shown = `Relevan? = Ya` and `CENTER ASSIGNED = <selected center>` (Master_POI).
* **Best for Day** evaluates Popular Times for the selected planning day and the location's `Hari Terbaik`.
* **Best Day Fit** is an additional operational ranking layer and does not replace the underlying Total Score.
* Crowd windows are used for sorting and reference, not as a final visit-route schedule.
* The application supports multiple Sparks Centers through the selected center filter.
* Data without Popular Times is not estimated by the application.

### Code

* `src/App.tsx` — main UI, center/day selection, views, filtering and sorting
* `src/data/fieldData.ts` — data loading and dataset joining
* `src/lib/visitPlan.ts` — planning-day and recommendation logic
* `src/components/field/*` — field-sales UI components
* `server.ts` — Google Sheet data access and caching

The previous strategy / Visit Plan components may still exist in `src/components/` and
`src/lib/`, but components that are not part of the current main interface should be treated
as legacy until their current usage is verified.
