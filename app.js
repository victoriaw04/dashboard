/* All project assets are relative; the vector basemap requires public tile services. */
'use strict';
const statusElement = document.getElementById('status');
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
async function start() {
  const [counties, births, locations, style] = await Promise.all([
    readJSON('./data/california-counties.geojson'), readJSON('./data/birth-rates.json'),
    readJSON('./data/aflp-locations.geojson'), readJSON('./data/basemap-style.json')
  ]);
  const byCounty = new Map(births.rows.map(row => [row.county.trim().toLowerCase(), row]));
  for (const feature of counties.features) {
    const county = feature.properties.CDT_NAME_SHORT;
    const row = byCounty.get(county.trim().toLowerCase());
    feature.properties = {county, rate: row?.rate ?? null, births: row?.births ?? null, year: births.year};
  }
  const map = new maplibregl.Map({container: 'map', style,
    bounds: [[-124.5,32.45],[-114.1,42.05]], fitBoundsOptions: {padding: 28},
    attributionControl: false, maxZoom: 14, minZoom: 4});
  map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
  map.addControl(new maplibregl.AttributionControl({compact: false, customAttribution:
    'CDPH · California Department of Technology'}));
  map.on('error', event => {
    console.error(event.error);
    statusElement.classList.add('error');
    statusElement.textContent = 'Some map resources could not load. Check your internet connection and reload.';
  });
  map.on('load', () => {
    map.addSource('county-births', {type: 'geojson', data: counties});
    const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
    map.addLayer({id: 'county-fill', type: 'fill', source: 'county-births', paint: {
      'fill-color': ['case', ['==', ['get', 'rate'], null], '#d6d6d6',
        ['step', ['get', 'rate'], '#edf4f2', 5, '#b7d7d0', 10, '#70ada5', 15, '#34796f', 20, '#164d48']],
      'fill-opacity': 0.83}}, firstLabel);
    map.addLayer({id: 'county-outline', type: 'line', source: 'county-births', paint: {
      'line-color': '#60756f', 'line-width': 0.8}}, firstLabel);
    map.addSource('aflp', {type: 'geojson', data: locations});
    map.addLayer({id: 'aflp-points', type: 'circle', source: 'aflp', paint: {
      'circle-radius': 6, 'circle-color': '#ba562e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2}});
    map.on('click', event => {
      const point = map.queryRenderedFeatures(event.point, {layers: ['aflp-points']})[0];
      const county = map.queryRenderedFeatures(event.point, {layers: ['county-fill']})[0];
      if (!point && !county) return;
      let content;
      if (point) {
        const p = point.properties;
        content = popupContent(p.provider, [p.county + ' County', p.address, p.city,
          'Public directory mailing address', p.accuracy]);
      } else {
        const p = county.properties;
        content = popupContent(p.county + ' County', [
          p.rate == null ? 'Adolescent birth rate: No data (missing or suppressed)' :
            `${Number(p.rate).toFixed(1)} live births per 1,000 females, ages 15–19`,
          ...(p.births == null ? [] : [`Live births: ${Number(p.births).toLocaleString()}`]), `Year: ${p.year}`]);
      }
      new maplibregl.Popup({maxWidth: '290px'}).setLngLat(event.lngLat).setDOMContent(content).addTo(map);
    });
    for (const layer of ['county-fill', 'aflp-points']) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    }
    if (!statusElement.classList.contains('error')) {
      const available = counties.features.filter(f => f.properties.rate !== null).length;
      statusElement.textContent = `${counties.features.length} counties · ${available} published rates · ${counties.features.length - available} no data · ${locations.features.length} listed AFLP locations`;
    }
  });
}
start().catch(error => {
  console.error(error);
  statusElement.classList.add('error');
  statusElement.textContent = 'The map could not load. Check your connection and serve this folder through GitHub Pages or a local static preview.';
});
