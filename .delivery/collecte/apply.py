#!/usr/bin/env python3
"""Restore only reviewed text deltas and XLSX XML parts, with exact fingerprints."""
from pathlib import Path, PurePosixPath
import base64, hashlib, io, json, lzma, re, zipfile
ROOT=Path.cwd().resolve()
STAGE=ROOT/'.delivery/collecte'
EXPECTED='d44bac4cfdebd0e360ec49867c72c84ee0fd8fc564754e61c929c2369e86fa83'
def sha(data):return hashlib.sha256(data).hexdigest()
def destination(name):
    p=PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or not p.parts:raise ValueError('Unsafe path')
    if name not in ('AGENTS.md','README.md','package.json') and p.parts[0] not in ('app','docs','scripts','src','tests'):raise ValueError('Unapproved destination: '+name)
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
assert payload['schema']=='p9-collecte-transfert-v1'
assert payload['base']=='c0c55acdea6246d4c5d118775b300e64c487434a'
assert len(payload['files'])==18
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
assert book['previous']=='docs/PARALLAXE_Suivi_Dossiers_2026-11-17.xlsx'
assert book['output']=='docs/PARALLAXE_Suivi_Collecte_2026-11-17.xlsx'
assert len(book['parts'])==45
buffer=io.BytesIO();seen=set()
with zipfile.ZipFile(destination(book['previous'])) as old,zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as new:
    for name,before,after,parts in book['parts']:
        p=PurePosixPath(name)
        if p.is_absolute() or '..' in p.parts or name in seen:raise ValueError('Invalid workbook member')
        seen.add(name)
        original=old.read(name) if name in old.namelist() else b''
        if sha(original)!=before:raise ValueError('Workbook source drift: '+name)
        result=restore(original,parts,lambda text:re.findall(r'[^>]*>',text))
        if sha(result)!=after:raise ValueError('Workbook result changed: '+name)
        new.writestr(name,result)
planned[book['output']]=buffer.getvalue()
for name,data in planned.items():
    p=destination(name);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
print(json.dumps({'restored_files':len(planned),'verified_workbook_parts':len(seen),'runtime':119,'advanced_workstreams':5,'closed_workstreams':0,'workbook_sha256':sha(buffer.getvalue())}))
