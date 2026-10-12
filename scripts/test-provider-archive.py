"""Verify frozen experimental/evaluation inputs without rewriting them."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
def read(path): return json.loads((root / path).read_text())
protocol = read('data/ai-aflp-protocol.json')
for path, expected in protocol['frozen_input_sha256'].items():
    assert hashlib.sha256((root / path).read_bytes()).hexdigest() == expected, path
estimates = read('data/ai-aflp-estimates.json')
assert estimates['counties'] == read('data/ai-aflp-response.json')['counties']
assert len(estimates['counties']) == 58
assert {r['county'] for r in estimates['counties']} == {r['county'] for r in read('data/county-geography.json')['rows']}
assert all(type(r['estimated_provider_count']) is int and r['estimated_provider_count'] >= 0 for r in estimates['counties'])
assert all(r['confidence'] == 'low' for r in estimates['counties'])
assert all(r['estimated_provider_count'] is None for r in read('data/ai-representation.json')['counties'])
print('PASS: frozen original/new experiments and evaluation input hashes; all 58 original prediction rows match; original provider nulls preserved.')
