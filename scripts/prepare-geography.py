"""Offline conversion of archived USDA California rows and documented Caltrans regions."""
import csv, json, hashlib
from pathlib import Path
root = Path(__file__).resolve().parent.parent
def read(name): return json.loads((root / name).read_text())
metadata = read('data/sources/geography-provenance.json')
regions = read('data/sources/caltrans-regions-2020.json')
region_by_county = {}
for region, counties in regions['regions'].items():
    for county in counties:
        assert county not in region_by_county, county
        region_by_county[county] = region
raw = root / 'data/sources/rucc2023-california.csv'
assert hashlib.sha256(raw.read_bytes()).hexdigest() == metadata['california_csv_sha256']
by_fips = {}
with raw.open(newline='') as f:
    for row in csv.DictReader(f):
        assert row['State'] == 'CA' and row['FIPS'].startswith('06')
        target = by_fips.setdefault(row['FIPS'], {'county': row['County_Name'].removesuffix(' County')})
        assert row['Attribute'] not in target
        target[row['Attribute']] = row['Value']
boundaries = read('data/california-counties.geojson')['features']
assert len(by_fips) == len(boundaries) == len(region_by_county) == 58
rows = []
for feature in boundaries:
    fips = feature['properties']['CENSUS_GEOID']
    source = by_fips[fips]
    county = feature['properties']['CDT_NAME_SHORT']
    assert source['county'] == county
    code, population = int(source['RUCC_2023']), int(source['Population_2020'])
    assert 1 <= code <= 9 and population > 0
    rows.append({'county': county, 'fips': fips, 'rucc_2023': code,
                 'urban_rural': 'Urban/metro' if code <= 3 else 'Rural/nonmetro',
                 'population_2020': population, 'region': region_by_county[county]})
(root / 'data/county-geography.json').write_text(json.dumps({'provenance': metadata,
    'region_source': regions['source'], 'rows': sorted(rows, key=lambda r: r['county'])}, indent=2) + '\n')
print('Validated 58 FIPS joins, RUCC codes, populations, and region assignments.')
