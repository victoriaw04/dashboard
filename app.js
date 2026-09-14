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
  maps.forEach((map, index) => map.on('move', () => {
    if (syncing) return;
    syncing = true;
    try {
      maps[1 - index].jumpTo({center: map.getCenter(), zoom: map.getZoom(),
        bearing: map.getBearing(), pitch: map.getPitch()});
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
function buildAccessSummary(boundaries, locations, hubs, scenario) {
  const observed = new Map(), synthetic = new Map();
  const rows = document.getElementById('access-rows');
  const select = document.getElementById('access-county');
  const anchors = new Map(scenario.rows.map(row => [row.county, row.coordinates]));
  for (const feature of [...boundaries.features].sort((a, b) =>
    a.properties.CDT_NAME_SHORT.localeCompare(b.properties.CDT_NAME_SHORT))) {
    const county = feature.properties.CDT_NAME_SHORT;
    const points = ProviderAccess.samples(feature.geometry, anchors.get(county));
    observed.set(county, ProviderAccess.average(points, locations));
    synthetic.set(county, ProviderAccess.average(points, hubs));
    const option = document.createElement('option');
    option.value = county; option.textContent = county; select.append(option);
    const tr = document.createElement('tr');
    [county, formatMiles(observed.get(county)), formatMiles(synthetic.get(county))].forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = value; tr.append(cell);
    });
    rows.append(tr);
  }
  select.addEventListener('change', () => {
    document.getElementById('access-county-detail').textContent = select.value ?
      `${select.value} County — average straight-line distance to nearest listed AFLP: ${formatMiles(observed.get(select.value))}; nearest fictional hub: ${formatMiles(synthetic.get(select.value))}.` :
      'Choose a county to compare its average distance to the nearest provider.';
  });
  return {observed, synthetic};
}
function addAccessHover(map, panelId, providers, averages, synthetic) {
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
    heading.textContent = synthetic ? 'Nearest fictional hub' : 'Nearest listed provider';
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
    heading.textContent = synthetic ? 'Synthetic · nearest fictional hub' : 'Nearest listed AFLP provider';
    const minutes = ProviderAccess.minutes(nearest.miles);
    time.textContent = minutes < 1 ? '<1 min (illustrative)' : `~${Math.round(minutes).toLocaleString()} min (illustrative)`;
    distance.textContent = `${formatMiles(nearest.miles)} straight-line from this point`;
    provider.textContent = synthetic ? `${nearest.provider.properties.county} County fictional hub` : nearest.provider.properties.provider;
    county.textContent = name ? `${name} County average: ${formatMiles(averages.get(name))} to nearest ${synthetic ? 'fictional hub' : 'listed provider'}` :
      'Outside mapped counties · no county average';
  }
  function schedule() { if (frame === null) frame = requestAnimationFrame(render); }
  map.on('mousemove', event => { pointer = event.point; schedule(); });
  map.on('click', event => { pointer = event.point; schedule(); });
  // Recalculate for a stationary pointer while zooming or panning either map.
  map.on('move', () => { if (pointer) schedule(); });
  map.getCanvas().addEventListener('mouseleave', () => { pointer = null; reset(); });
}
async function start() {
  const [boundaries, births, locations, scenario] = await Promise.all([
    readJSON('./data/california-counties.geojson'), readJSON('./data/birth-rates.json'),
    readJSON('./data/aflp-locations.geojson'), readJSON('./data/synthetic-scenario.json')
  ]);
  const byCounty = new Map(births.rows.map(row => [row.county.trim().toLowerCase(), row]));
  const syntheticByCounty = new Map(scenario.rows.map(row => [row.county, row]));
  const counties = {type: 'FeatureCollection', features: boundaries.features.map(feature => {
    const county = feature.properties.CDT_NAME_SHORT;
    const row = byCounty.get(county.trim().toLowerCase());
    return {...feature, properties: {county, rate: row?.rate ?? null, births: row?.births ?? null, year: births.year}};
  })};
  const syntheticCounties = {type: 'FeatureCollection', features: boundaries.features.map(feature => {
    const county = feature.properties.CDT_NAME_SHORT;
    const row = syntheticByCounty.get(county);
    if (!row) throw new Error(`Missing synthetic county: ${county}`);
    return {...feature, properties: {county, rate: row.rate, providers: row.providers}};
  })};
  const providerPoints = {type: 'FeatureCollection', features: scenario.rows.map(row => ({
    type: 'Feature', geometry: {type: 'Point', coordinates: row.coordinates},
    properties: {county: row.county, rate: row.rate, providers: row.providers}
  }))};
  const hubs = providerPoints.features.filter(feature => feature.properties.providers > 0);
  const access = buildAccessSummary(boundaries, locations.features, hubs, scenario);
  const tbody = document.getElementById('scenario-rows');
  for (const row of [...scenario.rows].sort((a, b) => a.county.localeCompare(b.county))) {
    const tr = document.createElement('tr');
    [row.county, row.rate.toFixed(1), row.providers].forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = value;
      tr.append(cell);
    });
    tbody.append(tr);
  }
  const map = createMap('map', statusElement, 'CDPH · California Department of Technology');
  const nextMap = createMap('scenario-map', scenarioStatus, 'Synthetic values · Boundaries: California Department of Technology');
  synchronize([map, nextMap]);
  map.on('load', () => {
    addCounties(map, counties);
    addAccessHover(map, 'access-hover', locations.features, access.observed, false);
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
    addCounties(nextMap, syntheticCounties);
    addAccessHover(nextMap, 'scenario-access-hover', hubs, access.synthetic, true);
    nextMap.addSource('providers', {type: 'geojson', data: providerPoints});
    nextMap.addLayer({id: 'provider-circles', type: 'circle', source: 'providers',
      filter: ['>', ['get', 'providers'], 0], paint: {
        // Radius is proportional to sqrt(count), so circle area encodes count.
        'circle-radius': ['*', 5, ['sqrt', ['get', 'providers']]],
        'circle-color': '#925126', 'circle-opacity': 0.8,
        'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5}});
    addInteractions(nextMap, 'provider-circles', (point, county) => {
      const p = (point || county).properties;
      return popupContent(p.county + ' County · Synthetic', [
        `Invented birth rate: ${Number(p.rate).toFixed(1)} per 1,000 females, ages 15–19`,
        `Invented providers: ${p.providers}`,
        countyAccessLine(access.synthetic, p.county),
        'Fictional demonstration only. County totals, not actual provider sites or estimates.']);
    });
    if (!scenarioStatus.classList.contains('error')) {
      scenarioStatus.textContent = `${scenario.rows.length} counties · All rates and provider counts are invented`;
    }
  });
}
start().catch(error => {
  console.error(error);
  for (const status of [statusElement, scenarioStatus]) {
    status.classList.add('error');
    status.textContent = 'The comparison could not load. Serve this folder through a local static preview and check that WebGL is available.';
  }
});
