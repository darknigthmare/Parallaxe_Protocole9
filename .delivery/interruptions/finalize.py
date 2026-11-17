"""Complete the existing interruption lot; do not alter geometry or game rules."""
from pathlib import Path
from hashlib import sha256

def patch(name, expected, replacements):
    p=Path(name)
    data=p.read_bytes()
    assert sha256(data).hexdigest()==expected, 'Source drift: '+name
    text=data.decode('utf8')
    for old,new in replacements:
        assert text.count(old)==1, (name,old)
        text=text.replace(old,new)
    p.write_text(text,encoding='utf8')

patch('scripts/qa-native-browser.mjs','94af842ce945ad37d91a56c28c922e3651fa54589f6af0e32cc0a15726f8c115',[
("  const call=(method,params={})=>new Promise((resolve,reject)=>{\n   const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);",
 "  // Restored software WebGL may need shader warm-up before a surface capture.\n  // Keep ordinary commands strict; never retry a failed capture as a passing test.\n  const call=(method,params={})=>new Promise((resolve,reject)=>{\n   const timeout=method==='Page.captureScreenshot'?60000:15000;\n   const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},timeout);"),
("{format:'png',captureBeyondViewport:false}","{format:'png',captureBeyondViewport:false,optimizeForSpeed:true}")])

patch('tests/browser-runtime.mjs','1ec0e4bc2feb6f680b2ddc6de0868c159b05a89e04bfe17582330cc80751d81d',[
("window.__p9qa={errors:[],microphoneRequests:0};", "window.__p9qa={errors:[],microphoneRequests:0,draws:0};for(const method of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=WebGL2RenderingContext.prototype[method];WebGL2RenderingContext.prototype[method]=function(...args){const result=original.apply(this,args);if(!this.isContextLost())__p9qa.draws++;return result;};}"),
(" report.renderer=await browser.evaluate", " report.browser=await browser.call('Browser.getVersion');\n report.renderer=await browser.evaluate"),
(" await writeFile(resolve(out,'01-reference.png'),await browser.screenshot());", " const captures=[];\n const capture=async name=>{const start=performance.now();const png=await browser.screenshot();assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),1280);assert.equal(png.readUInt32BE(20),800);await writeFile(resolve(out,name),png);captures.push({file:name,width:1280,height:800,bytes:png.length,captureMs:Math.round(performance.now()-start)});};\n report.captures=captures;\n await capture('01-reference.png');"),
(" await writeFile(resolve(out,'02-context-lost.png'),await browser.screenshot());", " await capture('02-context-lost.png');"),
(" await browser.evaluate(\"document.querySelector('.modal-pause .solid-button').click()\");", " await browser.evaluate(\"__p9qa.beforeResume=__p9qa.draws;document.querySelector('.modal-pause .solid-button').click()\");"),
(" await sleep(300);", " await browser.waitFor('__p9qa.draws>__p9qa.beforeResume',30000);"),
(" report.checks.push('explicit resume restores drawing without microphone requests or uncaught browser errors');\n await writeFile(resolve(out,'03-restored-reference.png'),await browser.screenshot());", " report.checks.push('explicit resume issues fresh WebGL drawing calls without microphone requests or uncaught browser errors');\n await capture('03-restored-reference.png');\n assert.equal(await browser.evaluate(\"document.querySelector('canvas').getContext('webgl2').isContextLost()\"),false);\n assert.equal(await browser.evaluate('__p9qa.checkpoint===localStorage.getItem(\"parallaxe-training\")'),true);\n assert.equal(await browser.evaluate('__p9qa.microphoneRequests'),0);\n assert.deepEqual(await browser.evaluate('__p9qa.errors'),[]);\n report.checks.push('all three 1280x800 PNG captures complete and post-capture state remains valid');")])
p=Path('docs/QA_INTERRUPTION_20261116.md')
assert sha256(p.read_bytes()).hexdigest()=='8b8eabd701ab7129d3fb89daacdfb55e27ade87892005713c293901382be4ef7'
p.write_text(p.read_text()+'''\n## Reprise exacte du 17 novembre 2026\n\nLe deuxième essai (43963401167, de30f8c) avait réussi les cinq contrôles de perte, restauration et reprise volontaire, puis la capture finale a dépassé le délai CDP uniforme de 15 secondes. Sa capture de diagnostic montre le décor revenu. Cela ne suffit pas à déclarer cette recette réussie.\n\nLe délai des captures est maintenant borné à 60 secondes, sans relance automatique ; les autres commandes gardent 15 secondes. L'encodage PNG utilise optimizeForSpeed. Le rapport conserve navigateur, pilote logiciel, dimensions et durées de capture (qui ne sont pas des temps d'image). La recette exige de nouveaux appels de dessin WebGL après la reprise, les trois PNG complets et une nouvelle vérification de la sauvegarde, du contexte, des exceptions et des demandes de micro après la dernière capture. Aucun détail graphique ni résolution du jeu n'est réduit. Les résultats finaux sont ceux du commit exact, pas ceux des deux essais interrompus.\n\nRéférences du protocole : https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot et https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate .\n''',encoding='utf8')
print('PASS: focused capture budget, fresh drawing guard and post-capture verification applied')
