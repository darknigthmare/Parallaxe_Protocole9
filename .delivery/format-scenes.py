#!/usr/bin/env python3
"""Restore the reviewed artifact_tool formatting export; values validated separately."""
from pathlib import Path
import base64,hashlib,io,json,lzma,re,zipfile
ENCODED='''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'''
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=lzma.decompress(base64.b64decode(ENCODED,validate=True))
assert sha(raw)=='7611e6709d9281ee41ad079e695327b185c44e1811c031de3e2705cc02ff75a4'
payload=json.loads(raw)
p=Path('docs/PARALLAXE_Suivi_Reprise_2026-11-16_Scenes.xlsx');original=p.read_bytes()
assert sha(original)==payload['before']
with zipfile.ZipFile(io.BytesIO(original)) as archive:
    order=archive.namelist();members={n:archive.read(n) for n in order}
for name,before,after,parts in payload['parts']:
    assert name in members and sha(members[name])==before
    chunks=re.findall(r'[^>]*>',members[name].decode())
    assert ''.join(chunks).encode()==members[name]
    output=[]
    for part in parts:
        if isinstance(part,str):output.append(part)
        else:
            assert isinstance(part,list) and len(part)==2 and all(type(n) is int for n in part) and 0<=part[0]<=part[1]<=len(chunks)
            output.append(''.join(chunks[part[0]:part[1]]))
    members[name]=''.join(output).encode();assert sha(members[name])==after
buffer=io.BytesIO()
with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for name in order:
        entry=zipfile.ZipInfo(name,(1980,1,1,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED;entry.external_attr=0o600<<16
        archive.writestr(entry,members[name],compresslevel=9)
assert sha(buffer.getvalue())==payload['after']
gen=Path('scripts/build-reprise-scenes-workbook.py');source=gen.read_bytes()
assert sha(source)==payload['generator_before']
text=source.decode();assert text.count(payload['old'])==1
source=text.replace(payload['old'],payload['new']).encode();assert sha(source)==payload['generator_after']
p.write_bytes(buffer.getvalue());gen.write_bytes(source)
print('PASS: artifact_tool formatting export restored without clipping; '+payload['after'])
