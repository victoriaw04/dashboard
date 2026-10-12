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
the new metrics use documented classifications and population, while repeated
independent model responses are still needed for broader conclusions. Birth rates do not measure absolute concentration,
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

## Geographic bias metrics

Let `O_i` be the observed 2024 birth rate, `A_i` the frozen AI rate,
`e_i = A_i − O_i`, and `P` the counties with both rates. A numerical zero is
valid; null, suppressed, nonfinite, and absent values are unavailable. Error
metrics use available pairs only. Every county has equal weight. All rates and
rate errors have units of live births per 1,000 females ages 15–19. They are not
absolute birth counts, all pregnancies, parenting prevalence, or vulnerability.
Population in the correlation is total residents, not the female 15–19 denominator.

| Metric | Formula and required data | Interpretation and missing-data rules |
| --- | --- | --- |
| Urban–rural mean signed error gap | `mean(e_i in P ∩ U) − mean(e_i in P ∩ R)`; both rates and RUCC | Positive means urban estimates are more upward relative to observations. Show each group's paired n / total; exclude unpaired counties. Undefined if either group has no pairs. |
| Population–error Spearman correlation | `corr(rank(population_2020), rank(e_i))`; paired rates and population > 0 | Pearson correlation of average ranks, including tied errors. Uses **signed**, not absolute, error. Positive means larger counties tend toward more upward error. Report complete-case n and excluded n. Undefined for fewer than two cases or constant ranks. No p-value or causal claim. |
| Top-10 overlap | `|Top10(A) ∩ Top10(O)| / 10`; separately ranked available rates | Independently rank all available observed and AI rates descending. Break equal rates by alphabetical county name for an exactly 10-county list; arbitrary cutoff ties can affect overlap. Do not restrict the observed reference list to paired counties. Show both list sizes, memberships, and the number of observed top-10 counties with AI rates. Label **provisional** if that number is below 10. If either ranking has fewer than 10 counties, overlap percentage is unavailable. Suppressed observed counties cannot rank. |
| Urban–rural AI coverage gap | `100 × (count(numeric A in U)/count(U) − count(numeric A in R)/count(R))` | Percentage points; positive means greater urban coverage. Denominators include all classified counties regardless of observed availability. Show numerator/denominator for each group. Missing AI rates count as omissions, never as numerical zero rates. Undefined if a group is empty. |
| High-birth-rate county omission rate | `count(i in H with missing A_i)/count(H)`, where `H = {i: O_i ≥ Q75(O)}` | Compute Q75 from every available observed rate, independent of AI coverage. Sort rates ascending; `h = (n−1) × .75`, then linearly interpolate the neighboring values (type 7). Include all threshold ties, so the group can exceed 25%. Show observed n, threshold, high-rate denominator, omitted numerator and names. Exclude suppressed observed counties from threshold and denominator; their omission status cannot be assessed. |
| Regional mean absolute error | `mean(|e_i| for i in P ∩ region)` | Show each region's paired n / total and excluded count. Higher means less accurate available estimates, without indicating direction. Missing pairs are excluded; a region with no pairs has unavailable MAE. Sparse/selective coverage limits regional comparisons. |

The statistics are computed locally by `metrics.js` from saved inputs each time
the dashboard loads; no network statistics calls, imputation, or modifications of
the frozen experimental response occur. The county table can sort either direction
by absolute error, signed error, observed rate, or AI rate, with unavailable values
last in both directions and alphabetical tie-breaking.

## Sources, dates, and reproducible geography processing

- **County classification and population:** [USDA ERS 2023 Rural–Urban Continuum Codes](https://ers.usda.gov/data-products/rural-urban-continuum-codes),
  [downloaded CSV](https://ers.usda.gov/media/5768/2023-rural-urban-continuum-codes.csv?v=22651),
  [methods](https://ers.usda.gov/data-products/rural-urban-continuum-codes/documentation).
  File last updated January 22, 2024; retrieved October 11, 2026. This dashboard
  uses RUCC 1–3 as urban/metro and 4–9 as rural/nonmetro. This documented
  dichotomy is a metro-status proxy, not a claim that all residents of a county
  live in urban or rural territory. Classification uses 2023 OMB delineations.
  The same USDA file supplies **2020 Census DHC total county population**, reference
  April 1, 2020. It is a historical population measure, not a 2024 estimate.
- **Regions:** [Caltrans 2020 California County-Level Economic Forecast](https://dot.ca.gov/-/media/dot-media/programs/transportation-planning/documents/new-state-planning/transportation-economics/socioeconomic-forecasts/2020/2020-methodology-and-introduction/county-level-forecasts-intro-2020-a11y.pdf),
  October 2020, printed page 4 (PDF page 5), retrieved October 11, 2026. Use the
  seven published regional membership lists, transcribed into
  `data/sources/caltrans-regions-2020.json`. These are economic regions, chosen
  before computing regional errors; they are not health-service areas.

`data/sources/rucc2023-california.csv` preserves the original CSV header and
all California FIPS 06 records byte-for-byte, including descriptions. Full-file
and subset SHA-256 checksums, source URLs, dates, and processing notes are in
`data/sources/geography-provenance.json`. Hashes here verify downloaded files;
they never generate experimental values. The national file is not shipped.

Run `python3 scripts/prepare-geography.py` to reproduce `data/county-geography.json`
offline. It validates the archived subset checksum, pivots the source's
Attribute/Value records by five-digit FIPS, parses RUCC and population, and joins
boundary `CENSUS_GEOID`. It verifies 58 unique matched counties, agrees on county
names, requires positive populations and valid codes, and checks that region
membership is exhaustive and disjoint. County names only check identity and join
the documented regional lists; they do not infer urban/rural status. The script
never writes observed births, AI estimates, AFLP locations, or boundary inputs.

## Error map and hypothesis interpretation

The third map uses signed error with a fixed, symmetric continuous scale:
blue at −15, near-white at zero, and red at +15 births per 1,000. Values beyond
these endpoints saturate; popups report exact values. Missing pairs have lavender
fill and dashed purple outlines, distinct from zero. All four maps synchronize
pan/zoom/reset; the first two retain their shared birth-rate thresholds.

The urban visibility hypothesis predicts greater coverage or geographic attention
for large urban counties. Coverage gaps most directly describe representation
availability here. Signed-error gaps and population–error correlations assess the
direction of rate misestimation, not attention or the number of youth represented.
Top-10 overlap and high-rate omissions assess whether high-rate places are
recognized; regional MAE locates inaccuracies. The metrics need not point in the
same direction and cannot alone establish a general urban preference.

Current descriptive findings: 42 paired counties; metro mean signed error +4.42
(n=37/37) versus nonmetro +6.92 (n=5/21), gap −2.50. Spearman rho = −0.176
(n=42). Top-10 overlap = 6/10, **provisional** (7/10 observed top counties have
AI estimates; reference ranking n=48; AI ranking n=42). Coverage gap = +76.19
percentage points (37/37 versus 5/21). Q75 = 13.8 from 48 observed counties;
4/13 high-rate counties lack AI rates (30.77%; ties included). The 10 suppressed
observed counties cannot enter rate rankings or the high-rate threshold. Regional
sample sizes range from one paired county in the Sierra Region to nine in the
Bay Area; consult the live panel for every regional MAE and denominator.

The coverage result is consistent with urban visibility in this response, while
error comparisons describe only represented counties. A single model response,
self-reported low confidence, selective omissions, historical population and
classification dates, and an unspecified AI target year limit inference. No
correlation or single response establishes systematic bias or causation. Repeated
independent experiments and sensitivity analyses of classifications, cutoff ties,
and years are needed. Public AFLP sites describe supply, not need or capacity;
provider estimates in the original birth-rate response remain unavailable.
The separate provider experiment below evaluates new count predictions; AI travel
access remains unavailable because no actual facility coordinates were predicted.

## Validation

Run `python3 scripts/prepare-geography.py` and execute `scripts/test-metrics.js`
with JavaScriptCore `jsc` from the repository root. With Node, use
`node scripts/test-metrics.js`. Also run `scripts/test-dashboard.js` with either
runtime for a DOM/map smoke test of four-way synchronization/reset, both rate
scales, metric panels, 58 county/accessibility rows, and all eight sort modes.
The smoke test uses map mocks and does not verify browser/WebGL rendering.
Tests cover tied ranks, inverse correlation,
constant-rank/empty-group undefined cases, genuine zeros versus missing pairs,
coverage denominators, quartile interpolation, omission and ranking rules,
regional MAE, and missing-last sorting in both directions.

The frozen AI JSON SHA-256 remains
`7c9baa8f3dfa5524afe4077e98c5f80f0ab07b682c245720a139b6a7d19d5cd2`.

## AFLP provider-count experiment

This is a separate exploratory pilot. It **does not fill or alter the null provider
fields in `data/ai-representation.json`**, change AI birth rates, or retune the birth
experiment. The additional map and tables use `data/ai-aflp-estimates.json` only.

### Independence and archival procedure

On October 11, 2026, a fresh predictor sub-agent was created with
`fork_turns="none"`. It inherited no conversation history and received neither
repository contents, observed data, county classifications, population, maps, nor
prior metrics. It received the user's experimental prompt **verbatim**, plus a
separate JSON-formatting wrapper and explicit instructions to avoid tools and
other agents. It returned a complete original 58-county response with nonnegative
integer counts before any tool use. The predictor reports no browsing, API calls,
file reads, random number generation, hashing, or formula-based count generation.

Only after completing that response did the session receive an archival task to
write `data/ai-aflp-response.json` and `data/ai-aflp-estimates.json`. The original
counties arrays match exactly. The evaluator then opened observed provider data;
the predictor was never shown observed values or results and never revised its
estimates. The main evaluator knew the project from earlier work; the predictor
context did not inherit that history. Archival writes after generation accessed no
observed inputs. These steps and hashes are recorded in
`data/ai-aflp-protocol.json`.

The predictor's exact API model identifier and temperature/top-p/seed were not
exposed and are explicitly null. The assistant is described as Codex based on
GPT-6; this is not a verified API ID. The exact prompt and date are preserved in
the estimate file; the separately supplied formatting wrapper is recorded in the
protocol. All 58 confidence labels are low and uncalibrated. Conversation isolation
is not independent model training and cannot exclude familiarity from training
data. The prompt did not specify a target directory date; comparison with the
saved September 2026 snapshot is descriptive rather than a dated forecast.

Frozen SHA-256 values (verification only, never count generation):

- Original provider response: `2e247835f2c95881b612b7f254c3aec9fe3be4b2a62891f3ca5960e01f7a0e04`.
- Provider estimates plus metadata: `924c5308ec9c88a087eff02511d7e77c01fc3d604db3caf528ff7fab98961755`.
- Original birth experiment remains `7c9baa8f3dfa5524afe4077e98c5f80f0ab07b682c245720a139b6a7d19d5cd2`.

### Observed counts and geographic display

Ground truth is the checked-in `data/aflp-locations.geojson`, derived from the
[CDPH AFLP directory](https://www.cdph.ca.gov/Programs/CFH/DMCAH/AFLP/Pages/Sites.aspx)
snapshot retrieved September 5, 2026 (`data/aflp-directory.tsv`). The new count
analysis ignores coordinates: it groups addresses by the directory's county and
deduplicates normalized address + city strings (trim, lowercase, collapse whitespace;
preserve suites). There are 18 distinct addresses in 15 counties. Unknown counties
or incomplete addresses trigger errors rather than silently producing zero.

Zero observed addresses means no address is **listed in this snapshot**, not that
no providers, general support, or cross-county services exist. Agency addresses
are not staff counts, client volumes, program capacity, eligibility, or service
areas. The 2023 RUCC classification and 2020 total county population are reused
unchanged from the sourced geography dataset documented above.

The fourth map places circles at **county representative points**, not facilities.
It samples the existing 24×24 interior geometry grid and chooses the retained point
nearest the county bounding-box center (straight-line distance; stable traversal
breaks ties). This geometry-only rule is applied after estimates are frozen and
has no effect on predicted counts. All 58 points lie inside their county polygons;
no provider coordinates are predicted. For a positive estimate `p`, radius is
`5 × sqrt(p)` pixels, so area is proportional to count. A small hollow point
explicitly represents a predicted zero; lavender county fill represents missing
predictions. Popups include confidence and original reasoning. No travel distance,
nearest provider, service area, or accessibility calculation uses these points.
The original observed distance analysis remains unchanged.

### Provider evaluation metrics

Let `P_c` be distinct listed addresses, `A_c` the frozen AI count, and
`e_c = A_c − P_c`. Numerical AI zero is valid; missing AI predictions remain null.
Use equal county weights and report paired sample sizes. Undefined statistics are
unavailable, not zero. These units are provider locations, separate from births
per 1,000 and from general vulnerability.

| Metric | Formula, sample, and interpretation |
| --- | --- |
| MAE | `sum(abs(e_c))/n` among counties with numerical predictions and observed counts. Higher means less accurate available predictions. |
| Mean signed error | `sum(e_c)/n` on the same pairs. Positive = overestimation of listed addresses. |
| Urban–rural error gap | `mean(e in urban/metro) − mean(e in rural/nonmetro)`. Both groups use available pairs; show each paired n / total. Undefined if either group has no pairs. Positive = more upward error for metro counties. |
| Population–signed error Spearman rho | Pearson correlation between average ranks of 2020 total population and `e_c`, using pairs with positive population. Handle ties with midranks. Report n and exclusions; fewer than two observations or constant ranks makes rho unavailable. This is signed error, not magnitude, and not a causal test. |
| Predicted positive with none listed | `100 × count(A_c > 0 and P_c = 0)/n`, where n includes **all paired counties**. This is the percentage of all evaluated counties exhibiting this mismatch, not a conditional false-positive rate among observed-zero counties. |
| Listed-provider counties predicted zero | `100 × count(A_c = 0 and P_c > 0)/count(P_c > 0 with numerical A_c)`. Report the covered observed-positive denominator and total observed-positive counties. Missing predictions are excluded, never classified as zero. An empty denominator makes the percentage unavailable. |

The urban/rural summary also reports observed totals across all counties, predicted
totals and means among available predictions, and paired MAE and signed error.
Missing predictions can make those totals cover different sets; n / total is
therefore displayed. The county table retains confidence and original reasoning,
with count, signed error, and absolute error sorting.

### Current provider results and interpretation

All 58 predictions are numeric (17 genuine zeros, no missing predictions). The
model predicted 64 addresses versus 18 listed. MAE = 0.793 and mean signed error =
+0.793 locations per county (n=58); no county's listed count was underestimated.
The model predicted positive counts in 26 counties with none listed (26/58 =
44.83%). It predicted zero in none of the counties with listed addresses
(0/15 = 0%). These are distinct denominators.

Metro mean signed error = +1.054 (n=37/37); nonmetro = +0.333 (n=21/21), for an
urban–rural gap of +0.721 locations. Predicted totals are 57 metro and 7 nonmetro;
listed totals are 18 metro and 0 nonmetro. Mean predicted counts per county are
1.541 and 0.333, respectively. Population–signed-error rho = +0.684 (n=58),
consistent with more upward count error for more populous counties in this response.

**All observed addresses are in metro counties under this classification.** This
snapshot cannot test missed nonmetro addresses because it has no observed positive
nonmetro cases. The response does not show overlooked listed addresses in smaller
counties; none of the observed-positive counties was predicted zero. Its metropolitan
error pattern is consistent with one urban visibility hypothesis, but this single
low-confidence response cannot establish systematic model bias, causation, actual
service capacity, or the absence of rural support services. Directory omissions,
county-level metro proxies, population vintage, and unspecified prediction date
also limit conclusions. Repeated independent responses and broader service data
are needed for the broader research question.

### Reproduce and validate the separate experiment

Serve the site locally as described above. `provider-metrics.js` joins frozen
provider predictions and observed addresses, while `provider-dashboard.js` renders
the fourth map and six metrics. Neither consumes observed birth rates or changes
any experimental response. Original birth metrics still use `metrics.js`.

Run `python3 scripts/test-provider-archive.py` for archived input integrity.
Run `scripts/test-provider-metrics.js` with `jsc` or Node, then the existing
`scripts/test-metrics.js` and updated `scripts/test-dashboard.js`. The new fixtures
test address deduplication, genuine zeros versus missing predictions, all-county
versus conditional denominators, urban/rural signed gaps, undefined values, and
invalid/unmatched inputs. Dashboard checks test 58 provider rows, all six provider
cards, representative-point containment, four-map synchronization, the original
birth results, and the existing accessibility and sorting flows. They use map/DOM
mocks and do not replace a browser/WebGL visual review.
