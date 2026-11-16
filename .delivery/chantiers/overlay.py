#!/usr/bin/env python3
"""Recover the interrupted JSX fix and add its regression before any branch write."""
from pathlib import Path
import hashlib
p=Path('app/controller-navigation.tsx')
b=p.read_bytes()
assert hashlib.sha256(b).hexdigest()=='4434ce99aeb4ac802c544b3e5ebecaec426c996c18d55dc7b2c4831ad6cdbb6e'
s=b.decode();old='edit:()=>{}});e.stopPropagation();}}>';new='edit:()=>{}});e.stopPropagation();}}}>'
assert s.count(old)==1
p.write_text(s.replace(old,new))
assert hashlib.sha256(p.read_bytes()).hexdigest()=='1a6749121e8d80f6481041577156c22fdac0d3e9a4cecbf1f2fc2f8cab808492'
p=Path('tests/utility-ui.test.mjs')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='e31e61e4c30fa9fa5b52ba83ba19b330f0f6293791d3a0348cc197e7a1a2ce0e'
p.write_text(p.read_text()+'''

test('all new UI modules and Game have no TypeScript/JSX syntax diagnostics',async()=>{
  for(const name of ['controller-navigation','training-storage','performance-settings','game']){
    const source=await readFile(new URL(`../app/${name}.tsx`,import.meta.url),'utf8');
    const result=ts.transpileModule(source,{fileName:name+'.tsx',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
    const errors=(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
    assert.deepEqual(errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[],name);
  }
});
''')
p=Path('docs/REPRISE_CHANTIERS_20261116.md')
assert not p.exists()
p.write_text('''# Reprise des chantiers — 16 novembre 2026

Base source : a73add4b2cd56524f07f2034505deb44dbf8f5cf. Le commit de transport 46f0d60 n’avait pas appliqué le lot : la compilation s’arrêtait sur une accolade JSX manquante dans le clavier virtuel.

Cette reprise corrige le composant et ajoute un test des diagnostics de syntaxe de tous les nouveaux panneaux et de leur intégration Game. Le contrôle TypeScript complet reste obligatoire. Les tests de callbacks seuls n’étaient pas suffisants.

Le lot récupéré traite la navigation des menus à la manette avec retour au neutre, l’import/export confirmé des points de reprise solo, et une capture locale des temps d’images et des compteurs de rendu. Le registre de 28 lots et les 600 clés sont conservés. Le classeur nommé Chantiers du 12 novembre reste l’édition documentaire récupérée, pas un faux nouvel essai matériel daté du 12.

Les validations GPU, manette physique, audio, TURN inter-réseaux, coopération humaine et lanceur Windows restent ouvertes. Le compteur reste 119/120 ; hall_stretch demeure exclu. Les résultats de CI doivent être attachés au commit final exact. Cette reprise ne fusionne pas main et ne publie pas le jeu.
''')
print('PASS: controller JSX fixed; syntax regression and dated recovery note added')
