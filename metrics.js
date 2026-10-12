/* Pure descriptive statistics. Nulls are never interpreted as numeric zero. */
'use strict';
const GeographicBias = (() => {
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  function ranks(values) {
    const sorted = values.map((value, index) => ({value, index})).sort((a, b) => a.value - b.value);
    const result = [];
    for (let i = 0; i < sorted.length;) {
      let j = i + 1;
      while (j < sorted.length && sorted[j].value === sorted[i].value) j++;
      for (let k = i; k < j; k++) result[sorted[k].index] = (i + 1 + j) / 2;
      i = j;
    }
    return result;
  }
  function spearman(x, y) {
    if (x.length !== y.length || x.length < 2 || !x.every(numeric) || !y.every(numeric)) return null;
    const a = ranks(x), b = ranks(y), ma = mean(a), mb = mean(b);
    let covariance = 0, va = 0, vb = 0;
    a.forEach((v, i) => { covariance += (v - ma) * (b[i] - mb); va += (v - ma) ** 2; vb += (b[i] - mb) ** 2; });
    return va && vb ? covariance / Math.sqrt(va * vb) : null;
  }
  function quantile(values, p) {
    if (!values.length) return null;
    const ordered = [...values].sort((a, b) => a - b), h = (ordered.length - 1) * p;
    const lo = Math.floor(h), hi = Math.ceil(h);
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (h - lo);
  }
  function join(observed, ai, geography) {
    const o = new Map(observed.map(r => [r.county, r]));
    const a = new Map(ai.map(r => [r.county, r]));
    return geography.map(g => {
      const obs = o.get(g.county)?.rate, estimate = a.get(g.county)?.estimated_birth_rate;
      const rate = numeric(obs) ? obs : null, prediction = numeric(estimate) ? estimate : null;
      const error = rate !== null && prediction !== null ? prediction - rate : null;
      return {...g, observed: rate, estimate: prediction, error, absolute_error: error === null ? null : Math.abs(error)};
    });
  }
  function sortRows(rows, key, descending = true) {
    return [...rows].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (!numeric(av) && numeric(bv)) return 1;
      if (numeric(av) && !numeric(bv)) return -1;
      return (numeric(av) && numeric(bv) ? (descending ? bv - av : av - bv) : 0) || a.county.localeCompare(b.county, 'en');
    });
  }
  function calculate(rows) {
    const paired = rows.filter(r => numeric(r.error));
    const groups = ['Urban/metro', 'Rural/nonmetro'].map(name => {
      const all = rows.filter(r => r.urban_rural === name), pairs = all.filter(r => numeric(r.error));
      const covered = all.filter(r => numeric(r.estimate)).length;
      return {name, total: all.length, paired: pairs.length, covered,
        mean_error: mean(pairs.map(r => r.error)), coverage: all.length ? covered / all.length : null};
    });
    const [u, r] = groups;
    const populationPairs = paired.filter(r => numeric(r.population_2020) && r.population_2020 > 0);
    const observedRows = rows.filter(r => numeric(r.observed)), aiRows = rows.filter(r => numeric(r.estimate));
    const observedTop = sortRows(observedRows, 'observed').slice(0, 10);
    const aiTop = sortRows(aiRows, 'estimate').slice(0, 10);
    const observedNames = new Set(observedTop.map(r => r.county));
    const overlap = aiTop.filter(r => observedNames.has(r.county)).length;
    const topCovered = observedTop.filter(r => numeric(r.estimate)).length;
    const q75 = quantile(observedRows.map(r => r.observed), .75);
    const high = observedRows.filter(r => r.observed >= q75), omissions = high.filter(r => !numeric(r.estimate));
    const regions = [...new Set(rows.map(r => r.region))].sort().map(region => {
      const all = rows.filter(r => r.region === region), pairs = all.filter(r => numeric(r.error));
      return {region, total: all.length, n: pairs.length, excluded: all.length - pairs.length, mae: mean(pairs.map(r => r.absolute_error))};
    });
    return {total: rows.length, paired: paired.length, excluded: rows.length - paired.length, groups,
      signed_gap: numeric(u.mean_error) && numeric(r.mean_error) ? u.mean_error - r.mean_error : null,
      coverage_gap: numeric(u.coverage) && numeric(r.coverage) ? 100 * (u.coverage - r.coverage) : null,
      spearman: spearman(populationPairs.map(r => r.population_2020), populationPairs.map(r => r.error)), spearman_n: populationPairs.length,
      top10: {overlap, fraction: observedTop.length === 10 && aiTop.length === 10 ? overlap / 10 : null,
        observed_n: observedRows.length, ai_n: aiRows.length, observed_top: observedTop.map(r => r.county), ai_top: aiTop.map(r => r.county),
        observed_top_covered: topCovered, provisional: topCovered < 10},
      high_rate: {threshold: q75, observed_n: observedRows.length, n: high.length, omitted: omissions.length,
        omission_rate: high.length ? omissions.length / high.length : null, omitted_counties: omissions.map(r => r.county)}, regions};
  }
  return {mean, ranks, spearman, quantile, join, sortRows, calculate};
})();
