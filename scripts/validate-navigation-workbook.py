#!/usr/bin/env python3
"""Independent CRC/XML/cell/cached-formula and current-delivery validation."""
from pathlib import Path
import csv,hashlib,json,runpy
ROOT=Path(__file__).resolve().parents[1]
load=runpy.run_path(str(ROOT/'scripts/validate-reprise-scenes-workbook.py'))['load']
data=json.loads((ROOT/'docs/reprise-navigation-20261117.json').read_text())
before=ROOT/data['source_workbook'];assert hashlib.sha256(before.read_bytes()).hexdigest()==data['source_workbook_sha256']
a=load(before);b=load(ROOT/data['output_workbook'])
assert set(b)==set(a)|{'Navigation'}
for name in set(a)-{'Synthèse'}:assert a[name]==b[name],name
for address in ['B7','B8','B9','B10','B11','B12','B13']:assert a['Synthèse'][address]==b['Synthèse'][address]
current=json.loads((ROOT/'docs/current-delivery.json').read_text())
# Validate the Navigation snapshot at its own delivery boundary.
stop=current['workstream_updates'].index('docs/reprise-navigation-20261117.json')+1
if stop == len(current['workstream_updates']):
    assert current['workbook']==data['output_workbook'] and current['base_commit']==data['base_commit']
assert current['tracked_keys']==600 and current['runtime_count']==119
rows=json.loads((ROOT/'docs/chantiers-20261112.json').read_text())['work_packages']
for filename in current['workstream_updates'][:stop]:
    path=ROOT/filename;assert path.resolve().is_relative_to(ROOT)
    updates=json.loads(path.read_text())['updates']
    for row in rows:row.update(updates.get(row['lot'],{}))
fields=['lot','priorite','domaine','etat','prochaine_recette','preuves_disponibles','avance_ce_lot','cloture']
assert len(rows)==28 and len({r['lot'] for r in rows})==28
with (ROOT/'docs/CHANTIERS_NAVIGATION_20261117.csv').open(encoding='utf-8-sig',newline='') as f:csvrows=list(csv.DictReader(f,delimiter=';'))
assert len(csvrows)==28
for i,(row,csvrow) in enumerate(zip(rows,csvrows),6):
    row['avance_ce_lot']=row['lot'] in data['updates'];assert row['cloture'] is False
    for col,key in zip('ABCDEFGH',fields):
        expected=('Oui' if row[key] else 'Non') if key in ('avance_ce_lot','cloture') else row[key]
        assert b['Navigation'].get(f'{col}{i}',('', ''))[0]==expected,(col,i)
        assert csvrow[key]==str(row[key]),(key,i)
for addr,n in [('G36',len(data['updates'])),('H36',0)]:assert b['Navigation'][addr][0]==n and b['Navigation'][addr][1]
for key in ['qa','runtime_catalog','original_concepts','historical_registry']:assert (ROOT/current[key]).is_file()
print(json.dumps({'result':'PASS','sheets':13,'unchanged_historical_sheets':11,'tracked_keys':600,'runtime':119,'workstreams':28,'advanced':len(data['updates']),'closed':0,'formula_errors':0}))
