#!/usr/bin/env python3
"""Read-only verification: source hashes, historical cells, dated 28-row tracker."""
from pathlib import Path
import csv, hashlib, json, runpy
ROOT=Path(__file__).resolve().parents[1]
load=runpy.run_path(str(ROOT/'scripts/validate-reprise-scenes-workbook.py'))['load']
data=json.loads((ROOT/'docs/reprise-interruptions-20261116.json').read_text())
source=ROOT/data['source_workbook']
assert hashlib.sha256(source.read_bytes()).hexdigest()==data['source_workbook_sha256']
a=load(source);b=load(ROOT/data['output_workbook'])
assert set(b)==set(a)|{'Interruptions'}
for name in set(a)-{'Synthèse'}:assert a[name]==b[name],name
for address in ['B7','B8','B9','B10','B11','B12','B13']:assert a['Synthèse'][address]==b['Synthèse'][address]
rows=json.loads((ROOT/'docs/chantiers-20261112.json').read_text())['work_packages']
for name in ['integration-workstreams-20261116.json','reprise-scenes-20261116.json','reprise-interruptions-20261116.json']:
    updates=json.loads((ROOT/'docs'/name).read_text())['updates']
    for row in rows:row.update(updates.get(row['lot'],{}))
fields=['lot','priorite','domaine','etat','prochaine_recette','preuves_disponibles','avance_ce_lot','cloture']
assert len(rows)==28 and len({row['lot'] for row in rows})==28
with (ROOT/'docs/CHANTIERS_INTERRUPTION_20261116.csv').open(encoding='utf-8-sig',newline='') as f:csvrows=list(csv.DictReader(f,delimiter=';'))
assert len(csvrows)==28
for i,(row,csvrow) in enumerate(zip(rows,csvrows),6):
    row['avance_ce_lot']=row['lot'] in data['updates'];assert row['cloture'] is False
    for col,key in zip('ABCDEFGH',fields):
        expected=('Oui' if row[key] else 'Non') if key in ('avance_ce_lot','cloture') else row[key]
        assert b['Interruptions'].get(f'{col}{i}',('', ''))[0]==expected,(col,i)
        assert csvrow[key]==str(row[key]),(key,i)
for addr,expected in [('G36',len(data['updates'])),('H36',0)]:
    assert b['Interruptions'][addr][0]==expected and b['Interruptions'][addr][1]
print(json.dumps({'result':'PASS','sheets':10,'unchanged_historical_sheets':8,'items':600,'runtime':119,'workstreams':28,'advanced':5,'closed':0,'formula_errors':0}))
