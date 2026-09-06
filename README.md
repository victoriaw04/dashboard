# Adolescent Birth Rates and AFLP Services in California

Victoria's simple Week 9 research dashboard.

## Research Question

How do adolescent birth rates vary across California counties, and how does the geographic distribution of publicly listed AFLP services compare with these patterns?

## Data Sources

- California Department of Public Health — [Adolescent Births](https://www.cdph.ca.gov/Programs/CFH/DMCAH/Pages/Data/Adolescent-Births-in-California.aspx)
- California Department of Public Health — [Adolescent Family Life Program](https://www.cdph.ca.gov/Programs/CFH/DMCAH/AFLP/Pages/Sites.aspx)
- California Department of Technology — [California County Boundaries and Identifiers](https://gis.data.ca.gov/datasets/California::california-county-boundaries-and-identifiers)

## Dashboard

Live dashboard: [https://victoriaw04.github.io/dashboard/]

The root `index.html` uses MapLibre GL JS 5.6.2 with CARTO's Positron vector basemap, whose paint colors are converted to grayscale in the saved style. Click counties for rates and birth counts; click orange AFLP points for directory details. Local assets use relative paths. The public basemap's remote vector tiles, fonts, and sprites require internet access; no API keys, backend, or build step is needed. OpenStreetMap and CARTO attribution is preserved.

To publish, upload these files to the lowercase `dashboard` repository's `main` branch, then select **Settings → Pages → Deploy from a branch → main → /(root)**. Replace the placeholder above with the published URL. Preview with an editor's static HTTP preview; opening `index.html` directly with `file://` will block data fetching in browsers.

## Data preparation and limitations

The supplied birth CSV is retained unchanged. `data/birth-rates.json` selects the newest single year, **2024**, indicator **Adolescent Birth Rate**, **Ages 15–19**, **Total Population / Total population**, excluding statewide and US rows. Rates are live births per 1,000 females ages 15–19. County names join to the boundary field `CDT_NAME_SHORT`; all 58 counties match.

Following the saved CDPH methodology, numerators below 10 are suppressed: the corresponding rate and count become `null`, including zero-coded export rows. Missing values also remain `null`; no unavailable value is replaced by zero. There are 48 published rates and 10 counties shown as “No data.” This uses single-year observations as requested; CDPH's county dashboard uses three-year aggregates.

The supplied boundary CSV is metadata, not geometry. `data/california-counties.geojson` was retrieved from the official [CDT feature service](https://services3.arcgis.com/uknczv4rpevve42E/arcgis/rest/services/California_County_Boundaries_and_Identifiers_Blue_Version_view/FeatureServer/1) on September 5, 2026, with `outSR=4326`, `geometryPrecision=5`, and `maxAllowableOffset=0.001` for a small display download.

The [CDPH directory TSV](https://www.cdph.ca.gov/Programs/CFH/DMCAH/AFLP/SiteAssets/AFLP-Directory.txt) was retrieved September 5, 2026. Its 18 publicly listed mailing addresses are mapped in `data/aflp-locations.geojson`. Seventeen were matched with the US Census geocoder (`Public_AR_Current`), with suite text omitted for matching. Madera's address did not match: its point uses the OpenStreetMap Nominatim Sunrise Avenue street segment in ZIP 93638 and is explicitly labeled as a street-level approximation. It is not a verified building location. Geocoder responses are saved under `data/geocoding/`. OpenStreetMap data © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).

Live births do not represent every pregnant youth. Program locations do not directly measure actual service accessibility or capacity. Directory and birth data refer to different dates; no causal claims are made.

To regenerate the derived JSON files from the checked-in sources, run `node scripts/prepare-data.cjs` if Node.js is available. This optional maintenance step is **not** needed to serve or publish the dashboard.
