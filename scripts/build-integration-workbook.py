#!/usr/bin/env python3
"""Reproduce the integration workbook and 28-row CSV, preserving the historical input."""
from pathlib import Path
import csv
import hashlib
import json
from artifact_tool import Blob, SpreadsheetFile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'docs/integration-workstreams-20261116.json').read_text())
for kind in ('workbook', 'workstreams'):
    path = root / manifest['source_' + kind]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == manifest['source_' + kind + '_sha256'], path
baseline = json.loads((root / manifest['source_workstreams']).read_text())
packages = baseline['work_packages']
assert len(packages) == 28 and len({p['lot'] for p in packages}) == 28
assert set(manifest['updates']).issubset({p['lot'] for p in packages})
for package in packages:
    package.update(manifest['updates'].get(package['lot'], {}))
    package['avance_ce_lot'] = package['lot'] in manifest['updates']
    assert package['cloture'] is False
output = root / 'outputs/integration-20261116'
output.mkdir(parents=True, exist_ok=True)
fields = ['lot', 'priorite', 'domaine', 'etat', 'prochaine_recette', 'preuves_disponibles', 'avance_ce_lot', 'cloture']
with (output / 'PARALLAXE_Chantiers_Integration_2026-11-16.csv').open('w', encoding='utf-8-sig', newline='') as handle:
    writer = csv.DictWriter(handle, fields, delimiter=';', extrasaction='ignore')
    writer.writeheader(); writer.writerows(packages)

wb = SpreadsheetFile.import_xlsx(Blob.load(str(root / manifest['source_workbook'])))
wb.render({'sheet_name': 'Synthèse', 'range': 'A1:H25', 'scale': 1}).save(str(output / 'source-preview.png'))
summary = wb.worksheets.get_item('Synthèse')
summary.get_range('A3').values = [['16 novembre 2026 · intégration Vercel / PC · 119 anomalies sur 120']]
summary.get_range('A16').values = [['BRANCHES RÉUNIES — RÉCEPTIONS TOUJOURS OUVERTES']]
for row, text in {
    18: 'Cinq lieux, menus manette, sauvegardes et mesures locales réunis avec l’hébergement Vercel.',
    19: 'W04, W21, W23 et W24 avancent : protocole coop, stockage, confidentialité et traçabilité.',
    20: 'Douze tests ajoutés ; sources des deux branches conservées ; aucun chantier clôturé artificiellement.',
    24: 'Onglet Intégration : état daté des 28 lots. Les 600 clés et les fiches A/B originales restent conservées.'
}.items():
    summary.get_range(f'A{row}').values = [[text]]
    summary.get_range(f'A{row}:H{row}').format.row_height = 38
lots = wb.worksheets.get_item('Lots prioritaires')
track = json.loads((root / 'docs/parallaxe-open-work-20261101.json').read_text())
for index, lot in enumerate(track['lots'], 6):
    if lot['id'] in manifest['updates']:
        lots.get_range(f'H{index}').values = [[manifest['updates'][lot['id']]['etat']]]

sheet = wb.worksheets.add('Intégration')
sheet.merge_cells('A1:H2')
sheet.get_range('A1').values = [['PARALLAXE / INTÉGRATION DU 16 NOVEMBRE 2026']]
sheet.get_range('A1:H2').format = {'fill':'#173A4B','font':{'name':'Arial','size':17,'bold':True,'color':'#FFFFFF'},'row_height':24}
sheet.merge_cells('A3:H3')
sheet.get_range('A3').values = [['Révision fonctionnelle : ' + manifest['source_commit'] + ' — 28 lots, aucune clôture automatique.']]
sheet.get_range('A3:H3').format = {'wrap_text':True,'row_height':32,'font':{'name':'Arial','size':10,'color':'#53616B'}}
headers = ['Lot','Priorité','Chantier','État du 16 novembre','Recette restante','Preuves','Avancé ce lot','Clôturé']
rows = [[p[k] if k not in ('avance_ce_lot','cloture') else ('Oui' if p[k] else 'Non') for k in fields] for p in packages]
sheet.get_range('A5:H33').values = [headers] + rows
sheet.tables.add('A5:H33', True, 'P9_Integration_20261116')
sheet.get_range('A5:H33').format.font = {'name':'Arial','size':10,'color':'#162733'}
sheet.get_range('A5:H5').format = {'fill':'#173A4B','font':{'name':'Arial','size':10,'bold':True,'color':'#FFFFFF'},'wrap_text':True,'row_height':32}
sheet.get_range('A6:H33').format.wrap_text = True
sheet.get_range('A6:H33').format.vertical_alignment = 'top'
for column, width in zip('ABCDEFGH', [10,10,26,36,40,40,14,12]):
    sheet.get_range(f'{column}1:{column}39').format.column_width = width
for index, p in enumerate(packages, 6):
    sheet.get_range(f'A{index}:H{index}').format.row_height = 108
    if p['avance_ce_lot']:
        sheet.get_range(f'A{index}:H{index}').format.fill = '#DDEEE8'
sheet.get_range('F35:H36').values = [['BILAN','AVANCÉS','CLÔTURÉS'],['Lots de cette livraison',None,None]]
sheet.get_range('G36:H36').formulas = [['=COUNTIF(G6:G33,"Oui")','=COUNTIF(H6:H33,"Oui")']]
sheet.merge_cells('A38:H38');sheet.get_range('A38').values = [[manifest['ci_url']]]
sheet.get_range('A38:H38').format.row_height = 25
sheet.merge_cells('A39:H39');sheet.get_range('A39').values = [[manifest['scope']]]
sheet.get_range('A39:H39').format.wrap_text = True
sheet.get_range('A39:H39').format.row_height = 32
sheet.freeze_panes.freeze_rows(5);sheet.freeze_panes.freeze_columns(2)
print(wb.inspect({'kind':'table','range':'Synthèse!A6:B13','include':'values,formulas','table_max_rows':8,'table_max_cols':2}).ndjson)
print(wb.inspect({'kind':'table','range':'Intégration!F35:H36','include':'values,formulas','table_max_rows':2,'table_max_cols':3}).ndjson)
print(wb.inspect({'kind':'match','search_term':'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A','options':{'use_regex':True,'max_results':20},'summary':'Integration formula verification'}).ndjson)
wb.render({'sheet_name':'Synthèse','range':'A1:H25','scale':1.4}).save(str(output / 'integration-preview.png'))
SpreadsheetFile.export_xlsx(wb).save(str(output / 'PARALLAXE_Suivi_Integration_2026-11-16.xlsx'))
print(str(output))
