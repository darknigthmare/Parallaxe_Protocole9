#!/usr/bin/env python3
"""Append the dated scene/release workstream review without changing historical source rows."""
from pathlib import Path
import csv, hashlib, json
from artifact_tool import Blob, SpreadsheetFile

def populate(wb, root, tracker):
    packages = json.loads((root / 'docs/chantiers-20261112.json').read_text())['work_packages']
    prior = json.loads((root / 'docs/integration-workstreams-20261116.json').read_text())['updates']
    for package in packages:
        package.update(prior.get(package['lot'], {}))
        package.update(tracker['updates'].get(package['lot'], {}))
        package['avance_ce_lot'] = package['lot'] in tracker['updates']
        assert package['cloture'] is False
    assert len(packages) == 28
    summary=wb.worksheets.get_item('Synthèse')
    summary.get_range('A3').values=[['16 novembre 2026 · scènes à la demande et téléchargements liés au commit · 119 / 120']]
    summary.get_range('A16').values=[['REPRISE : SCÈNES, RÉFÉRENCES ET LIVRAISON']]
    notes={
        18:'Saint-Clair au démarrage ; quatre lieux construits à la première visite, puis réutilisés sans baisse de détail.',
        19:'Inventaire CPU : 445 010 triangles au démarrage contre 617 631 auparavant ; aucun gain de FPS certifié.',
        20:'W12, W13, W22 et W23 avancent. 600 clés conservées ; aucune réception humaine clôturée automatiquement.',
        24:'Le nouvel onglet Reprise scènes porte les 28 états datés. Les lignes historiques restent conservées.'
    }
    for row,text in notes.items():
        summary.get_range(f'A{row}').values=[[text]]
        summary.get_range(f'A{row}:H{row}').format.row_height=38
    sheet=wb.worksheets.add('Reprise scènes')
    sheet.merge_cells('A1:H2');sheet.get_range('A1').values=[['PARALLAXE / SCÈNES ET LIVRAISON — 16 NOVEMBRE 2026']]
    sheet.get_range('A1:H2').format={'fill':'#173A4B','font':{'name':'Arial','size':17,'bold':True,'color':'#FFFFFF'},'row_height':24}
    sheet.merge_cells('A3:H3');sheet.get_range('A3').values=[['Base : '+tracker['base_commit']+' · 28 lots, quatre avancés, aucune clôture automatique.']]
    sheet.get_range('A3:H3').format={'wrap_text':True,'row_height':32,'font':{'name':'Arial','size':10,'color':'#53616B'}}
    fields=['lot','priorite','domaine','etat','prochaine_recette','preuves_disponibles','avance_ce_lot','cloture']
    rows=[[p[k] if k not in ('avance_ce_lot','cloture') else ('Oui' if p[k] else 'Non') for k in fields] for p in packages]
    sheet.get_range('A5:H33').values=[['Lot','Priorité','Chantier','État actualisé','Réception restante','Preuves disponibles','Avancé ce lot','Clôturé']]+rows
    sheet.tables.add('A5:H33',True,'P9_Scenes_20261116')
    sheet.get_range('A5:H33').format.font={'name':'Arial','size':10,'color':'#162733'}
    sheet.get_range('A5:H5').format={'fill':'#173A4B','font':{'name':'Arial','size':10,'bold':True,'color':'#FFFFFF'},'wrap_text':True,'row_height':32}
    sheet.get_range('A6:H33').format.wrap_text=True
    sheet.get_range('A6:H33').format.vertical_alignment='top'
    for column,width in zip('ABCDEFGH',[10,10,26,36,43,40,14,12]):
        sheet.get_range(f'{column}1:{column}44').format.column_width=width
    for index,p in enumerate(packages,6):
        sheet.get_range(f'A{index}:H{index}').format.row_height=110
        if p['avance_ce_lot']:sheet.get_range(f'A{index}:H{index}').format.fill='#DDEEE8'
    sheet.get_range('F35:H36').values=[['BILAN','AVANCÉS','CLÔTURÉS'],['Cette livraison',None,None]]
    sheet.get_range('G36:H36').formulas=[['=COUNTIF(G6:G33,"Oui")','=COUNTIF(H6:H33,"Oui")']]
    sheet.merge_cells('A38:H38');sheet.get_range('A38').values=[['INVENTAIRE CPU DES OBJETS — PAS UNE MESURE GPU OU FPS']]
    sheet.get_range('A38:H38').format={'fill':'#173A4B','font':{'bold':True,'color':'#FFFFFF'},'row_height':28}
    sheet.get_range('A39:F42').values=[
        ['Mesure','Avant','Au démarrage','Écart','Variation','Après cinq lieux'],
        ['Triangles construits',tracker['metrics']['before']['triangles'],tracker['metrics']['entry']['triangles'],None,None,tracker['metrics']['after_all_visits']['triangles']],
        ['Objets maillés',tracker['metrics']['before']['meshes'],tracker['metrics']['entry']['meshes'],None,None,tracker['metrics']['after_all_visits']['meshes']],
        ['Miroirs alloués',tracker['metrics']['before']['mirrors'],tracker['metrics']['entry']['mirrors'],None,None,tracker['metrics']['after_all_visits']['mirrors']]
    ]
    sheet.get_range('D40:E42').formulas=[['=C40-B40','=C40/B40-1'],['=C41-B41','=C41/B41-1'],['=C42-B42','=C42/B42-1']]
    sheet.get_range('B40:D42').set_number_format('#,##0')
    sheet.get_range('E40:E42').set_number_format('0.0%')
    sheet.get_range('F40:F42').set_number_format('#,##0')
    sheet.get_range('A39:F42').format.row_height=28
    sheet.get_range('A39:A42').format.wrap_text=True
    sheet.get_range('A40:F42').format.row_height=44
    sheet.merge_cells('A44:H44');sheet.get_range('A44').values=[['Sources : docs/reprise-scenes-20261116.json ; docs/scene-inventory-20261116.json ; docs/QA_SCENES_LIVRAISON_20261116.md']]
    sheet.get_range('A44:H44').format.wrap_text=True;sheet.get_range('A44:H44').format.row_height=32
    sheet.freeze_panes.freeze_rows(5);sheet.freeze_panes.freeze_columns(2)
    with (root/'docs/CHANTIERS_REPRISE_SCENES_20261116.csv').open('w',encoding='utf-8-sig',newline='') as handle:
        writer=csv.DictWriter(handle,fields,delimiter=';',extrasaction='ignore');writer.writeheader();writer.writerows(packages)
    return wb

if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    tracker=json.loads((root/'docs/reprise-scenes-20261116.json').read_text())
    source=root/tracker['source_workbook']
    assert hashlib.sha256(source.read_bytes()).hexdigest()==tracker['source_workbook_sha256']
    wb=SpreadsheetFile.import_xlsx(Blob.load(str(source)))
    out=root/'outputs/reprise-scenes-20261116';out.mkdir(parents=True,exist_ok=True)
    wb.render({'sheet_name':'Synthèse','range':'A1:H25','scale':1}).save(str(out/'source-preview.png'))
    populate(wb,root,tracker)
    print(wb.inspect({'kind':'table','range':"'Reprise scènes'!F35:H36",'include':'values,formulas','table_max_rows':2,'table_max_cols':3}).ndjson)
    print(wb.inspect({'kind':'match','search_term':'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A','options':{'use_regex':True,'max_results':20}}).ndjson)
    wb.render({'sheet_name':'Synthèse','range':'A1:H25','scale':1.2}).save(str(out/'preview.png'))
    SpreadsheetFile.export_xlsx(wb).save(str(root/'docs/PARALLAXE_Suivi_Reprise_2026-11-16_Scenes.xlsx'))
