#!/usr/bin/env python3
"""Apply reviewed input validation fixes to the restored lot, not to unrelated files."""
from pathlib import Path
from hashlib import sha256

def read(name,expected):
    p=Path(name);b=p.read_bytes()
    assert sha256(b).hexdigest()==expected, 'Source drift: '+name
    return p,b.decode('utf8')
def one(s,old,new):
    assert s.count(old)==1, 'Missing or ambiguous replacement'
    return s.replace(old,new)

p,s=read('src/game/gamepad-menu.ts','7f24662dcc7e8d54b3c010be2c5626e65499c741ffbb4d8787e8321dbb11d786')
s=one(s,'const select=current as HTMLSelectElement,options=', '// tagName is checked above; worker and browser DOM declarations coexist in this project.\n      const select=current as unknown as HTMLSelectElement,options=')
p.write_text(s)

p,s=read('src/game/training-backup.ts','155e390af84f088d85acc460a411912f46cfa49d8492e0ae36c8a3210602e3d0')
s=one(s,"!['campaign','single'].includes(String(p.mode))||!isLevelId(p.levelId)||!['standard','relaxed'].includes(String(p.difficulty))", "(p.mode!=='campaign'&&p.mode!=='single')||!isLevelId(p.levelId)||(p.difficulty!=='standard'&&p.difficulty!=='relaxed')")
s=one(s,'!ANOMALY_BY_ID[id]','!Object.hasOwn(ANOMALY_BY_ID,id)')
s=one(s,'!!ANOMALY_BY_ID[id]','!!Object.hasOwn(ANOMALY_BY_ID,id)')
s=one(s,'&&ANOMALY_BY_ID[x]','&&Object.hasOwn(ANOMALY_BY_ID,x)')
s=one(s,"typeof text!=='string'||text.length>BACKUP_LIMIT", "typeof text!=='string'||(text.length>BACKUP_LIMIT||new TextEncoder().encode(text).byteLength>BACKUP_LIMIT)")
p.write_text(s)

p,s=read('tests/training-backup.test.mjs','a0fa74ad0240b3e22ec13e1386f7295f0ac48cb10d0f1172f6c9dac1c99775ca')
s+='''

test('import rejects coerced array modes and difficulties instead of bypassing checkpoint guards',()=>{
  for(const patch of [{mode:['campaign']},{mode:['single']},{difficulty:['standard']},{difficulty:['relaxed']}]){
    assert.throws(()=>readTrainingBackup(encode({...backup(),progress:{...backup().progress,...patch}})),/non reconnu/);
  }
});
test('only own runtime IDs may enter discoveries, never Object prototype properties',()=>{
  for(const id of ['toString','constructor','__proto__','hasOwnProperty']){
    assert.throws(()=>readTrainingBackup(encode({...backup(),archives:[id]})),/découvertes/);
    assert.deepEqual(createTrainingBackup(null,[id,discovered]).archives,[discovered]);
    const store=storage(createRun({seed:'old'}),[id]);
    assert.deepEqual(importTrainingBackup(store,backup(),'fresh').known,[discovered]);
  }
});
test('the 64 KiB parser limit counts UTF-8 bytes, not only code units',()=>{
  const text=JSON.stringify({format:'é'.repeat(40000),progress:null,archives:[]});
  assert.ok(text.length<65536);
  assert.throws(()=>readTrainingBackup(text),/trop volumineux/);
});
'''
p.write_text(s)

p,s=read('tests/gamepad-menu.test.mjs','b947fdc845a00139d3686c49d93a28155d2e26dd016c4c277625edfb66093e55')
s+='''

test('select navigation skips disabled options, clamps boundaries and dispatches change',()=>{
  const previous=globalThis.document;
  class Select{
    tagName='SELECT';stored='low';events=[];
    options=[{value:'low',disabled:false},{value:'unused',disabled:true},{value:'high',disabled:false}];
    get value(){return this.stored;}set value(v){this.stored=v;}
    matches(s){return s==='input[type="range"],select';}
    getClientRects(){return [{}];}closest(){return null;}getAttribute(){return null;}
    dispatchEvent(e){this.events.push(e.type);}
  }
  const select=new Select(),root={querySelectorAll:()=>[select]};
  globalThis.document={activeElement:select};
  try{
    const hooks={back(){throw new Error('unexpected back');},edit(){throw new Error('unexpected edit');}};
    navigateMenu(root,'right',hooks);assert.equal(select.value,'high');
    navigateMenu(root,'right',hooks);assert.equal(select.value,'high');
    navigateMenu(root,'left',hooks);assert.equal(select.value,'low');
    assert.deepEqual(select.events,['change','change','change']);
    select.options=[];navigateMenu(root,'right',hooks);assert.equal(select.value,'low');
  }finally{globalThis.document=previous;}
});
'''
p.write_text(s)
p=Path('docs/REPRISE_CHANTIERS_20261116.md')
p.write_text(p.read_text()+'''
## Contrôles supplémentaires de cette reprise

La compilation complète a également détecté une assertion de type ambiguë entre les déclarations DOM navigateur et Worker pour SELECT. La vérification réelle du tag est conservée avant l’assertion explicite ; une régression exerce le choix d’option, les bornes, les options désactivées et l’événement change.

Trois régressions nouvelles reproduisaient des défauts d’import avant correction : mode/difficulté sous forme de tableau converti en chaîne, propriétés héritées de Object acceptées comme identifiants et dépassement de 64 Kio en caractères UTF-8 multioctets. Les comparaisons sont désormais strictes, les découvertes doivent être des propriétés propres du catalogue et le plafond est contrôlé en octets. Les anciens fichiers valides restent compatibles. Aucune autorisation vocale ni session coopérative n’est importée.
''')
print('PASS: SELECT typing and four behavioral regressions added; strict checkpoint validation applied')
