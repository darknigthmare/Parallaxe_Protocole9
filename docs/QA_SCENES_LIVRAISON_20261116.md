# Reprise scènes et téléchargements — 16 novembre 2026

Base exacte : `820d57c0f9888937c16db48becd7e51c6d74e1e8` sur main, correctif de provenance précédemment interrompu. Sa CI 43917750231 est terminée avec succès. Vercel a finalement produit la production READY `dpl_HvjPfvoGPBMBhg1q9dgfm7cCTRDD` pour cette révision ; l’ancien refus de quota ne doit pas être présenté comme l’état actuel.

## W12 — Construire les décors au premier passage

Saint-Clair et les équipements communs restent construits au démarrage. Métro, clinique, Chalet et Observatoire sont créés à leur première visite puis conservés jusqu’à la destruction de la scène. Les changements de qualité s’appliquent aussi aux nouveaux miroirs. Aucun maillage, indice, collision ou lieu n’est supprimé ; il ne s’agit pas d’un LOD ou d’une baisse de qualité.

Inventaire CPU, rendu WebGL simulé, aucun test GPU :

| Indicateur | Base 820d57c | Nouveau démarrage | Après visite des cinq lieux |
| --- | ---: | ---: | ---: |
| Triangles cumulés des objets construits, même inactifs | 617631 | 445010 | 617631 |
| Objets maillés | 1604 | 1186 | 1604 |
| Surfaces réfléchissantes allouées | 10 | 2 | 10 |

Les géométries peuvent être partagées : cet inventaire n’est ni le nombre de triangles affichés dans une image ni une mesure de mémoire GPU. Les autres lieux sont indiqués « non construits » dans le diagnostic, pas « zéro triangle ». Le coût de leur première création est reporté à la première visite ; il reste à mesurer sur matériel réel. Après toutes les visites, le coût de conservation redevient celui de la base.

Une texture de code RELAIS d’un décor caché n’est plus régénérée lorsque le joueur observe un autre lieu. Elle reçoit le bon code avant le premier rendu au retour et son ancienne texture est libérée une seule fois.

## W13 — Référence et cycle de vie

Un changement de session/passage invalide immédiatement le support sélectionné et l’historique du reflet, même avant la prochaine image ; la chronologie d’environnement repart aussi sur son nouveau contexte. Les transitions de lieu, phase et boucle invalident également la sélection. La comparaison A/B à contexte identique conserve volontairement le support pour pouvoir lire les deux perceptions.

Dix contrôles ajoutés à la suite de scène (52 → 62) : démarrage réduit, première visite/réutilisation/qualité, RELAIS caché, référence restaurée après retour dans chacun des quatre lieux secondaires, sélection périmée, destruction d’une scène limitée à l’hôtel ou à l’hôtel + Observatoire. Les tests de réinitialisation comparent visibilité, matériaux et transformations des supports inspectables ; l’animation ambiante normale n’est pas figée pour faire passer la recette. Les parcours et anciens tests de scène restent exécutés.

## W22 / W23 — Des téléchargements liés à la bonne révision

Le panneau Archives ne propose plus deux noms de ZIP 0.4.1 fixes. Il lit l’identité publique du build, puis :

- en édition web, propose le source GitHub du SHA exact et les vérifications CI filtrées sur ce SHA pour trouver le paquet PC/LAN ;
- en édition portable, propose le source embarqué seulement si son manifeste est propre et concorde avec le SHA et la version, sinon le source GitHub exact ;
- sans identité valide, affiche l’incertitude et un accès général aux livraisons, jamais une archive historique présentée comme actuelle.

Les artefacts CI demandent une connexion GitHub et sont conservés 14 jours selon le workflow. Ce lien n’est pas un téléchargement direct garanti : aucun artefact peut n’être disponible, avoir expiré ou être encore en vérification. Le document de conception préexistant est explicitement nommé historique.

Seuls des chemins fixes et des URL construites depuis le dépôt autorisé sont utilisés. Les métadonnées sont limitées à 8 Kio, sans identifiant de connexion, avec redirections refusées, délai de six secondes dans le panneau et annulation à sa fermeture. Le SHA-256 affiché est celui annoncé par le manifeste ; le navigateur ne prétend pas avoir recalculé le ZIP avant clic. La recette du paquet, elle, télécharge le vrai source depuis son serveur HTTP et recalcule l’empreinte.

Le build supprime les anciens ZIP et leurs anciens manifestes de sa copie de public/downloads. Les originaux historiques du dépôt et les classeurs ne sont pas effacés. Douze tests de politique/chargement, un test de nettoyage et un test des callbacks du panneau ont été ajoutés. Deux contrôles de sortie compilée vérifient séparément Vercel et portable avant que la compilation suivante ne remplace leur dossier commun.

## Preuves et limites

Les suites CPU locales du jeu et les cinq skills P9 passent. Le composant est exercé avec hooks simulés : ce n’est pas une capture réelle du navigateur. La compilation Vite complète et le test de fonction Vercel compilée ne sont pas disponibles dans le conteneur local sans ses dépendances réseau ; la CI du commit livré fait autorité pour le typage, les trois builds et le paquet extrait.

Le catalogue reste à 119/120, les textes A/B et les 600 clés sont inchangés, aucun des 28 lots n’est déclaré entièrement clôturé. `hall_stretch` demeure exclu. Rendu GPU, coût réel de première visite, FPS, audio humain, manette physique, TURN inter-réseaux et lanceur Windows restent à réceptionner.
