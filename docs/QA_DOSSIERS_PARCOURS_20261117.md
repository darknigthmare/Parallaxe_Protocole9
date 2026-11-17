# Dossiers, débriefs et parcours — 17 novembre 2026

Base exacte : `5d56c3a894a7639537d3cde028185bbc9c60d883` (PR #9). Le moteur, les cinq lieux, les 119 concepts, les textes A/B et les dépendances sont conservés.

## Contenu jouable

Le carnet de chaque lieu contient une copie de consigne originale, trois paragraphes courts : relève de Saint-Clair, régulation du terminus, registre de l’aile blanche, garde du chalet, volets de l’observatoire. Les cinq textes sont communs aux témoins et ne consultent ni graine, ni anomalie, ni attribution des perceptions. Le joueur les conserve explicitement depuis un passage de référence ou d’inspection ; entrer dans un lieu ne collecte rien automatiquement. Les notes conservées sont relisibles dans les Archives, même après rechargement.

Il s’agit de correspondance remise dans le carnet, **pas de documents 3D ramassés dans le décor**. N10 reste partiel : les objets physiques à collectionner restent à produire. Les trois cinématiques et salles finales N07–N09 ne sont pas réalisées ni remplacées par ces textes. N05/N06 reçoivent un débrief textuel qui dépend seulement de la fin et des compteurs publics ; aucune mesure cachée de confiance ou culpabilité. Le mode lieu unique conserve son propre texte et ne revendique pas la certification des trois secteurs.

Le débrief paraît seulement après victoire ou défaite, jamais pendant la référence, l’inspection ou une révélation intermédiaire. Les nombres de diagnostics effectués et de réponses correctes sont distingués des neuf validations acquises. L’écran de fin reste défilable, notamment à 390×844.

## Données locales

La clé `parallaxe-field-notes` contient uniquement un format et jusqu’à cinq identifiants autorisés. Pas de nom, code de salon, graine, autorisation vocale, résultat ou date de collecte. Les notes ne modifient jamais la clé des anomalies découvertes. Un échec du stockage est indiqué et ne produit pas de fausse confirmation. La lecture depuis un autre onglet se resynchronise ; ce stockage n’est pas une base transactionnelle et n’est pas synchronisé dans le cloud. L’export solo existant n’inclut pas ces consignes : l’interface l’annonce.

Deux régressions de migration locale ont été reproduites sur la base, puis corrigées : phase tableau convertie en chaîne ; identifiants hérités (`constructor`, `toString`, `__proto__`) et propriétés étrangères du résultat conservés. Les sauvegardes valides et migrations historiques gardent leurs tests. Les modes de jeu, probabilités et scores ne sont pas changés.

## Parcours complets HTTP

`tests/http-journey.mjs` exécute les vrais endpoints via des clients séparés, sans lire le stockage ni Room. Les diagnostics de QA comparent les projections personnelles complètes, y compris les indices relationnels sans effet nommé. Les références sont identiques avant inspection ; le résultat est commun seulement après unanimité.

Le paquet PC extrait exécute deux campagnes (2 puis 4 clients) avec désaccord bloquant, correction du vote, erreur au second secteur, préservation du premier et neuf validations finales. Il exécute aussi les cinq lieux autonomes avec 2–4 clients ; le chalet subit une erreur qui remet sa série à zéro. Les paliers de campagne imposent leur nouvelle référence. Les mêmes deux campagnes et un chalet à trois clients traversent l’adaptateur Vercel compilé avec stockage REST simulé. Ce ne sont pas des joueurs humains ni un test TURN entre réseaux.

## Navigateur compilé

`tests/browser-records.mjs` sélectionne les cinq lieux par leurs vrais menus, capture leurs références, conserve chaque consigne, simule un échec d’écriture local, recharge la page et vérifie les cinq notes sans déverrouiller d’anomalie. Deux paliers solo de test, injectés uniquement dans le profil navigateur jetable, sont ensuite résolus par les commandes réelles pour éprouver victoire/défaite, débriefs et sortie en fenêtre 390×844. L’oracle de test reste dans Node, hors du jeu livré. Les captures et rapports indiquent la révision exacte.

Les recettes sont des exigences ; consulter le résultat de CI du SHA livré avant de les déclarer réussies. Le test des interruptions de la livraison précédente reste obligatoire. Chromium/SwiftShader est un rendu logiciel : aucune mesure GPU, FPS, téléphone physique, manette ou microphone n’est déduite de ces tests.

## Suivi des 28 lots

Le manifeste `docs/current-delivery.json` désigne le classeur cumulatif et le registre actuel, pour éviter de confondre les classeurs historiques datés. W05, W06, W16, W23, W26 et W28 avancent. Le nouveau classeur ajoute l’onglet Dossiers ; les données des neuf anciens onglets hors Synthèse restent identiques. Les 600 clés, 28 lots et 124 recettes humaines historiques sont conservés. Aucun lot complet n’est fermé sur la seule base de tests automatiques.

Niveaux futurs, salles finales, modèles artistiques, voix humaines, TURN, équilibrage humain et `hall_stretch` conservent leur production/recette restante. Le pointeur cumulatif ne réécrit pas le maître historique ni ne prétend rééditer tous les anciens classeurs.
