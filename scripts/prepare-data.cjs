// Run with Node.js only when rebuilding the checked-in data; the site needs no build.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'data', file), 'utf8').replace(/^\uFEFF/, '');
const write = (file, data) => fs.writeFileSync(path.join(root, 'data', file), JSON.stringify(data));
// The supplied CSV uses unquoted fields for the indicator/age/total-population rows.
const rows = read('Data-Adolescent-Births.csv').split(/\r?\n/)
  .filter(line => line.startsWith('Adolescent Birth Rate,Ages 15-19,'))
  .map(line => line.split(','))
  .filter(row => row[4] === 'Total Population' && row[5] === 'Total population' && /^\d{4}$/.test(row[3])
    && !['California', 'United States'].includes(row[2]));
const year = Math.max(...rows.map(row => Number(row[3])));
const numeric = value => value?.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
const selected = rows.filter(row => Number(row[3]) === year).map(row => {
  const count = numeric(row[6]);
  const published = count !== null && count >= 10;
  return {county: row[2], year, rate: published ? numeric(row[8]) : null,
    births: published ? count : null, status: published ? 'Published' : 'No data (missing or suppressed)'};
});
const boundaries = JSON.parse(read('california-counties.geojson'));
if (selected.length !== 58 || new Set(selected.map(row => row.county)).size !== 58) throw Error('Expected 58 unique county rows');
for (const feature of boundaries.features) {
  if (!selected.some(row => row.county === feature.properties.CDT_NAME_SHORT)) throw Error('Unmatched county');
}
write('birth-rates.json', {year, age: '15–19', unit: 'Live births per 1,000 females ages 15–19', rows: selected});
const directory = read('aflp-directory.tsv').trim().split(/\r?\n/).slice(1).map(line => line.split('\t'));
const features = directory.map((row, index) => {
  const retry = `geocoding/${index + 1}-retry.json`;
  const file = fs.existsSync(path.join(root, 'data', retry)) ? retry : `geocoding/${index + 1}.json`;
  const matches = JSON.parse(read(file)).result.addressMatches;
  // Madera's address has no Census match. Use the OSM street segment in the
  // directory's ZIP code, explicitly labeled as a street-level approximation.
  let match = matches[0];
  let geocoder = 'US Census Public_AR_Current';
  let accuracy = 'Approximate address match';
  if (index === 9 && matches.length === 0) {
    const street = JSON.parse(read('geocoding/10-osm.json')).find(item => item.display_name.includes('93638'));
    if (!street || street.name !== 'Sunrise Avenue') throw Error('Review Madera street match');
    match = {coordinates: {x: Number(street.lon), y: Number(street.lat)}, matchedAddress: street.display_name};
    geocoder = 'OpenStreetMap Nominatim';
    accuracy = 'Street-level approximation on Sunrise Avenue, 93638; exact address could not be geocoded';
  } else if (matches.length !== 1) throw Error(`Review geocoder match for ${row[1]}: ${matches.length}`);
  const {x, y} = match.coordinates;
  if (!(x > -125 && x < -114 && y > 32 && y < 43)) throw Error('Coordinate outside California extent');
  return {type: 'Feature', geometry: {type: 'Point', coordinates: [x,y]}, properties: {
    provider: row[1].trim(), county: row[0], address: row[5], city: row[6], website: row[2],
    matchedAddress: match.matchedAddress, geocoder, accuracy, retrieved: '2026-09-05'}};
});
write('aflp-locations.geojson', {type: 'FeatureCollection', features});
console.log(`${year}: ${selected.length} counties, ${selected.filter(row => row.rate !== null).length} published rates, ${features.length} AFLP locations.`);
