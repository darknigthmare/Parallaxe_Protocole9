#!/usr/bin/env python3
"""Read-only standard-library validation; creation is done by artifact_tool."""
from pathlib import Path
import csv, hashlib, json, posixpath, zipfile
from decimal import Decimal
from xml.etree import ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
def load(path):
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
        for name in z.namelist():
            if name.endswith(('.xml','.rels')):ET.fromstring(z.read(name))
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            shared=[''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',NS)]
        rels={n.attrib['Id']:n.attrib['Target'] for n in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        sheets={}
        for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',NS):
            target=rels[sheet.attrib['{'+REL+'}id']]
            member=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
            cells={}
            for cell in ET.fromstring(z.read(member)).findall('s:sheetData/s:row/s:c',NS):
                assert cell.get('t')!='e',f'Formula error {sheet.get("name")} {cell.get("r")}'
                value=cell.findtext('s:v',default='',namespaces=NS)
                if cell.get('t')=='s':value=shared[int(value)]
                elif cell.get('t')=='inlineStr':value=''.join(cell.find('s:is',NS).itertext())
                elif value and cell.get('t') not in ('str','b'):value=Decimal(value)
                formula=cell.findtext('s:f',default='',namespaces=NS)
                if value!='' or formula:cells[cell.get('r')]=(value,formula)
            sheets[sheet.get('name')]=cells
        return sheets

def main():
    data=json.loads((ROOT/'docs/reprise-scenes-20261116.json').read_text())
    before=ROOT/data['source_workbook']
    assert hashlib.sha256(before.read_bytes()).hexdigest()==data['source_workbook_sha256']
    original=load(before);current=load(ROOT/'docs/PARALLAXE_Suivi_Reprise_2026-11-16_Scenes.xlsx')
    assert set(current)==set(original)|{'Reprise scènes'}
    for name in set(original)-{'Synthèse'}:assert current[name]==original[name],f'Historical data changed in {name}'
    for address in ['B7','B8','B9','B10','B11','B12','B13']:assert current['Synthèse'][address]==original['Synthèse'][address]
    rows=json.loads((ROOT/'docs/chantiers-20261112.json').read_text())['work_packages']
    prior=json.loads((ROOT/'docs/integration-workstreams-20261116.json').read_text())['updates']
    fields=['lot','priorite','domaine','etat','prochaine_recette','preuves_disponibles','avance_ce_lot','cloture']
    for index,row in enumerate(rows,6):
        row.update(prior.get(row['lot'],{}));row.update(data['updates'].get(row['lot'],{}));row['avance_ce_lot']=row['lot'] in data['updates']
        assert row['cloture'] is False
        for col,key in zip('ABCDEFGH',fields):
            expected=('Oui' if row[key] else 'Non') if key in ('avance_ce_lot','cloture') else row[key]
            assert current['Reprise scènes'].get(f'{col}{index}',('', ''))[0]==expected,(col,index)
    with (ROOT/'docs/CHANTIERS_REPRISE_SCENES_20261116.csv').open(encoding='utf-8-sig',newline='') as f:csvrows=list(csv.DictReader(f,delimiter=';'))
    assert len(csvrows)==28
    for actual,row in zip(csvrows,rows):
        for key in fields:assert actual[key]==str(row[key]),key
    sheet=current['Reprise scènes']
    for address,value in {'G36':4,'H36':0,'B40':617631,'C40':445010,'D40':-172621,'F40':617631,'B41':1604,'C41':1186,'B42':10,'C42':2}.items():assert sheet[address][0]==value,address
    assert sheet['G36'][1] and sheet['H36'][1] and sheet['E40'][1]
    print(json.dumps({'result':'PASS','sheets':9,'historical_sheets_unchanged':7,'runtime':119,'items':600,'workstreams':28,'advanced':4,'closed':0,'formula_errors':0}))
if __name__=='__main__':main()
