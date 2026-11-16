from pathlib import Path
from hashlib import sha256

def change(name,before,after,replacements):
    p=Path(name);data=p.read_bytes()
    assert sha256(data).hexdigest()==before, name
    text=data.decode()
    for old,new in replacements:
        assert text.count(old)==1,(name,old)
        text=text.replace(old,new)
    result=text.encode()
    assert sha256(result).hexdigest()==after,name
    p.write_bytes(result)

change('scripts/qa-native-browser.mjs','4e121ce5dd708da5f49c5daa9d46e0fb323fee61b7bb0a167ab45157808d0408','94af842ce945ad37d91a56c28c922e3651fa54589f6af0e32cc0a15726f8c115',[
 ('if(await evaluate(expression))return;','if(await evaluate(`Boolean(${expression})`))return;')])
change('tests/browser-runtime.mjs','42807dc2abfc3053dfa00eac4ecf419c0621f2bcb1b8f324f047d9cdef3b7897','1ec0e4bc2feb6f680b2ddc6de0868c159b05a89e04bfe17582330cc80751d81d',[
 (" await browser.evaluate(\"__p9qa.checkpoint=localStorage.getItem('parallaxe-training')\");"," await browser.waitFor(\"(()=>{const raw=localStorage.getItem('parallaxe-training');return raw!==null&&JSON.parse(raw).phase==='reference';})()\");\n await browser.evaluate(\"void(__p9qa.checkpoint=localStorage.getItem('parallaxe-training'))\");"),
 ("}catch(error){report.result='FAIL';report.error=String(error);throw error;}","}catch(error){report.result='FAIL';report.error=String(error);\n if(browser)try{await writeFile(resolve(out,'failure.png'),await browser.screenshot());}catch{}\n throw error;}")])
p=Path('docs/QA_INTERRUPTION_20261116.md')
assert sha256(p.read_bytes()).hexdigest()=='6cee1be699c06ab1afb8d405a25fabdd869226d4a9d78ca4442f4ebf0b9465ab'
p.write_text(p.read_text()+"\n## Correction du harnais navigateur\n\nLe premier essai CI a réellement initialisé WebGL2 avec SwiftShader, puis le harnais a échoué en tentant de sérialiser un élément DOM React complet. Les conditions d’attente sont désormais converties en booléens dans la page avant transfert CDP. La recette exige aussi une sauvegarde solo de référence non nulle avant de comparer sa conservation ; deux valeurs nulles ne peuvent pas être prises pour une preuve. Une capture d’échec facilite la revue, sans modifier les contrôles du jeu.\n")
assert sha256(p.read_bytes()).hexdigest()=='8b8eabd701ab7129d3fb89daacdfb55e27ade87892005713c293901382be4ef7'
print('PASS: bounded CDP predicate serialization and non-null checkpoint assertion')
