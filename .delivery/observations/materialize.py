#!/usr/bin/env python3
"""One-shot, SHA-256 checked restoration; no network, external code or evaluation."""
from pathlib import Path, PurePosixPath
import base64, hashlib, html, io, json, lzma, re, zipfile

ROOT = Path.cwd().resolve()
STAGE = ROOT / '.delivery/observations'
ORIGINAL_SHA = '9a2f29534f2d8ee6b7f8a5a3fe4a427302edb9e5fd9e112fc0f613da242ff759'
OVERLAY_SHA = '9fc8018946ab29c376cee8ebdcd252c80640201293b57508f5e729a76208e07d'
WORKBOOK_SHA = '4b060b25516e98774a01898925eecafdfeb8f05e91a1aa1644bbcd77cd8bef47'
WORKBOOK = 'docs/PARALLAXE_Suivi_Courant_2026-11-11.xlsx'
WORKFLOWS = {'.github/workflows/ci.yml', '.github/workflows/excel-registre.yml'}
DICTIONARY_FILES = ['docs/workbook-v02.json','docs/anomalies-design.json','docs/runtime-catalog.json','docs/parallaxe-open-work-20261101.json','docs/anomalies-gap-20261101.json']

def digest(data): return hashlib.sha256(data).hexdigest()
def safe_path(value):
    p = PurePosixPath(value)
    if p.is_absolute() or '..' in p.parts or not p.parts:
        raise ValueError('Unsafe path')
    if value not in WORKFLOWS and value not in ('README.md', 'package.json') and p.parts[0] not in ('app','docs','scripts','src','tests'):
        raise ValueError('Unapproved destination: ' + value)
    target = ROOT.joinpath(*p.parts)
    if not target.resolve().is_relative_to(ROOT) or target.is_symlink():
        raise ValueError('Destination escapes checkout: ' + value)
    return target

def decode(names, expected):
    encoded = ''.join(''.join((STAGE/name).read_text().split()) for name in names)
    raw = lzma.decompress(base64.b64decode(encoded, validate=True))
    if digest(raw) != expected:
        raise ValueError('Transport fingerprint mismatch: ' + str(names))
    return json.loads(raw)

def strings(value):
    if isinstance(value, str): yield value
    elif isinstance(value, list):
        for child in value: yield from strings(child)
    elif isinstance(value, dict):
        for child in value.values(): yield from strings(child)

vocabulary=set()
for name in DICTIONARY_FILES:
    vocabulary.update(strings(json.loads(safe_path(name).read_text())))
dictionary=sorted(s for s in vocabulary if len(s)>=20)
assert len(dictionary)==4150, 'Unexpected source dictionary'
pattern=re.compile(r'@@P9:(\d+):0@@')
def expand(value): return pattern.sub(lambda m: dictionary[int(m[1])], value)

planned={}
def current(name):
    if name in planned: return planned[name]
    p=safe_path(name)
    return p.read_bytes() if p.exists() else b''

def apply(records, resolver=lambda x:x):
    seen=set()
    for name, before, after, parts in records:
        name=resolver(name); safe_path(name)
        if name in seen: raise ValueError('Duplicate record: '+name)
        seen.add(name)
        old=current(name)
        if digest(old)!=before: raise ValueError('Source drift: '+name)
        lines=old.decode('utf8').splitlines(keepends=True)
        output=[]
        for part in parts:
            if isinstance(part,list):
                if len(part)!=2 or not all(type(v) is int for v in part) or not 0<=part[0]<=part[1]<=len(lines):
                    raise ValueError('Invalid line slice: '+name)
                output.append(''.join(lines[part[0]:part[1]]))
            elif isinstance(part,str): output.append(resolver(part))
            else: raise ValueError('Invalid delta type')
        result=''.join(output).encode('utf8')
        if digest(result)!=after: raise ValueError('Result fingerprint mismatch: '+name)
        planned[name]=result

original=decode([f'code-{n}.b64' for n in range(1,5)], ORIGINAL_SHA)
assert len(original)==25
apply(original,expand)
overlay=decode(['reprise-11.b64'],OVERLAY_SHA)
assert overlay['base']=='9c0bd3d8162e479d36d58b1f267638b3b03476f1'
apply(overlay['records'])
assert overlay['delete']==['docs/QA_OBSERVATIONS_20261110.md']

def document(name): return json.loads(current('docs/'+name))
t=document('parallaxe-open-work-20261101.json')
d=document('anomalies-design.json')
r=document('runtime-catalog.json')
g=document('anomalies-gap-20261110.json')
live={a['id']:a for a in r}
assert len(r)==len(live)==104 and len(d['anomalies'])==120 and len(t['items'])==600
rows={
 'xl/worksheets/sheet2.xml': [[a[0],a[1],a[2],'Oui' if a[0]in live else 'Non','Implémenté — QA partielle' if a[0]in live else 'Conçu — non implémenté',', '.join(live[a[0]].get('levels',[]))if a[0]in live else a[3],a[5],a[6],a[7],a[9],a[12],'https://github.com/darknigthmare/Parallaxe_Protocole9/blob/continuation/observations-20261110/docs/anomalies-design.json']for a in d['anomalies']],
 'xl/worksheets/sheet3.xml': [[x[k]for k in ['cle','domaine','id','nom','priorite','statut_source','nature','action','critere','preuve_exigee','verification','details','source']]for x in t['items']],
 'xl/worksheets/sheet4.xml': [[x[k]for k in ['id','priorite','domaine','action','criteres','preuve','liens','etat']]for x in t['lots']],
 'xl/worksheets/sheet5.xml': [[x[k]for k in ['id','nom','priorite','statut_source','action','critere','details','source']]for x in t['items']if x['domaine']=='QA'],
 'xl/worksheets/sheet6.xml': [[x[k]for k in ['id','name','priority','target','baseline','perceptionA','perceptionB','trigger','technicalImplementation','qaAcceptance']]for x in g['remaining_anomalies']],
}
book=decode(['workbook-1.b64','workbook-2.b64'],WORKBOOK_SHA)
assert book['output']==WORKBOOK and book['format']=='xml-row-restoration-v1' and len(book['parts'])==33
cell=re.compile(r'(<x:c\b[^>]*r="([A-Z]+)(\d+)"[^>]*>.*?<x:v>)(.*?)(</x:v>.*?</x:c>)')
def column(value):
    n=0
    for char in value:n=n*26+ord(char)-64
    return n-1
buffer=io.BytesIO()
seen=set()
with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as z:
    for name, fingerprint, template in book['parts']:
        member=PurePosixPath(name)
        if member.is_absolute() or '..'in member.parts or name in seen:raise ValueError('Invalid ZIP entry')
        seen.add(name)
        values=rows.get(name,[])
        def restore(match):
            if match[4]!='@@ROW@@':return match[0]
            val=values[int(match[3])-6][column(match[2])]
            return match[1]+html.escape(str(val),quote=False)+match[5]
        data=cell.sub(restore,template).encode('utf8')
        if digest(data)!=fingerprint:raise ValueError('Exported workbook part changed: '+name)
        z.writestr(name,data)
planned[WORKBOOK]=buffer.getvalue()

# Workflow changes are applied separately by the authorized connector, never
# by this recovery job's GITHUB_TOKEN. All other writes are explicit and atomic.
for name,data in planned.items():
    if name in WORKFLOWS or name in overlay['delete']:continue
    p=safe_path(name);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_bytes(data)
for name in overlay['delete']:
    p=safe_path(name)
    if p.exists():p.unlink()
print(json.dumps({'restored_source_records':len(original),'overlay_records':len(overlay['records']),
 'workbook_parts_verified':len(seen),'written_files':len([p for p in planned if p not in WORKFLOWS and p not in overlay['delete']]),
 'runtime':104,'planned':16,'workbook':WORKBOOK,'workflow_files_skipped':sorted(WORKFLOWS)},ensure_ascii=False))
