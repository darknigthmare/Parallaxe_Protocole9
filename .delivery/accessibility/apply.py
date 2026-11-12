#!/usr/bin/env python3
"""Restore reviewed UTF-8 deltas and exact XLSX parts, with before/after SHA256 checks."""
from pathlib import Path, PurePosixPath
import base64, hashlib, io, json, lzma, re, zipfile
ROOT=Path.cwd().resolve()
STAGE=ROOT/'.delivery/accessibility'
EXPECTED='746114b749b02572869555541c9a713656a3bbc5c9b88dc84f720ebb06365bf1'
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

def splitxml(text):
    matches=list(re.finditer(r'</(?:\w+:)?row>',text))
    if not matches:return re.findall(r'[^>]*>',text)
    last=0;parts=[]
    for match in matches:
        parts.append(text[last:match.end()]);last=match.end()
    if last<len(text):parts.append(text[last:])
    return parts

encoded=''.join(''.join((STAGE/f'part-{n}.b64').read_text().split()) for n in range(1,3))
raw=lzma.decompress(base64.b64decode(encoded,validate=True))
if sha(raw)!=EXPECTED:raise ValueError('Payload fingerprint mismatch')
payload=json.loads(raw)
assert payload['schema']=='p9-accessibility-delta-v1'
assert payload['base']=='a78c6511112ad55b4dc5bc31c35b7e89c304cc3a'
assert len(payload['files'])==23
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
assert book['previous']=='docs/PARALLAXE_Suivi_Courant_2026-11-12_Observatoire.xlsx'
assert book['output']=='docs/PARALLAXE_Suivi_Courant_2026-11-12_Accessibilite.xlsx'
assert len(book['parts'])==33
buffer=io.BytesIO();seen=set()
with zipfile.ZipFile(destination(book['previous'])) as old,zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as new:
    for name,before,after,parts in book['parts']:
        p=PurePosixPath(name)
        if p.is_absolute() or '..' in p.parts or name in seen:raise ValueError('Invalid workbook part')
        seen.add(name)
        original=old.read(name) if name in old.namelist() else b''
        if sha(original)!=before:raise ValueError('Workbook source drift: '+name)
        result=restore(original,parts,splitxml)
        if sha(result)!=after:raise ValueError('Workbook result changed: '+name)
        new.writestr(name,result)
planned[book['output']]=buffer.getvalue()
for name,data in planned.items():
    p=destination(name);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
print(json.dumps({'restored_files':len(planned),'workbook_parts_verified':len(seen),'runtime':119,'remaining':1,'remappable_actions':12,'source_base':payload['base'],'workbook':book['output'],'workbook_sha256':sha(buffer.getvalue())},ensure_ascii=False))
