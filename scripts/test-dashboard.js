/* DOM/map integration smoke test; no WebGL renderer is exercised. */
if (typeof readFile !== 'function') { globalThis.readFile = path => require('node:fs').readFileSync(path, 'utf8'); globalThis.print = console.log; }
const elements=new Map(), handlers=new Map(), maps=[];
function element(){return {children:[],value:'',classList:{add(){},contains(){return false}},append(x){this.children.push(x)},replaceChildren(...x){this.children=x},addEventListener(type,fn){handlers.set(this,fn)},textContent:''};}
globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element};
document.getElementById('table-sort').value='absolute_error';document.getElementById('table-direction').value='descending';document.getElementById('provider-sort').value='absolute_error';
globalThis.fetch=async path=>({ok:true,json:async()=>JSON.parse(readFile(path))});
globalThis.console={error(e){print('FAIL: '+e.stack); if(typeof quit==='function')quit(1); else process.exit(1);}};
globalThis.maplibregl={Map:class{constructor(){this.layers=[];this.sources={};this.events={};this.jumps=0;maps.push(this)}addControl(){}on(name,...args){if(name==='load')args[0]();else if(args.length===1)(this.events[name] ||= []).push(args[0])}jumpTo(){this.jumps++;if(this.events.move)this.events.move.forEach(fn=>fn())}getCenter(){return [0,0]}getZoom(){return 4}getBearing(){return 0}getPitch(){return 0}stop(){}fitBounds(){this.jumps++;if(this.events.move)this.events.move.forEach(fn=>fn())}addSource(name,source){this.sources[name]=source}addLayer(x){this.layers.push(x)}getCanvas(){return {addEventListener(){}}}},NavigationControl:class{},AttributionControl:class{}};
eval(readFile('access.js')+'\n'+readFile('metrics.js')+'\n'+readFile('provider-metrics.js')+'\n'+readFile('provider-dashboard.js')+'\n'+readFile('app.js').replace('start().catch(error => {',`start().then(()=>{
if(elements.get('scenario-rows').children.length!==58)throw Error('County table');
if(elements.get('access-rows').children.length!==58)throw Error('Access table');
if(elements.get('access-rows').children.some(r=>r.children[1].textContent==='Unavailable'))throw Error('Access unavailable');
if(elements.get('metric-cards').children.length!==5)throw Error('Metric cards');
if(maps.length!==4)throw Error('Four maps');
if(elements.get('provider-rows').children.length!==58)throw Error('Provider table');
if(elements.get('provider-metrics').children.length!==6)throw Error('Provider metric cards');
if(elements.get('provider-group-rows').children.length!==2)throw Error('Provider group summary');
if(JSON.stringify(maps[0].layers[0].paint)!==JSON.stringify(maps[1].layers[0].paint))throw Error('Rate thresholds');
if(!maps[2].layers.some(l=>l.id==='missing-outline'))throw Error('Missing styling');
for(const key of ['absolute_error','error','observed','estimate'])for(const direction of ['ascending','descending']){
 document.getElementById('table-sort').value=key;document.getElementById('table-direction').value=direction;handlers.get(document.getElementById('table-sort'))();
 if(elements.get('scenario-rows').children.length!==58)throw Error('Sorting lost rows');
}
const providerPoints=maps[3].sources['estimated-providers'].data.features;
const boundaries=JSON.parse(readFile('data/california-counties.geojson')).features;
if(providerPoints.length!==58)throw Error('Representative count');
for(const point of providerPoints){const county=boundaries.find(b=>b.properties.CDT_NAME_SHORT===point.properties.county);if(!ProviderAccess.contains(county.geometry,point.geometry.coordinates))throw Error('Representative outside county');}
for(const source of maps){const before=maps.map(m=>m.jumps);source.events.move.forEach(fn=>fn());maps.forEach((m,i)=>{if(m.jumps-before[i] !== (m===source ? 0 : 1))throw Error('Four-way map sync')});}
handlers.get(document.getElementById('reset-maps'))();
const result=GeographicBias.calculate(GeographicBias.join(JSON.parse(readFile('data/birth-rates.json')).rows,JSON.parse(readFile('data/ai-representation.json')).counties,JSON.parse(readFile('data/county-geography.json')).rows));
const providerResult=ProviderBias.calculate(ProviderBias.join(JSON.parse(readFile('data/aflp-locations.geojson')).features,JSON.parse(readFile('data/ai-aflp-estimates.json')).counties,JSON.parse(readFile('data/county-geography.json')).rows));
if(result.paired!==42 || result.top10.overlap!==6)throw Error('Birth experiment regression');
print(JSON.stringify(providerResult,null,2));
print('PASS: all four map load handlers, 58 county and accessibility rows, birth and provider metrics, both 58-row comparison tables, representative containment, eight sort modes, matching rate scales.');
}).catch(error=>{`));
