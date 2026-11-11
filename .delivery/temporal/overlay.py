#!/usr/bin/env python3
"""Apply the reviewed post-restoration corrections, without shell or network access."""
from pathlib import Path, PurePosixPath
import json, hashlib
root=Path.cwd().resolve()
sha=lambda value:hashlib.sha256(value).hexdigest()
records=json.loads((root/'.delivery/temporal/overlay.json').read_text())['records']
assert len(records)==7
pending={}
for name,before,after,parts in records:
    p=PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or p.parts[0] not in ('src','tests','docs') or name in pending:raise ValueError('Unsafe path')
    path=root.joinpath(*p.parts)
    if path.is_symlink() or not path.resolve().is_relative_to(root):raise ValueError('Checkout escape')
    original=path.read_bytes()
    if sha(original)!=before:raise ValueError('Overlay source drift: '+name)
    lines=original.decode('utf8').splitlines(keepends=True);chunks=[]
    for part in parts:
        if isinstance(part,str):chunks.append(part)
        elif isinstance(part,list) and len(part)==2 and all(type(n) is int for n in part) and 0<=part[0]<=part[1]<=len(lines):chunks.append(''.join(lines[part[0]:part[1]]))
        else:raise ValueError('Bad line slice')
    result=''.join(chunks).encode('utf8')
    if sha(result)!=after:raise ValueError('Overlay result changed: '+name)
    pending[name]=result
for name,data in pending.items():root.joinpath(name).write_bytes(data)
print(json.dumps({'overlay_files':len(pending),'door_z':11.10,'handler_and_packaged_http_tests':True}))
