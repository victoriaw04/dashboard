/* Separate AFLP-count experiment. No birth-rate data are consumed here. */
'use strict';
const ProviderBias = (() => {
  const count = value => Number.isInteger(value) && value >= 0;
  function join(features, estimates, geography) {
    const observed = new Map(geography.map(g => [g.county, new Set()]));
    // Closed-directory count: zero means no listed address in this snapshot.
    for (const feature of features) {
      const p = feature.properties;
      if (!observed.has(p.county) || !p.address?.trim() || !p.city?.trim()) throw Error('Unmatched or incomplete AFLP address');
      const normalize = text => text.trim().toLowerCase().replace(/\s+/g, ' ');
      observed.get(p.county).add(normalize(p.address) + '|' + normalize(p.city));
    }
    const byCounty = new Map();
    for (const row of estimates) {
      if (byCounty.has(row.county) || !observed.has(row.county)) throw Error('Duplicate or unmatched AI AFLP county');
      if (row.estimated_provider_count != null && !count(row.estimated_provider_count)) throw Error('Invalid AI AFLP count');
      byCounty.set(row.county, row);
    }
    return geography.map(g => {
      const ai = byCounty.get(g.county), estimate = ai?.estimated_provider_count ?? null;
      const actual = observed.get(g.county).size, error = estimate === null ? null : estimate - actual;
      return {...g, observed: actual, estimate, error, absolute_error: error === null ? null : Math.abs(error),
        confidence: ai?.confidence ?? 'unavailable', reasoning: ai?.reasoning ?? 'No prediction supplied.'};
    });
  }
  function calculate(rows) {
    const paired = rows.filter(r => r.error !== null), mean = GeographicBias.mean;
    const groups = ['Urban/metro', 'Rural/nonmetro'].map(name => {
      const all = rows.filter(r => r.urban_rural === name), pairs = all.filter(r => r.error !== null);
      return {name, total: all.length, n: pairs.length, excluded: all.length-pairs.length,
        observed_total: all.reduce((sum,r) => sum+r.observed,0),
        predicted_total: pairs.length ? pairs.reduce((sum,r) => sum+r.estimate,0) : null,
        predicted_mean: mean(pairs.map(r => r.estimate)),
        mean_error: mean(pairs.map(r => r.error)), mae: mean(pairs.map(r => r.absolute_error))};
    });
    const pop = paired.filter(r => typeof r.population_2020 === 'number' && Number.isFinite(r.population_2020) && r.population_2020 > 0);
    const falsePositives = paired.filter(r => r.estimate > 0 && r.observed === 0);
    const observedPositive = paired.filter(r => r.observed > 0), falseNegatives = observedPositive.filter(r => r.estimate === 0);
    return {total: rows.length, n: paired.length, excluded: rows.length-paired.length,
      mae: mean(paired.map(r => r.absolute_error)), mean_error: mean(paired.map(r => r.error)), groups,
      signed_gap: groups.every(g => g.mean_error !== null) ? groups[0].mean_error-groups[1].mean_error : null,
      spearman: GeographicBias.spearman(pop.map(r => r.population_2020),pop.map(r => r.error)), spearman_n: pop.length,
      false_positive: {n: falsePositives.length, denominator: paired.length,
        fraction: paired.length ? falsePositives.length/paired.length : null, counties: falsePositives.map(r=>r.county)},
      false_negative: {n: falseNegatives.length, denominator: observedPositive.length,
        fraction: observedPositive.length ? falseNegatives.length/observedPositive.length : null,
        total_observed_positive: rows.filter(r=>r.observed>0).length, counties: falseNegatives.map(r=>r.county)}};
  }
  function representativePoints(boundaries, rows) {
    const byCounty = new Map(rows.map(r=>[r.county,r]));
    return {type:'FeatureCollection', features:boundaries.features.map(feature=>{
      const county=feature.properties.CDT_NAME_SHORT, samples=ProviderAccess.samples(feature.geometry);
      if (!samples.length || !byCounty.has(county)) throw Error('No representative point or prediction row for '+county);
      const polygons=feature.geometry.type==='MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates];
      let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
      for(const polygon of polygons) for(const [x,y] of polygon[0]) {west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,y);north=Math.max(north,y);}
      const center=[(west+east)/2,(south+north)/2];
      const coordinates=samples.reduce((best,point)=>ProviderAccess.distanceMiles(point,center)<ProviderAccess.distanceMiles(best,center) ? point : best,samples[0]);
      return {type:'Feature',geometry:{type:'Point',coordinates},properties:{...byCounty.get(county),point_type:'County representative point; not a facility'}};
    })};
  }
  return {join,calculate,representativePoints};
})();
