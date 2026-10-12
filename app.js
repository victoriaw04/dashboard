/* All displayed data and map assets are local; no online basemap is requested. */
'use strict';
const bounds = [[-124.5, 32.45], [-114.1, 42.05]];
const statusElement = document.getElementById('status');
const scenarioStatus = document.getElementById('scenario-status');
async function readJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json();
}
function popupContent(title, lines) {
  const content = document.createElement('div');
  const heading = document.createElement('h3');
  heading.textContent = title;
  content.append(heading);
  for (const line of lines) {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    content.append(paragraph);
  }
  return content;
}
function createMap(container, status, attribution) {
  const map = new maplibregl.Map({container,
    style: {version: 8, sources: {}, layers: [{id: 'background', type: 'background',
      paint: {'background-color': '#f0f2ef'}}]},
    bounds, fitBoundsOptions: {padding: 28},
    attributionControl: false, maxZoom: 14, minZoom: 2});
  map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
  map.addControl(new maplibregl.AttributionControl({compact: true, customAttribution: attribution}));
  map.on('error', event => {
    console.error(event.error);
    status.classList.add('error');
    status.textContent = 'Some local map resources could not load. Reload the local preview.';
  });
  return map;
}
function addCounties(map, data) {
  map.addSource('county-births', {type: 'geojson', data});
  map.addLayer({id: 'county-fill', type: 'fill', source: 'county-births', paint: {
    'fill-color': ['case', ['==', ['get', 'rate'], null], '#d6d6d6',
      ['step', ['get', 'rate'], '#edf4f2', 5, '#b7d7d0', 10, '#70ada5', 15, '#34796f', 20, '#164d48']]}});
  map.addLayer({id: 'county-outline', type: 'line', source: 'county-births', paint: {
    'line-color': '#60756f', 'line-width': 0.8}});
}
function addInteractions(map, pointLayer, describe) {
  let popup;
  map.on('click', event => {
    const point = map.queryRenderedFeatures(event.point, {layers: [pointLayer]})[0];
    const county = map.queryRenderedFeatures(event.point, {layers: ['county-fill']})[0];
    if (!point && !county) return;
    if (popup) popup.remove();
    popup = new maplibregl.Popup({maxWidth: '290px'}).setLngLat(event.lngLat)
      .setDOMContent(describe(point, county)).addTo(map);
  });
  for (const layer of ['county-fill', pointLayer]) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  }
}
function synchronize(maps) {
  let syncing = false;
  maps.forEach(map => map.on('move', () => {
    if (syncing) return;
    syncing = true;
    try {
      maps.filter(other => other !== map).forEach(other => other.jumpTo({center: map.getCenter(), zoom: map.getZoom(),
        bearing: map.getBearing(), pitch: map.getPitch()}));
    } finally { syncing = false; }
  }));
  document.getElementById('reset-maps').addEventListener('click', () => {
    maps.forEach(map => map.stop());
    maps[0].fitBounds(bounds, {padding: 28, duration: 0});
  });
}
function formatMiles(value) {
  return value == null ? 'Unavailable' : `${value.toFixed(1)} mi`;
}
function countyAccessLine(averages, county) {
  return `County average to nearest provider: ${formatMiles(averages.get(county))} (straight-line, area sample)`;
}
function buildAccessSummary(boundaries, locations) {
  const observed = new Map();
  const rows = document.getElementById('access-rows');
  const select = document.getElementById('access-county');
  for (const feature of [...boundaries.features].sort((a, b) =>
    a.properties.CDT_NAME_SHORT.localeCompare(b.properties.CDT_NAME_SHORT))) {
    const county = feature.properties.CDT_NAME_SHORT;
    const points = ProviderAccess.samples(feature.geometry);
    observed.set(county, ProviderAccess.average(points, locations));
    const option = document.createElement('option');
    option.value = county; option.textContent = county; select.append(option);
    const tr = document.createElement('tr');
    [county, formatMiles(observed.get(county)), 'Unavailable'].forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = value; tr.append(cell);
    });
    rows.append(tr);
  }
  select.addEventListener('change', () => {
    document.getElementById('access-county-detail').textContent = select.value ?
      `${select.value} County — average straight-line distance to nearest listed AFLP: ${formatMiles(observed.get(select.value))}; AI accessibility unavailable (no predicted provider locations).` :
      'Choose a county to compare its average distance to the nearest provider.';
  });
  return {observed};
}
function addAccessHover(map, panelId, providers, averages) {
  const panel = document.getElementById(panelId);
  const heading = document.createElement('strong');
  const time = document.createElement('p'); time.className = 'access-time';
  const distance = document.createElement('p');
  const provider = document.createElement('p');
  const county = document.createElement('p');
  const note = document.createElement('small');
  note.textContent = 'Illustrative time = straight-line miles ÷ 30 mph. No road routing.';
  panel.replaceChildren(heading, time, distance, provider, county, note);
  function reset() {
    heading.textContent = 'Nearest listed provider';
    time.textContent = '';
    distance.textContent = 'Hover anywhere on the map, or tap, to estimate distance and time.';
    provider.textContent = ''; county.textContent = '';
  }
  reset();
  let pointer = null, frame = null;
  function render() {
    frame = null;
    if (!pointer) return;
    const lngLat = map.unproject(pointer);
    const nearest = ProviderAccess.nearest([lngLat.lng, lngLat.lat], providers);
    if (!nearest) {
      reset(); distance.textContent = 'No provider locations available for this map.'; return;
    }
    const feature = map.queryRenderedFeatures(pointer, {layers: ['county-fill']})[0];
    const name = feature?.properties.county;
    heading.textContent = 'Nearest listed AFLP provider';
    const minutes = ProviderAccess.minutes(nearest.miles);
    time.textContent = minutes < 1 ? '<1 min (illustrative)' : `~${Math.round(minutes).toLocaleString()} min (illustrative)`;
    distance.textContent = `${formatMiles(nearest.miles)} straight-line from this point`;
    provider.textContent = nearest.provider.properties.provider;
    county.textContent = name ? `${name} County average: ${formatMiles(averages.get(name))} to nearest listed provider` :
      'Outside mapped counties · no county average';
  }
  function schedule() { if (frame === null) frame = requestAnimationFrame(render); }
  map.on('mousemove', event => { pointer = event.point; schedule(); });
  map.on('click', event => { pointer = event.point; schedule(); });
  // Recalculate for a stationary pointer while zooming or panning either map.
  map.on('move', () => { if (pointer) schedule(); });
  map.getCanvas().addEventListener('mouseleave', () => { pointer = null; reset(); });
}
function displayNumber(value, signed = false, digits = 1) {
  return value == null ? 'Unavailable' : `${signed && value > 0 ? '+' : ''}${Number(value).toFixed(digits)}`;
}
function renderStatistics(s) {
  const panel = document.getElementById('metric-cards');
  const [u, r] = s.groups;
  function card(title, value, interpretation, sample, limitation) {
    const article = document.createElement('article');
    const heading = document.createElement('h3'); heading.textContent = title;
    const number = document.createElement('p'); number.className = 'metric-value'; number.textContent = value;
    article.append(heading); article.append(number);
    for (const text of [interpretation, 'Sample: ' + sample, 'Missing-data limitation: ' + limitation]) {
      const p = document.createElement('p'); p.textContent = text; article.append(p);
    }
    panel.append(article);
  }
  card('Urban–rural mean signed error gap', displayNumber(s.signed_gap, true) + ' births / 1,000',
    `Urban/metro mean (${displayNumber(u.mean_error, true)}) minus rural/nonmetro mean (${displayNumber(r.mean_error, true)}). Positive = more upward error in urban counties.`,
    `urban ${u.paired}/${u.total}; rural ${r.paired}/${r.total} paired counties`,
    `${s.excluded} unpaired counties excluded; unequal coverage may change this contrast.`);
  card('Population–signed error Spearman correlation', displayNumber(s.spearman, true, 3),
    'Correlation of 2020 total population rank with signed error rank. Positive = larger counties tend toward more upward error; this does not measure error magnitude.',
    `${s.spearman_n} paired counties with population; ${s.total - s.spearman_n} excluded`,
    'Requires both rates and population; average ranks handle ties. Undefined with constant ranks. Complete-case association is not causal or proof of systematic bias.');
  card('Top-10 birth-rate overlap' + (s.top10.provisional ? ' · Provisional' : ''),
    s.top10.fraction == null ? 'Unavailable (fewer than 10 ranked counties)' : `${s.top10.overlap}/10 (${(100*s.top10.fraction).toFixed(0)}%)`,
    'Shared counties in separately ranked observed and AI top-10 lists. Equal rates break ties alphabetically; this is rate agreement, not absolute birth-count agreement.',
    `${s.top10.observed_n} observed rates; ${s.top10.ai_n} AI rates; ${s.top10.observed_top_covered}/10 observed top counties have AI estimates`,
    `Observed top-10: ${s.top10.observed_top.join(', ')}. AI top-10: ${s.top10.ai_top.join(', ')}. Missing AI rates cannot rank; observed suppression limits the reference ranking. Rankings are provisional when fewer than 10 observed top-rate counties have AI estimates.`);
  card('Urban–rural AI coverage gap', displayNumber(s.coverage_gap, true) + ' percentage points',
    `Urban/metro (${displayNumber(u.coverage == null ? null : u.coverage*100)}%) minus rural/nonmetro (${displayNumber(r.coverage == null ? null : r.coverage*100)}%) with numerical AI rates. Positive = greater urban coverage.`,
    `urban ${u.covered}/${u.total}; rural ${r.covered}/${r.total}; all ${s.total} counties`,
    'No observed rate required. Missing AI estimates are omissions in coverage, never zero birth rates. Provider estimates are unavailable statewide.');
  card('High-birth-rate county omission rate', displayNumber(s.high_rate.omission_rate == null ? null : 100*s.high_rate.omission_rate) + '%',
    `Share lacking an AI rate among observed rates ≥ the 75th percentile (${displayNumber(s.high_rate.threshold, false, 2)} per 1,000). Quantile uses linear interpolation; threshold ties are included.`,
    `${s.high_rate.omitted}/${s.high_rate.n} high-rate counties omitted; threshold from ${s.high_rate.observed_n} observed counties`,
    `${s.total-s.high_rate.observed_n} missing/suppressed observed rates excluded from the threshold and denominator. Omitted: ${s.high_rate.omitted_counties.join(', ') || 'none'}. High birth rate does not measure general vulnerability.`);
  const regionList = document.createElement('div'); regionList.className = 'table-scroll';
  const table = document.createElement('table');
  const caption = document.createElement('caption'); caption.textContent = 'Mean absolute error by Caltrans region · births per 1,000'; table.append(caption);
  const head = document.createElement('thead'), hr = document.createElement('tr');
  for (const label of ['Region', 'MAE', 'Paired n / total', 'Excluded']) { const th = document.createElement('th'); th.scope='col'; th.textContent=label; hr.append(th); }
  head.append(hr); table.append(head);
  const body = document.createElement('tbody');
  for (const row of s.regions) {
    const tr = document.createElement('tr');
    [row.region, displayNumber(row.mae), `${row.n}/${row.total}`, row.excluded].forEach((v,i) => {const cell=document.createElement(i ? 'td' : 'th'); if (!i) cell.scope='row'; cell.textContent=v; tr.append(cell);});
    body.append(tr);
  }
  table.append(body); regionList.append(table); document.getElementById('region-statistics').append(regionList);
}
async function start() {
  const [boundaries, births, locations, scenario, geography, providerExperiment] = await Promise.all([
    readJSON('./data/california-counties.geojson'), readJSON('./data/birth-rates.json'),
    readJSON('./data/aflp-locations.geojson'), readJSON('./data/ai-representation.json'),
    readJSON('./data/county-geography.json'), readJSON('./data/ai-aflp-estimates.json')
  ]);
  const byCounty = new Map(births.rows.map(row => [row.county.trim().toLowerCase(), row]));
  const aiByCounty = new Map(scenario.counties.map(row => [row.county, row]));
  const counties = {type: 'FeatureCollection', features: boundaries.features.map(feature => {
    const county = feature.properties.CDT_NAME_SHORT;
    const row = byCounty.get(county.trim().toLowerCase());
    return {...feature, properties: {county, rate: row?.rate ?? null, births: row?.births ?? null, year: births.year}};
  })};
  const aiCounties = {type: 'FeatureCollection', features: boundaries.features.map(feature => {
    const county = feature.properties.CDT_NAME_SHORT;
    const row = aiByCounty.get(county);
    if (!row) throw new Error(`Missing AI county: ${county}`);
    return {...feature, properties: {county, rate: row.estimated_birth_rate, confidence: row.confidence, reasoning: row.reasoning}};
  })};
  const access = buildAccessSummary(boundaries, locations.features);
  const comparison = GeographicBias.join(births.rows, scenario.counties, geography.rows);
  const statistics = GeographicBias.calculate(comparison);
  renderStatistics(statistics);
  const errorByCounty = new Map(comparison.map(row => [row.county, row]));
  const errors = {type: 'FeatureCollection', features: boundaries.features.map(feature => ({
    ...feature, properties: errorByCounty.get(feature.properties.CDT_NAME_SHORT)
  }))};
  const tbody = document.getElementById('scenario-rows');
  function renderTable() {
    tbody.replaceChildren();
    const key = document.getElementById('table-sort').value;
    const descending = document.getElementById('table-direction').value === 'descending';
    for (const row of GeographicBias.sortRows(comparison, key, descending)) {
      const ai = aiByCounty.get(row.county);
      const count = locations.features.filter(f => f.properties.county === row.county).length;
      const tr = document.createElement('tr');
      [row.county, row.urban_rural, row.region, row.population_2020.toLocaleString(),
        displayNumber(row.observed), displayNumber(row.estimate), displayNumber(row.error, true), displayNumber(row.absolute_error),
        count, ai.estimated_provider_count ?? 'Unavailable', ai.confidence,
        ai.reasoning + ' Provider estimate: ' + ai.provider_count_unavailable_reason].forEach((value, index) => {
        const cell = document.createElement(index === 0 ? 'th' : 'td');
        if (index === 0) cell.scope = 'row';
        cell.textContent = value; tr.append(cell);
      });
      tbody.append(tr);
    }
    document.getElementById('table-sort-status').textContent = `58 counties sorted by ${key.replaceAll('_', ' ')} (${descending ? 'descending' : 'ascending'}); unavailable values last.`;
  }
  for (const id of ['table-sort', 'table-direction']) document.getElementById(id).addEventListener('change', renderTable);
  renderTable();
  const paired = comparison.filter(row => row.error !== null);
  document.getElementById('bias-summary').textContent = `${paired.length} paired counties; ${statistics.excluded} excluded. Mean signed error: ${displayNumber(GeographicBias.mean(paired.map(r => r.error)), true)}; mean absolute error: ${displayNumber(GeographicBias.mean(paired.map(r => r.absolute_error)))} births per 1,000. County-weighted, not population-weighted.`;
  const map = createMap('map', statusElement, 'CDPH · California Department of Technology');
  const nextMap = createMap('scenario-map', scenarioStatus, 'AI estimates · Boundaries: California Department of Technology');
  const errorStatus = document.getElementById('error-status');
  const errorMap = createMap('error-map', errorStatus, 'AI − CDPH 2024 · Boundaries: California Department of Technology');
  const providerMap = renderProviderExperiment(boundaries, locations, providerExperiment, geography);
  synchronize([map, nextMap, errorMap, providerMap]);
  errorMap.on('load', () => {
    errorMap.addSource('county-births', {type: 'geojson', data: errors});
    errorMap.addLayer({id: 'county-fill', type: 'fill', source: 'county-births', paint: {
      'fill-color': ['case', ['==', ['get', 'error'], null], '#b8b4c7',
        ['interpolate', ['linear'], ['get', 'error'], -15, '#2166ac', 0, '#f7f7f7', 15, '#b2182b']]}});
    errorMap.addLayer({id: 'county-outline', type: 'line', source: 'county-births', paint: {'line-color': '#60756f', 'line-width': .8}});
    errorMap.addLayer({id: 'missing-outline', type: 'line', source: 'county-births',
      filter: ['==', ['get', 'error'], null], paint: {'line-color': '#514368', 'line-width': 2, 'line-dasharray': [2, 2]}});
    errorMap.addSource('empty', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
    errorMap.addLayer({id: 'empty-points', type: 'circle', source: 'empty'});
    addInteractions(errorMap, 'empty-points', (_, county) => {
      const p = county.properties;
      return popupContent(p.county + ' County · Estimation error', [
        `Observed 2024 rate: ${displayNumber(p.observed)}`, `AI rate: ${displayNumber(p.estimate)}`,
        `AI − observed: ${displayNumber(p.error, true)} births per 1,000 females ages 15–19`,
        p.error == null ? 'Excluded: observed rate or AI estimate is unavailable; this is not zero error.' : 'Positive = overestimate; negative = underestimate.',
        `${p.urban_rural} · ${p.region} · 2020 population: ${Number(p.population_2020).toLocaleString()}`]);
    });
    if (!errorStatus.classList.contains('error')) errorStatus.textContent = `${statistics.paired} paired counties · ${statistics.excluded} missing pairs · Fixed symmetric ±15 scale; extremes saturate`;
  });
  map.on('load', () => {
    addCounties(map, counties);
    addAccessHover(map, 'access-hover', locations.features, access.observed);
    map.addSource('aflp', {type: 'geojson', data: locations});
    map.addLayer({id: 'aflp-points', type: 'circle', source: 'aflp', paint: {
      'circle-radius': 6, 'circle-color': '#ba562e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2}});
    addInteractions(map, 'aflp-points', (point, county) => {
      if (point) {
        const p = point.properties;
        return popupContent(p.provider, [p.county + ' County', p.address, p.city,
          'Public directory mailing address', p.accuracy]);
      }
      const p = county.properties;
      return popupContent(p.county + ' County', [
        p.rate == null ? 'Adolescent birth rate: No data (missing or suppressed)' :
          `${Number(p.rate).toFixed(1)} live births per 1,000 females, ages 15–19`,
        ...(p.births == null ? [] : [`Live births: ${Number(p.births).toLocaleString()}`]), `Year: ${p.year}`,
        countyAccessLine(access.observed, p.county)]);
    });
    if (!statusElement.classList.contains('error')) {
      const available = counties.features.filter(f => f.properties.rate !== null).length;
      statusElement.textContent = `${counties.features.length} counties · ${available} published rates · ${counties.features.length - available} no data · ${locations.features.length} listed AFLP locations`;
    }
  });
  nextMap.on('load', () => {
    addCounties(nextMap, aiCounties);
    // No provider coordinates were generated; an empty layer supports county interactions.
    nextMap.addSource('providers', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
    nextMap.addLayer({id: 'provider-circles', type: 'circle', source: 'providers'});
    addInteractions(nextMap, 'provider-circles', (_, county) => {
      const p = county.properties;
      return popupContent(p.county + ' County · AI estimate', [
        p.rate == null ? 'Birth-rate estimate unavailable: insufficient knowledge' :
          `Estimated birth rate: ${Number(p.rate).toFixed(1)} per 1,000 females ages 15–19`,
        `Confidence: ${p.confidence}`, p.reasoning,
        'Provider count and locations: unavailable; this does not mean zero providers.']);
    });
    if (!scenarioStatus.classList.contains('error')) {
      const available = scenario.counties.filter(row => row.estimated_birth_rate != null).length;
      scenarioStatus.textContent = `58 counties · ${available} estimates · ${58 - available} unavailable · All confidence low · Generated ${scenario.generation_date}`;
    }
  });
}
start().catch(error => {
  console.error(error);
  for (const status of [statusElement, scenarioStatus, document.getElementById('error-status'), document.getElementById('provider-map-status')]) {
    status.classList.add('error');
    status.textContent = 'The comparison could not load. Serve this folder through a local static preview and check that WebGL is available.';
  }
});
