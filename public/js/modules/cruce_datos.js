/* Conciliador de Creditos V36: logica modular sin documentos contractuales precargados. */
'use strict';
/* 9.1 Estado de aplicación y utilidades */
let actual=[],previous=[],results=[],missing=[],stats=null;const $=s=>document.getElementById(s);const fmt=n=>Number(n||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2});const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const canon=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();const round=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
/* 9.1.1 Formato monetario visible: almacenamiento numérico sin cambiar los cálculos. */
function parseUsd(value){let t=String(value??'').replace(/USD|\$|\s/gi,'').trim();if(!t)return NaN;if(t.includes(',')&&t.includes('.'))t=t.replace(/\./g,'').replace(',','.');else if(t.includes(','))t=t.replace(',','.');else if(/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');return Number(t)}
function formatUsd(value){return 'USD '+Number(value||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})}
const creditInput=document.getElementById('limite');creditInput.addEventListener('focus',()=>{let n=parseUsd(creditInput.value);creditInput.value=Number.isFinite(n)?String(n).replace('.',','):'';creditInput.select()});creditInput.addEventListener('blur',()=>{let n=parseUsd(creditInput.value);if(Number.isFinite(n)&&n>=0)creditInput.value=formatUsd(n)});
/* 9.1.2 Regla exclusiva nuevos: configuración independiente, cantidad numérica en memoria. */
const newOnlyMoney=$('newOnlyAmount');
newOnlyMoney.addEventListener('focus',()=>{const n=parseUsd(newOnlyMoney.value);newOnlyMoney.value=Number.isFinite(n)?String(n).replace('.',','):'';newOnlyMoney.select()});
newOnlyMoney.addEventListener('blur',()=>{const n=parseUsd(newOnlyMoney.value);if(Number.isFinite(n)&&n>=0)newOnlyMoney.value=formatUsd(n)});
/* 9.2 Parámetros iniciales y rangos */
const paramsDefault=()=>({min:18,minMes:0,minDia:0,maxNuevo:70,maxNuevoMes:0,maxNuevoDia:0,maxPerm:75,maxPermMes:0,maxPermDia:0,limite:60000,age:[{fromY:75,fromM:0,fromD:0,toY:75,toM:0,toD:0,limit:10000,obs:'COBERTURA HASTA $10.000'}],guarantees:[{from:10000.01,to:60000,obs:'SOLICITAR FORMULARIO DE ASEGURABILIDAD'}],combined:[{fromY:18,fromM:0,fromD:0,toY:74,toM:11,toD:29,amountFrom:40000.01,amountTo:60000,obs:'DECLARACIÓN DE SALUD'}]});let ranges=paramsDefault();
/* 9.2.V16 Catálogo de pólizas: almacenamiento local con respaldo portable.
   No se almacenan datos personales de las bases ACTUAL ni MES ANTERIOR.
   El guardado es explícito; cambiar de póliza no sobrescribe las configuraciones. */
const POLICY_STORE='conciliador_creditos_perfiles_v16';
let policyCatalog={};let activePolicy='';let savedSnapshot='';
const policyIds=['min','minMes','minDia','maxNuevo','maxNuevoMes','maxNuevoDia','maxPerm','maxPermMes','maxPermDia','limite','newOnlyFromY','newOnlyFromM','newOnlyFromD','newOnlyToY','newOnlyToM','newOnlyToD','newOnlyAmount','newOnlyObs'];
function policyNotice(msg,bad=false){const el=$('policyMessage');el.textContent=msg;el.className='policy-message '+(bad?'bad':'ok');}
/* V27: Asignación solicitada de las pólizas históricas al emisor BALSECA.
   Sólo modifica el campo issuer; los snapshots y sus cálculos no se alteran.
   Se aplica tanto al catálogo local como a un respaldo JSON importado. */
const BALSECA_ISSUER='BALSECA CARDENAS EDWIN MAURICIO';
const BALSECA_POLICY_NUMBERS=new Set(['24-2368', '24-2369', '24-2603', '24-2604', '24-2605', '24-2606', '24-2607', '24-2608', '24-2660', '24-2687', '24-2697', '24-2752', '24-3036']);
function assignBalsecaPolicies(catalog){
 let changes=0;
 for(const [key,profile] of Object.entries(catalog||{})){
  if(!profile||typeof profile!=='object')continue;
  const number=String(profile.number||key).trim().toUpperCase();
  if(BALSECA_POLICY_NUMBERS.has(number)&&profile.issuer!==BALSECA_ISSUER){
   profile.issuer=BALSECA_ISSUER; changes++;
  }
 }
 return changes;
}
function policyStorageWrite(){try{localStorage.setItem(POLICY_STORE,JSON.stringify(policyCatalog));return true}catch(err){policyNotice('El navegador no permitió guardar automáticamente. Descarga el respaldo JSON para conservar las pólizas. '+err.message,true);return false}}
function policyStorageRead(){try{let obj=JSON.parse(localStorage.getItem(POLICY_STORE)||'{}');if(obj&&typeof obj==='object'&&!Array.isArray(obj)){policyCatalog=obj;const moved=assignBalsecaPolicies(policyCatalog);if(moved)policyStorageWrite();}}catch(e){policyCatalog={};policyNotice('No fue posible leer el catálogo guardado: '+e.message,true)}}
function policySnapshot(){readRanges();let fields={};for(let id of policyIds)fields[id]=$(id).value;fields.newOnlyEnabled=$('newOnlyEnabled').checked;fields.allowNewEntries=$('allowNewEntries').value;return {fields,ranges:JSON.parse(JSON.stringify(ranges))}}
function policyDirty(){return !!activePolicy&&savedSnapshot!==JSON.stringify(policySnapshot())}
function policyConfirmLeave(){return !policyDirty()||confirm('Hay cambios sin guardar en los parámetros de la póliza actual. ¿Deseas descartarlos y continuar?')}
function policyValidNumber(n){return !['__proto__','prototype','constructor'].includes(String(n).toLowerCase())&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/.test(n)}
function policyRefresh(preferred=''){
 let select=$('policyList'),was=preferred||activePolicy,issuer=$('issuerSelect').value;
 const available=Object.values(policyCatalog).filter(p=>(p.issuer||'')===issuer);
 select.innerHTML='<option value="">+ Nueva póliza</option>'+available.sort((a,b)=>a.number.localeCompare(b.number,'es')).map(p=>`<option value="${esc(p.number)}">${esc(p.number)} — ${esc(p.description)}</option>`).join('');
 select.value=policyCatalog[was]&&(policyCatalog[was].issuer||'')===issuer?was:'';
 if($('policySearchInput'))policySearchRefresh();
 updateTemplateDownloadNames();
 const cnt=$('portableCount');if(cnt){const n=Object.keys(policyCatalog).length;cnt.textContent=n+' '+(n===1?'póliza':'pólizas');}
}
/* V28 — búsqueda entre todos los emisores, incluidos perfiles antiguos sin asignar. */
function policySearchRefresh(){
 const out=$('policySearchResults'), term=canon(($('policySearchInput').value||'').trim());
 if(!term){out.textContent='Escribe un número o nombre para localizar su emisor.';return;}
 const hits=Object.values(policyCatalog).filter(p=>canon([p.number,p.description,p.issuer||'Sin asignar'].join(' ')).includes(term)).sort((a,b)=>a.number.localeCompare(b.number,'es')).slice(0,100);
 if(!hits.length){out.textContent='No se encontraron pólizas con ese dato en el catálogo cargado.';return;}
 out.innerHTML=hits.map(p=>`<button type="button" class="policy-search-hit" data-policy-open="${esc(p.number)}"><strong>${esc(p.number)} — ${esc(p.description||'')}</strong><br>Emisor: ${esc(p.issuer||'Sin asignar / pólizas anteriores')}</button>`).join('');
}
$('policySearchInput').addEventListener('input',policySearchRefresh);
$('policySearchResults').addEventListener('click',ev=>{
 const btn=ev.target.closest('[data-policy-open]');if(!btn)return;
 const number=btn.dataset.policyOpen, profile=policyCatalog[number];if(!profile)return;
 if(number!==activePolicy&&!policyConfirmLeave())return;
 try{policyApply(profile);policySearchRefresh()}catch(e){policyNotice('No se pudo abrir la póliza: '+e.message,true)}
});
function policyClearIdentity(){activePolicy='';savedSnapshot='';$('policyList').value='';$('policyNumber').value='';$('policyDescription').value='';updateTemplateDownloadNames();}
function policyApply(profile){if(!profile||!profile.snapshot||!profile.snapshot.fields||!profile.snapshot.ranges)throw Error('La póliza no contiene parámetros guardados.');
 let snap=profile.snapshot,rg=snap.ranges;
 for(let id of policyIds)if(Object.prototype.hasOwnProperty.call(snap.fields,id))$(id).value=snap.fields[id];
 $('newOnlyEnabled').checked=!!snap.fields.newOnlyEnabled;toggleNewOnlyDetails();$('allowNewEntries').value=snap.fields.allowNewEntries==='no'?'no':'si';updateNewEntryMode();
 ranges=JSON.parse(JSON.stringify({age:rg.age||[],guarantees:rg.guarantees||[],combined:rg.combined||[]}));
 tableRanges();tableCombined();updateAgeFieldLimits();
 $('policyNumber').value=profile.number;$('policyDescription').value=profile.description;$('issuerSelect').value=profile.issuer||'';
 activePolicy=profile.number;savedSnapshot=JSON.stringify(policySnapshot());policyRefresh(activePolicy);
 if(actual.length&&previous.length){try{compute();policyNotice('Póliza '+profile.number+' cargada y resultados recalculados con sus parámetros.')}catch(e){results=[];stats=null;policyNotice('Póliza cargada. Revisa los parámetros antes de recalcular: '+e.message,true)}}
 else policyNotice('Configuración de '+profile.number+' — '+profile.description+' recuperada. Carga las bases para procesarla.');
}
function policyCreateNew(){
 if(!policyConfirmLeave())return;
 const selectedIssuer=$('issuerSelect').value;
 // V18: nueva póliza parte de una sesión completamente vacía; el catálogo guardado se conserva.
 resetWorkspaceForNewPolicy();$('issuerSelect').value=selectedIssuer;policyRefresh();
 policyNotice('Nueva póliza: datos, parámetros, rangos y bases de la sesión en blanco. Registra el número y descripción antes de guardarla.');
 document.querySelector('[data-tab="parametros"]').click();
 $('policyNumber').focus();
}
function policyLoad(number){if(!number){policyCreateNew();return}if(number===activePolicy){policyRefresh(activePolicy);return}if(!policyConfirmLeave()){policyRefresh(activePolicy);return}try{policyApply(policyCatalog[number])}catch(e){policyRefresh(activePolicy);policyNotice('No se pudo abrir la póliza: '+e.message,true)}}
function policySave(){try{
 const n=$('policyNumber').value.trim().toUpperCase(),d=$('policyDescription').value.trim();
 if(!policyValidNumber(n))throw Error('Ingresa un número de póliza válido (letras, números, guion, punto o guion bajo; sin espacios).');
 if(!d)throw Error('Ingresa la descripción de la póliza.');
 const p=getParams(false);const snap=policySnapshot();
 if(activePolicy&&n!==activePolicy&&!confirm('Has cambiado el número de la póliza. ¿Guardar como una nueva póliza '+n+'? La anterior permanecerá guardada.'))return;
 if(policyCatalog[n]&&n!==activePolicy&&!confirm('La póliza '+n+' ya existe. ¿Deseas sobrescribir sus parámetros guardados?'))return;
 policyCatalog[n]={number:n,description:d,issuer:$('issuerSelect').value,snapshot:snap,savedAt:new Date().toISOString()};activePolicy=n;savedSnapshot=JSON.stringify(snap);policyRefresh(n);
 const kept=policyStorageWrite();
 if(catalogOpen&&$('portableAuto').checked)policyDownloadBackup(true);
 if(actual.length&&previous.length)compute();
 if(kept)policyNotice('Póliza '+n+' — '+d+' guardada. '+(catalogOpen&&$('portableAuto').checked?'Catálogo portátil descargado: consérvalo para otra PC.':'Abre la pestaña 6. Catálogo para descargar el JSON portátil.'));
 else policyNotice('No se pudo guardar en el navegador; '+(catalogOpen&&$('portableAuto').checked?'el catálogo JSON descargado contiene tu póliza.':'abre la pestaña 6. Catálogo para conservarla.'),true);
 }catch(e){policyNotice('No fue posible guardar: '+e.message,true)}
}
function policyDelete(){let n=activePolicy||$('policyList').value;if(!n||!policyCatalog[n]){policyNotice('Selecciona una póliza guardada para eliminarla.',true);return}if(!confirm('¿Eliminar la configuración guardada de '+n+'? Esta acción no borra los Excel ni sus datos.'))return;delete policyCatalog[n];policyStorageWrite();policyClearIdentity();policyRefresh();policyNotice('Configuración '+n+' eliminada del catálogo. Los parámetros que ves siguen en pantalla hasta cargar otra póliza o limpiar.');}
async function policyDownloadBackup(silent=false){
 try{
  const pdfOriginales=await pdfExportDocsV33();
  const pdfArchivosV35=await pdfExportDocsV35();
  const obj={format:'ConciliadorCreditosPolicyCatalog',version:1,createdAt:new Date().toISOString(),policies:Object.values(policyCatalog),documents:policyDocumentsV32,pdfOriginales:{},pdfArchivosV35};
  save(new Blob([JSON.stringify(obj)],{type:'application/json;charset=utf-8'}),'CATALOGO_POLIZAS.json');
  if(!silent)policyNotice('CATALOGO_POLIZAS.json descargado: '+obj.policies.length+' pólizas y '+pdfArchivosV35.length+' PDF originales. Consérvalo en un lugar seguro.');
 }catch(e){policyNotice('No se pudo generar el respaldo completo: '+e.message,true);}
}
async function policyImportFile(file){if(!file)return;try{const data=JSON.parse(await file.text());if(data.format!=='ConciliadorCreditosPolicyCatalog'||data.version!==1||!Array.isArray(data.policies))throw Error('Formato de respaldo no reconocido.');let incoming={};for(let p of data.policies){if(!p||!policyValidNumber(p.number)||typeof p.description!=='string'||!p.snapshot||!p.snapshot.fields||!p.snapshot.ranges)throw Error('Se encontró una póliza mal formada en el respaldo.');incoming[p.number]={number:p.number,description:p.description,issuer:ISSUERS.includes(p.issuer)?p.issuer:'',snapshot:p.snapshot,savedAt:p.savedAt||''}}
 const duplicates=Object.keys(incoming).filter(n=>policyCatalog[n]);if(duplicates.length&&!confirm('El respaldo contiene '+duplicates.length+' póliza(s) ya guardadas. ¿Sobrescribir sus configuraciones?'))return;
 if(!policyConfirmLeave())return;
 if(data.documents&&typeof data.documents==='object'&&!Array.isArray(data.documents)){
  const safe=Object.entries(data.documents).filter(([n,v])=>policyValidNumber(n)&&v&&typeof v==='object'&&!Array.isArray(v)).map(([n,v])=>[n,v]);
  for(const [n,v] of safe){if(policyDocumentsV32[n]&&!confirm('El catálogo contiene una ficha documental para '+n+'. ¿Reemplazarla?'))continue;policyDocumentsV32[n]=v;}
  docStorageWriteV32();
 }
 // Restaurar archivos originales adjuntos al catálogo, si el respaldo los incluye.
 let restoredPdfV33={restored:0,errors:[]};
 if(Array.isArray(data.pdfArchivosV35)){restoredPdfV33=await pdfImportDocsV35(data.pdfArchivosV35);}else if(data.pdfOriginales&&typeof data.pdfOriginales==='object'){restoredPdfV33=await pdfImportLegacyV35(data.pdfOriginales);}
 Object.assign(policyCatalog,incoming);assignBalsecaPolicies(policyCatalog);policyStorageWrite();if(activePolicy&&incoming[activePolicy]){activePolicy='';savedSnapshot='';}policyRefresh(activePolicy);policyNotice('Se importaron '+Object.keys(incoming).length+' pólizas y '+restoredPdfV33.restored+' PDF originales. '+(restoredPdfV33.errors.length?'Algunos PDF no se pudieron guardar en este equipo; revisa el espacio disponible. ':'')+'Selecciona una póliza para consultar sus condiciones.');
 }catch(e){policyNotice('No se pudo importar: '+e.message,true)}finally{$('policyImport').value=''}}
function policyFilePrefix(){const n=$('policyNumber').value.trim().toUpperCase(),d=$('policyDescription').value.trim();if(!policyValidNumber(n))throw Error('Indica el número de póliza en 2. Parámetros antes de exportar.');if(!d)throw Error('Indica también la descripción de la póliza antes de exportar.');return n.replace(/[^A-Za-z0-9._-]/g,'_')}
const ISSUERS=['OCANIA CEVALLOS NAYELI ANAHI','MORALES VARGAS SHARON NATALIA','ACHIG DONOSO JHOSELYN PAMELA','PAREDES YANEZ JAMILETH ALEJANDRA','POZO ENCALADA ANDREA LIZETH','BALSECA CARDENAS EDWIN MAURICIO'];
$('issuerSelect').addEventListener('change',e=>{
 if(!policyConfirmLeave()){e.target.value=policyCatalog[activePolicy]?.issuer||'';return;}
 // V29: al cambiar de emisor, borrar la configuración visible de la póliza anterior.
 // El catálogo persistente permanece intacto. Se limpia también la sesión de bases
 // para evitar conciliar datos de un producto con los límites de otro.
 const targetIssuer=e.target.value;
 resetWorkspaceForNewPolicy();
 $('issuerSelect').value=targetIssuer;
 $('policySearchInput').value='';
 policyRefresh();
 updateTemplateDownloadNames();
 policyNotice(targetIssuer?'Emisor '+targetIssuer+' seleccionado. Póliza, parámetros y bases de la sesión limpios; elige una póliza o registra una nueva.':'Emisor sin asignar seleccionado. Póliza y parámetros de la sesión limpios.');
});
/* V29 — Nombres de plantillas con número de póliza, sin modificar los Excel internos. */
function updateTemplateDownloadNames(){
 const number=$('policyNumber').value.trim().toUpperCase();
 const suffix=policyValidNumber(number)?number:'SIN_POLIZA';
 $('templateActual').download='PLANTILLA_ACTUAL_'+suffix+'.xlsx';
 $('templatePrevious').download='PLANTILLA_MES_ANTERIOR_'+suffix+'.xlsx';
}
$('policyNumber').addEventListener('input',updateTemplateDownloadNames);
$('templateActual').addEventListener('click',updateTemplateDownloadNames);
$('templatePrevious').addEventListener('click',updateTemplateDownloadNames);
$('policyList').addEventListener('change',e=>policyLoad(e.target.value));$('policyNew').onclick=policyCreateNew;$('policySave').onclick=policySave;$('policyDelete').onclick=policyDelete;
$('policyBackup').onclick=()=>{if(catalogOpen)policyDownloadBackup();};$('policyImportButton').onclick=()=>$('policyImport').click();$('policyImport').onchange=e=>policyImportFile(e.target.files[0]);$('portableDownload').onclick=()=>{if(catalogOpen)policyDownloadBackup();};$('portableOpen').onclick=()=>$('policyImport').click();
/* V26: mostrar campos únicamente cuando el requisito esté marcado. */
function toggleNewOnlyDetails(){ $('newOnlyDetails').hidden=!$('newOnlyEnabled').checked; }
$('newOnlyEnabled').addEventListener('change',toggleNewOnlyDetails);
toggleNewOnlyDetails();
$('issuerSelect').value=BALSECA_ISSUER;
policyStorageRead();policyRefresh();updateTemplateDownloadNames();

/* V26 — CLAVE LOCAL PARA PESTAÑA 6. No cifra el archivo exportado. */
const CATALOG_LOCK_KEY='conciliador_catalogo_clave_v26';
let catalogOpen=false;
function catalogHash(value,salt){
 if(!globalThis.crypto||!crypto.subtle)throw Error('Este navegador no admite protección con clave en archivos locales. Usa Edge o Chrome actualizado.');
 const enc=new TextEncoder();
 return crypto.subtle.importKey('raw',enc.encode(value),'PBKDF2',false,['deriveBits'])
 .then(key=>crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:120000,hash:'SHA-256'},key,256))
 .then(bits=>Array.from(new Uint8Array(bits),x=>x.toString(16).padStart(2,'0')).join(''));
}
function catalogLockUI(){
 $('catalogUnlocked').classList.toggle('active',catalogOpen);
 $('catalogLock').classList.toggle('hidden',catalogOpen);
 $('catalogPassword').value='';
 let exists=false;try{exists=!!localStorage.getItem(CATALOG_LOCK_KEY)}catch(e){$('catalogLockMessage').textContent='El almacenamiento del navegador no está disponible: '+e.message;}
 $('catalogLockHelp').textContent=exists?'Introduce la clave que configuraste en este navegador.':'Primer acceso: crea una clave de al menos 6 caracteres. Se guardará solamente el verificador en este navegador.';
 $('catalogUnlock').textContent=exists?'Abrir catálogo':'Crear clave y abrir catálogo';
}
async function catalogUnlock(){
 const pass=$('catalogPassword').value;
 const msg=$('catalogLockMessage');msg.textContent='';
 if(pass.length<6){msg.textContent='La clave debe contener al menos 6 caracteres.';return;}
 try{
 const current=JSON.parse(localStorage.getItem(CATALOG_LOCK_KEY)||'null');
 if(current){let test=await catalogHash(pass,current.salt);if(test!==current.hash){msg.textContent='Clave incorrecta.';return;}}
 else{
 if(!confirm('¿Crear esta clave para proteger el acceso local a la pestaña Catálogo? Guárdala en un lugar seguro.'))return;
 const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
 const hash=await catalogHash(pass,salt);
 localStorage.setItem(CATALOG_LOCK_KEY,JSON.stringify({salt,hash}));
 }
 catalogOpen=true;catalogLockUI();
 }catch(e){msg.textContent='No se pudo abrir el catálogo: '+e.message;}
}
$('catalogUnlock').onclick=catalogUnlock;
$('catalogPassword').addEventListener('keydown',e=>{if(e.key==='Enter')catalogUnlock();});
$('catalogRelock').onclick=()=>{catalogOpen=false;catalogLockUI();};
$('catalogChangePassword').onclick=async()=>{
 const existing=prompt('Introduce la clave actual para cambiarla:');if(existing===null)return;
 const current=JSON.parse(localStorage.getItem(CATALOG_LOCK_KEY)||'null');
 if(!current||await catalogHash(existing,current.salt)!==current.hash){alert('Clave actual incorrecta.');return;}
 const next=prompt('Nueva clave (mínimo 6 caracteres):');if(next===null)return;
 if(next.length<6){alert('La clave debe tener al menos 6 caracteres.');return;}
 const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
 localStorage.setItem(CATALOG_LOCK_KEY,JSON.stringify({salt,hash:await catalogHash(next,salt)}));
 alert('Clave local actualizada.');
};
catalogLockUI();


function tableRanges(){ $('ageRanges').innerHTML=`<div class="tablewrap"><table><thead><tr><th>DESDE AÑOS</th><th>MESES</th><th>DÍAS</th><th>HASTA AÑOS</th><th>MESES</th><th>DÍAS</th><th>LÍMITE USD</th><th>OBSERVACIONES</th><th>CONTROL</th><th></th></tr></thead><tbody>${ranges.age.map((r,i)=>`<tr>${['fromY','fromM','fromD','toY','toM','toD','limit'].map(k=>`<td><input style="min-width:76px;width:90px" data-group="age" data-i="${i}" data-field="${k}" type="${k==='limit'?'text':'number'}" ${k==='limit'?'data-money="1" inputmode="decimal"':'min="0"'} ${k.endsWith('M')?'max="11"':k.endsWith('D')?'max="30"':k.endsWith('Y')?'max="'+Number($('maxPerm').value)+'"':''} step="${k==='limit'?'.01':'1'}" value="${k==='limit'?formatUsd(r[k]):r[k]}"></td>`).join('')}<td><input style="min-width:220px" data-group="age" data-i="${i}" data-field="obs" value="${esc(r.obs)}"></td><td>${cmpAge([r.fromY,r.fromM,r.fromD],[r.toY,r.toM,r.toD])<=0?'OK':'REVISAR'}</td><td><button class="secondary" data-remove="age" data-i="${i}">Eliminar</button></td></tr>`).join('')}</tbody></table></div>`; $('guaranteeRanges').innerHTML=`<div class="tablewrap"><table><thead><tr><th>MONTO DESDE USD</th><th>MONTO HASTA USD</th><th>OBSERVACIONES</th><th></th></tr></thead><tbody>${ranges.guarantees.map((r,i)=>`<tr><td><input data-group="guarantees" data-i="${i}" data-field="from" data-money="1" type="text" inputmode="decimal" value="${formatUsd(r.from)}"></td><td><input data-group="guarantees" data-i="${i}" data-field="to" data-money="1" type="text" inputmode="decimal" value="${formatUsd(r.to)}"></td><td><input data-group="guarantees" data-i="${i}" data-field="obs" value="${esc(r.obs)}"></td><td><button class="secondary" data-remove="guarantees" data-i="${i}">Eliminar</button></td></tr>`).join('')}</tbody></table></div>`;}
function tableCombined(){ $('combinedRanges').innerHTML=`<div class="tablewrap"><table><thead><tr><th>DESDE AÑOS</th><th>MESES</th><th>DÍAS</th><th>HASTA AÑOS</th><th>MESES</th><th>DÍAS</th><th>MONTO DESDE USD</th><th>MONTO HASTA USD</th><th>REQUISITO</th><th></th></tr></thead><tbody>${ranges.combined.map((r,i)=>`<tr>${['fromY','fromM','fromD','toY','toM','toD','amountFrom','amountTo'].map(k=>`<td><input style="min-width:76px;width:86px" type="${k.startsWith('amount')?'text':'number'}" ${k.startsWith('amount')?'data-money="1" inputmode="decimal"':''} data-group="combined" data-i="${i}" data-field="${k}" step="${k.startsWith('amount')?'.01':'1'}" value="${k.startsWith('amount')?formatUsd(r[k]):r[k]}"></td>`).join('')}<td><input style="min-width:230px" data-group="combined" data-i="${i}" data-field="obs" value="${esc(r.obs)}"></td><td><button class="secondary" data-remove="combined" data-i="${i}">Eliminar</button></td></tr>`).join('')}</tbody></table></div>`;}
const _originalTableRanges=tableRanges;tableRanges=function(){_originalTableRanges();updateAgeFieldLimits();};const _originalTableCombined=tableCombined;tableCombined=function(){_originalTableCombined();updateAgeFieldLimits();};
/* V18: moneda en todos los importes de parámetros, sin convertirlos en texto de cálculo. */
document.addEventListener('focusin',e=>{
 const el=e.target;
 if(!(el instanceof HTMLInputElement)||el.dataset.money!=='1')return;
 const n=parseUsd(el.value);
 el.value=Number.isFinite(n)?String(n).replace('.',','):'';
 el.select();
});
document.addEventListener('focusout',e=>{
 const el=e.target;
 if(!(el instanceof HTMLInputElement)||el.dataset.money!=='1')return;
 const n=parseUsd(el.value);
 if(Number.isFinite(n)&&n>=0)el.value=formatUsd(n);
});
function readRanges(){document.querySelectorAll('[data-group][data-field]').forEach(x=>{let r=ranges[x.dataset.group][+x.dataset.i];r[x.dataset.field]=x.dataset.field==='obs'?x.value:x.dataset.money==='1'?parseUsd(x.value):Number(x.value)});}
document.addEventListener('click',e=>{if(e.target.dataset.remove){readRanges();ranges[e.target.dataset.remove].splice(+e.target.dataset.i,1);tableRanges();tableCombined()}});$('addAge').onclick=()=>{readRanges();if(ranges.age.length>=10){alert('Máximo 10 rangos');return;}ranges.age.push({fromY:Number($('min').value),fromM:Number($('minMes').value),fromD:Number($('minDia').value),toY:Number($('maxPerm').value),toM:Number($('maxPermMes').value),toD:Number($('maxPermDia').value),limit:10000,obs:'COBERTURA HASTA $10.000'});tableRanges()};$('addCombined').onclick=()=>{readRanges();ranges.combined.push({fromY:Number($('min').value),fromM:Number($('minMes').value),fromD:Number($('minDia').value),toY:Number($('maxPerm').value),toM:Number($('maxPermMes').value),toD:Number($('maxPermDia').value),amountFrom:0,amountTo:parseUsd($('limite').value),obs:'DECLARACIÓN DE SALUD'});tableCombined()};$('addGuarantee').onclick=()=>{readRanges();ranges.guarantees.push({from:0,to:parseUsd($('limite').value),obs:'SOLICITAR DOCUMENTO'});tableRanges()};tableRanges();tableCombined();updateAgeFieldLimits();
function cmpAge(a,b){for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i]?1:-1;return 0}
/* 9.2.1 Rangos cronológicos: meses 0–11, días según mes de referencia de la fecha de corte. */
function maxAgeDays(){const d=$('corte').value||'2026-09-01';const [y,m]=d.split('-').map(Number);return new Date(y,m-1,0).getDate()-1;}
function updateAgeFieldLimits(){const maxD=maxAgeDays();document.querySelectorAll('input[id$="Dia"],input[id="newOnlyFromD"],input[id="newOnlyToD"],input[data-field="fromD"],input[data-field="toD"]').forEach(x=>{x.max=maxD;x.title='Días permitidos 0–'+maxD+' según el mes de referencia de la fecha de corte'});document.querySelectorAll('input[id$="Mes"],input[data-field="fromM"],input[data-field="toM"]').forEach(x=>{x.max=11;x.title='Meses permitidos de 0 a 11'});}
$('corte').addEventListener('change',updateAgeFieldLimits);document.addEventListener('input',e=>{if(e.target.matches('input[id$="Dia"],input[id$="Mes"],input[data-field$="D"],input[data-field$="M"]'))e.target.setCustomValidity('');});
updateAgeFieldLimits();
/* V17.1 Política por póliza: una póliza solo de permanencia no admite ingresos nuevos.
   El campo de edad máxima se deshabilita visualmente, pero conservamos sus valores
   en el perfil para cuando la póliza vuelva a permitir ingresos. */
function updateNewEntryMode(){
 const allow=$('allowNewEntries').value!=='no';
 const panel=$('newAgePanel');panel.style.opacity=allow?'1':'.43';
 for(const id of ['maxNuevo','maxNuevoMes','maxNuevoDia'])$(id).disabled=!allow;
 panel.title=allow?'':'NO APLICA: la póliza es exclusivamente de permanencia.';
}
$('allowNewEntries').addEventListener('change',()=>{updateNewEntryMode();if(actual.length&&previous.length){try{compute()}catch(e){showStatus('Revisa parámetros: '+e.message,'error')}}});
updateNewEntryMode();
/* 9.2.2 Umbral adicional, exclusivamente para las cédulas clasificadas NUEVO. */
function getNewOnlyRule(p){
 if(!$('newOnlyEnabled').checked||p.allowNewEntries===false)return {enabled:false};
 const r={enabled:true,fromY:Number($('newOnlyFromY').value),fromM:Number($('newOnlyFromM').value),fromD:Number($('newOnlyFromD').value),toY:Number($('newOnlyToY').value),toM:Number($('newOnlyToM').value),toD:Number($('newOnlyToD').value),amountFrom:parseUsd($('newOnlyAmount').value),obs:$('newOnlyObs').value.trim()};
 const days=maxAgeDays();
 for(const k of ['fromY','fromM','fromD','toY','toM','toD']){
  const val=r[k],max=k.endsWith('Y')?100:k.endsWith('M')?11:days;
  if(!Number.isInteger(val)||val<0||val>max)throw Error('Revisa años, meses y días del requisito exclusivo para ingresos nuevos.');
 }
 if(r.toY===100&&(r.toM||r.toD))throw Error('El requisito para nuevos no puede superar los 100 años cumplidos.');
 if(cmpAge([r.fromY,r.fromM,r.fromD],[r.toY,r.toM,r.toD])>0)throw Error('El rango de edad para ingresos nuevos está invertido.');
 if(!Number.isFinite(r.amountFrom)||r.amountFrom<0||r.amountFrom>p.limite)throw Error('El monto mínimo del requisito para nuevos debe ser igual o menor al límite general de crédito.');
 if(!r.obs)throw Error('Escribe la observación del requisito exclusivo para nuevos.');
 return r;
}
/* 9.3 Validación de parámetros; mínimo de ingreso y máximo de permanencia */
function getParams(requireCorte=true){readRanges();const p={allowNewEntries:$('allowNewEntries').value!=='no'};for(let k of ['corte','min','minMes','minDia','maxNuevo','maxNuevoMes','maxNuevoDia','maxPerm','maxPermMes','maxPermDia','limite'])p[k]=k==='corte'?$(k).value:k==='limite'?parseUsd($(k).value):Number($(k).value);if((requireCorte&&!p.corte)||!Number.isFinite(p.limite)||p.limite<0)throw Error('Revisa fecha de corte y límite general.');for(let k of (p.allowNewEntries?['min','maxNuevo','maxPerm']:['min','maxPerm'])){if(!Number.isInteger(p[k])||p[k]<0||!Number.isInteger(p[k+'Mes'])||p[k+'Mes']<0||p[k+'Mes']>11||!Number.isInteger(p[k+'Dia'])||p[k+'Dia']<0||p[k+'Dia']>30)throw Error('Revisa años, meses y días de '+k)}if(p.maxPerm>100||(p.maxPerm===100&&(p.maxPermMes>0||p.maxPermDia>0)))throw Error('La edad máxima de permanencia es 100 años cumplidos.');const maxD=maxAgeDays();for(const k of (p.allowNewEntries?['min','maxNuevo','maxPerm']:['min','maxPerm']))if(p[k+'Dia']>maxD)throw Error('En la fecha de corte seleccionada los días deben estar entre 0 y '+maxD+'.');if((p.allowNewEntries&&(cmpAge([p.maxNuevo,p.maxNuevoMes,p.maxNuevoDia],[p.min,p.minMes,p.minDia])<0||cmpAge([p.maxPerm,p.maxPermMes,p.maxPermDia],[p.maxNuevo,p.maxNuevoMes,p.maxNuevoDia])<0))||cmpAge([p.maxPerm,p.maxPermMes,p.maxPermDia],[p.min,p.minMes,p.minDia])<0)throw Error('Las edades deben estar ordenadas: mínima, nuevo ingreso (cuando aplica), permanencia.');for(let [i,r] of ranges.age.entries()){if(['fromY','fromM','fromD','toY','toM','toD'].some(k=>!Number.isInteger(r[k])||r[k]<0||(k.endsWith('M')&&r[k]>11)||(k.endsWith('D')&&r[k]>maxD))||!Number.isFinite(r.limit)||cmpAge([r.fromY,r.fromM,r.fromD],[r.toY,r.toM,r.toD])>0||r.limit<0||r.limit>p.limite)throw Error('Rango especial inválido en fila '+(i+1)+': verifica edad, días y límite monetario general.');if(cmpAge([r.fromY,r.fromM,r.fromD],[p.min,p.minMes,p.minDia])<0||cmpAge([r.toY,r.toM,r.toD],[p.min,p.minMes,p.minDia])<0)throw Error('Los rangos especiales no pueden ser inferiores a la edad mínima de ingreso: '+p.min+' años, '+p.minMes+' meses, '+p.minDia+' días. Corrige el rango '+(i+1));if(cmpAge([r.fromY,r.fromM,r.fromD],[p.maxPerm,p.maxPermMes,p.maxPermDia])>0||cmpAge([r.toY,r.toM,r.toD],[p.maxPerm,p.maxPermMes,p.maxPermDia])>0)throw Error('Los rangos especiales no pueden superar la edad máxima de permanencia: '+p.maxPerm+' años, '+p.maxPermMes+' meses, '+p.maxPermDia+' días. Corrige el rango '+(i+1));for(let j=0;j<i;j++)if(cmpAge([r.fromY,r.fromM,r.fromD],[ranges.age[j].toY,ranges.age[j].toM,ranges.age[j].toD])<=0&&cmpAge([r.toY,r.toM,r.toD],[ranges.age[j].fromY,ranges.age[j].fromM,ranges.age[j].fromD])>=0)throw Error('Los rangos especiales de edad no deben superponerse.')}for(let [i,r] of ranges.combined.entries()){for(let key of ['fromY','fromM','fromD','toY','toM','toD'])if(!Number.isInteger(r[key])||r[key]<0||(key.endsWith('M')&&r[key]>11)||(key.endsWith('D')&&r[key]>maxD))throw Error('Revisa edad exacta de requisito combinado '+(i+1));if(cmpAge([r.fromY,r.fromM,r.fromD],[p.min,p.minMes,p.minDia])<0||cmpAge([r.toY,r.toM,r.toD],[p.min,p.minMes,p.minDia])<0)throw Error('El requisito combinado no puede empezar antes de la edad mínima de ingreso. Corrige el rango '+(i+1));if(cmpAge([r.toY,r.toM,r.toD],[p.maxPerm,p.maxPermMes,p.maxPermDia])>0||cmpAge([r.fromY,r.fromM,r.fromD],[p.maxPerm,p.maxPermMes,p.maxPermDia])>0)throw Error('La edad de requisitos combinados no puede superar la edad máxima de permanencia. Corrige el rango '+(i+1));if(cmpAge([r.fromY,r.fromM,r.fromD],[r.toY,r.toM,r.toD])>0||!Number.isFinite(r.amountFrom)||!Number.isFinite(r.amountTo)||r.amountFrom<0||r.amountTo<r.amountFrom||r.amountTo>p.limite||!r.obs.trim())throw Error('Revisa el requisito combinado '+(i+1)+': el monto no debe superar el límite general del crédito.');}for(let r of ranges.guarantees)if(!Number.isFinite(r.from)||!Number.isFinite(r.to)||r.from>r.to||r.from<0||r.to>p.limite||!r.obs.trim())throw Error('Revisa las garantías: ningún monto puede superar el límite general del crédito.');return {...p,age:ranges.age,guarantees:ranges.guarantees,combined:ranges.combined,newOnly:getNewOnlyRule(p)}}
function ci(v){let s=String(v??'').trim().replace(/\.0$/,'').replace(/\s/g,'');return s}/* VALIDACIÓN DE CÉDULA V11: réplica del validador Excel aportado.
   El estado CORRECTO corresponde a 10 dígitos numéricos y módulo 10 coincidente.
   No se restringe la tercera posición a 0–5: la fórmula Excel de referencia
   considera correctos números cuyo tercer dígito es 6 (ej. 1761426459).
   CORRECTO no acredita existencia o vigencia administrativa del documento. */
function validCI(s){if(!/^\d{10}$/.test(s))return false;let sum=0;for(let i=0;i<9;i++){let n=Number(s[i])*(i%2?1:2);sum+=n>9?n-9:n}return(10-sum%10)%10===Number(s[9])}function dateISO(v){if(v==null||v==='')return'';if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==='number'){let d=new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000);return d.toISOString().slice(0,10)}let t=String(v).trim();if(/^\d{4}-\d{2}-\d{2}/.test(t))return t.slice(0,10);let m=t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''}function age(b,c){if(!/^\d{4}-\d\d-\d\d$/.test(b))return null;let [y,m,d]=b.split('-').map(Number),[cy,cm,cd]=c.split('-').map(Number);let birth=new Date(Date.UTC(y,m-1,d));if(birth.getUTCFullYear()!==y||birth.getUTCMonth()!==m-1||birth.getUTCDate()!==d||b>c)return null;let yy=cy-y,mm=cm-m,dd=cd-d;if(dd<0){mm--;dd+=new Date(Date.UTC(cy,cm-1,0)).getUTCDate()}if(mm<0){yy--;mm+=12}return [yy,mm,dd]}
const zipEntries=async file=>{const zip=await JSZip.loadAsync(file),texts={};for(let [name,obj] of Object.entries(zip.files))if(/^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml))$/.test(name))texts[name]=await obj.async('text');return texts};const parseXml=s=>new DOMParser().parseFromString(s,'application/xml');const xmlNodes=(el,name)=>Array.from(el.getElementsByTagName(name));function xlsxRows(entries){let strings=[],shared=entries['xl/sharedStrings.xml'];if(shared){strings=xmlNodes(parseXml(shared),'si').map(n=>xmlNodes(n,'t').map(t=>t.textContent).join(''))}let book=entries['xl/workbook.xml'];let rels=entries['xl/_rels/workbook.xml.rels'];let file='xl/worksheets/sheet1.xml';if(book&&rels){let first=xmlNodes(parseXml(book),'sheet')[0],id=first?.getAttribute('r:id');let rel=xmlNodes(parseXml(rels),'Relationship').find(x=>x.getAttribute('Id')===id);let target=rel?.getAttribute('Target');if(target){file=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\.\//,'');}}if(!entries[file])file=Object.keys(entries).find(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k));if(!file)throw Error('No se encontró una hoja de cálculo.');let doc=parseXml(entries[file]);if(xmlNodes(doc,'parsererror').length)throw Error('XML no válido en '+file);let out=[];for(let row of xmlNodes(doc,'sheetData')[0]?.getElementsByTagName('row')||[]){let values=[];for(let c of row.getElementsByTagName('c')){let ref=c.getAttribute('r')||'A1',col=ref.match(/[A-Z]+/)[0],idx=0;for(let letter of col)idx=idx*26+letter.charCodeAt(0)-64;let type=c.getAttribute('t');let v=c.getElementsByTagName('v')[0]?.textContent??'';if(type==='s')v=strings[+v]??'';else if(type==='inlineStr')v=Array.from(c.getElementsByTagName('t')).map(x=>x.textContent).join('');else if(type==='b')v=v==='1';else if(v!==''&&type!=='str'&&type!=='e')v=Number(v);values[idx-1]=v;}out[Number(row.getAttribute('r')||out.length+1)-1]=values;}return out;}
async function readExcel(file,isActual){if(!file||!file.name.toLowerCase().endsWith('.xlsx'))throw Error('Selecciona archivos .xlsx válidos.');let rows=xlsxRows(await zipEntries(file)),hi=-1,ix={};for(let i=0;i<Math.min(rows.length,35);i++){let cells=(rows[i]||[]).map(canon),id=cells.findIndex(v=>v.includes('CEDULA')),amount=cells.findIndex(v=>v.includes('MONTO'));if(id>=0&&amount>=0){hi=i;ix={ci:id,monto:amount,nombre:cells.findIndex(v=>v.includes('NOMBRES')),fecha:cells.findIndex(v=>v.includes('NACIMIENTO')||v.includes('FECHA NAC'))};break;}}if(hi<0)throw Error('No se encontraron encabezados CÉDULA y MONTO en '+file.name);if(isActual&&ix.fecha<0)throw Error('Falta FECHA DE NACIMIENTO en ACTUAL');let output=[];for(let i=hi+1;i<rows.length;i++){let row=rows[i]||[],v=row[ix.monto],id=row[ix.ci];if((id===undefined||id==='')&&(v===undefined||v===''))continue;if(v==null||v==='')throw Error(`Monto vacío en ${file.name}, fila ${i+1}`);let monto=typeof v==='number'?v:Number(String(v).replace(/\s/g,'').replace(/\./g,'').replace(',','.'));if(!Number.isFinite(monto))throw Error(`Monto inválido en ${file.name}, fila ${i+1}: ${v}`);output.push({ci:ci(id),nombre:ix.nombre>=0?String(row[ix.nombre]??''):'',fecha:ix.fecha>=0?dateISO(row[ix.fecha]):'',monto:Math.round(monto*100),fila:i+1});}if(!output.length)throw Error(file.name+' no contiene datos');return output;}
/* V19: Conversión de rangos copiados desde Excel (TSV) al esquema común de readExcel.
   No modifica la conciliación: ambas fuentes producen {ci,nombre,fecha,monto,fila}.
   Se conserva el orden original y no se agregan registros por cédula aquí. */
function readPastedExcel(text,isActual){
  const source=isActual?'BASE ACTUAL':'MES ANTERIOR';
  const raw=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  if(!raw)throw Error('No hay datos pegados en '+source+'.');
  // Excel copia cada celda separada por TAB y cada fila separada por salto de línea.
  // Se toleran valores con comillas que contengan saltos de línea o tabulaciones.
  let grid=[],cells=[],token='',inQuotes=false;
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(ch==='"'){
      if(inQuotes&&raw[i+1]==='"'){token+='"';i++}else inQuotes=!inQuotes;
    }else if(ch==='\t'&&!inQuotes){cells.push(token.trim());token=''}
    else if(ch==='\n'&&!inQuotes){cells.push(token.trim());grid.push(cells);cells=[];token=''}
    else token+=ch;
  }
  cells.push(token.trim());grid.push(cells);
  if(inQuotes)throw Error('Comillas sin cerrar en los datos pegados de '+source+'.');
  grid=grid.filter(row=>row.some(v=>String(v).trim()!==''));
  if(!grid.length)throw Error('No se encontraron filas en '+source+'.');
  let first=grid[0].map(canon),header=first.some(v=>v.includes('CEDULA'))&&first.some(v=>v.includes('MONTO'));
  let fields={ci:0,nombre:1,fecha:isActual?2:-1,monto:isActual?3:2},start=0;
  if(header){
    fields={ci:first.findIndex(v=>v.includes('CEDULA')),nombre:first.findIndex(v=>v.includes('NOMBRE')),fecha:isActual?first.findIndex(v=>v.includes('NACIMIENTO')||v.includes('FECHA NAC')):-1,monto:first.findIndex(v=>v.includes('MONTO'))};
    if(fields.ci<0||fields.monto<0||fields.nombre<0||(isActual&&fields.fecha<0))throw Error('Encabezados incompletos en '+source+'.');
    start=1;
  }
  let output=[];
  for(let i=start;i<grid.length;i++){
    const row=grid[i],line=i+1,id=(row[fields.ci]??'').trim(),name=(row[fields.nombre]??'').trim(),rawAmount=(row[fields.monto]??'').trim();
    if(!id&&!name&&!rawAmount)continue;
    if(!id)throw Error(source+': cédula vacía en la fila pegada '+line+'.');
    if(rawAmount==='')throw Error(source+': monto vacío en la fila pegada '+line+'.');
    if(isActual&&!(row[fields.fecha]??'').trim())throw Error(source+': falta fecha de nacimiento en la fila pegada '+line+'.');
    const amount=parsePastedUsd(rawAmount);
    if(!Number.isFinite(amount))throw Error(source+': monto inválido en la fila pegada '+line+': '+rawAmount);
    output.push({ci:ci(id),nombre:name,fecha:isActual?dateISO(row[fields.fecha]):'',monto:Math.round(amount*100),fila:line});
  }
  if(!output.length)throw Error(source+' no contiene registros.');
  return output;
}
/* V25: aceptar importes pegados de Excel con separadores mixtos.
   Solo se usa en pegado; NO modifica cálculos, parámetros ni lectura de archivos XLSX.
   Casos: $11.756.28, $11,756.28, USD 11.756,28, 11756.28. */
function parsePastedUsd(value){
  const raw=String(value??'').replace(/USD|\$|\s/g,'').trim();
  if(!/^\d[\d.,]*$/.test(raw))return NaN;
  const marks=[...raw.matchAll(/[.,]/g)].map(m=>m.index);
  if(!marks.length)return Number(raw);
  const last=marks[marks.length-1], digitsAfter=raw.length-last-1;
  const before=raw.slice(0,last), after=raw.slice(last+1);
  // Si hay un separador y tres cifras finales, corresponde a miles.
  if(marks.length===1&&digitsAfter===3&&before.length<=3)return Number(before+after);
  // Los importes copiados de Excel usan centavos (1 o 2 cifras finales).
  if(digitsAfter>=1&&digitsAfter<=2)return Number(before.replace(/[.,]/g,'')+'.'+after);
  // Separadores de miles repetidos sin decimales.
  if(digitsAfter===3&&/^\d{1,3}(?:[.,]\d{3})+$/.test(raw))return Number(raw.replace(/[.,]/g,''));
  return NaN;
}
/* V22: resumen de observaciones exclusivamente para pantalla y exportación.
   La evaluación, prioridades, totales y condiciones siguen sin cambios.
   El detalle original se conserva por separado para filtros de múltiples causas. */
function observacionBreve(decision, obs, errors, req){
  if(decision==='APTO PARA CARGA') return 'OK SIN NOVEDADES';
  if(decision==='SUPERA LA EDAD MÁXIMA DE INGRESO') return 'SUPERA LA EDAD MÁXIMA DE INGRESO';
  if(decision==='NO PERMITE INGRESOS NUEVOS') return 'NO PERMITE INGRESOS NUEVOS';
  if(decision==='SUPERA EL LÍMITE DE CRÉDITO'){
    const etiquetas = obs.filter(x=>x.startsWith('APLICA LÍMITE ESPECIAL POR EDAD - '))
      .map(x=>x.slice('APLICA LÍMITE ESPECIAL POR EDAD - '.length).trim()).filter(Boolean);
    return etiquetas.length?[...new Set(etiquetas)].join(' | '):'SUPERA EL LÍMITE DE CRÉDITO';
  }
  if(decision==='OTRAS VALIDACIONES / REVISAR') return [...new Set(errors)].join(' | ') || 'REVISAR DATOS';
  if(decision==='PENDIENTE DE REQUISITOS') return [...new Set(req.filter(Boolean))].join(' | ') || 'PENDIENTE DE REQUISITOS';
  return [...new Set([...errors,...req].filter(Boolean))].join(' | ') || 'OK SIN NOVEDADES';
}
/* V28: presentación informativa de requisitos superados. NO altera el motor ni la decisión.
   Si el total ya supera el extremo superior de una franja documental, conserva el
   requisito iniciado al alcanzar su umbral mínimo. En permanencias no vuelve a
   solicitar documentos cuyo umbral ya se alcanzó en el período anterior. */
function requisitosParaMostrar(p,global,old,isNew,variation,ageParts){
 if(!isNew&&variation!=='AUMENTO')return [];
 const out=[];
 for(const r of p.guarantees){
   const lo=Math.round(r.from*100),hi=Math.round(r.to*100);
   if(global>hi && global>=lo && (isNew||old<lo) && r.obs.trim())out.push(r.obs.trim());
 }
 if(ageParts)for(const r of p.combined){
   const lo=Math.round(r.amountFrom*100),hi=Math.round(r.amountTo*100);
   if(global>hi&&global>=lo&&(isNew||old<lo)&&cmpAge(ageParts,[r.fromY,r.fromM,r.fromD])>=0&&cmpAge(ageParts,[r.toY,r.toM,r.toD])<=0&&r.obs.trim())out.push(r.obs.trim());
 }
 return [...new Set(out)];
}
/* V28: observaciones visibles, prioridad de límite primero y luego requisitos.
   No modifica los errores, requisitos originales ni la decisión de carga. */
function observacionExportable(r){
 if(r.decision!=='SUPERA EL LÍMITE DE CRÉDITO')return r.obs;
 const tags=[r.obs,...(r.requisitosSoloReporte||[])].filter(Boolean);
 return [...new Set(tags)].join(' | ');
}
/* 9.4 Motor de conciliación y decisiones (sin modificaciones de cálculo en V6) */
function sumMap(rows){let m=new Map();for(let r of rows)m.set(r.ci,(m.get(r.ci)||0)+r.monto);return m}function compute(){let p=getParams(),a=sumMap(actual),b=sumMap(previous),seen=new Set();results=actual.map(x=>{let n=a.get(x.ci),old=b.get(x.ci)||0,isNew=!b.has(x.ci),diff=n-old,variation=isNew?'NUEVO':diff>0?'AUMENTO':diff<0?'DISMINUCIÓN':'SIN VARIACIÓN',ap=age(x.fecha,p.corte),errors=[],req=[],obs=[isNew?'INGRESO NUEVO':'PERMANENCIA',variation],limit=Math.round(p.limite*100);if(isNew&&!p.allowNewEntries)errors.push('NO PERMITE INGRESOS NUEVOS');if(!validCI(x.ci))errors.push('CÉDULA INVÁLIDA');if(!ap)errors.push('FECHA DE NACIMIENTO INVÁLIDA');else{if(cmpAge(ap,[p.min,p.minMes,p.minDia])<0)errors.push('NO CUMPLE EDAD MÍNIMA');if(isNew&&p.allowNewEntries&&cmpAge(ap,[p.maxNuevo,p.maxNuevoMes,p.maxNuevoDia])>0)errors.push('SUPERA EDAD MÁXIMA DE INGRESO');if(!isNew&&cmpAge(ap,[p.maxPerm,p.maxPermMes,p.maxPermDia])>0)errors.push('SUPERA EDAD MÁXIMA DE PERMANENCIA');for(let r of p.age)if(cmpAge(ap,[r.fromY,r.fromM,r.fromD])>=0&&cmpAge(ap,[r.toY,r.toM,r.toD])<=0){limit=Math.min(limit,Math.round(r.limit*100));obs.push('APLICA LÍMITE ESPECIAL POR EDAD'+(r.obs?' - '+r.obs:''))}}if(n>limit)errors.push('SUPERA EL LÍMITE DE CRÉDITO');if(n<0)errors.push('MONTO NEGATIVO');if(isNew||diff>0){for(let r of p.guarantees){let lo=Math.round(r.from*100),hi=Math.round(r.to*100);if(n>=lo&&n<=hi&&(isNew||!(old>=lo&&old<=hi)))req.push(r.obs.trim())}if(ap)for(let r of p.combined){let minAge=[r.fromY,r.fromM,r.fromD],maxAge=[r.toY,r.toM,r.toD],lo=Math.round(r.amountFrom*100),hi=Math.round(r.amountTo*100);if(cmpAge(ap,minAge)>=0&&cmpAge(ap,maxAge)<=0&&n>=lo&&n<=hi&&(isNew||!(old>=lo&&old<=hi)))req.push(r.obs.trim())}/* V14: regla adicional independiente, exclusivamente para ingreso NUEVO. */
if(isNew&&p.allowNewEntries&&ap&&p.newOnly.enabled&&cmpAge(ap,[p.newOnly.fromY,p.newOnly.fromM,p.newOnly.fromD])>=0&&cmpAge(ap,[p.newOnly.toY,p.newOnly.toM,p.newOnly.toD])<=0&&n>=Math.round(p.newOnly.amountFrom*100))req.push(p.newOnly.obs);
if(req.length===0)obs.push('SIN NUEVOS REQUISITOS POR AUMENTO / YA EXIGIDOS EN MES ANTERIOR')}else obs.push('SIN NUEVAS GARANTÍAS');obs.push(...errors,...req);/* V13: prioridad de exclusion por edad maxima de ingreso antes de limite de credito. No altera observaciones ni calculos. */let decision=errors.includes('NO PERMITE INGRESOS NUEVOS')?'NO PERMITE INGRESOS NUEVOS':errors.includes('SUPERA EDAD MÁXIMA DE INGRESO')?'SUPERA LA EDAD MÁXIMA DE INGRESO':errors.includes('SUPERA EL LÍMITE DE CRÉDITO')?'SUPERA EL LÍMITE DE CRÉDITO':errors.length?'OTRAS VALIDACIONES / REVISAR':req.length?'PENDIENTE DE REQUISITOS':'APTO PARA CARGA';return {...x,global:n,old,diff,estado:isNew?'INGRESO NUEVO':'PERMANENCIA',variation,edad:ap?`${ap[0]} años, ${ap[1]} meses, ${ap[2]} días`:'SIN FECHA VÁLIDA',ciEstado:validCI(x.ci)?'CORRECTO':'INCORRECTO',/* V22: obsDetalle conserva todas las causas para filtros; obs solo contiene la observación breve. */obsDetalle:[...new Set(obs)].join(' | '),obs:observacionBreve(decision,obs,errors,req),limiteSugerido:limit,requisitosSoloReporte:[...new Set([...req,...requisitosParaMostrar(p,n,old,isNew,variation,ap)])],decision}});missing=[...b].filter(([ci])=>!a.has(ci)).map(([ci,monto])=>({ci,monto,nombre:(previous.find(r=>r.ci===ci)||{}).nombre||""})).sort((x,y)=>x.ci.localeCompare(y.ci));let totalA=actual.reduce((s,x)=>s+x.monto,0),totalB=previous.reduce((s,x)=>s+x.monto,0),ingresos=0,aumentos=0,disminuciones=0,salidas=missing.reduce((s,x)=>s+x.monto,0);for(let [id,n] of a){let old=b.get(id)||0;if(!b.has(id))ingresos+=n;else if(n>old)aumentos+=n-old;else if(n<old)disminuciones+=old-n;}let exportTotal=results.reduce((s,x)=>s+x.monto,0);let decisions={};for(let r of results)decisions[r.decision]=(decisions[r.decision]||0)+1;stats={totalA,totalB,variacion:totalA-totalB,ingresos,aumentos,disminuciones,salidas,explicado:ingresos+aumentos-disminuciones-salidas,cuadre:totalA-totalB-(ingresos+aumentos-disminuciones-salidas),exportTotal,regActual:actual.length,regAnterior:previous.length,cedActual:a.size,cedAnterior:b.size,nuevas:[...a.keys()].filter(id=>!b.has(id)).length,permanencias:[...a.keys()].filter(id=>b.has(id)).length,soloAnterior:missing.length,duplicadosA:actual.length-a.size,duplicadosB:previous.length-b.size,decisions};render();}
function metric(title,value,cls=''){return `<div class="metric ${cls}"><small>${title}</small><b>${value}</b></div>`}function kpi(l,v,cls=''){return `<div class="kpirow"><span>${esc(l)}</span><strong class="${cls}">${esc(v)}</strong></div>`}function render(){if(!stats)return;let s=stats;$('cards').innerHTML=metric('Cartera ACTUAL','USD '+fmt(s.totalA/100))+metric('Cartera ANTERIOR','USD '+fmt(s.totalB/100))+metric('Variación global','USD '+fmt(s.variacion/100),s.variacion>=0?'positive':'danger')+metric('Diferencia de cuadre','USD '+fmt(s.cuadre/100),s.cuadre===0?'positive':'danger')+metric('Registros ACTUAL',s.regActual)+metric('Cédulas ACTUAL',s.cedActual)+metric('Cédulas nuevas',s.nuevas)+metric('Permanencias',s.permanencias);$('movement').innerHTML=kpi('Ingresos nuevos','+ USD '+fmt(s.ingresos/100))+kpi('Aumentos de permanencias','+ USD '+fmt(s.aumentos/100))+kpi('Disminuciones de permanencias','- USD '+fmt(s.disminuciones/100))+kpi('Salidas del anterior','- USD '+fmt(s.salidas/100))+kpi('Variación explicada','USD '+fmt(s.explicado/100));$('decisions').innerHTML=Object.entries(s.decisions).map(([k,v])=>kpi(k,v+' registros')).join('')+kpi('Cédulas que salieron',s.soloAnterior+' cédulas');$('checks').innerHTML=kpi('Total ACTUAL vs suma RESULTADOS','USD '+fmt((s.totalA-s.exportTotal)/100),s.totalA===s.exportTotal?'green':'red')+kpi('Conciliación de variación','USD '+fmt(s.cuadre/100),s.cuadre===0?'green':'red')+kpi('Filas RESULTADOS vs ACTUAL',`${results.length} / ${actual.length}`,results.length===actual.length?'green':'red')+kpi('Suma global ACTUAL sin repetir por cédula','USD '+fmt([...new Map(results.map(r=>[r.ci,r.global])).values()].reduce((a,b)=>a+b,0)/100))+kpi('Suma global ANTERIOR (solo cédulas vigentes)','USD '+fmt([...new Map(results.map(r=>[r.ci,r.old])).values()].reduce((a,b)=>a+b,0)/100))+kpi('Duplicados por cédula ACTUAL (registros adicionales)',s.duplicadosA)+kpi('Duplicados por cédula ANTERIOR (registros adicionales)',s.duplicadosB);$('missingBody').innerHTML=missing.map(r=>`<tr><td>${esc(r.ci)}</td><td>${esc(r.nombre||"—")}</td><td>${fmt(r.monto/100)}</td></tr>`).join('');renderRows();}
/* 9.4.1 Vista limitada a 50 registros. Los filtros consultan toda la base; las exportaciones no se limitan. */
const PAGE_SIZE=50;
/* V12: los filtros por motivo no son excluyentes; una cedula puede superar el limite y la edad al mismo tiempo. */
/* V15: INGRESOS NUEVOS es un filtro de consulta, no modifica la decision de carga. */
function matchesDecisionFilter(r,d){if(!d)return true;if(d==='INGRESOS NUEVOS')return r.estado==='INGRESO NUEVO';if(d==='NO PERMITE INGRESOS NUEVOS')return r.decision==='NO PERMITE INGRESOS NUEVOS';if(d==='SUPERA EL LÍMITE DE CRÉDITO')return r.obsDetalle.split(' | ').includes('SUPERA EL LÍMITE DE CRÉDITO');if(d==='SUPERA LA EDAD MÁXIMA DE INGRESO')return r.obsDetalle.split(' | ').includes('SUPERA EDAD MÁXIMA DE INGRESO');return r.decision===d}
function filtered(){let q=canon($('search').value),d=$('decisionFilter').value;return results.filter(r=>(!q||canon(r.ci+' '+r.nombre).includes(q))&&matchesDecisionFilter(r,d))}
function renderRows(){let rows=filtered();let vistos=new Set();$('count').textContent=`Mostrando los primeros ${Math.min(PAGE_SIZE,rows.length)} de ${rows.length} registros filtrados (${results.length} registros en total); importe filtrado: USD ${fmt(rows.reduce((s,x)=>s+x.monto,0)/100)}. La exportación conserva todos los registros.`;$('resultBody').innerHTML=rows.slice(0,PAGE_SIZE).map(r=>{let primero=!vistos.has(r.ci);vistos.add(r.ci);return `<tr><td>${r.fila}</td><td>${esc(r.ci)}</td><td>${esc(r.ciEstado)}</td><td>${esc(r.nombre)}</td><td>${esc(r.fecha)}</td><td>${esc(r.edad)}</td><td class="alignright">${fmt(r.monto/100)}</td><td class="alignright">${primero?fmt(r.global/100):'—'}</td><td class="alignright">${primero?fmt(r.old/100):'—'}</td><td class="alignright">${primero?fmt(r.diff/100):'—'}</td><td>${esc(r.variation)}</td><td>${esc(observacionExportable(r))}</td><td><span class="tag ${r.decision==='APTO PARA CARGA'?'g':r.decision==='PENDIENTE DE REQUISITOS'?'y':'r'}">${esc(r.decision)}</span></td></tr>`}).join('')}
$('search').oninput=renderRows;$('decisionFilter').onchange=renderRows;
function rowForExport(r,seen){let first=!seen.has(r.ci);seen.add(r.ci);return [r.fila,r.ci,r.ciEstado,r.nombre,r.fecha,r.edad,r.monto/100,first?r.global/100:null,first?r.old/100:null,first?r.diff/100:null,r.estado,r.variation,observacionExportable(r),r.decision,first&&r.decision==='SUPERA EL LÍMITE DE CRÉDITO'?r.limiteSugerido/100:null]}
function bookRows(){let res=[['FILA ORIGEN','CÉDULA','ESTADO CÉDULA','NOMBRES COMPLETOS','FECHA NAC.','EDAD (A/M/D)','MONTO ACTUAL','SUMA GLOBAL ACTUAL (1 VEZ POR CÉDULA)','SUMA GLOBAL ANTERIOR (1 VEZ POR CÉDULA)','DIFERENCIA GLOBAL (1 VEZ POR CÉDULA)','ESTADO','VARIACIÓN','OBSERVACIONES','DECISIÓN DE CARGA','SUGERENCIA / LÍMITE (USD)']];let seen=new Set();for(let r of results)res.push(rowForExport(r,seen));return res}
function groupedRows(){let grouped=new Map();for(let r of results)if(!grouped.has(r.ci))grouped.set(r.ci,[r.ci,r.nombre,r.global/100,r.old/100,r.diff/100,r.estado,r.variation]);return [['CÉDULA','NOMBRES COMPLETOS','SUMA GLOBAL ACTUAL','SUMA GLOBAL ANTERIOR','DIFERENCIA GLOBAL','ESTADO','VARIACIÓN'],...grouped.values()]}
function csvCell(x){let str=String(x??'');return '"'+str.replace(/"/g,'""')+'"'}function save(blob,name){let a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1000)}function downloadCSV(rows,name){let s='\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n');save(new Blob([s],{type:'text/csv;charset=utf-8'}),name)}
function excelXmlRows(rows,sheetName){let moneyCols=sheetName==='RESULTADOS'?[7,8,9,10,15]:sheetName==='TOTALES POR CEDULA'?[3,4,5]:sheetName==='SOLO ANTERIOR'?[2]:sheetName==='CONTROL TOTALES'?[2]:[];let specialMoney=sheetName==='PARAMETROS';let monetary=(j,i)=>moneyCols.includes(j+1)&&i>0&&(sheetName!=='CONTROL TOTALES'||i<=11);let moneyParam=(row,i,j)=>specialMoney&&typeof row[j]==='number'&&(row[0]==='LÍMITE GENERAL'&&j===1||row.length===8&&j===6||row.length===3&&j<=1&&i>6||row.length===9&&(j===6||j===7));return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetData>${rows.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>{let col='',n=j+1;while(n){col=String.fromCharCode(65+(n-1)%26)+col;n=Math.floor((n-1)/26)}let ref=col+(i+1),head=i===0;let style=head?1:monetary(j,i)||moneyParam(row,i,j)?(sheetName==='RESULTADOS'&&j===6?3:2):sheetName==='RESULTADOS'&&j===6?4:0;if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]))}</t></is></c>`}).join('')}</row>`).join('')}</sheetData></worksheet>`}
const excelStyles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot; #,##0.00"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FF9C3E05"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF256D73"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE1BB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
/* 9.5 Exportación de libros Excel manteniendo sus formatos */
async function downloadXLSX(){if(!stats)throw Error('Primero procesa las bases.');let policyNumber=policyFilePrefix(),policyDescription=$('policyDescription').value.trim();let detail=bookRows(),s=stats;let controls=[['INDICADOR','VALOR'],['CARTERA ACTUAL',s.totalA/100],['CARTERA ANTERIOR',s.totalB/100],['VARIACIÓN GLOBAL',s.variacion/100],['INGRESOS NUEVOS',s.ingresos/100],['AUMENTOS PERMANENCIAS',s.aumentos/100],['DISMINUCIONES PERMANENCIAS',s.disminuciones/100],['SALIDAS',s.salidas/100],['VARIACIÓN EXPLICADA',s.explicado/100],['CUADRE',s.cuadre/100],['TOTAL RESULTADOS',s.exportTotal/100],['REGISTROS ACTUAL',s.regActual],['REGISTROS ANTERIOR',s.regAnterior],['CÉDULAS NUEVAS',s.nuevas],['PERMANENCIAS',s.permanencias],...Object.entries(s.decisions).map(([k,v])=>['REGISTROS '+k,v])];let p=getParams(),params=[['PARÁMETRO','VALOR'],['NÚMERO DE PÓLIZA',policyNumber],['DESCRIPCIÓN',policyDescription],['CORTE',p.corte],['EDAD MÍNIMA',`${p.min} años, ${p.minMes} meses, ${p.minDia} días`],['POLÍTICA INGRESOS NUEVOS',p.allowNewEntries?'PERMITIDOS':'NO PERMITIDOS — SOLO PERMANENCIA'],['EDAD MÁX NUEVOS',p.allowNewEntries?`${p.maxNuevo} años, ${p.maxNuevoMes} meses, ${p.maxNuevoDia} días`:'NO APLICA'],['EDAD MÁX PERMANENCIA',`${p.maxPerm} años, ${p.maxPermMes} meses, ${p.maxPermDia} días`],['LÍMITE GENERAL',p.limite],[],['DESDE AÑOS','DESDE MESES','DESDE DÍAS','HASTA AÑOS','HASTA MESES','HASTA DÍAS','LÍMITE USD','OBSERVACIÓN'],...p.age.map(r=>[r.fromY,r.fromM,r.fromD,r.toY,r.toM,r.toD,r.limit,r.obs]),[],['MONTO DESDE','MONTO HASTA','REQUISITO'],...p.guarantees.map(r=>[r.from,r.to,r.obs]),[],['EDAD DESDE A','M','D','EDAD HASTA A','M','D','MONTO DESDE','MONTO HASTA','REQUISITO COMBINADO'],...p.combined.map(r=>[r.fromY,r.fromM,r.fromD,r.toY,r.toM,r.toD,r.amountFrom,r.amountTo,r.obs]),[],['REQUISITO SOLO NUEVOS','ACTIVO','EDAD DESDE A','M','D','EDAD HASTA A','M','D','MONTO DESDE USD','OBSERVACION'],['DECLARACION DE SALUD',p.newOnly.enabled?'SI':'NO',p.newOnly.enabled?p.newOnly.fromY:'',p.newOnly.enabled?p.newOnly.fromM:'',p.newOnly.enabled?p.newOnly.fromD:'',p.newOnly.enabled?p.newOnly.toY:'',p.newOnly.enabled?p.newOnly.toM:'',p.newOnly.enabled?p.newOnly.toD:'',p.newOnly.enabled?p.newOnly.amountFrom:'',p.newOnly.enabled?p.newOnly.obs:'']];controls.splice(1,0,['NÚMERO DE PÓLIZA',policyNumber],['DESCRIPCIÓN',policyDescription]);let sheets=[['RESULTADOS',detail],['TOTALES POR CEDULA',groupedRows()],['CONTROL TOTALES',controls],['SOLO ANTERIOR',[['CÉDULA','MONTO ANTERIOR'],...missing.map(r=>[r.ci,r.monto/100])]],['PARAMETROS',params]];let zip=new JSZip();zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);zip.file('xl/styles.xml',excelStyles);zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name],i)=>`<sheet name="${name}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`);sheets.forEach(([name,rows],i)=>zip.file(`xl/worksheets/sheet${i+1}.xml`,excelXmlRows(rows,name)));let blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});save(blob,'Conciliacion_Creditos_'+policyNumber+'_'+p.corte+'.xlsx')}
function showStatus(msg,type=''){let x=$('status');x.className='notice '+type;x.textContent=msg}async function processWithCutoff(){
  const f1=$('actualFile').files[0],f2=$('anteriorFile').files[0],t1=$('actualPaste').value,t2=$('anteriorPaste').value;
  const pasted1=t1.trim().length>0,pasted2=t2.trim().length>0;
  if((!f1&&!pasted1)||(!f2&&!pasted2)){showStatus('Carga o pega ambas bases (ACTUAL y MES ANTERIOR).','error');return;}
  try{
    showStatus('Procesando bases localmente...');
    const aa=pasted1?readPastedExcel(t1,true):await readExcel(f1,true);
    const bb=pasted2?readPastedExcel(t2,false):await readExcel(f2,false);
    actual=aa;previous=bb;compute();
    showStatus(`Conciliación completada: ${actual.length} registros de ACTUAL, ${previous.length} registros anteriores. Descuadre USD ${fmt(stats.cuadre/100)}.`,stats.cuadre===0?'good':'warn');
    document.querySelector('[data-tab=resumen]').click();
    $('cutoffSummary').textContent='Fecha de corte de edad aplicada: '+$('corte').value.split('-').reverse().join('/');
    $('cutoffSummary').hidden=false;
    $('cutoffSummaryControl').textContent=$('cutoffSummary').textContent;
    $('cutoffSummaryControl').hidden=false;
  }catch(e){showStatus('Error: '+e.message,'error');console.error(e)}
}
$('process').onclick=()=>{
  const hasActual=$('actualFile').files[0]||$('actualPaste').value.trim();
  const hasPrevious=$('anteriorFile').files[0]||$('anteriorPaste').value.trim();
  if(!hasActual||!hasPrevious){
    showStatus('Carga o pega ambas bases (ACTUAL y MES ANTERIOR).','error');return;
  }
  const dialog=$('cutoffDialog');$('cutoffInput').value='';dialog.showModal();
};
$('cutoffCancel').onclick=()=>$('cutoffDialog').close();
$('cutoffForm').addEventListener('submit',e=>{e.preventDefault();const val=$('cutoffInput').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(val)){alert('Selecciona una fecha válida.');return;}$('corte').value=val;updateAgeFieldLimits();$('cutoffDialog').close();processWithCutoff();});
$('recalc').onclick=()=>{try{getParams();if(actual.length&&previous.length)compute();alert('Parámetros aplicados correctamente.')}catch(e){alert(e.message)}};$('exportAll').onclick=async()=>{try{await downloadXLSX()}catch(e){alert('No se pudo exportar: '+e.message)}};$('exportCSV').onclick=()=>{if(!results.length)return alert('Primero carga las bases');try{downloadCSV(bookRows(),'Resultados_Conciliacion_'+policyFilePrefix()+'.csv')}catch(e){alert(e.message)}};$('exportMass').onclick=()=>{if(!results.length)return alert('Primero carga las bases');let prefix;try{prefix=policyFilePrefix()}catch(e){return alert(e.message)}let valid=results.filter(r=>r.decision==='APTO PARA CARGA');if(!confirm(`Se exportarán ${valid.length} registros APTO PARA CARGA. Los pendientes y excluidos no se incluyen. ¿Continuar?`))return;let ascii=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Ñ/g,'N').replace(/ñ/g,'n').replace(/[|\r\n]/g,' ').trim();let lines=valid.map(r=>`C|${r.ci}|${ascii(r.nombre).toUpperCase()}|${r.fecha.split('-').reverse().join('/')}|M||${(r.monto/100).toFixed(2)}|1|N`);save(new Blob([lines.join('\r\n')],{type:'text/plain;charset=utf-8'}),'Carga_Masiva_Aptos_'+prefix+'.txt')};$('downloadFiltered').onclick=()=>{if(!results.length)return alert('Primero carga las bases');let keys=bookRows()[0];let seen=new Set();let rows=filtered().map(r=>rowForExport(r,seen));try{downloadCSV([keys,...rows],'Resultados_Filtrados_'+policyFilePrefix()+'.csv')}catch(e){alert(e.message)}};/* V14: limpieza total y explícita de datos, filtros, parámetros y reglas de esta sesión. */
function resetWorkspaceForNewPolicy(){
 actual=[];previous=[];results=[];missing=[];stats=null;
 $('actualFile').value='';$('anteriorFile').value='';$('actualPaste').value='';$('anteriorPaste').value='';$('search').value='';$('decisionFilter').value='';
 for(const id of ['cards','movement','decisions','checks','resultBody','missingBody','count'])$(id).innerHTML='';
 for(const id of policyIds)$(id).value='';
 $('corte').value='';$('cutoffInput').value='';$('cutoffSummary').hidden=true;$('cutoffSummaryControl').hidden=true;
 $('newOnlyEnabled').checked=false;toggleNewOnlyDetails();$('allowNewEntries').value='si';updateNewEntryMode();
 ranges={age:[],guarantees:[],combined:[]};tableRanges();tableCombined();
 policyClearIdentity();policyRefresh();
 showStatus('Nueva póliza: sesión vacía. Selecciona las bases después de configurar y guardar.','good');
}
function clearEverything(){
 if(!confirm('¿Limpiar TODO? Se borrarán las bases cargadas, los resultados y los parámetros de esta sesión. Las pólizas guardadas permanecerán disponibles en el catálogo.'))return;
 resetWorkspaceForNewPolicy();
 policyNotice('Sesión limpiada. Las pólizas guardadas siguen disponibles en el catálogo.');
 showStatus('Sesión limpiada. Las pólizas guardadas se conservan en el catálogo de Parámetros.','good');
 document.querySelector('[data-tab="carga"]').click();
}
$('reset').onclick=clearEverything;
$('clearAllParams').onclick=clearEverything;document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===el));document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('active',p.id===el.dataset.tab))});

/* ===== V32: CONSULTA DOCUMENTAL AISLADA (NO ALTERA CÁLCULOS) ===== */
const DOC_STORE_V32='conciliador_documentos_polizas_v32';
let policyDocumentsV32={};

/* ===== V33 | PDF ORIGINAL POR PÓLIZA: IndexedDB + respaldo JSON ===== */
const PDF_DB_V33='conciliador_pdf_original_v33', PDF_TABLE_V33='pdfPorPoliza';
let pdfSessionV33=new Map(), pdfViewerUrlV33=null, pdfPreviewSeqV33=0;
function pdfDecodeB64V33(data){const bin=atob(data),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return new Blob([out],{type:'application/pdf'});}
function pdfToB64V33(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(r.error||Error('Error al leer PDF'));r.readAsDataURL(blob);});}
function pdfOpenDbV33(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(Error('IndexedDB no disponible'));return;}const r=indexedDB.open(PDF_DB_V33,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(PDF_TABLE_V33))r.result.createObjectStore(PDF_TABLE_V33);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function pdfSaveV33(number,blob){pdfSessionV33.set(number,blob);const db=await pdfOpenDbV33();try{await new Promise((resolve,reject)=>{const tx=db.transaction(PDF_TABLE_V33,'readwrite');tx.objectStore(PDF_TABLE_V33).put(blob,number);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
async function pdfGetV33(number){if(pdfSessionV33.has(number))return pdfSessionV33.get(number);try{const db=await pdfOpenDbV33();const stored=await new Promise((resolve,reject)=>{const tx=db.transaction(PDF_TABLE_V33,'readonly');const r=tx.objectStore(PDF_TABLE_V33).get(number);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});db.close();if(stored){pdfSessionV33.set(number,stored);return stored;}}catch(e){/* Fallback to supplied reference document below */}
 return null;
}
async function pdfRefreshViewerV33(){
 const seq=++pdfPreviewSeqV33, n=$('fichaPolicySelect').value;
 if(pdfViewerUrlV33){URL.revokeObjectURL(pdfViewerUrlV33);pdfViewerUrlV33=null;}
 $('fichaPdfFrame').removeAttribute('src');$('fichaPdfFrameWrap').hidden=true;
 $('fichaOriginalName').textContent='';$('fichaOriginalStatus').hidden=false;
 if(!n){$('fichaOriginalStatus').textContent='Selecciona una póliza para ver su documento original.';return;}
 $('fichaOriginalStatus').textContent='Cargando PDF original de '+n+'…';
 const blob=await pdfGetV33(n);
 if(seq!==pdfPreviewSeqV33)return;
 if(!blob){$('fichaOriginalStatus').textContent='Esta póliza todavía no tiene un PDF original almacenado. Asocia su documento con el selector superior y vuelve a esta vista.';return;}
 pdfViewerUrlV33=URL.createObjectURL(blob);
 $('fichaOriginalName').textContent=policyDocumentsV32[n]?.source||'Documento asociado';
 $('fichaPdfFrame').src=pdfViewerUrlV33+'#toolbar=0&navpanes=0&scrollbar=1';
 $('fichaPdfFrameWrap').hidden=false;$('fichaOriginalStatus').hidden=true;
}
function pdfSwitchTabV33(type){const showPdf=type==='original';$('fichaOriginalPane').hidden=!showPdf;$('fichaSummaryPane').hidden=showPdf;$('fichaOriginalTab').classList.toggle('ficha-tab-selected',showPdf);$('fichaSummaryTab').classList.toggle('ficha-tab-selected',!showPdf);if(showPdf)pdfRefreshViewerV33();}
$('fichaSummaryTab').onclick=()=>pdfSwitchTabV33('summary');
$('fichaOriginalTab').onclick=()=>pdfSwitchTabV33('original');
async function pdfExportDocsV33(){const items={};const names=new Set([...Object.keys(policyDocumentsV32),...Object.keys(policyCatalog)]);for(const name of names){let blob=await pdfGetV33(name);if(blob){items[name]={name:policyDocumentsV32[name]?.source||name+'.pdf',mime:'application/pdf',base64:await pdfToB64V33(blob)};}}return items;}
async function pdfImportDocsV33(documents){let restored=0,errors=[];for(const [n,record] of Object.entries(documents||{})){if(!policyValidNumber(n)||typeof record?.base64!=='string'||!record.base64)continue;try{const blob=pdfDecodeB64V33(record.base64);if(blob.size>12*1024*1024)throw Error('supera 12 MB');await pdfSaveV33(n,blob);restored++;}catch(e){errors.push(n+': '+e.message);}}return {restored,errors};}

function docStorageReadV32(){try{const x=JSON.parse(localStorage.getItem(DOC_STORE_V32)||'{}');policyDocumentsV32=(x&&typeof x==='object'&&!Array.isArray(x))?x:{};}catch(e){policyDocumentsV32={};}}
function docStorageWriteV32(){try{localStorage.setItem(DOC_STORE_V32,JSON.stringify(policyDocumentsV32));return true}catch(e){return false;}}
const docNormalizeV32=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
function docDecodePdfLiteralV32(s){return s.replace(/\\([0-7]{1,3}|[nrtbf()\\]|\r\n|\n|\r)/g,(_,c)=>{if(/^[0-7]/.test(c))return String.fromCharCode(parseInt(c,8));return ({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f','(':'(',')':')','\\':'\\','\r\n':'','\n':'','\r':''})[c]??c;});}
async function docExtractPdfTextV32(file){
 const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length>12*1024*1024)throw Error('PDF demasiado grande (máximo 12 MB).');
 const raw=Array.from(bytes,b=>String.fromCharCode(b)).join('');
 if(!raw.startsWith('%PDF-'))throw Error('El archivo no es un PDF válido.');
 const parts=[];let at=0,count=0;
 while((at=raw.indexOf('stream',at))>=0){
  const after=at+6;
  if(raw[after]!=='\n'&&raw[after]!=='\r'){at=after;continue;}
  const begin=after+(raw[after]==='\r'&&raw[after+1]==='\n'?2:1);
  const end=raw.indexOf('endstream',begin);if(end<0)break;
  const pre=raw.slice(Math.max(0,at-1200),at),dict=pre.slice(pre.lastIndexOf('<<'));
  at=end+9;
  if(/\/Subtype\s*\/Image|\/FontFile|\/Type\s*\/ObjStm/.test(dict))continue;
  if(!/\/FlateDecode/.test(dict)&&!/BT[\s\S]*?ET/.test(raw.slice(begin,Math.min(end,begin+1000))))continue;
  if(++count>300)break;
  const expectedLength=Number((dict.match(/\/Length\s*(\d+)/)||[])[1]||0);
  let stream=bytes.slice(begin,expectedLength>0&&expectedLength<=end-begin?begin+expectedLength:end);
  // Algunos generadores PDF dejan un salto de línea antes de endstream.
  if(!expectedLength){while(stream.length&&[10,13,32].includes(stream[stream.length-1]))stream=stream.slice(0,-1);}
  try{
   if(/\/FlateDecode/.test(dict)){
    if(typeof DecompressionStream==='undefined')throw Error('Este navegador no puede descomprimir PDF.');
    const output=new Response(new Blob([stream]).stream().pipeThrough(new DecompressionStream('deflate')));
    stream=new Uint8Array(await output.arrayBuffer());
   }
   let content=Array.from(stream,b=>String.fromCharCode(b)).join('');
   const blocks=content.match(/BT[\s\S]*?ET/g)||[];
   for(const block of blocks){
    const tokens=[];const reg=/\(((?:\\.|[^\\)])*)\)\s*Tj|\[((?:[^\]]|\]\s*\w)*?)\]\s*TJ/g;let m;
    while((m=reg.exec(block))){
     if(m[1]!==undefined)tokens.push(docDecodePdfLiteralV32(m[1]));
     else tokens.push([...m[2].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map(z=>docDecodePdfLiteralV32(z[1])).join(''));
    }
    if(tokens.length)parts.push(tokens.join(' '));
   }
  }catch(e){/* Other PDF streams or unsupported filters are ignored. */}
 }
 const text=parts.join('\n');
 if(text.trim().length<120)throw Error('No se encontró suficiente texto extraíble. El PDF podría ser escaneado o utilizar una codificación no compatible. No se inventarán condiciones.');
 return text;
}
function docFindLinesV32(lines,regex){return lines.find(x=>regex.test(docNormalizeV32(x)))||'';}
function docExtractSectionV32(lines,start,endRegex){
 const ix=lines.findIndex(x=>start.test(docNormalizeV32(x)));
 if(ix<0)return '';
 const collected=[];
 for(let j=ix+1;j<Math.min(lines.length,ix+28);j++){
  const l=lines[j].trim();if(endRegex.test(docNormalizeV32(l)))break;
  if(l&& !/^(CREACION|IMPRESION|CODIGO DE|CONDICIONES PARTICULARES|PAG\.|ASEGURADO\s*:|RAMO\s*:|POLIZA\s*:)/i.test(docNormalizeV32(l)))collected.push(l);
 }
 return collected.join(' ').replace(/\s+/g,' ').trim();
}
function docReadValuesV32(text,filename){
 const lines=text.split(/\r?\n/).map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
 const readAge=(regex)=>{const x=docFindLinesV32(lines,regex);return x.match(/(\d{1,3})\s*a[nñ]os/i)?.[0]||'';};
 const limitLine=docFindLinesV32(lines,/LIMITE MAXIMO DE CREDITO/);
 const limit=limitLine.match(/\$\s*([\d.,]+)/)?.[1]||'';
 const rateLines=lines.filter(x=>/Tasa Neta Mensual|Codeudor-Conyuge.*por mil/i.test(docNormalizeV32(x))).join(' ');
 const rate=(rateLines.match(/(\d+(?:[.,]\d+)?)\s*(?:por\s*mil|‰)/i)||[])[1]||'';
 const bands=lines.filter(x=>/^\d{1,3}\s*a[nñ]os?\b.*(?:\d+\s*%)/i.test(x)||/^\d{1,3}\s*a[nñ]os?\s*\d+\s*d[ií]a\b.*\d+\s*%/i.test(x)).slice(0,12);
 const reqLine=lines.findIndex(x=>/De\s*\$\s*0\s*a\s*\$\s*25[,\.]?000/i.test(x));
 const requirements=[];
 if(reqLine>=0){
  requirements.push(lines[reqLine]);
  const fragments=[];
  for(let j=reqLine+1;j<Math.min(reqLine+9,lines.length);j++){
   if(/Todos los socios|DESGRAVAMEN|EXCLUSIONES|En caso que/i.test(lines[j]))break;
   fragments.push(lines[j]);
  }
  if(fragments.length)requirements.push(fragments.join(' ').replace(/\s+/g,' ').trim());
 }
 const socioIndex=lines.findIndex(x=>/Todos los socios mayores a/i.test(docNormalizeV32(x)));
 if(socioIndex>=0){
  const fragments=[];
  for(let j=socioIndex;j<Math.min(socioIndex+7,lines.length);j++){
   if(j>socioIndex&&/En caso que|DESGRAVAMEN/i.test(lines[j]))break;
   fragments.push(lines[j]);
  }
  requirements.push(fragments.join(' ').split(/En caso que/i)[0].replace(/\s+/g,' ').trim());
 }
 if(socioIndex>=0){requirements[requirements.length-1]=requirements[requirements.length-1].split(/En caso que/i)[0].trim();}
 const continuity=docExtractSectionV32(lines,/^CONTINUIDAD DE COBERTURA\s*:/,/^(NOVACION DE CREDITO|ERRORES U OMISIONES|CANCELACION DE POLIZA|PAGO POR|CREACION)/);
 let billing='';const bix=lines.findIndex(x=>/^FACTURACION$/i.test(docNormalizeV32(x)));
 if(bix>=0){
  const intro=lines.slice(bix+1,bix+4).filter(x=>!/^IMPRESION|^CREACION/i.test(docNormalizeV32(x))).join(' ').split(/\d{2}\/\d{2}\/\d{4}/)[0].trim();
  const items=lines.slice(bix+1,bix+65).filter(x=>/^[-•]\s*(Nombres|N[uú]mero|Fecha|Nro|Principio|Monto|Saldo)/i.test(x));
  billing=[intro,...items].filter(Boolean).join(' · ').replace(/\s+/g,' ').trim();
 }
 const formatLimit=limit?('USD '+(parseFloat(limit.replace(/,/g,''))||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2})) : '';
 return {source:filename,readAt:new Date().toISOString(),credit:formatLimit,rate:rate?rate.replace('.',',')+' por mil':'',minAge:readAge(/Edad Minima de ingreso/i),maxAge:readAge(/Edad Maxima de ingreso/i),stayAge:readAge(/Edad Maxima de permanencia/i),bands,requirements,continuity,billing,confidence:'Extracción automática local: revisa los campos con el PDF original.'};
}
function docDisplayValueV32(x){return x&&String(x).trim()?String(x):'No identificado en el PDF';}
function docListV32(items){if(!items?.length)return '<div class="ficha-empty">No identificado en el PDF.</div>';return '<ul class="ficha-list">'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';}
function docPanelV32(p){
 let html='<div class="ficha-banner"><strong>CONDICIONES DEL DOCUMENTO</strong><div class="ficha-note">Archivo: '+esc(p.source||'')+' · '+esc(p.confidence||'')+'</div></div>';
 html+='<div class="ficha-grid">'+fichaCell('LÍMITE MÁXIMO DE CRÉDITO',docDisplayValueV32(p.credit))+fichaCell('TASA NETA MENSUAL',docDisplayValueV32(p.rate))+fichaCell('EDAD MÍNIMA DE INGRESO',docDisplayValueV32(p.minAge))+fichaCell('EDAD MÁXIMA DE INGRESO',docDisplayValueV32(p.maxAge))+fichaCell('EDAD MÁXIMA DE PERMANENCIA',docDisplayValueV32(p.stayAge))+'</div>';
 html+='<div class="ficha-subheading">LÍMITES DE COBERTURA SEGÚN EDAD</div>'+docListV32(p.bands);
 html+='<div class="ficha-subheading">REQUISITOS DE ASEGURABILIDAD — TITULAR Y CÓNYUGE</div>'+docListV32(p.requirements);
 html+='<div class="ficha-subheading">CONTINUIDAD DE COBERTURA</div><p class="ficha-note">'+esc(docDisplayValueV32(p.continuity))+'</p>';
 html+='<div class="ficha-subheading">FACTURACIÓN</div><p class="ficha-note">'+esc(docDisplayValueV32(p.billing))+'</p>';
 return html;
}
function docSelectedPolicyV32(){return $('fichaPolicySelect').value;}
async function docUploadV32(file){
 if(!file)return;
 const number=docSelectedPolicyV32();
 if(!number){$('fichaUploadMessage').textContent='Selecciona una póliza antes de adjuntar el PDF.';return;}
 if(!policyCatalog[number]){$('fichaUploadMessage').textContent='La póliza debe estar guardada en el catálogo antes de asociarle un documento.';return;}
 if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name)){$('fichaUploadMessage').textContent='Selecciona un archivo PDF válido.';return;}
 if(file.size>12*1024*1024){$('fichaUploadMessage').textContent='El PDF supera el límite de 12 MB para su respaldo portátil.';return;}
 $('fichaUploadMessage').textContent='Guardando PDF de '+number+'…';
 try{
   const existing=await pdfGetV33(number);
   if(existing&&!confirm('La póliza '+number+' ya tiene un PDF asociado. ¿Deseas reemplazarlo?'))return;
   let persisted=true;
   try{await pdfSaveV33(number,file);}catch(e){pdfSessionV33.set(number,file);persisted=false;}
   policyDocumentsV32[number]={...(policyDocumentsV32[number]||{}),source:file.name};
   docStorageWriteV32();
   $('fichaUploadMessage').textContent=persisted?'PDF vinculado a '+number+'. Para visualizarlo, utiliza el botón en 1. Parámetros.':'PDF vinculado solo durante esta sesión. El navegador no permitió guardarlo permanentemente. Descarga el catálogo portátil como respaldo.';
   pdfUpdateParamV34();
 }catch(e){$('fichaUploadMessage').textContent='No se pudo vincular el PDF: '+e.message;}
 finally{$('fichaPdfUpload').value='';}
}
/* V35: la carga ahora utiliza docUploadV35, compatible con tres anexos. */
docStorageReadV32();


/* ===== V32: PESTAÑA DE CONSULTA SIN EDICIÓN ===== */
function fichaCell(label,value){return `<div class="ficha-value"><span>${esc(label)}</span><strong>${esc(String(value))}</strong></div>`;}
function fichaRefreshList(){
 const sel=$('fichaPolicySelect'),q=canon(($('fichaSearch').value||'').trim()),prior=sel.value;
 const entries=Object.values(policyCatalog).filter(p=>canon([p.number,p.description,p.issuer].join(' ')).includes(q));
 entries.sort((a,b)=>a.number.localeCompare(b.number,'es'));
 sel.innerHTML='<option value="">Selecciona una póliza</option>'+entries.map(p=>`<option value="${esc(p.number)}">${esc(p.number)} — ${esc(p.description)} · ${esc(p.issuer||'Sin asignar')}</option>`).join('');
 if(entries.some(p=>p.number===prior))sel.value=prior;
 else if(q&&entries.length===1)sel.value=entries[0].number;
 fichaRender();
}
function fichaRender(){
  // V34: no se construyen resúmenes contractuales ni vistas internas.
  // La ficha de la V32 se conserva solo como metadato de compatibilidad con respaldos previos.
  const body=$('fichaBody');if(body)body.textContent='';
}
$('fichaSearch').addEventListener('input',fichaRefreshList);
$('fichaPolicySelect').addEventListener('change',()=>{$('fichaUploadMessage').textContent='';fichaRender();});
document.querySelector('[data-tab="ficha"]').addEventListener('click',()=>{
 fichaRefreshList();const sel=$('fichaPolicySelect');if(!sel.value&&activePolicy&&[...sel.options].some(o=>o.value===activePolicy)){sel.value=activePolicy;fichaRender();}
});

/* ===== V34: ABRIR PDF ORIGINAL EN PESTAÑA DEL NAVEGADOR, SIN ALTERAR CÁLCULOS ===== */
let pdfOpenedUrlsV34=[];
function pdfSelectedParamV34(){
 const sel=$('policyList')?.value||'';
 return sel&&policyCatalog[sel]?sel:'';
}
function pdfUpdateParamV34(){
 const number=pdfSelectedParamV34();
 $('policyOpenPdfV34').hidden=true;
 $('policyOpenPdfStatusV34').textContent=number?'Documentos asociados a '+number+':':'Selecciona una póliza para consultar sus documentos.';
 pdfRenderParamListV35(number);
}
$('policyOpenPdfV34').addEventListener('click',async()=>{
 const number=pdfSelectedParamV34();
 if(!number){alert('Selecciona una póliza guardada.');return;}
 // Abrir una ventana en el gesto de clic, antes de la lectura asíncrona (evita bloqueo de popups).
 const tab=window.open('about:blank','_blank');
 if(!tab){alert('El navegador bloqueó la nueva pestaña. Autoriza ventanas emergentes para este archivo y vuelve a intentarlo.');return;}
 try{
   tab.document.title='PDF de póliza '+number;
   tab.document.body.textContent='Abriendo documento de póliza '+number+'…';
   const blob=await pdfGetV33(number);
   if(!blob){tab.document.body.textContent='La póliza '+number+' no tiene un PDF vinculado. Ve a 7. Cargar PDF para asociarlo.';return;}
   const url=URL.createObjectURL(blob);
   pdfOpenedUrlsV34.push(url);
   tab.location.replace(url+'#toolbar=0&navpanes=0');
 }catch(e){try{tab.document.body.textContent='No se pudo abrir el PDF: '+e.message;}catch(_){} }
});
$('policyList').addEventListener('change',pdfUpdateParamV34);
$('issuerSelect').addEventListener('change',pdfUpdateParamV34);
$('policyNew').addEventListener('click',pdfUpdateParamV34);
document.querySelector('[data-tab="parametros"]').addEventListener('click',pdfUpdateParamV34);
pdfUpdateParamV34();

/* ===== V35 DOCUMENTOS: identidad PDF, anexos múltiples y respaldos portátiles ===== */
const PDF_META_KEY_V35='conciliador_pdf_anexos_v35';
let pdfMetaV35={};
try{const v=JSON.parse(localStorage.getItem(PDF_META_KEY_V35)||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))pdfMetaV35=v;}catch(_){}
function pdfPersistMetaV35(){try{localStorage.setItem(PDF_META_KEY_V35,JSON.stringify(pdfMetaV35));return true;}catch(_){return false;}}
function pdfKeyV35(policy,annex){return 'V35:'+policy+':'+annex;}
function pdfFormatIdV35(n,annex){const code=String(n||'').split('-')[0]||'24',serial=String(n||'').split('-').at(-1).replace(/\D/g,'').padStart(7,'0');return code+'_'+serial+'_'+String(annex).padStart(6,'0')+(String(annex)==='000000'?'':'_ACLARATORIO');}
function pdfExistingV35(n){return (pdfMetaV35[n]||[]).slice().sort((a,b)=>a.annex.localeCompare(b.annex));}
async function pdfGetStoredV35(n,annex){let b=await pdfGetDbRawV35(pdfKeyV35(n,annex));return b;}
async function pdfGetDbRawV35(key){if(pdfSessionV33.has(key))return pdfSessionV33.get(key);try{const db=await pdfOpenDbV33();const value=await new Promise((resolve,reject)=>{const tx=db.transaction(PDF_TABLE_V33,'readonly');const req=tx.objectStore(PDF_TABLE_V33).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});db.close();if(value)pdfSessionV33.set(key,value);return value;}catch(_){return null;}}
async function pdfSaveRawV35(key,blob){pdfSessionV33.set(key,blob);const db=await pdfOpenDbV33();try{await new Promise((resolve,reject)=>{const tx=db.transaction(PDF_TABLE_V33,'readwrite');tx.objectStore(PDF_TABLE_V33).put(blob,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
// Recuperación sin pérdida de un único PDF almacenado previamente en V33/V34.
async function pdfMigrateLegacyV35(n){if(pdfExistingV35(n).length)return;let legacy=null;try{legacy=await pdfGetV33(n);}catch(_){}if(!legacy)return;
 let annex='000000';try{const text=await docExtractPdfTextV32(legacy);const id=pdfReadIdentityV35(text);if(id&&id.policy===n)annex=id.annex;}catch(_){}
 const key=pdfKeyV35(n,annex);let stored=true;try{await pdfSaveRawV35(key,legacy);}catch(_){pdfSessionV33.set(key,legacy);stored=false;}
 pdfMetaV35[n]=[{annex,display:pdfFormatIdV35(n,annex),source:policyDocumentsV32[n]?.source||'PDF anterior',stored}];pdfPersistMetaV35();
}
function pdfReadIdentityV35(text){
 // V36: los PDF de Sweaden no siempre mantienen el orden de lectura visual.
 // La carátula puede separar POLIZA No. y ANEXO No. de sus valores;
 // en las condiciones particulares puede aparecer ENDOSO antes que POLIZA.
 const raw=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 const normalized=raw.replace(/\s+/g,' ');
 const result=(serial,annex)=>{
   if(!/^\d{4,9}$/.test(serial||'')||!/^\d{1,8}$/.test(annex||''))return null;
   const value=String(Number(serial));
   if(value==='0'||Number(annex)>999999)return null;
   return {policy:'24-'+value,annex:annex.padStart(6,'0')};
 };
 // Número de pago compuesto: ramo (2), póliza (7) y anexo (6).
 const packed=normalized.match(/NUMERO\s+DE\s+POLIZA\s+PARA\s+EL\s+PAGO\s*:?\s*(\d{15})\b/);
 if(packed){const d=packed[1];return {policy:d.slice(0,2)+'-'+String(Number(d.slice(2,9))),annex:d.slice(9,15)};}
 // Orden textual normal: PÓLIZA: 0002369 ENDOSO: 000002.
 for(const re of [
  /\bPOLIZA\s*[:.#ºNRO ]*\s*(\d{4,9})\s*(?:ENDOSO|ANEXO)\s*[:.#ºNRO ]*\s*(\d{1,8})\b/,
  /\bPOLIZA\s+NO\.?\s*(\d{4,9})\s*ANEXO\s+NO\.?\s*(\d{1,8})\b/
 ]){const m=normalized.match(re);if(m)return result(m[1],m[2]);}
 // Orden invertido de los PDF de endosos: ENDOSO : 000002 / RAMO / POLIZA : 0002369.
 // No asumir que el número de referencia o el número de pago es el anexo.
 const reverse=raw.match(/\bENDOSO\s*:\s*(\d{6})[\s\S]{0,115}?\bPOLIZA\s*:\s*(\d{6,7})\b/);
 if(reverse)return result(reverse[2],reverse[1]);
 // En algunas carátulas los valores están desplazados respecto a los encabezados.
 // Buscar ambos rótulos, y limitarse al bloque previo a VIGENCIA DEL DOCUMENTO.
 const cover=raw.slice(0,Math.min(raw.length,2200));
 const labelPolicy=cover.indexOf('POLIZA NO.');
 const labelAnnex=cover.indexOf('ANEXO NO.');
 if(labelPolicy>=0&&labelAnnex>labelPolicy){
   const p=(cover.slice(labelPolicy,labelAnnex).match(/\b0{0,3}\d{4,7}\b/g)||[]).at(-1);
   const ending=cover.indexOf('VIGENCIA DEL DOCUMENTO',labelAnnex);
   const chunk=cover.slice(labelAnnex,ending>labelAnnex?ending:labelAnnex+110);
   const candidates=chunk.match(/\b\d{6}\b/g)||[];
   // Solo anexos de seis dígitos; fechas como 01/05/2025 no coinciden.
   const ann=candidates[0];
   if(p&&ann)return result(p,ann);
 }
 return null;
}
async function pdfFindDuplicateV35(policy,annex){for(const [n,docs] of Object.entries(pdfMetaV35)){if((docs||[]).some(d=>d.annex===annex&&n===policy))return n;}
 // También comprobar el PDF heredado que aún no haya sido migrado.
 const old=await pdfGetDbRawV35(policy);if(old&&!pdfExistingV35(policy).length)return policy;
 return null;
}
function pdfRenderExistingV35(){const el=$('fichaExistingV35');if(!el)return;const n=$('fichaPolicySelect').value;const docs=pdfExistingV35(n);el.innerHTML=docs.map(d=>'<span>📄 '+esc(d.display)+'</span>').join('')||'<span>Sin documentos asociados</span>';}
let pdfRenderSeqV35=0;
async function pdfRenderParamListV35(n){const el=$('policyPdfListV35');if(!el)return;const seq=++pdfRenderSeqV35;
 if(!n){el.innerHTML='<p class="policy-pdf-empty-v35">Selecciona una póliza.</p>';return;}
 await pdfMigrateLegacyV35(n);if(seq!==pdfRenderSeqV35)return;
 const docs=pdfExistingV35(n);el.innerHTML=docs.length?docs.map(d=>'<div class="policy-pdf-item-v35"><button type="button" data-policy="'+esc(n)+'" data-annex="'+esc(d.annex)+'"><span>📄 '+esc(d.display)+'</span><span>↗</span></button><small>Visualizar documento PDF en otra pestaña</small></div>').join(''):'<p class="policy-pdf-empty-v35">Esta póliza no tiene archivos PDF vinculados. Agrégalos en 7. Cargar PDF.</p>';
}
$('policyPdfListV35').addEventListener('click',async event=>{const btn=event.target.closest('button[data-annex]');if(!btn)return;const n=btn.dataset.policy,annex=btn.dataset.annex;
 const tab=window.open('about:blank','_blank');if(!tab){alert('El navegador bloqueó la apertura de la pestaña.');return;}
 try{tab.document.title=pdfFormatIdV35(n,annex);tab.document.body.textContent='Abriendo '+pdfFormatIdV35(n,annex)+'…';const blob=await pdfGetStoredV35(n,annex);if(!blob){tab.document.body.textContent='El archivo PDF no está disponible en este equipo. Recupera el catálogo portátil más reciente.';return;}const url=URL.createObjectURL(blob);pdfOpenedUrlsV34.push(url);tab.location.replace(url+'#toolbar=0&navpanes=0');}catch(err){try{tab.document.body.textContent='Error: '+err.message;}catch(_){}}
});
async function docUploadV35(file){if(!file)return;const msg=$('fichaUploadMessage'),number=$('fichaPolicySelect').value;
 try{
 if(!number||!policyCatalog[number])throw Error('Selecciona una póliza guardada antes de subir el documento.');
 if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name))throw Error('Selecciona un archivo PDF.');
 if(file.size>12*1024*1024)throw Error('El archivo supera el límite de 12 MB.');
 msg.textContent='Leyendo la póliza y el anexo desde el PDF…';
 let id;try{id=pdfReadIdentityV35(await docExtractPdfTextV32(file));}catch(err){throw Error('No se pudo leer el número de póliza y anexo desde el contenido del PDF. '+err.message);}
 if(!id)throw Error('No se identificaron claramente POLIZA y ENDOSO/ANEXO dentro del documento. No se utilizará el nombre del archivo para asignarlo.');
 if(id.policy!==number)throw Error('El PDF corresponde a la póliza '+id.policy+' (anexo '+id.annex+'), pero seleccionaste '+number+'. Selecciona la póliza correcta.');
 await pdfMigrateLegacyV35(number);
 const found=await pdfFindDuplicateV35(number,id.annex);
 if(found)throw Error('DOCUMENTO DUPLICADO: '+pdfFormatIdV35(number,id.annex)+' ya existe en la póliza '+found+'. No se guardó una copia adicional.');
 if(pdfExistingV35(number).length>=3)throw Error('Esta póliza ya tiene 3 documentos. No se permite adjuntar otro.');
 const display=pdfFormatIdV35(number,id.annex);
 let stored=true;try{await pdfSaveRawV35(pdfKeyV35(number,id.annex),file);}catch(e){pdfSessionV33.set(pdfKeyV35(number,id.annex),file);stored=false;}
 (pdfMetaV35[number]??=[]).push({annex:id.annex,display,source:file.name,stored,addedAt:new Date().toISOString()});pdfPersistMetaV35();
 msg.textContent='Documento asociado como '+display+(stored?'.':'. Guardado solo durante esta sesión; exporta el catálogo JSON.');
 pdfRenderExistingV35();pdfUpdateParamV34();
 }catch(e){msg.textContent='ALERTA: '+e.message;msg.style.color='#a02739';}
 finally{$('fichaPdfUpload').value='';}
}
$('fichaPdfUpload').addEventListener('change',ev=>docUploadV35(ev.target.files[0]));
$('fichaPolicySelect').addEventListener('change',()=>pdfMigrateLegacyV35($('fichaPolicySelect').value).then(pdfRenderExistingV35));
document.querySelector('[data-tab="ficha"]').addEventListener('click',()=>{pdfMigrateLegacyV35($('fichaPolicySelect').value).then(pdfRenderExistingV35);});
async function pdfExportDocsV35(){const items=[];for(const n of Object.keys(policyCatalog)){await pdfMigrateLegacyV35(n);for(const m of pdfExistingV35(n)){const blob=await pdfGetStoredV35(n,m.annex);if(blob)items.push({policy:n,annex:m.annex,display:m.display,source:m.source,mime:'application/pdf',base64:await pdfToB64V33(blob)});}}return items;}
async function pdfImportDocsV35(items){let restored=0,errors=[];for(const r of items){try{if(!r||!policyValidNumber(r.policy)||!/^\d{6}$/.test(r.annex)||typeof r.base64!=='string')throw Error('formato inválido');
 const n=r.policy;if(pdfExistingV35(n).some(d=>d.annex===r.annex)){errors.push(pdfFormatIdV35(n,r.annex)+': ya existe; se conservó el original');continue;}
 if(pdfExistingV35(n).length>=3){errors.push(n+': máximo 3 documentos');continue;}
 const blob=pdfDecodeB64V33(r.base64);if(blob.size>12*1024*1024)throw Error('PDF mayor a 12 MB');await pdfSaveRawV35(pdfKeyV35(n,r.annex),blob);
 (pdfMetaV35[n]??=[]).push({annex:r.annex,display:pdfFormatIdV35(n,r.annex),source:r.source||'',stored:true});restored++;
 }catch(e){errors.push((r?.policy||'Desconocido')+': '+e.message);}}
 pdfPersistMetaV35();pdfUpdateParamV34();return {restored,errors};}
async function pdfImportLegacyV35(items){let restored=0,errors=[];for(const [n,r] of Object.entries(items)){if(!policyValidNumber(n)||!r?.base64)continue;try{await pdfMigrateLegacyV35(n);if(pdfExistingV35(n).length)continue;const blob=pdfDecodeB64V33(r.base64);let annex='000000';try{const id=pdfReadIdentityV35(await docExtractPdfTextV32(blob));if(id?.policy===n)annex=id.annex;}catch(_){}
 await pdfSaveRawV35(pdfKeyV35(n,annex),blob);pdfMetaV35[n]=[{annex,display:pdfFormatIdV35(n,annex),source:r.name||'',stored:true}];restored++;}catch(e){errors.push(n+': '+e.message);}}
 pdfPersistMetaV35();pdfUpdateParamV34();return {restored,errors};}
// Recuperar enlaces de consulta al cambiar de emisor, póliza o catálogo.
$('policyList').addEventListener('change',pdfUpdateParamV34);
$('issuerSelect').addEventListener('change',pdfUpdateParamV34);
setTimeout(()=>pdfUpdateParamV34(),0);
