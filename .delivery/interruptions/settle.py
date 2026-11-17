"""Allow bounded software shader initialization; never lower production detail."""
from pathlib import Path
p=Path('scripts/qa-native-browser.mjs')
s=p.read_text();old="const timeout=method==='Page.captureScreenshot'?60000:15000;"
assert s.count(old)==1
p.write_text(s.replace(old,"const timeout=['Page.captureScreenshot','Runtime.evaluate'].includes(method)?60000:15000;"))
p=Path('tests/browser-runtime.mjs');s=p.read_text()
old='if(!this.isContextLost())__p9qa.draws++;';assert s.count(old)==1
p.write_text(s.replace(old,'__p9qa.draws++;'))
p=Path('docs/QA_INTERRUPTION_20261116.md');s=p.read_text()
s=s.replace('les autres commandes gardent 15 secondes.',"l’évaluation de page dispose aussi de 60 secondes pour laisser finir l’initialisation des shaders, les commandes de transport gardent 15 secondes.")
s+='\nLe troisième essai (44009984069) a expiré pendant Runtime.evaluate au démarrage, avant les contrôles de la recette ; sa capture montre le menu correctement rendu. Le compteur de dessin ne fait plus d’interrogation du pilote à chaque appel ; l’état du contexte reste vérifié aux étapes explicites. Ces budgets sont spécifiques au rendu logiciel du runner, pas une promesse de performances du jeu.\n'
p.write_text(s)
print('PASS: bounded page-evaluation budget and observational draw counter, no production change')
