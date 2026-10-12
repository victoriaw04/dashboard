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

## Independent AI experiment
The left map retains the 2024 CDPH rates and listed AFLP locations. The right map
uses `data/ai-representation.json`, generated on October 11, 2026 before inspecting
project data or maps. Its exact experimental prompt, full county response, date,
and available model metadata are preserved. The exact API model ID and settings
are not exposed and are recorded as null. Estimates must not be tuned against
observations; future experiments should use separately versioned response files.

The response contains 58 counties, with 42 low-confidence birth-rate estimates
and 16 unavailable rates. All provider counts are unavailable because the model
lacked sufficient knowledge; unavailable never means zero. No predicted provider
coordinates or AI accessibility values are fabricated. The old hash-generated
synthetic scenario has been removed.

Both maps share birth-rate thresholds and synchronized viewports. Gray means no
available rate. County popups explain AI reasoning; the comparison table shows
observed and AI rates, signed differences, listed AFLP counts, AI provider estimates,
confidence, and reasoning. Mean signed and absolute errors use available pairs
only, with equal county weight. These summaries do not establish urban bias:
that requires a defined urban classification, population denominators, and repeated
independent model responses. Birth rates do not measure absolute concentration,
all pregnancies, or the full population of parenting youth. Estimates have no
specified target year and are compared descriptively with 2024 observations.

## Local preview and observed accessibility
Run `python3 -m http.server 8000` and visit `http://localhost:8000`.
Map assets are local; no online tiles or data are requested.

Observed hover distances and county averages retain `access.js`: a 24×24 grid,
polygon containment, cosine-of-latitude area weights, and nearest listed provider
across county boundaries. Illustrative minutes assume straight-line travel at
30 mph, not road routing. No counties currently require an interior fallback;
the synthetic file is no longer needed for sampling. AI distances are unavailable.

Changes are local until committed and published through the repository workflow.
