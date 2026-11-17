# Reprise du lot navigation — 17 novembre 2026

Point exact repris : `184bc694791eb1ec393ffa5de16b954b12cbb39d` sur `continuation/navigation-20261117`. Le lot avait déjà été appliqué, le transport retiré et les six classeurs validés ; le run 44049130077 s’arrêtait au typage avant les tests et compilations. Il n’est pas réappliqué.

## Correction de compilation

`topDialog` demandait tout `ParentNode`, alors qu’il ne lit que `querySelector`. Les déclarations combinées DOM et Worker du projet rendent la méthode `append` de `HTMLElement` incompatible avec celle de `ParentNode`. Le contrat est réduit à `Pick<ParentNode, 'querySelector'>`, sans assertion `any`, suppression de diagnostic, changement de dépendance ou nouveau comportement de sélection. Les deux appels réels (document et racine HTML) restent soumis au typage complet.

## Vérification permanente

Le workflow temporaire d’écriture est supprimé. La CI habituelle doit contrôler le typage, toutes les suites antérieures, `test:menus`, `test:browser-menus`, les six validateurs de classeurs, trois builds et l’archive extraite du SHA exact. Le rapport de navigation et ses captures sont conservés même en échec. Les règles, les cinq lieux, les textes A/B et les anciens classeurs ne sont pas modifiés par cette correction.

La recette navigateur utilise les vrais événements clavier et le vrai DOM du jeu compilé, avec un contrôleur standard simulé. Elle ne certifie ni une manette physique, ni un lecteur d’écran, ni le confort ou les performances d’un appareil réel. La compilation seule n’est pas la recette du lot ; consulter la CI du commit final.

Références : https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys et https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ .

## Reprise après l’échec du lanceur navigateur

Le run 44052680376 (`26a7670`) passe le typage, les suites de données, les six validateurs et les trois compilations. Il échoue avant toute étape navigateur : aucun port CDP détecté au bout des 10 secondes prévues. Ce résultat n’est pas présenté comme un succès du scénario. Le lanceur utilise désormais un seul délai monotone borné à 30 secondes, conserve les 8 Kio finaux du stderr de son processus jetable about:blank et signale les échecs de lancement/sortie. Aucune relance automatique, réduction graphique ou assertion retirée.

Le lancement local du navigateur fonctionne ; cela ne démontre pas encore le comportement du jeu compilé. Le résultat de la CI du nouveau commit reste requis.
