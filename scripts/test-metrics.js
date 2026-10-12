/* Run with JavaScriptCore jsc (or node after loading metrics.js in a VM). */
const source = typeof readFile === 'function' ? readFile('metrics.js') : require('node:fs').readFileSync('metrics.js', 'utf8');
const report = typeof print === 'function' ? print : console.log;
eval(source + `
function assert(condition, message) { if (!condition) throw Error(message); }
function close(a,b) { return Math.abs(a-b) < 1e-10; }
assert(JSON.stringify(GeographicBias.ranks([10,20,20,40])) === '[1,2.5,2.5,4]', 'Average tied ranks');
assert(close(GeographicBias.spearman([1,2,3],[3,2,1]), -1), 'Inverse ranks');
assert(close(GeographicBias.spearman([1,2,3,4],[1,2,2,4]), 3/Math.sqrt(10)), 'Tied Spearman');
assert(GeographicBias.spearman([1,1],[2,3]) === null, 'Constant ranks undefined');
assert(GeographicBias.spearman([1,null],[2,3]) === null, 'Reject missing population');
assert(GeographicBias.quantile([1,2,3,4],.75) === 3.25, 'Interpolated quartile');
const geo = [
 {county:'A', urban_rural:'Urban/metro', region:'R1', population_2020:100},
 {county:'B', urban_rural:'Urban/metro', region:'R1', population_2020:200},
 {county:'C', urban_rural:'Rural/nonmetro', region:'R2', population_2020:10},
 {county:'D', urban_rural:'Rural/nonmetro', region:'R2', population_2020:20}
];
const rows = GeographicBias.join([{county:'A',rate:1},{county:'B',rate:8},{county:'C',rate:3},{county:'D',rate:null}],
 [{county:'A',estimated_birth_rate:0},{county:'B',estimated_birth_rate:null},{county:'C',estimated_birth_rate:5},{county:'D',estimated_birth_rate:2}],geo);
assert(rows[0].error === -1 && rows[1].error === null && rows[3].error === null, 'Zero retained; missing pairs excluded');
const s = GeographicBias.calculate(rows);
assert(s.paired === 2 && s.signed_gap === -3 && s.coverage_gap === -50, 'Signed and coverage gaps');
assert(s.high_rate.omission_rate === 1 && s.high_rate.n === 1, 'High-rate omission denominator');
assert(s.regions[0].mae === 1 && s.regions[1].mae === 2, 'Region MAE ignores missing pairs');
assert(s.top10.provisional && s.top10.fraction === null, 'Insufficient ranking sample');
assert(GeographicBias.sortRows(rows,'error',false).map(r=>r.county).join('') === 'ACBD', 'Ascending missing last');
assert(GeographicBias.sortRows(rows,'error',true).map(r=>r.county).join('') === 'CABD', 'Descending missing last');
const ten = Array.from({length:12}, (_,i) => ({county:String(i).padStart(2,'0'),observed:12-i,estimate:i === 0 ? null : 12-i,error:i === 0 ? null : 0,absolute_error:i === 0 ? null : 0,urban_rural:'Urban/metro',region:'X',population_2020:100+i}));
const t=GeographicBias.calculate(ten);
assert(t.top10.overlap === 9 && t.top10.provisional && t.top10.observed_top_covered === 9, 'Full observed top-ten retains omitted county');
assert(t.signed_gap === null && t.coverage_gap === null, 'Empty rural denominator unavailable');
assert(GeographicBias.calculate([]).high_rate.omission_rate === null, 'Empty high-rate denominator');
`);
report('PASS: ties, signed error, missing pairs, true zero, coverage denominators, quartiles, omissions, region MAE, ranking omissions, sorting, and undefined statistics.');
