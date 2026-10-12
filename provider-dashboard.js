/* Rendering for the independently frozen provider-count experiment. */
'use strict';
function renderProviderExperiment(boundaries, locations, experiment, geography) {
  const rows=ProviderBias.join(locations.features,experiment.counties,geography.rows);
  const s=ProviderBias.calculate(rows), panel=document.getElementById('provider-metrics');
  const format=(value,signed=false,digits=2)=>displayNumber(value,signed,digits);
  function card(title,value,interpretation,sample,limitation) {
    const article=document.createElement('article'), h=document.createElement('h3'); h.textContent=title;article.append(h);
    const v=document.createElement('p');v.className='metric-value';v.textContent=value;article.append(v);
    for(const line of [interpretation,'Sample: '+sample,'Missing-data limitation: '+limitation]) {const p=document.createElement('p');p.textContent=line;article.append(p);}
    panel.append(article);
  }
  const common=`${s.excluded} unavailable predictions excluded. Directory zero means no listed address, not no services.`;
  card('Provider-count mean absolute error',format(s.mae)+' locations',
    'Average |AI count − listed count|, with equal county weights. Higher means less accurate predictions.',`${s.n}/${s.total} paired counties`,common);
  card('Provider-count mean signed error',format(s.mean_error,true)+' locations',
    'Average AI count − listed count. Positive means overestimation; negative means underestimation.',`${s.n}/${s.total} paired counties`,common);
  card('Urban–rural provider error gap',format(s.signed_gap,true)+' locations',
    'Urban/metro mean signed error minus rural/nonmetro mean signed error. Positive means more upward error in metro counties.',
    `urban ${s.groups[0].n}/${s.groups[0].total}; rural ${s.groups[1].n}/${s.groups[1].total}`,common+' Undefined if either group has no pairs.');
  card('Population–provider error Spearman correlation',format(s.spearman,true,3),
    'Association of 2020 total population ranks with signed provider-count error ranks. Average ranks handle ties. Positive means larger counties tend toward more upward error.',
    `${s.spearman_n} paired counties with population; ${s.total-s.spearman_n} excluded`,common+' Undefined with fewer than two cases or constant ranks; not a causal or systematic-bias test.');
  card('Predicted providers with none listed',s.false_positive.fraction===null?'Unavailable':format(100*s.false_positive.fraction)+'%',
    'Counties with AI > 0 and listed count = 0, divided by all counties with a numerical prediction. This is an all-county percentage, not a conditional false-positive rate.',
    `${s.false_positive.n}/${s.false_positive.denominator} paired counties`,common);
  card('Listed-provider counties predicted zero',s.false_negative.fraction===null?'Unavailable':format(100*s.false_negative.fraction)+'%',
    'Among counties with listed addresses and numerical AI predictions, the share incorrectly predicted zero.',
    `${s.false_negative.n}/${s.false_negative.denominator} covered counties with listed providers; ${s.false_negative.total_observed_positive} such counties overall`,
    common+' Counties with listed providers but unavailable predictions are excluded from this percentage.');
  document.getElementById('provider-summary').textContent=`${s.n} numeric predictions · ${rows.filter(r=>r.estimate===0).length} genuine predicted zeros · ${s.excluded} unavailable · All confidence low · Generated ${experiment.generation_date}`;
  const groupBody=document.getElementById('provider-group-rows');
  for(const group of s.groups) {
    const tr=document.createElement('tr');
    [group.name,`${group.n}/${group.total}`,group.observed_total,group.predicted_total??'Unavailable',format(group.predicted_mean),format(group.mean_error,true),format(group.mae)].forEach((value,i)=>{
      const cell=document.createElement(i?'td':'th');if(!i)cell.scope='row';cell.textContent=value;tr.append(cell);
    });groupBody.append(tr);
  }
  const tbody=document.getElementById('provider-rows');
  function table() {
    tbody.replaceChildren();
    for(const row of GeographicBias.sortRows(rows,document.getElementById('provider-sort').value)) {
      const tr=document.createElement('tr');
      [row.county,row.observed,row.estimate??'Unavailable',format(row.error,true),format(row.absolute_error),row.urban_rural,row.confidence,row.reasoning].forEach((value,i)=>{
        const cell=document.createElement(i?'td':'th');if(!i)cell.scope='row';cell.textContent=value;tr.append(cell);
      });tbody.append(tr);
    }
  }
  document.getElementById('provider-sort').addEventListener('change',table);table();
  const status=document.getElementById('provider-map-status');
  const map=createMap('provider-map',status,'AI county estimates · Boundaries: California Department of Technology');
  const points=ProviderBias.representativePoints(boundaries,rows), byCounty=new Map(rows.map(r=>[r.county,r]));
  map.on('load',()=>{
    const counties={type:'FeatureCollection',features:boundaries.features.map(f=>({...f,properties:byCounty.get(f.properties.CDT_NAME_SHORT)}))};
    map.addSource('county-births',{type:'geojson',data:counties});
    map.addLayer({id:'county-fill',type:'fill',source:'county-births',paint:{'fill-color':['case',['==',['get','estimate'],null],'#b8b4c7','#edf4f2']}});
    map.addLayer({id:'county-outline',type:'line',source:'county-births',paint:{'line-color':'#60756f','line-width':.8}});
    map.addSource('estimated-providers',{type:'geojson',data:points});
    map.addLayer({id:'provider-estimates',type:'circle',source:'estimated-providers',filter:['>', ['get','estimate'],0],paint:{
      'circle-radius':['*',5,['sqrt',['get','estimate']]],'circle-color':'#925126','circle-opacity':.8,'circle-stroke-color':'#fff','circle-stroke-width':1.5}});
    map.addLayer({id:'provider-zeros',type:'circle',source:'estimated-providers',filter:['==',['get','estimate'],0],paint:{
      'circle-radius':3,'circle-color':'#fff','circle-stroke-color':'#925126','circle-stroke-width':1.5}});
    // The shared interaction layer includes positive and zero representative points.
    map.addLayer({id:'provider-hit-points',type:'circle',source:'estimated-providers',filter:['!=',['get','estimate'],null],paint:{'circle-radius':15,'circle-opacity':0}});
    addInteractions(map,'provider-hit-points',(point,county)=>{
      const p=(point||county).properties;
      return popupContent(p.county+' County · AI-estimated AFLP locations',[
        `AI-generated estimate: ${p.estimate??'Unavailable'} (not a verified count)`,`Listed addresses: ${p.observed}`,
        `Signed count error: ${format(p.error,true)}`,`Confidence: ${p.confidence}`,p.reasoning,
        'Circle is a county representative point, not a facility location. No travel distances are computed from it.',
        'A predicted zero does not establish absence of support services.']);
    });
    if(!status.classList.contains('error'))status.textContent=`58 county representative points · ${s.n} numeric estimates · Circle area proportional to predicted count · Not facility coordinates`;
  });
  return map;
}
