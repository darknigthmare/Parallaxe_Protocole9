#!/usr/bin/env python3
"""Restore reviewed line deltas; validate all before/after SHA256 values before writes."""
from pathlib import Path, PurePosixPath
import base64, hashlib, io, json, lzma, re, zipfile
ROOT=Path.cwd().resolve()
STAGE=ROOT/'.delivery/temporal'
EXPECTED='28e9d5085bf8e34bb362662adf06ca83fc0eb03327a0bdab9f44f80b527ed53e'
sha=lambda value:hashlib.sha256(value).hexdigest()
def destination(name):
    p=PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or not p.parts:raise ValueError('Unsafe destination')
    if name not in ('AGENTS.md','README.md','package.json') and p.parts[0] not in ('app','docs','scripts','src','tests'):raise ValueError('Unapproved destination: '+name)
    path=ROOT.joinpath(*p.parts)
    if path.is_symlink() or not path.resolve().is_relative_to(ROOT):raise ValueError('Checkout escape')
    return path

def restore(original,parts,splitter):
    chunks=splitter(original.decode('utf8'));output=[]
    if ''.join(chunks)!=original.decode('utf8'):raise ValueError('Non-lossless split')
    for part in parts:
        if isinstance(part,str):output.append(part)
        elif isinstance(part,list) and len(part)==2 and all(type(i) is int for i in part) and 0<=part[0]<=part[1]<=len(chunks):output.append(''.join(chunks[part[0]:part[1]]))
        else:raise ValueError('Invalid delta slice')
    return ''.join(output).encode('utf8')

encoded=''.join(''.join((STAGE/f'lot-{n}.b64').read_text().split()) for n in range(1,4))
raw=lzma.decompress(base64.b64decode(encoded,validate=True))
if sha(raw)!=EXPECTED:raise ValueError('Payload fingerprint mismatch')
payload=json.loads(raw)
assert payload['base']=='e8ae289681dd37d9b7893b4cf8cb1370a58656bf'
assert len(payload['files'])==24
planned={}
for name,before,after,parts in payload['files']:
    p=destination(name)
    if name in planned:raise ValueError('Duplicate destination')
    original=p.read_bytes() if p.exists() else b''
    if sha(original)!=before:raise ValueError('Source drift: '+name)
    result=restore(original,parts,lambda text:text.splitlines(keepends=True))
    if sha(result)!=after:raise ValueError('Result fingerprint mismatch: '+name)
    planned[name]=result
book=payload['workbook']
assert book['output']=='docs/PARALLAXE_Suivi_Courant_2026-11-11_Temporal.xlsx'
assert book['previous']=='docs/PARALLAXE_Suivi_Courant_2026-11-11_Acoustique.xlsx'
assert len(book['parts'])==33
buffer=io.BytesIO();seen=set()
with zipfile.ZipFile(destination(book['previous'])) as old,zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as new:
    for name,before,after,parts in book['parts']:
        part=PurePosixPath(name)
        if part.is_absolute() or '..' in part.parts or name in seen:raise ValueError('Invalid workbook member')
        seen.add(name)
        original=old.read(name) if name in old.namelist() else b''
        if sha(original)!=before:raise ValueError('Workbook source drift: '+name)
        result=restore(original,parts,lambda text:re.findall(r'[^>]*>',text))
        if sha(result)!=after:raise ValueError('Workbook part changed: '+name)
        new.writestr(name,result)
planned[book['output']]=buffer.getvalue()
for name,data in planned.items():
    p=destination(name);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
print(json.dumps({'restored_files':len(planned),'verified_workbook_parts':len(seen),'runtime':112,'remaining':8,'source_base':payload['base'],'workbook':book['output'],'workbook_sha256':sha(buffer.getvalue())},ensure_ascii=False))
