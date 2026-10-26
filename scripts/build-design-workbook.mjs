/**
 * PARALLAXE versioned workbook. All workbook authoring uses @oai/artifact-tool.
 * Run from a conversation-specific /tmp directory linked to the primary runtime.
 * Inputs are auditable JSON in docs; no app/runtime source is modified here.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';

const project=process.env.PARALLAXE_PROJECT||process.cwd();
const json=async name=>JSON.parse(await fs.readFile(path.join(project,'docs',name),'utf8'));
const [design,runtime,status,content]=await Promise.all([
 json('anomalies-design.json'),json('runtime-catalog.json'),json('build-status.json'),json('workbook-v02.json')
]);
const version=status.build;
if(!/^\d+\.\d+\.\d+$/.test(version)||design.version!==version||content.version!==version)throw new Error('Design, workbook content and build status must share a valid semantic version.');
if(!/^\d{4}-\d{2}-\d{2}$/.test(status.date))throw new Error('Build status needs an ISO calendar date.');
const outputDir=path.join(project,`outputs/design-v${version.replaceAll('.','')}-${status.date.replaceAll('-','')}`);
const previewDir=process.env.PARALLAXE_PREVIEW_DIR||`/tmp/parallaxe-workbook-v${version.replaceAll('.','')}-previews`;
const displayDate=new Date(`${status.date}T12:00:00Z`).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
if(design.anomalies.length!==120)throw new Error('Expected 120 anomaly designs.');
const byId=Object.fromEntries(runtime.map(a=>[a.id,a]));
if(new Set(design.anomalies.map(a=>a[0])).size!==120)throw new Error('Duplicate design ID.');
if(new Set(runtime.map(a=>a.id)).size!==runtime.length)throw new Error('Duplicate runtime ID.');
const missing=runtime.filter(a=>!design.anomalies.some(d=>d[0]===a.id));
if(missing.length)throw new Error(`Runtime IDs absent from design: ${missing.map(a=>a.id).join(', ')}`);
await fs.mkdir(outputDir,{recursive:true});await fs.mkdir(previewDir,{recursive:true});

const tokens={...status,runtimeCount:runtime.length,plannedCount:120-runtime.length};
const resolve=value=>typeof value==='string'?value.replace(/\{\{([^}]+)\}\}/g,(_,key)=>{
 if(tokens[key]===undefined)throw new Error(`Unresolved token ${key}`);return String(tokens[key]);
}):value;
const colors={ink:'#162733',muted:'#53616B',navy:'#173A4B',gold:'#C19B56',paper:'#FFFFFF',pale:'#F3F6F7',amber:'#FFF2D8',line:'#C9D3D8'};
const names=['Synthèse','Boucle','Anomalies','Coopération','Radio','Personnages','Niveaux','Lieux','Direction artistique','Audio','Commandes','Narration','Production','QA','Références'];
const workbook=Workbook.create();const sheets={};const tableRows={};const tableEnds={};
for(const name of names){const s=workbook.worksheets.add(name);s.showGridLines=false;sheets[name]=s;}
const column=i=>{let n=i+1,s='';while(n){s=String.fromCharCode(65+(n-1)%26)+s;n=Math.floor((n-1)/26);}return s;};
function frame(sheet,title,subtitle,lastCol,lastRow){
 const all=sheet.getRange(`A1:${lastCol}${lastRow}`);all.format={font:{name:'Arial',size:10,color:colors.ink},fill:colors.paper,verticalAlignment:'center'};
 sheet.getRange('A2').values=[[title]];sheet.getRange('A2').format={font:{name:'Arial',size:16,bold:true,color:colors.navy},rowHeight:27};
 sheet.getRange(`A3:${lastCol}3`).format.borders={bottom:{style:'thin',color:colors.gold}};sheet.getRange('A3').format.rowHeight=8;
 sheet.getRange('A4').values=[[subtitle]];sheet.getRange('A4').format={font:{name:'Arial',size:10,italic:true,color:colors.muted},rowHeight:23};
}
function wrappedLines(value,width){const cap=Math.max(8,Math.floor(width));let n=1,used=0;for(const word of String(value??'').split(/\s+/)){if(used&&used+word.length+1>cap){n++;used=0;}if(word.length>cap){n+=Math.floor(word.length/cap);used=word.length%cap;}else used+=word.length+(used?1:0);}return n;}
const statusValues=['Présent','Prévu','Implémenté — QA partielle','Validé','À vérifier','Conçu — non implémenté','Bloqué','Réussi','Partiel','À exécuter','À tester sur GPU','À tester sur appareils','Conception définie','Contrôle structurel partiel'];
function tableSheet(name,spec){
 const s=sheets[name],rows=spec.rows.map(row=>row.map(resolve)),end=rows.length+5,last=column(spec.headers.length-1);
 if(rows.some(r=>r.length!==spec.headers.length))throw new Error(`Column count ${name}`);
 if(new Set(rows.map(r=>r[0])).size!==rows.length)throw new Error(`Row ID duplicate ${name}`);
 tableRows[name]=rows;tableEnds[name]=end;
 frame(s,spec.title,spec.subtitle,last,end);
 s.getRange(`A5:${last}${end}`).values=[spec.headers,...rows];
 const key=`P9_${name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z]/g,'')}`;
 s.tables.add(`A5:${last}${end}`,true,key).showFilterButton=true;
 s.getRange(`A5:${last}5`).format={fill:colors.navy,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},verticalAlignment:'center',horizontalAlignment:'center',wrapText:true,rowHeight:40};
 s.getRange(`A6:${last}${end}`).format.wrapText=true;s.getRange(`A6:${last}${end}`).format.verticalAlignment='center';
 rows.forEach((row,i)=>{const lines=Math.max(...row.map((v,j)=>wrappedLines(v,spec.widths[j])));const r=s.getRange(`A${i+6}:${last}${i+6}`);r.format.rowHeight=Math.max(40,lines*13+12);if(i%2===0)r.format.fill=colors.pale;});
 spec.widths.forEach((w,i)=>s.getRange(`${column(i)}1:${column(i)}${end}`).format.columnWidth=w);
 s.freezePanes.freezeRows(5);s.freezePanes.freezeColumns(spec.freezeCols??1);
 if(spec.statusCol!==null&&spec.statusCol!==undefined){const c=column(spec.statusCol),range=s.getRange(`${c}6:${c}${end}`);range.dataValidation={rule:{type:'list',values:statusValues}};range.format.fill=colors.amber;
  range.conditionalFormats.add('containsText',{text:'Bloqué',format:{fill:'#FCE6E1',font:{color:'#9B3028',bold:true}}});
  range.conditionalFormats.add('containsText',{text:'Validé',format:{fill:'#E9F1EC',font:{color:'#244D36'}}});
  range.conditionalFormats.add('containsText',{text:'Réussi',format:{fill:'#E9F1EC',font:{color:'#244D36'}}});
 }
 return s;
}

const levelLabel={hotel:'Saint-Clair',metro:'Terminus 09',clinic:'Aile blanche'};
const proofFor=(id,family)=>id.startsWith('radio_')&&id!=='radio_signal'?'Audio + relevé écrit':(['relay_mismatch','paired_arrow','paired_clock'].includes(id)||family==='Relation')?'Comparaison entre témoins':id.includes('reflection')||id.startsWith('avatar_')?'Corps / reflet / mouvement':'Visuel / objet / espace';
const anomalyData=design.anomalies.map((a,i)=>{
 const [effect,name,family,place,intensity,baseline,A,B,compare,trigger,confirm,assets,fairness]=a;const live=byId[effect];
 const qa=live?(status.runtimeQAById?.[effect]||status.runtimeQA):`Spécification originale ; effet absent du catalogue runtime v${version}.`;
 return [`PX-${String(i+1).padStart(3,'0')}`,live?.title||name,family,live?'Présent':'Prévu',live?status.runtimeStatus:'Conçu — non implémenté',live?.intensity??intensity,effect==='blood_handprint'?'Porte':place,live?.baseline||baseline,['relay_mismatch','paired_arrow','paired_clock'].includes(effect)?A:live?.description||A,B,live?.cooperation||compare,trigger,confirm,fairness,assets,effect,live?.difficulty??(family==='Relation'?3:2),qa,...['hotel','metro','clinic'].map(id=>live?.levels?.includes(id)?'Oui':'—'),proofFor(effect,family)];
});
const anomalies=tableSheet('Anomalies',{title:'120 anomalies — catalogue et suivi',subtitle:'A = perception affectée ; B = autre témoin. Mise en scène / assets = conception. Les trois colonnes de lieu indiquent la disponibilité en code.',headers:['ID','Anomalie','Famille','Code actuel','Statut','Peur (1–5)','Lieu / repère','Référence normale','Perception A','Perception B','Comparaison à communiquer','Déclenchement / mise en scène','Preuve et décision','Équité et accessibilité','Assets et animation prévus','Identifiant moteur','Difficulté (1–3)','Validation et limites','Saint-Clair (code)','Terminus 09 (code)','Aile blanche (code)','Canal de preuve'],rows:anomalyData,widths:[14,31,18,16,31,12,28,48,48,44,49,43,47,49,43,29,15,53,20,20,20,30],statusCol:4,freezeCols:2});
const aEnd=tableEnds.Anomalies;
for(const c of ['F','Q']){anomalies.getRange(`${c}6:${c}${aEnd}`).format.numberFormat='0';anomalies.getRange(`${c}6:${c}${aEnd}`).format.horizontalAlignment='center';}
anomalies.getRange(`F6:F${aEnd}`).dataValidation={rule:{type:'whole',operator:'between',formula1:1,formula2:5}};
anomalies.getRange(`Q6:Q${aEnd}`).dataValidation={rule:{type:'whole',operator:'between',formula1:1,formula2:3}};
anomalies.getRange(`S6:U${aEnd}`).format.horizontalAlignment='center';

for(const name of names){
 if(name==='Synthèse'||name==='Anomalies')continue;
 const spec=structuredClone(content.sheets[name]);
 if(!spec)throw new Error(`No content for ${name}`);
 if(name==='QA')for(const row of spec.rows){const check=status.qaResults?.[row[0]];if(check){row[5]=check.status;row[7]=check.note;}}
 tableSheet(name,spec);
}
const refs=sheets['Références'];
refs.getRange(`F6:F${tableEnds['Références']}`).format.horizontalAlignment='center';
sheets.Niveaux.getRange('A6:A8').format.horizontalAlignment='center';
for(const [i,r] of tableRows['Références'].entries()){
 const at=i+6;refs.getRange(`F${at}`).values=[[new Date(`${r[5]}T12:00:00Z`)]];refs.getRange(`F${at}`).format.numberFormat='dd/mm/yyyy';
 if(/^https:\/\//.test(r[4]))refs.getRange(`E${at}`).format.font={name:'Arial',size:10,color:'#225F8E'};
}
const pools={};
for(const [i,id] of ['hotel','metro','clinic'].entries()){
 const levelColumn=['S','T','U'][i];
 sheets.Niveaux.getRange(`G${i+6}`).formulas=[[`=COUNTIFS('Anomalies'!$D$6:$D$${aEnd},"Présent",'Anomalies'!$${levelColumn}$6:$${levelColumn}$${aEnd},"Oui")`]];
 sheets.Niveaux.getRange(`G${i+6}`).format={numberFormat:'0',horizontalAlignment:'center',font:{name:'Arial',size:14,bold:true,color:colors.navy}};
 pools[id]=runtime.filter(a=>a.levels?.includes(id)).length;
}

const summary=sheets.Synthèse;frame(summary,'PARALLAXE — Protocole 9',`Conception et suivi · édition ${version} · ${displayDate}`,'H',38);
summary.tabColor=colors.navy;anomalies.tabColor=colors.gold;sheets.Radio.tabColor='#6A8D91';sheets.Personnages.tabColor='#78928B';sheets.Niveaux.tabColor='#75919C';sheets.Production.tabColor='#75919C';sheets.QA.tabColor='#A27165';refs.tabColor='#AAB1B6';
[36,21,4,39,24,4,24,23].forEach((w,i)=>summary.getRange(`${column(i)}1:${column(i)}38`).format.columnWidth=w);
summary.getRange('A6:B6').values=[['Catalogue','Nombre']];summary.getRange('D6:E6').values=[['Production','Nombre']];
for(const address of ['A6:B6','D6:E6'])summary.getRange(address).format={fill:colors.navy,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:28};
summary.getRange('A7:A13').values=[['Anomalies conçues'],['Présentes dans le code'],['Prévues, non implémentées'],['À vérifier dans le catalogue'],['Implémentées, QA partielle'],['Validées selon le suivi'],['Part du catalogue en code']];
summary.getRange('B7:B13').formulas=[
 [`=COUNTA('Anomalies'!$A$6:$A$${aEnd})`],
 [`=COUNTIFS('Anomalies'!$D$6:$D$${aEnd},"Présent")`],
 [`=COUNTIFS('Anomalies'!$E$6:$E$${aEnd},"Conçu — non implémenté")`],
 [`=COUNTIFS('Anomalies'!$E$6:$E$${aEnd},"À vérifier")`],
 [`=COUNTIFS('Anomalies'!$E$6:$E$${aEnd},"Implémenté — QA partielle")`],
 [`=COUNTIFS('Anomalies'!$E$6:$E$${aEnd},"Validé")`],['=B8/B7']
];
summary.getRange('B7:B12').format.numberFormat='#,##0';summary.getRange('B13').format.numberFormat='0.0%';
const pEnd=tableEnds.Production,qEnd=tableEnds.QA;
summary.getRange('D7:D13').values=[['Lots de production'],['Lots en code ou présents'],['Lots à vérifier / éprouver'],['Lots futurs'],['Priorités P0'],['Priorités P1'],['Parcours QA documentés']];
summary.getRange('E7:E13').formulas=[
 [`=COUNTA('Production'!$A$6:$A$${pEnd})`],
 [`=COUNTIFS('Production'!$E$6:$E$${pEnd},"Présent")+COUNTIFS('Production'!$E$6:$E$${pEnd},"Implémenté — QA partielle")`],
 [`=COUNTIFS('Production'!$E$6:$E$${pEnd},"À vérifier")+COUNTIFS('Production'!$E$6:$E$${pEnd},"À exécuter")+COUNTIFS('Production'!$E$6:$E$${pEnd},"À tester sur GPU")+COUNTIFS('Production'!$E$6:$E$${pEnd},"À tester sur appareils")`],
 [`=COUNTIFS('Production'!$E$6:$E$${pEnd},"Conçu — non implémenté")`],
 [`=COUNTIFS('Production'!$B$6:$B$${pEnd},"P0")`],
 [`=COUNTIFS('Production'!$B$6:$B$${pEnd},"P1")`],
 [`=COUNTA('QA'!$A$6:$A$${qEnd})`]
];
for(const address of ['A7:B13','D7:E13'])summary.getRange(address).format.rowHeight=27;
for(const address of ['B7:B13','E7:E13'])summary.getRange(address).format.font={name:'Arial',size:12,bold:true,color:colors.navy};
summary.getRange('A16:B16').values=[['Campagne','Règle actuelle']];summary.getRange('D16:E16').values=[['Modes / communication','État actuel']];
for(const address of ['A16:B16','D16:E16'])summary.getRange(address).format={fill:colors.navy,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:28};
summary.getRange('A17:B23').values=[['Coopération','2 à 4 joueurs'],['Lieux construits',3],['Validations par lieu',3],['Validations pour sortir',9],['Erreurs max. standard',3],['Tours anormaux',0.68],['Tours conformes',0.32]];
summary.getRange('B22:B23').format.numberFormat='0%';summary.getRange('A17:B23').format.rowHeight=27;
summary.getRange('D17:E23').values=[['Solo','Comparaison A/B'],['Lieu au choix','9 consécutifs'],['Détendu','Erreurs illimitées'],['Voix intégrée','WebRTC / PTT'],['Preuves radio','Test + relevé écrit'],['Reflets','Planaires, corps'],['GPU / micro matériel','À éprouver']];summary.getRange('D17:E23').format.rowHeight=27;
summary.getRange('A25').values=[['Périmètre et limites de la livraison']];summary.getRange('A25').format.font={name:'Arial',size:12,bold:true,color:colors.navy};
const notes=[
 `Trois lieux : Saint-Clair, Terminus 09, Aile blanche. ${runtime.length} anomalies en code ; ${120-runtime.length} fiches supplémentaires conçues.`,
 'Campagne : trois validations par lieu avec paliers conservés, et une nouvelle référence à chaque lieu. Lieu unique : neuf validations consécutives.',
 status.patchSummary||'Vraie voix avec permission explicite, PTT, six effets de réception et calibration sans micro. Corps articulés et reflets planaires.',
 status.note,
 'Microphone : HTTPS ou localhost. Un service TURN configuré peut être nécessaire entre réseaux. Aucun essai matériel ou GPU n’est présumé réussi.',
 'La production d’assets sculptés haute définition, le mix final, les cinématiques et la certification commerciale restent des lots distincts.',
 'Lecture : filtrez Code actuel et Statut dans Anomalies. Les colonnes Lieux et Canal de preuve aident à préparer une session ou un lot de développement.',
 'Mise à jour : les compteurs sont des formules liées aux tables. Les JSON et le générateur documentés permettent de reconstruire ce fichier.'
];
for(const [i,note] of notes.entries()){const row=26+i;summary.mergeCells(`A${row}:H${row}`);summary.getRange(`A${row}`).values=[[note]];summary.getRange(`A${row}:H${row}`).format={wrapText:true,rowHeight:i===3?39:31,font:{name:'Arial',size:10,color:colors.muted},verticalAlignment:'center'};}
summary.getRange('A35').values=[['Les 120 fiches sont originales. Les inspirations de genre et les sources techniques sont documentées dans Références.']];summary.getRange('A35').format.font={name:'Arial',size:9,italic:true,color:colors.muted};

// Editable follow-up checks. Each temporary change is restored before export.
const initialImplemented=summary.getRange('B11').values[0][0],initialValidated=summary.getRange('B12').values[0][0];
const originalStatus=anomalies.getRange('E6').values[0][0];anomalies.getRange('E6').values=[['Validé']];
const changedValidated=summary.getRange('B12').values[0][0],changedImplemented=summary.getRange('B11').values[0][0];
anomalies.getRange('E6').values=[[originalStatus]];
const hotelBefore=sheets.Niveaux.getRange('G6').values[0][0],originalPresence=anomalies.getRange('D6').values[0][0];
anomalies.getRange('D6').values=[['Prévu']];const hotelChanged=sheets.Niveaux.getRange('G6').values[0][0];anomalies.getRange('D6').values=[[originalPresence]];
workbook.recalculate();
if(Number(changedValidated)!==Number(initialValidated)+1||Number(changedImplemented)!==Number(initialImplemented)-1)throw new Error('Status edit did not update formula counters.');
if(Number(hotelChanged)!==Number(hotelBefore)-1)throw new Error(`Level pool did not update from presence edit: ${JSON.stringify({hotelBefore,hotelChanged})}`);
const expected={total:120,code:runtime.length,planned:120-runtime.length};
const actual={total:summary.getRange('B7').values[0][0],code:summary.getRange('B8').values[0][0],planned:summary.getRange('B9').values[0][0]};
if(JSON.stringify(expected)!==JSON.stringify(actual))throw new Error(`Counter mismatch ${JSON.stringify(actual)}`);
for(const [i,id] of ['hotel','metro','clinic'].entries())if(sheets.Niveaux.getRange(`G${i+6}`).values[0][0]!==pools[id])throw new Error(`Pool mismatch ${id}`);
const errors=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},summary:'Final formula scan',maxChars:4500});
const sourceHash=createHash('sha256').update(JSON.stringify({design,runtime,status,content})).digest('hex');
const report={version:status.build,date:status.date,counts:actual,pools,poolsAreOverlapping:true,sheets:names,rows:Object.fromEntries(Object.entries(tableRows).map(([n,r])=>[n,r.length])),runtimeStatus:status.runtimeStatus,sourceHash,liveInputCheck:{originalStatus,changedValidated,changedImplemented,initialImplemented,initialValidated,restored:true,hotelBefore,hotelChanged},formulaScan:errors.ndjson};
await fs.writeFile(path.join(outputDir,'workbook-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));

const fullPreviews=[
 ['Synthèse','A1:H35'],['Boucle','A1:G9'],['Anomalies','A1:G9'],['Anomalies','H5:K9'],['Anomalies','L5:V9'],
 ['Coopération','A1:G9'],['Radio','A1:H9'],['Radio','A16:H22'],['Personnages','A1:H9'],['Personnages','A11:H16'],
 ['Niveaux','A1:F8'],['Niveaux','G5:J8'],['Lieux','A1:H9'],['Direction artistique','A1:G9'],['Direction artistique','A31:G36'],
 ['Audio','A1:G9'],['Commandes','A1:G9'],['Commandes','A20:G25'],['Narration','A1:G9'],['Production','A1:H9'],
 ['QA','A1:H9'],['QA','A52:H57'],['Références','A1:G9'],['Références','A22:G26'],['Anomalies','A86:G91'],['Anomalies','H86:N90'],['Anomalies','O86:V90'],
 ['Personnages','A24:H26'],['Production','A57:H59'],['QA','A79:H81']
];
const patchPreviews=[
 ['Synthèse','A1:H35'],['Radio','A1:H9'],['Radio',`A${tableEnds.Radio-2}:H${tableEnds.Radio}`],
 ['Production',`A${pEnd-1}:H${pEnd}`],['QA','A52:H55'],['QA',`A${qEnd-4}:H${qEnd}`],
 ['Références','A8:G10'],['Références',`A${tableEnds['Références']-2}:G${tableEnds['Références']}`],
 ['Anomalies','P100:V105']
];
const previews=process.env.PARALLAXE_RENDER_SCOPE==='patch'?patchPreviews:fullPreviews;
const chosen=new Set((process.env.PARALLAXE_RENDER_TABS||names.join(',')).split(','));const rendered=[];
for(const [i,[sheetName,range]] of previews.entries()){
 if(!chosen.has(sheetName))continue;
 const file=`${String(i+1).padStart(2,'0')}-${sheetName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z]/g,'')}.png`;
 const blob=await workbook.render({sheetName,range,scale:1,format:'png'});
 await fs.writeFile(path.join(previewDir,file),new Uint8Array(await blob.arrayBuffer()));rendered.push({sheetName,range,file});
}
await fs.writeFile(path.join(outputDir,'workbook-preview-manifest.json'),JSON.stringify(rendered,null,2)+'\n');
const output=path.join(outputDir,`PARALLAXE_Protocole_9_Conception_Suivi_v${version}.xlsx`);const xlsx=await SpreadsheetFile.exportXlsx(workbook);await xlsx.save(output);
console.log(JSON.stringify({output,previews:previewDir,rendered:rendered.length}));
