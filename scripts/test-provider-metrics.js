/* Pure provider evaluation fixtures: meaningful zeros, omissions, and deduplication. */
const read=typeof readFile==='function'?readFile:path=>require('node:fs').readFileSync(path,'utf8');
const report=typeof print==='function'?print:console.log;
eval(read('metrics.js')+'\n'+read('provider-metrics.js')+`
function assert(condition,message){if(!condition)throw Error(message);}
function close(a,b){return Math.abs(a-b)<1e-12;}
const geo=['A','B','C','D'].map((county,i)=>({county,urban_rural:i<2?'Urban/metro':'Rural/nonmetro',population_2020:100-i*10}));
const feature=(county,address)=>({properties:{county,address,city:'Example, CA'}});
const observed=[feature('A','1 Street'),feature('A',' 1 STREET '),feature('C','2 Road'),feature('D','3 Road')];
const predictions=[{county:'A',estimated_provider_count:0},{county:'B',estimated_provider_count:2},{county:'C',estimated_provider_count:1},{county:'D',estimated_provider_count:null}];
const rows=ProviderBias.join(observed,predictions,geo),s=ProviderBias.calculate(rows);
assert(rows[0].observed===1,'Duplicate addresses deduplicated');
assert(rows[0].estimate===0 && rows[0].error===-1,'True predicted zero retained');
assert(rows[1].observed===0 && rows[1].error===2,'Directory zero permits error calculation');
assert(rows[3].estimate===null && rows[3].error===null,'Missing not zero');
assert(s.n===3 && s.excluded===1 && s.mae===1 && close(s.mean_error,1/3),'Paired count errors');
assert(s.signed_gap===.5,'Urban minus rural signed gap');
assert(s.false_positive.n===1 && s.false_positive.denominator===3 && close(s.false_positive.fraction,1/3),'False positive all-paired denominator');
assert(s.false_negative.n===1 && s.false_negative.denominator===2 && s.false_negative.fraction===.5 && s.false_negative.total_observed_positive===3,'False negative observed-positive covered denominator');
const missing=ProviderBias.calculate(ProviderBias.join([],[],geo));
assert(missing.mae===null && missing.spearman===null && missing.false_positive.fraction===null && missing.false_negative.fraction===null && missing.signed_gap===null,'Undefined statistics not zero');
let rejected=false;try{ProviderBias.join(observed,[{county:'A',estimated_provider_count:-1}],geo)}catch(e){rejected=true}assert(rejected,'Reject negative counts');
rejected=false;try{ProviderBias.join([feature('Unknown','1 Street')],[],geo)}catch(e){rejected=true}assert(rejected,'Reject unmatched ground truth');
`);
report('PASS: provider address deduplication, genuine zeros, missing predictions, signed gaps, conditional denominators, undefined metrics, and invalid inputs.');
