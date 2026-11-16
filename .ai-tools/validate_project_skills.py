#!/usr/bin/env python3
"""Read-only validation of our local workflows; never assert agent/plugin activation."""
from pathlib import Path
import hashlib, json, re, sys
ROOT=Path(__file__).resolve().parents[1]
def audit(root=ROOT):
    root=Path(root).resolve();manifest=json.loads((root/'.ai-tools/project-skills.json').read_text(encoding='utf8'))
    if manifest.get('schema')!=1:raise ValueError('Unknown skill manifest')
    seen=set();names=[]
    for record in manifest['skills']:
        name=record['name']
        if not re.fullmatch(r'p9-[a-z0-9-]+',name) or name in names:raise ValueError('Duplicate/invalid skill name')
        names.append(name);expected=[f'{host}/skills/{name}/SKILL.md' for host in ('.agents','.claude')]
        if record['paths']!=expected:raise ValueError('Unexpected skill destinations')
        buffers=[]
        for relative in expected:
            p=root/relative
            if any(x.is_symlink() for x in [p,*p.parents] if x!=root.parent):raise ValueError('Skill symlink not permitted')
            if not p.resolve().is_relative_to(root):raise ValueError('Skill escapes repository')
            data=p.read_bytes();text=data.decode('utf8');buffers.append(data);seen.add(relative)
            if hashlib.sha256(data).hexdigest()!=record['sha256']:raise ValueError('Changed skill: '+relative)
            if not text.startswith('---\n') or f'\nname: {name}\n' not in text or not re.search(r'\ndescription: "[^\n]+"\n',text):raise ValueError('Invalid SKILL frontmatter')
            if len(text)<500:raise ValueError('Incomplete workflow')
        if buffers[0]!=buffers[1]:raise ValueError('Codex/Claude drift')
    return {'result':'PASS','names':names,'skills':len(names),'files':len(seen),'read_only':True,'runtime_verified':False,'external_plugins_installed_by_this_change':False}
if __name__=='__main__':
    try:print(json.dumps(audit(),ensure_ascii=False))
    except (OSError,ValueError,KeyError,TypeError) as e:print(str(e),file=sys.stderr);sys.exit(1)
