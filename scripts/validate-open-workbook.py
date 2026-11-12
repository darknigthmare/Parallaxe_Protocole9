#!/usr/bin/env python3
"""Read-only verification of current XLSX, original A/B sources and real runtime IDs."""
from __future__ import annotations
import csv
import json
import posixpath
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'docs'
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
def require(ok,message):
    if not ok: raise AssertionError(message)
def load(name): return json.loads((D/name).read_text(encoding='utf-8'))
def main():
    source=load('parallaxe-open-work-20261101.json');runtime=load('runtime-catalog.json');design=load('anomalies-design.json')
    items=source['items'];lots=source['lots'];live={x['id'] for x in runtime};original={x[0]:x for x in design['anomalies']}
    require(len(live)==len(runtime),'Duplicate runtime ID')
    require(len(original)==len(design['anomalies'])==120,'Original design IDs changed')
    require(live<=set(original),'Runtime case lacks original design')
    require(len(items)==source['compteurs']['items_total']==600,'600 stable tracking entries expected')
    require(len({x['cle'] for x in items})==len(items),'Duplicate tracking key')
    require(len(lots)==source['compteurs']['lots_priorises']==28,'28 work packages expected')
    require(source['compteurs']['anomalies_runtime']==len(live),'Runtime count stale')
    pending=set(original)-live
    require(source['compteurs']['anomalies_non_implantees']==len(pending),'Pending count stale')
    tracked={r['id']:r for r in items if r['domaine']=='Anomalies'}
    require(set(tracked)==set(original),'Tracking IDs differ from original design')
    for ident,row in tracked.items():
        require((row['statut_source']=='Conçu — non implémenté')==(ident not in live),f'False implementation state: {ident}')
    require(all(r['action'] and r['critere'] for r in items),'Empty action or acceptance criterion')
    require(all('{{' not in str(r) for r in items),'Unresolved template tokens')
    backlog=json.loads((ROOT/source['gap_json']).read_text(encoding='utf-8'))
    gap=backlog['remaining_anomalies']
    require({r['id'] for r in gap}==pending and len(gap)==backlog['remaining']==len(pending),'Remaining concepts mismatch')
    fields={'name':1,'family':2,'place':3,'intensity':4,'baseline':5,'perceptionA':6,'perceptionB':7,'comparison':8,'trigger':9,'success':10,'assets':11,'fairness':12}
    for row in gap:
        for key,index in fields.items():require(row[key]==original[row['id']][index],f'Original A/B changed: {row["id"]}/{key}')
    with (ROOT/source['gap_csv']).open(encoding='utf-8-sig',newline='') as f: csvrows=list(csv.DictReader(f,delimiter=';'))
    require(len(csvrows)==len(pending) and {r['ID'] for r in csvrows}==pending,'CSV not synchronized')
    for name in ['PARALLAXE_Design_Complet.xlsx','PARALLAXE_Suivi_Reprise_2026-10-28.xlsx','PARALLAXE_Suivi_Sessions_2026-10-29.xlsx','PARALLAXE_Registre_Ouverts_2026-11-01.xlsx','PARALLAXE_Registre_Ouverts_2026-11-01_v2.xlsx']:
        require((D/name).is_file(),f'Historical workbook missing: {name}')
    workbook=ROOT/source['classeur_courant']
    with zipfile.ZipFile(workbook) as z:
        require(z.testzip() is None,'Broken XLSX ZIP CRC')
        for name in z.namelist():
            if name.endswith(('.xml','.rels')):ET.fromstring(z.read(name))
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            shared=[''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',NS)]
        rels={n.attrib['Id']:n.attrib['Target'] for n in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        tables={}
        for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',NS):
            target=rels[sheet.attrib['{'+REL+'}id']]
            path=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
            xml=ET.fromstring(z.read(path));cells={}
            for c in xml.findall('s:sheetData/s:row/s:c',NS):
                v=c.find('s:v',NS);value=v.text if v is not None else ''
                if c.attrib.get('t')=='s':value=shared[int(value)]
                elif c.attrib.get('t')=='inlineStr':value=''.join(c.find('s:is',NS).itertext())
                cells[c.attrib['r']]=value
            tables[sheet.attrib['name']]=cells
        require(set(tables)=={'Synthèse','Anomalies','Registre ouvert','Lots prioritaires','Recette QA','Restantes','Livraison','Sources'},'Missing workbook tab')
        summary=tables['Synthèse']
        for address,value in {'B7':120,'B8':len(live),'B9':len(pending),'B11':600,'B12':28,'B13':124}.items():require(float(summary[address])==value,f'Stale cached formula: {address}')
        for i,row in enumerate(items,6):
            for col,key in [('A','cle'),('C','id'),('F','statut_source'),('H','action'),('I','critere')]:require(tables['Registre ouvert'].get(f'{col}{i}')==str(row[key]),f'XLSX/source mismatch {col}{i}')
        for i,row in enumerate(design['anomalies'],6):
            cells=tables['Anomalies'];require(cells.get(f'A{i}')==row[0],'Anomaly ID not preserved')
            require(cells.get(f'D{i}')==('Oui' if row[0] in live else 'Non'),'Runtime presence differs in workbook')
            for col,index in [('G',5),('H',6),('I',7),('J',9)]:require(cells.get(f'{col}{i}')==str(row[index]),f'Original clue changed in workbook {col}{i}')
    print(json.dumps({'result':'PASS','runtime':len(live),'remaining':len(pending),'items':len(items),'original_design':120,'workbook':source['classeur_courant'],'checks':'CRC/XML, cached formulas, 600 keys/criteria/statuses, 120 original A/B rows, remaining CSV and JSON','limits':'No physical GPU, microphone or TURN validation'},ensure_ascii=False))
if __name__=='__main__':main()
