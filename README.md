# Adolescent Birth Rates and AFLP Services in California

## Research Question
How do adolescent birth rates vary across California counties, and how does the geographic distribution of publicly listed AFLP services compare with these patterns?

This dashboard is the first stage of a larger project examining geographic bias in AI representations of pregnant and parenting youth in California.

## Data Sources
- California Department of Public Health — Adolescent Births Dashboard
- California Department of Public Health — Adolescent Family Life Program (AFLP) locations
- California Department of Technology — California County Boundaries and Identifiers

## Dashboard
Live dashboard: https://victoriaw04.github.io/dashboard/

## Side-by-side comparison
The left map retains the checked-in 2024 birth rates and AFLP directory locations.
The right map is a **synthetic demonstration**, with independently invented birth
rates and provider counts for all 58 counties. See `data/synthetic-scenario.json`
for the values and reproducible generation method. Circles represent county
provider totals (area proportional to count), not site locations. Zero providers
produce no circle; the county popup and expandable table still show zero.
These values are not estimates, predictions, or recommended staffing levels.

Both maps use the same birth-rate colors and synchronized pan/zoom. At narrow
screen widths they stack vertically. Reset both maps returns to California.
All map assets are local; neither map requests online tiles, fonts, or data.
Existing source links remain references for the observed map only.

Preview with `python3 -m http.server 8000`, then visit `http://localhost:8000`.

## Provider distance and hover estimates
Hover anywhere on either map (or tap on touch screens) for the nearest provider,
straight-line distance in miles, and illustrative minutes at an assumed 30 mph.
The box updates during pan/zoom, including with a stationary pointer. This is
not road routing: roads, water crossings, terrain, traffic, and eligibility are
not modeled. No network services are called.

County popups, a county selector, and an expandable comparison table show the
average distance to the nearest provider. `access.js` samples a 24×24 grid over
each county bounding box, excludes points outside polygons and inside holes,
and weights retained samples by cosine of latitude to approximate area weighting.
The nearest provider may be across a county boundary. This is not a population
average; small islands may be missed by sampling. An interior anchor is used
only as fallback when no grid points fall inside a county.

Observed distances use only saved AFLP locations. Synthetic distances treat
nonzero county circles as fictional hubs with all of that county's invented
providers co-located. Zero-provider counties contribute no hub but still get an
average distance to the nearest hub elsewhere. Count changes alone do not change
distances unless they add or remove a hub.
