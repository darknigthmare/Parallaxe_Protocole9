#!/usr/bin/env python3
"""Restore reviewed UTF-8 line deltas and exact XLSX XML parts; no network/evaluation."""
from pathlib import Path, PurePosixPath
import base64, hashlib, io, json, lzma, re, zipfile
ROOT=Path.cwd().resolve()
STAGE=ROOT/'.delivery/spoken'
EXPECTED='60e7eb8beb85da18b50e9e3849aa23b5a3b44a7d5f577951ccd7895fc64f74bd'
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
    result=[]
    for part in parts:
        if isinstance(part,str):result.append(part)
        elif isinstance(part,list) and len(part)==2 and all(type(n) is int for n in part) and 0<=part[0]<=part[1]<=len(chunks):result.append(''.join(chunks[part[0]:part[1]]))
        else:raise ValueError('Invalid delta slice')
    return ''.join(result).encode('utf8')

encoded=''.join(''.join((STAGE/f'part-{n}.b64').read_text().split()) for n in range(1,4))
raw=lzma.decompress(base64.b64decode(encoded,validate=True))
if sha(raw)!=EXPECTED:raise ValueError('Payload fingerprint mismatch')
payload=json.loads(raw)
assert payload['schema']=='p9-voice-delta-v1'
assert payload['base']=='b16609c9650e8812eac95b980bfc184feef1c621'
assert len(payload['files'])==35
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
assert book['output']=='docs/PARALLAXE_Suivi_Courant_2026-11-11_Voix.xlsx'
assert book['previous']=='docs/PARALLAXE_Suivi_Courant_2026-11-11_Ascenseur.xlsx'
assert len(book['parts'])==33
buffer=io.BytesIO();seen=set()
with zipfile.ZipFile(destination(book['previous'])) as old,zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as new:
    for name,before,after,parts in book['parts']:
        part=PurePosixPath(name)
        if part.is_absolute() or '..' in part.parts or name in seen:raise ValueError('Invalid workbook part')
        seen.add(name)
        original=old.read(name) if name in old.namelist() else b''
        if sha(original)!=before:raise ValueError('Workbook source drift: '+name)
        result=restore(original,parts,lambda text:re.findall(r'[^>]*>',text))
        if sha(result)!=after:raise ValueError('Workbook result changed: '+name)
        new.writestr(name,result)
planned[book['output']]=buffer.getvalue()
assert sorted(payload['generated_voice_files'])==['docs/spoken-bank-manifest.json','src/game/spoken-bank.ts','src/game/spoken-timing.ts']
for name,data in planned.items():
    p=destination(name);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
print(json.dumps({'restored_files':len(planned),'workbook_parts_verified':len(seen),'runtime':117,'remaining':3,'voice_generation_required':payload['generated_voice_files'],'workbook':book['output'],'workbook_sha256':sha(buffer.getvalue())},ensure_ascii=False))
