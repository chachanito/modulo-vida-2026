/* Controlador del cotizador; requiere DATA cargado desde public/js/data/. */
const $=id=>document.getElementById(id);const fmt=n=>Number(n||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:true});const unique=a=>[...new Set(a)];let active=null;function putOptions(el,items){el.innerHTML='';items.forEach(t=>el.add(new Option(t,t)))}putOptions($('category'),unique(DATA.map(x=>x.category)));function choices(){let o=DATA.filter(p=>p.category===$('category').value&&p.operation===$('operation').value);return o.length?o:DATA.filter(p=>p.category===$('category').value)}function refresh(){const list=choices();$('product').innerHTML='';list.forEach((p,i)=>$('product').add(new Option(p.name+' · '+p.operation,i)));render()}function num(v){return Number.isFinite(v)?String(v):''}/* Interpreta separadores decimales y de miles segun el formato ingresado. */function parse(v){let s=String(v??'').trim().replace(/[^0-9,.\-]/g,'');if(s.includes(',')&&s.includes('.')){if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'')}else if(s.includes(','))s=s.replace(',','.');else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');return Number(s)||0}function isAmparoPlus(p){return !!p&&['CROSS PLUS','CROSS PLUS DE 11 A 20 AÑOS','CROSS PLUS MARCAS DIFERENCIADAS','CROSS PLUS ELECTRICO','CAMIONETAS PARTICULARES PLUS','CAMIONETAS P. D-MAX / BT50 - NORMAL','CAMIONETAS P. D-MAX / BT50 - PLUS','CROSS NORMAL MARCAS DIFERENCIADAS'].includes(p.name);}
/* Reglas específicas para adaptar furgonetas al tonelaje y número de pasajeros. */
let furgonetaPassengerDefaults={Individual:17,Contenedor:11};
function isFurgonetaProduct(p){return !!p && (p.name||'').toUpperCase().includes('FURGONETA ESCOLARES-TURISMO');}
function furgonetaPassengerCount(){const v=parse($('furgonetaPassengers')?.value);return Math.max(1,Math.floor(v|| (active?.operation==='Contenedor'?11:17)));}
function syncFurgonetaControls(){const enabled=isFurgonetaProduct(active);$('furgonetaOptions').hidden=!enabled;if(!enabled)return;const op=active.operation;const input=$('furgonetaPassengers');if(!input.dataset.initialized){input.value=String(furgonetaPassengerDefaults[op]||17);input.dataset.initialized='1';}else if(input.dataset.operation!==op){input.value=String(furgonetaPassengerDefaults[op]||17);}input.dataset.operation=op;updateFurgonetaRules();}
// Actualiza reglas de furgonetas seg?n operaci?n y tonelaje.
function updateFurgonetaRules(){
 if(!isFurgonetaProduct(active))return;
 const heavy=$('furgonetaTonnage').value==='heavy';
 active.textId=heavy?'132':'185';
 // La tabla de coberturas cambia por completo según el tonelaje, como en el Excel.
 const passengers=furgonetaPassengerCount();
 const apLimit=Math.max(0,passengers*5000-10000);
 const apPremium=passengers*4.18;
 const common=[
  {code:'01',name:'Vehículo',note:'',limit:null,rate:null,premium:null},
  {code:'02',name:'Responsabilidad Civil (Daños a terceros)',note:'',limit:25000,rate:null,premium:null},
  {code:'03',name:'Muerte Accidental por Ocupante (Chofer y Acompañante)',note:'LÍMITE POR OCUPANTE $5.000,00',limit:10000,rate:null,premium:null},
  {code:'04',name:'Gastos de remolque',note:'',limit:250,rate:null,premium:null}
 ];
 const lightRows=[...common,
  {code:'08',name:'Asistencia Vehicular',note:'RESPALDO T-ASISTE',limit:0,rate:null,premium:null},
  {code:'11',name:'Gastos judiciales',note:'EN PROCESO PENAL',limit:1000,rate:null,premium:null},
  {code:'38',name:'Gastos Médicos por Accidente (Chofer y Acompañante)',note:'LÍMITE POR OCUPANTE $2.000,00',limit:4000,rate:null,premium:null},
  {code:'94',name:'Otros Rubros',note:'',limit:apLimit,rate:null,premium:apPremium}
 ];
 const heavyRows=[...common.map(c=>c.code==='04'?{...c,code:'12',name:'Gastos de wincha'}:c),
  {code:'11',name:'Gastos judiciales',note:'EN PROCESO PENAL',limit:1000,rate:null,premium:null},
  {code:'38',name:'Gastos Médicos por Accidente (Chofer y Acompañante)',note:'LÍMITE POR OCUPANTE $2.000,00',limit:4000,rate:null,premium:null},
  {code:'94',name:'Otros Rubros',note:'',limit:apLimit,rate:null,premium:apPremium}
 ];
 active.coverages=(heavy?heavyRows:lightRows);
 const partial=active.deductibles.find(x=>x.name.toUpperCase().startsWith('PERDIDA PARCIAL'));
 if(partial){partial.claimPct=heavy?0.10:0.10;partial.insuredPct=heavy?0.02:0.01;partial.minimum=heavy?750:250;}
 const pt=active.deductibles.find(x=>x.name.toUpperCase().startsWith('PERDIDA TOTAL'));
 if(pt){pt.insuredPct=null;pt.claimPct=0.15;pt.minimum=null;}
}
function coverage63Observation(product,coverage){if(isFurgonetaProduct(product)&&coverage?.code==='94')return 'COBERTURA DE AP PARA '+furgonetaPassengerCount()+' PASAJEROS';if(!coverage||coverage.code!=='63')return coverage?.note||'';const name=(product?.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();if(name.includes('NORMAL'))return 'SE EXCLUYE LA FUGA DEL CONDUCTOR';if(name.includes('PLUS')||name.includes('ULTRA'))return 'CON FUGA DEL CONDUCTOR';return coverage.note||'';}
/* Renderizado de tablas: conserva los importes editados al cambiar de producto. */
// Reconstruye las tablas conservando los importes editados cuando corresponde.
function render(preserve=true){const savedInsured=preserve?$('insuredHeader').value:'';const savedTotal=preserve?$('totalPremium').value:'';active=choices()[Number($('product').value)]||null;if(!active)return;syncFurgonetaControls();$('productTitle').textContent=active.name.toUpperCase();$('source').textContent='Hoja del producto: '+active.sheet+(active.coverageSource?' · Tabla de coberturas: '+active.coverageSource:' · Sin tabla de coberturas completa vinculada');const body=$('coverBody');body.innerHTML='';active.coverages.forEach((c,i)=>{const tr=document.createElement('tr');const is63=c.code==='63';const isStorProduct=active.category==='Pesados'&&(active.sheet||'').toUpperCase().includes('STOR');const special63=is63&&(isAmparoPlus(active)||active.name==='CROSS ULTRA'||isStorProduct);const special64=c.code==='64'&&['CROSS ULTRA','STYLE ULTRA'].includes(active.name);const special07=c.code==='07'&&active.category==='Pesados'&&/ULTRA/i.test(active.name);const specialFurgonetaAp=isFurgonetaProduct(active)&&c.code==='94';const columns=[c.code||'',c.name||'',(c.code==='01'||/^(veh[ií]culo)$/i.test((c.name||'').trim()))?'':'X',null,null,null,coverage63Observation(active,c)];columns.forEach((v,j)=>{const td=document.createElement('td');if(j===0)td.className='code';if(j===3&&!(c.code==='01'||/^(veh[ií]culo)$/i.test((c.name||'').trim()))){td.className='fixed-value';if(specialFurgonetaAp){td.dataset.furgonetaAp='limit';td.textContent='';}else if(is63){td.dataset.amparo='limit';td.textContent='';}else if(special64){td.dataset.cero='limit';td.textContent='';}else if(special07){td.dataset.lucro='limit';td.textContent='';}else td.textContent=c.limit==null?'':fmt(c.limit)}else if(j>=3&&j<=5){if(!(c.code==='01'||/^(veh[ií]culo)$/i.test((c.name||'').trim()))){td.textContent='';td.className='fixed-blank';if(specialFurgonetaAp&&j===5){td.dataset.furgonetaAp='premium';td.className='special-premium';}if(special63&&j===4){td.dataset.amparo='rate';td.className='special-rate';}if(special63&&j===5){td.dataset.amparo='premium';td.className='special-premium';}if(special64&&j===4){td.dataset.cero='rate';td.className='special-rate';}if(special64&&j===5){td.dataset.cero='premium';td.className='special-premium';}if(special07&&j===5){td.dataset.lucro='premium';td.className='special-premium';}}else{const inp=document.createElement('input');inp.type='text';inp.className='num locked';inp.readOnly=true;inp.tabIndex=-1;inp.dataset.field=['limit','rate','premium'][j-3];inp.dataset.idx=i;inp.value='';inp.setAttribute('aria-label','Dato sincronizado desde el encabezado');td.append(inp)}}else{td.textContent=v??'';if(j===2){td.className='fixed-x';if(i===0)td.textContent='';}if(j===6&&specialFurgonetaAp)td.dataset.furgonetaObservation='true';}tr.append(td)});body.append(tr)});$('dedBody').innerHTML='';active.deductibles.forEach(d=>{const tr=document.createElement('tr');[d.name,d.claimPct==null?'':fmt(d.claimPct*100)+'%',d.insuredPct==null?'':fmt(d.insuredPct*100)+'%',d.minimum==null?'':fmt(d.minimum)].forEach((v,j)=>{let td=document.createElement('td');td.textContent=v;if(active.category==='Pesados'&&j===3&&d.name.toUpperCase().startsWith('PERDIDA PARCIAL')){if((active.sheet||'').toUpperCase().includes('NQR'))td.dataset.storHinoMinimum='true';else td.dataset.storMinimum='true';}tr.append(td)});$('dedBody').append(tr)});if(!active.deductibles.length)$('dedBody').innerHTML='<tr><td colspan="4">No se pudo vincular automáticamente el cuadro de deducibles. Revisar hoja original.</td></tr>';$('totalPremium').value=savedTotal;$('insuredHeader').value=savedInsured;$('textHeader').textContent=active.textId||'—';$('productHeader').textContent=active.name.toUpperCase();calc()}// Calcula la prima neta y sincroniza los valores mostrados en coberturas y deducibles.
function calc(){const insured=parse($('insuredHeader').value);const total=parse($('totalPremium').value);const vehicle=document.querySelector('#coverBody input[data-field=limit]');const vehiclePremium=document.querySelector('#coverBody input[data-field=premium]');const vehicleRate=document.querySelector('#coverBody input[data-field=rate]');const valid=insured>0&&total>0;
/* Cálculo de prima neta y desglose de coberturas especiales. */
const fee=x=>x<=250.99?0.5:x<=500.99?1:x<=1000.99?3:x<=2000.99?5:x<=4000.99?7:9;
function netIndividual(p,discount){const base=(p-discount)/1.15;return (base-fee(base))/1.04;}
function netContenedor(p,discount){return ((p-discount)/1.15-0.90)/1.04;}
let targetNet=0;
const normalizedPlan=(active.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const normalizedSheet=(active.sheet||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const isPlus=/(^|[^A-Z])PLUS([^A-Z]|$)/.test(normalizedPlan);
const isUltra=/(^|[^A-Z])ULTRA([^A-Z]|$)/.test(normalizedPlan);
const isNormal=/(^|[^A-Z])NORMAL([^A-Z]|$)/.test(normalizedPlan);
// STOR: los tres planes comparten formulas, sin descuento previo de USD 46.
// Incluye las hojas STOR y la hoja PESADOS CONTENEDOR.
const isStor=normalizedSheet.startsWith('STOR')||normalizedSheet==='PESADOS CONTENEDOR'||normalizedPlan.startsWith('STOR ');
if(valid){
  if(isFurgonetaProduct(active)){targetNet=active.operation==='Contenedor'?netContenedor(total,0):netIndividual(total,0);}
  else if(isStor){targetNet=active.operation==='Contenedor'?netContenedor(total,0):netIndividual(total,0);}
  else if(isNormal||isPlus||isUltra){
    const discount=(isPlus||isUltra)?46:0;
    targetNet=active.operation==='Contenedor'?netContenedor(total,discount):netIndividual(total,discount);
  } else {
    const ratio=active&&active.examplePremium>0?active.exampleNet/active.examplePremium:0;
    targetNet=total*ratio;
  }
  targetNet=Math.max(0,targetNet);
}
// Las primas de Amparo Patrimonial y Cero Deducible son desgloses
// de la prima neta total y no cargos adicionales.
const amparoEnabled=(isAmparoPlus(active)||active.name==='CROSS ULTRA'||active.category==='Pesados')&&active.coverages.some(c=>c.code==='63');
const ceroEnabled=['CROSS ULTRA','STYLE ULTRA'].includes(active.name)&&active.coverages.some(c=>c.code==='64');
const lucroEnabled=active.category==='Pesados'&&/ULTRA/i.test(active.name)&&active.coverages.some(c=>c.code==='07');const furgonetaApEnabled=isFurgonetaProduct(active)&&active.coverages.some(c=>c.code==='94');
const amparoRate=active.category==='Pesados'?0.30:0.3;
const amparo=amparoEnabled&&insured>0&&amparoRate>0?Math.round(insured*(amparoRate/100)*100)/100:0;const furgonetaPassengers=furgonetaApEnabled?furgonetaPassengerCount():0;const furgonetaApLimit=Math.max(0,furgonetaPassengers*5000-10000);const furgonetaApPremium=furgonetaPassengers*4.18;
const cero=ceroEnabled&&insured>0?Math.round(insured*0.01*100)/100:0;
const lucro=lucroEnabled?200:0;
const primaVehiculo=valid?Math.max(0,targetNet-amparo-cero-lucro-(furgonetaApEnabled?furgonetaApPremium:0)):0;
for(const [field,value] of [['limit',insured>0?fmt(insured):''],['rate',amparoEnabled&&!furgonetaApEnabled?(amparoRate.toFixed(4).replace('.',',') ): ''],['premium',amparoEnabled&&!furgonetaApEnabled&&valid?fmt(amparo):'']]){
 const node=document.querySelector('#coverBody [data-amparo="'+field+'"]');if(node)node.textContent=value;
}
const fapLimit=document.querySelector('#coverBody [data-furgoneta-ap="limit"]');if(fapLimit)fapLimit.textContent=fmt(furgonetaApLimit);const fapPremium=document.querySelector('#coverBody [data-furgoneta-ap="premium"]');if(fapPremium)fapPremium.textContent=fmt(furgonetaApPremium);const fapObservation=document.querySelector('#coverBody [data-furgoneta-observation="true"]');if(fapObservation)fapObservation.textContent='COBERTURA DE AP PARA '+furgonetaPassengers+' PASAJEROS';for(const [field,value] of [['limit',insured>0?fmt(insured):''],['rate',ceroEnabled?'1,0000':''],['premium',ceroEnabled&&valid?fmt(cero):'']]){
 const node=document.querySelector('#coverBody [data-cero="'+field+'"]');if(node)node.textContent=value;
}
for(const [field,value] of [['limit',lucroEnabled?'4.000,00':''],['premium',lucroEnabled?fmt(200):'']]){
 const node=document.querySelector('#coverBody [data-lucro="'+field+'"]');if(node)node.textContent=value;
}
const storMinimumCell=document.querySelector('#dedBody [data-stor-minimum="true"]');if(storMinimumCell)storMinimumCell.textContent=insured>50000.99?'1.000,00':'600,00';const storHinoMinimumCell=document.querySelector('#dedBody [data-stor-hino-minimum="true"]');if(storHinoMinimumCell)storHinoMinimumCell.textContent=insured>50000.99?'1.500,00':'750,00';
if(vehicle)vehicle.value=insured>0?fmt(insured):'';
if(vehiclePremium)vehiclePremium.value=valid?fmt(primaVehiculo):'';
if(vehicleRate)vehicleRate.value=valid?(primaVehiculo/insured*100).toFixed(4).replace('.',','):'';let n=0;document.querySelectorAll('input[data-field="premium"]').forEach(x=>n+=parse(x.value));$('netTotal').textContent=valid?fmt(targetNet):'';$('netHeader').textContent=valid?fmt(targetNet):'';$('rateHeader').textContent=valid?((targetNet-(lucroEnabled?200:0)-(furgonetaApEnabled?furgonetaApPremium:0))/insured*100).toFixed(4).replace('.',','):''}['insuredHeader','totalPremium'].forEach(id=>{$(id).addEventListener('input',calc);$(id).addEventListener('blur',()=>{$(id).value=$(id).value.trim()?fmt(parse($(id).value)):'';calc()});$(id).addEventListener('focus',()=>{$(id).select()})});$('category').addEventListener('change',refresh);$('operation').addEventListener('change',()=>{if(isFurgonetaProduct(active))furgonetaPassengerDefaults[active.operation]=$('furgonetaPassengers').value;refresh()});$('product').addEventListener('change',()=>render(true));$('furgonetaTonnage').addEventListener('change',()=>{updateFurgonetaRules();$('textHeader').textContent=active.textId;render(true)});$('furgonetaPassengers').addEventListener('input',()=>{if(isFurgonetaProduct(active)){furgonetaPassengerDefaults[active.operation]=$('furgonetaPassengers').value;calc()}});$('resetBtn').onclick=()=>render(false);refresh();