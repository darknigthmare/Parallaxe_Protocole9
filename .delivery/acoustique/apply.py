#!/usr/bin/env python3
"""Restore a locally authored, SHA-256 verified source/Excel delta; no eval or network."""
from pathlib import Path, PurePosixPath
import base64, hashlib, io, json, lzma, re, zipfile

ROOT = Path.cwd().resolve()
STAGE = ROOT / '.delivery/acoustique'
EXPECTED = '4b7089547974b47b614fb8d8e389c2f165f5f2f22a425b5f0314d1db1ba32232'

def digest(value): return hashlib.sha256(value).hexdigest()
def path(value):
    p = PurePosixPath(value)
    if p.is_absolute() or '..' in p.parts or not p.parts:
        raise ValueError('Unsafe path')
    if value not in ('README.md', 'package.json') and p.parts[0] not in ('app', 'docs', 'scripts', 'src', 'tests'):
        raise ValueError('Unapproved path: ' + value)
    result = ROOT.joinpath(*p.parts)
    if not result.resolve().is_relative_to(ROOT) or result.is_symlink():
        raise ValueError('Path escapes checkout: ' + value)
    return result

def reconstruct(parts, original):
    result = []
    for part in parts:
        if isinstance(part, str): result.append(part)
        elif isinstance(part, list) and len(part) == 2 and all(type(v) is int for v in part) and 0 <= part[0] <= part[1] <= len(original):
            result.append(''.join(original[part[0]:part[1]]))
        else: raise ValueError('Invalid delta slice')
    return ''.join(result).encode('utf-8')

encoded = ''.join(''.join((STAGE / f'part{i}.b64').read_text().split()) for i in (1, 2))
raw = lzma.decompress(base64.b64decode(encoded, validate=True))
if digest(raw) != EXPECTED: raise ValueError('Transport fingerprint mismatch')
data = json.loads(raw)
if data['base'] != '0a3ba7f8cb5d6182aa5a838471ebf2b9204f79dc' or len(data['records']) != 22:
    raise ValueError('Unexpected source revision or record count')
planned = {}
for record in data['records']:
    name = record['path']; destination = path(name); source = path(record['source'])
    if name in planned: raise ValueError('Duplicate file')
    if destination.exists() and name != record['source']:
        raise ValueError('New destination already exists: ' + name)
    before = source.read_bytes() if source.exists() else b''
    if digest(before) != record['before']: raise ValueError('Source drift: ' + name)
    after = reconstruct(record['parts'], before.decode('utf-8').splitlines(keepends=True))
    if digest(after) != record['after']: raise ValueError('Result fingerprint mismatch: ' + name)
    planned[name] = after

book = data['workbook']; output = path(book['output'])
if output.exists(): raise ValueError('Current acoustic workbook already exists')
if len(book['parts']) != 33: raise ValueError('Unexpected workbook structure')
split_xml = lambda text: re.split(r'(?=<x:c\b|<x:row\b|<c\b|<row\b|<Relationship\b|<x:xf\b)', text)
seen = set(); result = io.BytesIO()
with zipfile.ZipFile(path(book['source'])) as old, zipfile.ZipFile(result, 'w', zipfile.ZIP_DEFLATED) as new:
    for record in book['parts']:
        name = record[0]; member = PurePosixPath(name)
        if member.is_absolute() or '..' in member.parts or name in seen:
            raise ValueError('Invalid workbook member')
        seen.add(name)
        before = old.read(name) if name in old.namelist() else b''
        if digest(before) != record[1]: raise ValueError('Workbook source drift: ' + name)
        if record[2] is None: after = before
        else:
            after = reconstruct(record[3], split_xml(before.decode('utf-8')))
            if digest(after) != record[2]: raise ValueError('Workbook result changed: ' + name)
        new.writestr(name, after)
planned[book['output']] = result.getvalue()
# Nothing is written until every source, result and exported XML part verifies.
for name, content in planned.items():
    target = path(name); target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(content)
print(json.dumps({'restored_files': len(planned), 'workbook_parts_verified': len(seen), 'runtime': 108,
                  'remaining': 12, 'workbook': book['output'], 'workbook_sha256': digest(result.getvalue())}))
