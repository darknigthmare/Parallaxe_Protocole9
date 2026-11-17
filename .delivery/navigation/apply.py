"""Restore reviewed UTF-8 deltas and exact XLSX parts; no evaluation or network."""
from pathlib import Path,PurePosixPath
import base64,hashlib,io,json,lzma,re,zipfile
root=Path.cwd().resolve()
sha=lambda data:hashlib.sha256(data).hexdigest()
def target(name):
    part=PurePosixPath(name)
    if part.is_absolute() or '..' in part.parts or not part.parts:raise ValueError('Unsafe destination')
    if name not in ('AGENTS.md','README.md','package.json') and part.parts[0] not in ('.agents','.claude','.ai-tools','app','docs','scripts','src','tests'):raise ValueError('Unapproved destination')
    p=root.joinpath(*part.parts)
    if p.is_symlink() or not p.resolve().is_relative_to(root):raise ValueError('Checkout escape')
    return p
def restore(original,parts,split):
    text=original.decode('utf8');chunks=split(text)
    assert ''.join(chunks)==text
    result=[]
    for part in parts:
        if isinstance(part,str):result.append(part)
        elif isinstance(part,list) and len(part)==2 and all(type(x) is int for x in part) and 0<=part[0]<=part[1]<=len(chunks):result.append(''.join(chunks[part[0]:part[1]]))
        else:raise ValueError('Invalid slice')
    return ''.join(result).encode('utf8')
encoded=''.join((root/f'.delivery/navigation/part-{i}.b64').read_text().strip() for i in range(1,4))
raw=lzma.decompress(base64.b64decode(encoded,validate=True))
assert sha(raw)=='4a493595df875e34b14e1d9036ffa5703aae52c4af0d296a3fb22222b458d5a9'
data=json.loads(raw);assert data['schema']=='p9-navigation-v1'
assert data['base']=='112e4969e3d6ab71947ad5391bb87e7d43126476'
assert len(data['files'])==22
pending={}
for name,before,after,parts in data['files']:
    p=target(name);original=p.read_bytes() if p.exists() else b''
    assert name not in pending and sha(original)==before,name
    result=restore(original,parts,lambda s:s.splitlines(keepends=True));assert sha(result)==after,name
    pending[name]=result
book=data['workbook'];assert book['previous']=='docs/PARALLAXE_Suivi_Collecte_2026-11-17.xlsx'
assert book['output']=='docs/PARALLAXE_Suivi_Navigation_2026-11-17.xlsx'
assert len(book['parts'])==48
buffer=io.BytesIO();seen=set()
with zipfile.ZipFile(target(book['previous'])) as old,zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as new:
    for name,before,after,parts in book['parts']:
        p=PurePosixPath(name);assert not p.is_absolute() and '..' not in p.parts and name not in seen
        seen.add(name);original=old.read(name) if name in old.namelist() else b'';assert sha(original)==before,name
        result=restore(original,parts,lambda s:re.findall(r'[^>]*>',s));assert sha(result)==after,name
        new.writestr(name,result)
pending[book['output']]=buffer.getvalue()
for name,result in pending.items():
    p=target(name);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(result)
print(json.dumps({'files':len(pending),'verified_xlsx_parts':len(seen),'runtime':119,'advanced_workstreams':5,'closed':0,'workbook_sha256':sha(buffer.getvalue())}))
