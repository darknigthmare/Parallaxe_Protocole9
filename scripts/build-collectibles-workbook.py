#!/usr/bin/env python3
"""Cumulative field-document delivery; never rewrite the historical 600-key worksheets."""
from pathlib import Path
import csv, json, hashlib
from artifact_tool import Blob, SpreadsheetFile

def rows_for(root, tracker):
    rows=json.loads((root/'docs/chantiers-20261112.json').read_text())['work_packages']
    current=json.loads((root/'docs/current-delivery.json').read_text())
    for filename in current['workstream_updates']:
        updates=json.loads((root/filename).read_text())['updates']
        for row in rows:row.update(updates.get(row['lot'],{}))
    for row in rows:row['avance_ce_lot']=row['lot'] in tracker['updates']
    assert len(rows)==28 and all(row['cloture'] is False for row in rows)
    return rows

def populate(wb,root,tracker):
    rows=rows_for(root,tracker);summary=wb.worksheets.get_item('Synthèse')
    summary.get_range('A3').values=[['17 novembre 2026 · consignes physiques et sauvegarde v2 · 119 / 120']]
    summary.get_range('A16').values=[['SUPPORTS 3D ET TRANSFERT DES CONSIGNES']]
    for i,text in {
        18:'Cinq consignes fixées près des entrées : viser, lire, conserver une copie. Les originaux restent pour l’équipe.',
        19:'L’export solo v2 inclut les consignes. L’import v1 reste compatible ; notes et découvertes existantes sont fusionnées.',
        20:'W16, W23, W25, W26 et W28 avancent. Les salles finales, cinématiques et réceptions matérielles restent ouvertes.',
        24:'Onglet Collecte : état cumulatif des 28 lots. Pointeur : docs/current-delivery.json ; aucune clôture humaine automatique.'
    }.items():
        summary.get_range(f'A{i}').values=[[text]];summary.get_range(f'A{i}:H{i}').format.row_height=38
    sheet=wb.worksheets.add('Collecte');sheet.merge_cells('A1:H2')
    sheet.get_range('A1').values=[['PARALLAXE / COLLECTE & TRANSFERT — 17 NOVEMBRE 2026']]
    sheet.get_range('A1:H2').format={'fill':'#173A4B','font':{'name':'Arial','size':17,'bold':True,'color':'#FFFFFF'},'row_height':24}
    sheet.merge_cells('A3:H3');sheet.get_range('A3').values=[['Base '+tracker['base_commit']+' · 28 lots conservés ; cinq avancées, sans certification matérielle.']]
    sheet.get_range('A3:H3').format={'wrap_text':True,'row_height':32,'font':{'name':'Arial','size':10,'color':'#53616B'}}
    fields=['lot','priorite','domaine','etat','prochaine_recette','preuves_disponibles','avance_ce_lot','cloture']
    vals=[[('Oui' if r[k] else 'Non') if k in ('avance_ce_lot','cloture') else r[k] for k in fields] for r in rows]
    sheet.get_range('A5:H33').values=[['Lot','Priorité','Chantier','État actuel','Réception restante','Preuves / recette','Avancé ce lot','Clôturé']]+vals
    sheet.tables.add('A5:H33',True,'P9_Collecte_20261117')
    sheet.get_range('A5:H33').format.font={'name':'Arial','size':10,'color':'#162733'}
    sheet.get_range('A5:H5').format={'fill':'#173A4B','font':{'name':'Arial','size':10,'bold':True,'color':'#FFFFFF'},'wrap_text':True,'row_height':32}
    sheet.get_range('A6:H33').format.wrap_text=True;sheet.get_range('A6:H33').format.vertical_alignment='top'
    for c,w in zip('ABCDEFGH',[10,10,26,36,43,40,14,12]):sheet.get_range(f'{c}1:{c}44').format.column_width=w
    for i,row in enumerate(rows,6):
        sheet.get_range(f'A{i}:H{i}').format.row_height=110
        if row['avance_ce_lot']:sheet.get_range(f'A{i}:H{i}').format.fill='#DDEEE8'
    sheet.get_range('F35:H36').values=[['BILAN','AVANCÉS','CLÔTURÉS'],['Cette reprise',None,None]]
    sheet.get_range('G36:H36').formulas=[['=COUNTIF(G6:G33,"Oui")','=COUNTIF(H6:H33,"Oui")']]
    for i,text in {
        38:'N10 avance : supports 3D de consignes, copie personnelle explicite. Les autres objets narratifs restent distincts.',
        40:'N07/N08/N09 et hall_stretch restent ouverts. Aucune cinématique remplacée par un texte ni réception humaine inventée.',
        42:'Sources : docs/reprise-collecte-20261117.json ; docs/QA_COLLECTE_20261117.md ; docs/current-delivery.json',
        44:'Dépôt : https://github.com/darknigthmare/Parallaxe_Protocole9 · Preuves : CI du commit exact, pas celles de la base.'
    }.items():
        sheet.merge_cells(f'A{i}:H{i}');sheet.get_range(f'A{i}').values=[[text]];sheet.get_range(f'A{i}:H{i}').format.wrap_text=True;sheet.get_range(f'A{i}:H{i}').format.row_height=32
    sheet.freeze_panes.freeze_rows(5);sheet.freeze_panes.freeze_columns(2)
    with (root/'docs/CHANTIERS_COLLECTE_20261117.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fields,delimiter=';',extrasaction='ignore');writer.writeheader();writer.writerows(rows)
    return wb
if __name__=='__main__':
    root=Path(__file__).resolve().parents[1];tracker=json.loads((root/'docs/reprise-collecte-20261117.json').read_text());path=root/tracker['source_workbook']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==tracker['source_workbook_sha256']
    wb=SpreadsheetFile.import_xlsx(Blob.load(str(path)));populate(wb,root,tracker)
    SpreadsheetFile.export_xlsx(wb).save(str(root/tracker['output_workbook']))
