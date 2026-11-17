#!/usr/bin/env python3
"""Append a dated reception sheet; preserve the original tracker and design rows."""
from pathlib import Path
import csv, json, hashlib
from artifact_tool import Blob, SpreadsheetFile

def rows_for(root, tracker):
    rows=json.loads((root/'docs/chantiers-20261112.json').read_text())['work_packages']
    for filename in ['integration-workstreams-20261116.json','reprise-scenes-20261116.json']:
        updates=json.loads((root/'docs'/filename).read_text())['updates']
        for row in rows: row.update(updates.get(row['lot'],{}))
    for row in rows:
        row.update(tracker['updates'].get(row['lot'],{}))
        row['avance_ce_lot']=row['lot'] in tracker['updates']
        assert row['cloture'] is False
    assert len(rows)==28
    return rows

def populate(wb,root,tracker):
    rows=rows_for(root,tracker)
    summary=wb.worksheets.get_item('Synthèse')
    summary.get_range('A3').values=[['16 novembre 2026 · interruptions graphiques et gestes tactiles · 119 / 120']]
    summary.get_range('A16').values=[['REPRISE : RENDU INTERROMPU, COMMANDES ET MICROPHONE']]
    for row,text in {
        18:'Perte WebGL : rendu et entrées suspendus, voix coupée ; restauration suivie d’une reprise volontaire.',
        19:'Éclairage reconstruit après restauration ; géométries, indices, collisions et progression préservés.',
        20:'W03, W11, W13, W14 et W23 avancent. Tests CPU et navigateur séparés des réceptions matérielles.',
        24:'L’onglet Interruptions contient les 28 états actualisés. Aucun essai humain ni chantier clôturé par défaut.'
    }.items():
        summary.get_range(f'A{row}').values=[[text]]
        summary.get_range(f'A{row}:H{row}').format.row_height=38
    sheet=wb.worksheets.add('Interruptions')
    sheet.merge_cells('A1:H2')
    sheet.get_range('A1').values=[['PARALLAXE / REPRISE APRÈS INTERRUPTION — 16 NOVEMBRE 2026']]
    sheet.get_range('A1:H2').format={'fill':'#173A4B','font':{'name':'Arial','size':17,'bold':True,'color':'#FFFFFF'},'row_height':24}
    sheet.merge_cells('A3:H3')
    sheet.get_range('A3').values=[['Base : '+tracker['base_commit']+' · 28 lots conservés ; réception humaine non déduite des tests.']]
    sheet.get_range('A3:H3').format={'wrap_text':True,'row_height':32,'font':{'name':'Arial','size':10,'color':'#53616B'}}
    fields=['lot','priorite','domaine','etat','prochaine_recette','preuves_disponibles','avance_ce_lot','cloture']
    values=[[('Oui' if row[k] else 'Non') if k in ('avance_ce_lot','cloture') else row[k] for k in fields] for row in rows]
    sheet.get_range('A5:H33').values=[['Lot','Priorité','Chantier','État actualisé','Réception restante','Preuves disponibles','Avancé ce lot','Clôturé']]+values
    sheet.tables.add('A5:H33',True,'P9_Interruptions_20261116')
    sheet.get_range('A5:H33').format.font={'name':'Arial','size':10,'color':'#162733'}
    sheet.get_range('A5:H5').format={'fill':'#173A4B','font':{'name':'Arial','size':10,'bold':True,'color':'#FFFFFF'},'wrap_text':True,'row_height':32}
    sheet.get_range('A6:H33').format.wrap_text=True
    sheet.get_range('A6:H33').format.vertical_alignment='top'
    for col,width in zip('ABCDEFGH',[10,10,26,36,43,40,14,12]):
        sheet.get_range(f'{col}1:{col}40').format.column_width=width
    for i,row in enumerate(rows,6):
        sheet.get_range(f'A{i}:H{i}').format.row_height=110
        if row['avance_ce_lot']:sheet.get_range(f'A{i}:H{i}').format.fill='#DDEEE8'
    sheet.get_range('F35:H36').values=[['BILAN','AVANCÉS','CLÔTURÉS'],['Cette reprise',None,None]]
    sheet.get_range('G36:H36').formulas=[['=COUNTIF(G6:G33,"Oui")','=COUNTIF(H6:H33,"Oui")']]
    sheet.merge_cells('A38:H38');sheet.get_range('A38').values=[['CPU : géométrie réelle / GPU simulé. Navigateur : Chromium logiciel en CI, résultat à vérifier au SHA exact.']]
    sheet.get_range('A38:H38').format.wrap_text=True
    sheet.get_range('A38:H38').format.row_height=32
    sheet.merge_cells('A40:H40');sheet.get_range('A40').values=[['Sources : docs/reprise-interruptions-20261116.json ; docs/QA_INTERRUPTION_20261116.md ; tests/browser-runtime.mjs']]
    sheet.get_range('A40:H40').format.wrap_text=True
    sheet.get_range('A40:H40').format.row_height=32
    sheet.freeze_panes.freeze_rows(5);sheet.freeze_panes.freeze_columns(2)
    with (root/'docs/CHANTIERS_INTERRUPTION_20261116.csv').open('w',encoding='utf-8-sig',newline='') as handle:
        writer=csv.DictWriter(handle,fields,delimiter=';',extrasaction='ignore')
        writer.writeheader();writer.writerows(rows)
    return wb

if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    tracker=json.loads((root/'docs/reprise-interruptions-20261116.json').read_text())
    path=root/tracker['source_workbook']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==tracker['source_workbook_sha256']
    wb=SpreadsheetFile.import_xlsx(Blob.load(str(path)))
    populate(wb,root,tracker)
    print(wb.inspect({'kind':'table','range':'Interruptions!F35:H36','include':'values,formulas','table_max_rows':2,'table_max_cols':3}).ndjson)
    SpreadsheetFile.export_xlsx(wb).save(str(root/tracker['output_workbook']))
