// Run with @oai/artifact-tool available, from the repo root or with PARALLAXE_PROJECT set.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {FileBlob, SpreadsheetFile} from '@oai/artifact-tool';

const root = path.resolve(process.env.PARALLAXE_PROJECT || '.');
const source = 'docs/reprise-concordance-20261118.json';
const read = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const delivery = await read(source);
const pointer = await read('docs/current-delivery.json');
const baseFile = path.join(root, delivery.source_workbook);
if (createHash('sha256').update(await fs.readFile(baseFile)).digest('hex') !== delivery.source_workbook_sha256) {
  throw new Error('Le classeur Navigation ne correspond pas à la base de cette édition.');
}
const history = pointer.workstream_updates;
const end = history.indexOf(source);
if (end < 0) throw new Error("L’édition Concordance manque dans l’historique.");
const rows = (await read('docs/chantiers-20261112.json')).work_packages;
for (const file of history.slice(0, end + 1)) {
  const {updates} = await read(file);
  for (const row of rows) Object.assign(row, updates[row.lot]);
}
for (const row of rows) row.avance_ce_lot = Object.hasOwn(delivery.updates, row.lot);

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(baseFile));
const summary = workbook.worksheets.getItem('Synthèse');
const summaryLines = {
  A3: '18 novembre 2026 · Concordance · 119 concepts présents sur 120',
  A16: 'CONCORDANCE · PREMIER DÉNOUEMENT DE CAMPAGNE',
  A18: 'Une campagne gagnée avec zéro erreur donne accès à la salle du matin depuis le bilan.',
  A19: 'Le joueur peut suivre les plans, lire la scène à son rythme ou revenir au bilan.',
  A20: 'Les relevés rapprochés montrent que chaque témoin avait vu une partie du lieu. La compréhension de la scène reste à évaluer en équipe.',
  A24: 'L’onglet Concordance rassemble les 28 chantiers et, sous le tableau, les trois fiches de dénouement N07 à N09.'
};
for (const [cell, text] of Object.entries(summaryLines)) summary.getRange(cell).values = [[text]];

const sheet = workbook.worksheets.add('Concordance');
sheet.showGridLines = false;
sheet.tabColor = '#436A64';
const ink = '#173A4B';
const header = {fill: ink, font: {name: 'Arial', bold: true, color: '#FFFFFF', size: 11},
  verticalAlignment: 'center', wrapText: true};
function mergedText(range, text) {
  sheet.mergeCells(range);
  const cell = sheet.getRange(range);
  cell.values = [[text]];
  return cell;
}
mergedText('A1:H2','PARALLAXE  /  CONCORDANCE').format = {
  ...header, rowHeight: 23, font: {...header.font, size: 18}
};
mergedText('A3:H3','18 novembre 2026 · État des chantiers après la première salle de fin de campagne').format = {
  fill: '#EDF2F1', font: {name: 'Arial', color: ink, size: 11}, rowHeight: 29, verticalAlignment: 'center'
};
const fields = ['lot','priorite','domaine','etat','prochaine_recette','preuves_disponibles','avance_ce_lot','cloture'];
const values = rows.map(row => fields.map(key => typeof row[key] === 'boolean' ? (row[key] ? 'Oui' : 'Non') : row[key]));
sheet.getRange('A5:H33').values = [
  ['Lot','Priorité','Chantier','État actuel','Réception restante','Sources et recette','Avancé ce lot','Clôturé'], ...values
];
sheet.tables.add('A5:H33', true, 'P9_Concordance_20261118');
sheet.getRange('A5:H5').format = {...header, rowHeight: 32};
sheet.getRange('A6:H33').format = {
  font: {name: 'Arial', size: 10, color: ink}, verticalAlignment: 'center', wrapText: true, rowHeight: 82
};
for (const [index, width] of [10,10,25,43,51,43,15,12].entries()) {
  const col = 'ABCDEFGH'[index];
  sheet.getRange(col + '1:' + col + '44').format.columnWidth = width;
}
for (const [index, row] of rows.entries()) {
  if (row.avance_ce_lot) sheet.getRange('A' + (index + 6) + ':H' + (index + 6)).format.fill = '#DFEEE8';
}
sheet.getRange('F35:H35').values = [['Bilan du 18 novembre','Avancés','Clôturés']];
sheet.getRange('F35:H35').format = {...header, rowHeight: 24};
sheet.getRange('F36').values = [['Chantiers']];
sheet.getRange('G36:H36').formulas = [['=COUNTIF(G6:G33,"Oui")','=COUNTIF(H6:H33,"Oui")']];
mergedText('A38:H38','DÉNOUEMENTS  /  CRITÈRES À RÉCEPTIONNER').format = {...header, rowHeight: 28};
for (const [index, [id, name, status, scenario]] of delivery.narration.entries()) {
  const r = index + 39;
  sheet.getRange('A' + r + ':B' + r).values = [[id,status]];
  sheet.getRange('C' + r).values = [[name]];
  mergedText('D' + r + ':H' + r,scenario);
  sheet.getRange('A' + r + ':H' + r).format = {
    fill: index === 0 ? '#DFEEE8' : '#F3F6F7', font: {name:'Arial',size:10,color:ink},
    rowHeight: 34, wrapText: true, verticalAlignment: 'center'
  };
}
mergedText('A43:H43','Sources de conception et de recette    ·    docs/parallaxe-open-work-20261101.json    ·    ' + delivery.qa).format = {
  font: {name:'Arial',size:10,color:'#46616B'}, rowHeight: 26, verticalAlignment: 'center'
};
sheet.freezePanes.freezeRows(5);
sheet.freezePanes.freezeColumns(2);

workbook.recalculate();
const preview = process.env.PARALLAXE_PREVIEW_DIR;
if (preview) {
  await fs.mkdir(preview, {recursive:true});
  for (const [name, range, filename] of [
    ['Synthèse','A16:H24','synthese'], ['Concordance','A1:H8','entete'],
    ['Concordance','A24:H25','salle'], ['Concordance','A30:H43','denouements']
  ]) {
    const png = await workbook.render({sheetName: name, range, scale: 0.85, format: 'png'});
    await fs.writeFile(path.join(preview, filename + '.png'), new Uint8Array(await png.arrayBuffer()));
  }
}
const outputDir = path.join(root, 'outputs', 'concordance-workbook-20261118');
await fs.mkdir(outputDir, {recursive: true});
const target = path.join(outputDir, path.basename(delivery.output_workbook));
await (await SpreadsheetFile.exportXlsx(workbook)).save(target);
await fs.copyFile(target, path.join(root, delivery.output_workbook));
function csvCell(value) {
  const text = typeof value === 'boolean' ? (value ? 'True' : 'False') : String(value);
  return /[;"\r\n]/.test(text) ? '"' + text.replaceAll('"','""') + '"' : text;
}
const csv = [fields, ...rows.map(row => fields.map(key => row[key]))].map(row => row.map(csvCell).join(';'));
await fs.writeFile(path.join(root, delivery.workstream_csv), '\uFEFF' + csv.join('\n') + '\n');
