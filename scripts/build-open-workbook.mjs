/**
 * Recréation du registre Excel des travaux ouverts.
 * Requiert l'environnement d'édition @oai/artifact-tool déjà utilisé pour
 * scripts/build-design-workbook.mjs ; cette dépendance n'est pas dans le jeu.
 * Commande: PARALLAXE_PROJECT=$PWD node scripts/build-open-workbook.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const root = process.env.PARALLAXE_PROJECT || process.cwd();
const source = JSON.parse(await fs.readFile(path.join(root, "docs/parallaxe-open-work-20261101.json"), "utf8"));
if (source.schema !== "parallaxe-open-work-v1") throw new Error("Schéma de suivi inconnu");
if (source.items.length !== source.compteurs.items_total) throw new Error("Compteur de registre incohérent");
const seen = new Set();
for (const item of source.items) {
  if (!item.cle || seen.has(item.cle)) throw new Error("Clé dupliquée ou absente : " + item.cle);
  seen.add(item.cle);
}
const wb = Workbook.create();
const colors = {navy:"#173A4B", light:"#F3F6F7", amber:"#FFF2D8", dark:"#162733"};
const formatHeader = {fill:colors.navy,font:{name:"Arial",size:10,bold:true,color:"#FFFFFF"},rowHeight:38,wrapText:true};
const spec = [
 ["Lots prioritaires",["ID","Priorité","Domaine","Action / livrable","Critère d'acceptation","Preuve attendue","Liens de suivi","Statut"],
 source.lots.map(x=>[x.id,x.priorite,x.domaine,x.action,x.criteres,x.preuve,x.liens,x.etat]),[12,12,27,68,72,60,31,27]],
 ["Registre ouvert",["Clé","Domaine","ID","Objet","Priorité","Statut d'origine","Nature","Action à réaliser","Critère de clôture","Preuve exigée","Commande / recette","Limites / détails","Fichier source"],
 source.items.map(x=>[x.cle,x.domaine,x.id,x.nom,x.priorite,x.statut_source,x.nature,x.action,x.critere,x.preuve_exigee,x.verification,x.details,x.source]),[32,24,16,35,12,35,27,68,72,48,55,66,65]],
 ["Anomalies",["ID","Nom","Statut source","Priorité","Action","Critère / baseline et A/B","Recette","Référence"],
 source.items.filter(x=>x.domaine==="Anomalies").map(x=>[x.id,x.nom,x.statut_source,x.priorite,x.action,x.critere,x.verification,x.source]),[31,33,34,12,80,102,61,64]],
 ["Recette QA",["ID","Nom / domaine","Priorité","Statut","Étapes","Critère attendu","Limite / preuve","Source"],
 source.items.filter(x=>x.domaine==="QA").map(x=>[x.id,x.nom,x.priorite,x.statut_source,x.action,x.critere,x.details,x.source]),[16,36,12,27,85,75,78,63]],
 ["Sources",["Fichier","URL et traçabilité","Note"],source.sources.map(x=>[x.path,x.url,"Source conservée ; snapshot au 01/11/2026"]),[67,108,42]]
];
const dashboard=wb.worksheets.add("Synthèse");
dashboard.getRange("A1:B1").values=[["PARALLAXE · registre des Excel ouverts",source.date]];
dashboard.getRange("A1:B1").format={fill:colors.navy,font:{name:"Arial",size:16,bold:true,color:"#FFFFFF"},rowHeight:33};
const summary=[
 ["Édition de code observée",source.build],
 ["Révision GitHub de départ",source.base_commit],
 ["Tâches ouvertes recensées",source.compteurs.items_total],
 ["Lots de travail détaillés",source.compteurs.lots_priorises],
 ["Lignes de conception à suivre",source.compteurs.conception_ouverts],
 ["Anomalies conçues",source.compteurs.anomalies_concues],
 ["Anomalies dans le code",source.compteurs.anomalies_runtime],
 ["Anomalies seulement conçues",source.compteurs.anomalies_non_implantees],
 ["Suivi sessions restant",source.compteurs.session_ouverts],
 ["Suivi radio historique restant",source.compteurs.radio_ouverts],
 ["Attention","Implémenté — QA partielle n'est pas Validé"],
 ["Épreuve","Tests matériels/GPU/réseaux ne sont pas réputés exécutés"]
];
dashboard.getRange("A3:B14").values=summary;
dashboard.getRange("A3:A14").format={fill:colors.light,font:{bold:true,color:colors.dark},rowHeight:26};
dashboard.getRange("A1:A14").format.columnWidth=45;dashboard.getRange("B1:B14").format.columnWidth=90;
dashboard.freezePanes.freezeRows(1);
for(const [name,headers,rows,widths] of spec){
 const ws=wb.worksheets.add(name);
 const last=String.fromCharCode(64+headers.length);
 ws.getRange(`A1:${last}${rows.length+1}`).values=[headers,...rows];
 ws.getRange(`A1:${last}1`).format=formatHeader;
 ws.getRange(`A2:${last}${rows.length+1}`).format={wrapText:true,verticalAlignment:"top"};
 widths.forEach((n,i)=>ws.getRange(`${String.fromCharCode(65+i)}1:${String.fromCharCode(65+i)}${rows.length+1}`).format.columnWidth=n);
 ws.getRange(`A2:${last}${rows.length+1}`).format.rowHeight=46;
 ws.freezePanes.freezeRows(1);
 if(headers.length>7)ws.freezePanes.freezeColumns(3);
 ws.tables.add(`A1:${last}${rows.length+1}`,true, "P9_"+name.replace(/[^A-Za-z]/g,""));
 ws.getRange(`A2:${last}2`).format.fill=colors.light;
}
const output=process.env.PARALLAXE_OPEN_XLSX||path.join(root,"docs/PARALLAXE_Registre_Ouverts_2026-11-01.xlsx");
await (await SpreadsheetFile.exportXlsx(wb)).save(output);
console.log(JSON.stringify({output,rows:source.items.length,anomalies:source.compteurs.anomalies_concues,qa:source.items.filter(x=>x.domaine==="QA").length}));
