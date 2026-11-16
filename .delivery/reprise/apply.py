#!/usr/bin/env python3
"""Restore only reviewed, fingerprint-verified UTF-8 deltas and exact workbook XML."""
from pathlib import Path, PurePosixPath
import base64, hashlib, io, json, lzma, re, zipfile
ROOT=Path.cwd().resolve()
STAGE=ROOT/'.delivery/reprise'
EXPECTED='6d530aff2dc889023e7e2c6975c4de219cb284746e23e052ca74e75080223a84'
def sha(data):return hashlib.sha256(data).hexdigest()
def destination(name):
    p=PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or not p.parts:raise ValueError('Unsafe path')
    if name not in ('README.md','package.json') and p.parts[0] not in ('app','docs','scripts','src','tests'):raise ValueError('Unapproved destination: '+name)
    target=ROOT.joinpath(*p.parts)
    if target.is_symlink() or not target.resolve().is_relative_to(ROOT):raise ValueError('Checkout escape')
    return target

def restore(original,parts,splitter):
    text=original.decode('utf8');chunks=splitter(text)
    if ''.join(chunks)!=text:raise ValueError('Non-lossless splitter')
    output=[]
    for part in parts:
        if isinstance(part,str):output.append(part)
        elif isinstance(part,list) and len(part)==2 and all(type(n) is int for n in part) and 0<=part[0]<=part[1]<=len(chunks):output.append(''.join(chunks[part[0]:part[1]]))
        else:raise ValueError('Invalid slice')
    return ''.join(output).encode('utf8')

encoded=''.join(''.join((STAGE/f'part-{n}.b64').read_text().split()) for n in range(1,3))
raw=lzma.decompress(base64.b64decode(encoded,validate=True))
if sha(raw)!=EXPECTED:raise ValueError('Payload fingerprint mismatch')
payload=json.loads(raw)
assert payload['schema']=='p9-scenes-release-v1'
assert payload['base']=='820d57c0f9888937c16db48becd7e51c6d74e1e8'
assert len(payload['files'])==19
planned={}
for name,before,after,parts in payload['files']:
    p=destination(name)
    if name in planned:raise ValueError('Duplicate destination')
    old=p.read_bytes() if p.exists() else b''
    if sha(old)!=before:raise ValueError('Source drift: '+name)
    result=restore(old,parts,lambda text:text.splitlines(keepends=True))
    if sha(result)!=after:raise ValueError('Result fingerprint mismatch: '+name)
    planned[name]=result
book=payload['workbook']
assert book['previous']=='docs/PARALLAXE_Suivi_Courant_2026-11-12_Chantiers.xlsx'
assert book['output']=='docs/PARALLAXE_Suivi_Reprise_2026-11-16_Scenes.xlsx'
assert len(book['parts'])==36
assert not destination(book['output']).exists()
buffer=io.BytesIO();seen=set()
with zipfile.ZipFile(destination(book['previous'])) as old,zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as new:
    for name,before,after,parts in book['parts']:
        p=PurePosixPath(name)
        if p.is_absolute() or '..' in p.parts or name in seen:raise ValueError('Invalid workbook part')
        seen.add(name)
        original=old.read(name) if name in old.namelist() else b''
        if sha(original)!=before:raise ValueError('Workbook source drift: '+name)
        result=restore(original,parts,lambda text:re.findall(r'[^>]*>',text))
        if sha(result)!=after:raise ValueError('Workbook result changed: '+name)
        member=zipfile.ZipInfo(name,(1980,1,1,0,0,0))
        member.compress_type=zipfile.ZIP_DEFLATED;member.external_attr=0o600<<16
        new.writestr(member,result,compresslevel=9)
assert sha(buffer.getvalue())==book['sha256']=='10266a35d2b67226de0d5d6371b367e0285b5e0d0c7cafe44284db4b6da61752'
planned[book['output']]=buffer.getvalue()
for name,data in planned.items():
    p=destination(name);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
print(json.dumps({'restored_files':len(planned),'verified_workbook_parts':len(seen),'source_base':payload['base'],'workbook_sha256':sha(buffer.getvalue()),'anomalies':119,'tracked_items':600,'closed_workstreams':0}))
