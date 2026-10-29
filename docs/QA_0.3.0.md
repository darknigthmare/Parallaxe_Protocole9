# Bilan de vérification — PARALLAXE v0.3.0

**27 octobre 2026. 80 contrôles automatisés réussis**, auxquels s’ajoutent le typage strict, les deux compilations, le serveur portable avec deux clients HTTP et l’aller-retour du modèle GLB. Ce rapport distingue les résultats exécutés des essais qui demandent encore les appareils des joueurs.

## Périmètre de la version

Le catalogue compte **81 anomalies intégrées : 69 visuelles et 12 radio**, réparties dans Saint-Clair, Terminus 09 et Aile blanche. La conception conserve 120 fiches ; **39 restent prévues**. Les pools se recoupent : hôtel 63, métro 47, clinique 47. Leur somme n’est pas un nombre d’anomalies uniques.

Les 27 nouvelles fiches couvrent six effets radio, cinq altérations du corps, deux altérations du reflet, quatre repères du métro, trois de la clinique et sept objets de l’hôtel. Les lectures agrandies reprennent les valeurs de la perception locale ; les pings ne partagent que l’identifiant de l’objet. Une inscription plausible sur un document relationnel ne donne pas, à elle seule, le verdict de l’équipe.

Sources : [catalogue exécuté](runtime-catalog.json), [règles](../src/game/rules.ts), [notes de version](RELEASE_0.3.0.md), [rapport de livraison](qa-final-v0.3.0.json).

## Contrôles exécutés sur cette version

| Domaine | Résultat | Portée et limite |
| --- | --- | --- |
| Règles et sessions | **18/18** | Couverture des 81 IDs dans leurs lieux, témoins et observateurs normaux de deux à quatre joueurs, référence, campagne, erreurs, victoire, migration, consensus, départs, actions authentifiées et pings sans lecture privée. Ce sont des contrôles de domaine, sans quatre écrans rendus. |
| Scène et personnages | **18/18** | Géométrie et normales finies, 69 effets appliqués puis réinitialisés, raycasts, passages, collisions, gestes, code de badge, reflet assis, miroirs sans récursion, repli solo, homonymes et nettoyage. Renderer, dessin Canvas et PMREM simulés ; aucun pixel certifié. |
| Nouveaux objets hôtel | **8/8** | Les seize combinaisons ordinaires de documents sont représentables ; projections privées, référence, sept cibles accessibles, grains et vapeur réellement inversés, duplication de clé, lectures indépendantes et destruction des ressources. |
| Radio | **32/32** | Les 19 régressions et 13 nouveaux contrôles de buffers PCM, graphe audio, réception, annulation et accessibilité. Les buffers analysés sont produits par le générateur réellement utilisé. Les API de périphériques et de navigateur restent simulées. |
| Contrôleur UI radio | **4/4** | Invalidation des demandes, reprise récente préservée, erreurs anciennes ignorées, sortie et démarrage dans le geste utilisateur. Le branchement React a aussi été relu ; cela ne remplace pas une recette DOM réelle. |
| TypeScript | **Réussi** | `npm run typecheck`, avec la configuration stricte du projet, après la correction des cibles d’inspecteur. |
| Build portable | **Réussi** | `npm run build:local`, après le correctif final de la scène. |
| Build hébergé | **Réussi** | `npm run build`, après le même correctif. Le compilateur signale un module de scène supérieur à 500 Ko ; ce résultat ne mesure pas les FPS. |
| Serveur portable | **Réussi** | Serveur réel sans `node_modules`, deux clients authentifiés, référence puis inspection, comparaison des projections complètes, unanimité correcte et départs. Les chemins privés normalisés sont refusés et les assets publics restent servis. |
| Modèle GLB | **Réussi** | Export puis lecture par `GLTFLoader`, 53 990 triangles, 58 maillages, 12 nœuds articulés et trois clips ; sommets finis. Aucun rendu GPU ou import dans un moteur externe certifié. |

Les suites figurent dans [tests](../tests/), ainsi que dans [.github/workflows/ci.yml](../.github/workflows/ci.yml). Les preuves détaillées sont [scène](qa-scene-v0.3.0.json), [objets](qa-inspection-v0.3.0.json), [radio](qa-radio-v0.3.json) et [serveur portable](qa-portable-path-v0.3.0.json).

## Corrections issues de la revue croisée

### Cibles de badge indépendantes du nom

La première intégration recherchait le modèle à partir du nom affiché. Deux joueurs nommés « Inspecteur » pouvaient donc lire le badge du même modèle. Un nom identique au libellé du double pouvait sélectionner le personnage fictif.

Chaque cible utilise maintenant un type de corps et un identifiant stable. La régression couvre deux homonymes avec des badges distincts, un badge absent sur un seul homonyme, les noms identiques aux libellés du double et du corps local, puis le départ du joueur ciblé. L’inspection ne se reporte pas sur un autre corps après ce départ. La correction résout aussi le contrôle de nullité TypeScript du callback.

### Protection des modules du serveur portable

L’ancien blocage de `/server/` intervenait avant la résolution du chemin. Une requête contenant des séparateurs encodés a été reproduite sur une copie temporaire de notre serveur : elle renvoyait le module compilé `session.mjs` avec un statut 200. Aucune session utilisateur n’a été demandée ou lue.

Le contrôle de racine et l’exclusion du répertoire serveur interviennent désormais après normalisation. Dix variantes GET et une requête HEAD sont refusées ; la traversée hors racine est refusée ; page, JavaScript, CSS et un répertoire public au nom voisin restent accessibles. Les essais HTTP ont été exécutés sous Linux avec Node 24.22.1. Les opérations de chemin Windows ont été vérifiées séparément, sans revendiquer une exécution sur Windows natif.

### Éléments de scène et distribution

Le panneau SYNCHRO a été déplacé pour rester accessible à côté du nouveau bureau. La matrice du badge est restaurée immédiatement après la capture du miroir. Les lettrages Canvas sont retirés du GLB après l’échantillonnage des animations, car cette étape rétablit désormais le badge courant. Le paquet PC inclut également les captures documentaires référencées par les rapports historiques.

## Géométrie et modèle livré

| Géométrie stockée | Triangles |
| --- | ---: |
| Saint-Clair, effets inactifs et éléments communs inclus | 235 744 |
| Terminus 09, même périmètre | 93 706 |
| Aile blanche, même périmètre | 117 547 |
| Un inspecteur | 53 990 |
| Ensemble de la scène, lieux et corps de remplacement inclus | 535 035 |

La scène stocke 974 maillages. Six surfaces planaires sont définies, dont deux actives par lieu. **Ces chiffres ne sont pas des compteurs de rendu par image, ni une mesure de performance.**

Le [manifeste GLB](../public/models/inspecteur-parallaxe.manifest.json) indique la version 0.3.0 et l’empreinte du fichier source d’avatar. Le modèle utilise des pièces rigides articulées et les clips Marche, Radio et Salut. Les lettrages de badge, sprites de noms et effets de perception restent gérés dans le jeu ; ils ne sont pas embarqués comme textures ou logique dans l’export.

## Radio : preuve numérique et écoute réelle

Le signal normal contient un clic d’ouverture, le code RELAIS en DTMF, la séquence 1–2–3 et le clic de fermeture. Les nouveaux cas suppriment ce dernier clic, changent le code, utilisent seulement la gauche, prolongent la réverbération, inversent l’ordre en 1–3–2 ou ajoutent un quatrième souffle.

Les analyses PCM vérifient les fréquences et leur ordre, l’énergie des clics, un canal droit nul, une vraie queue de réverbération et la présence de la quatrième impulsion. Contre-code et ordre inversé modifient la calibration synthétique ; ils ne réécrivent pas la parole. Les autres nouveaux profils affectent aussi la réception vocale.

Le bouton d’arrêt annule la source et les préparations anciennes. L’option mono conserve l’indice écrit du routage généré. Aucun de ces résultats ne mesure un casque, l’intelligibilité d’une conversation ou un trajet TURN réel. Les protections de consentement et de permission tardive de la v0.2.1 restent couvertes.

## Navigateur et preuves historiques

La route retournée par l’aperçu local a refusé la connexion du navigateur (`ERR_CONNECTION_REFUSED`). Le statut du service était encore « running », sans cause de code établie. L’essai a été arrêté ; aucun réglage de navigateur, d’isolation ou de sécurité n’a été contourné. **Aucune nouvelle validation visuelle, WebGL, microphone physique ou liaison vocale connectée n’a été obtenue.** Voir [le rapport navigateur v0.3.0](qa-browser-v0.3.0.json).

Les essais D1 à quatre clients, l’interface dans deux onglets, le GPU désactivé et l’absence de candidats ICE sont des preuves **historiques v0.2**, non relancées ici. Le [bilan v0.2.1 archivé](QA_0.2.1.md) et les rapports [D1](qa-network-v0.2.json) et [navigateur radio](qa-radio-browser-v0.2.json) en conservent le contexte. Ils ne prouvent pas une nouvelle session vocale réussie en v0.3.0.

## Classeur et livraison

Le classeur conserve 120 fiches avec distinction entre « Implémenté — QA partielle » et « Prévu ». Son export, ses formules, listes de validation, comptes et rendus sont suivis dans [workbook-validation.json](workbook-validation.json), [workbook-structure-validation.json](workbook-structure-validation.json) et [workbook-visual-review.json](workbook-visual-review.json).

Les deux ZIP et les classeurs embarqués passent les contrôles CRC. Le ZIP des sources contient **185 fichiers**, tous identiques au projet ; le paquet PC contient **52 fichiers**, dont les assets compilés, le modèle, le classeur, les documents et le ZIP des sources. Les chemins et exclusions sont contrôlés. **Le jeu extrait a été lancé sans dépendances et testé avec deux clients**, jusqu’au diagnostic unanime et au départ ; les protections des chemins privés ont également réussi. Le rapport [qa-final-v0.3.0.json](qa-final-v0.3.0.json) conserve l’empreinte des fichiers exécutables testés. Les empreintes finales des archives sont calculées séparément après inclusion de ce bilan, pour éviter un hash autoréférent.

L’outil GitHub a rejeté l’appel d’envoi d’un blob avec « user rejected MCP tool call ». La publication de cette version sur le dépôt reste en attente de cette autorisation ; aucune CI distante v0.3.0 n’est revendiquée. Le workflow fourni pourra s’exécuter sur le commit autorisé.

## Essais encore nécessaires sur les appareils cibles

1. Parcourir les trois lieux sur un GPU fonctionnel ; vérifier pixels, éclairage, visibilité des indices, badges, reflets, tabouret, objets et textes agrandis.
2. Déclencher les 69 effets visuels et les preuves relationnelles, comparer deux puis quatre vues, revenir à une référence propre et mesurer le confort et les FPS dans les trois qualités.
3. Écouter les douze profils radio et leur référence avec du matériel réel, en stéréo puis en mono, et vérifier l’intelligibilité et le volume.
4. Mener une conversation à deux puis quatre appareils : consentement, PTT, perte de focus, sortie, permission tardive, changement de lieu et reconnexion.
5. Tester le LAN en HTTPS approuvé puis des réseaux distincts avec TURN opérationnel ; mesurer latence et écho et vérifier expiration des identifiants.
6. Terminer une campagne avec de vrais joueurs, tester désaccords, reprise, changement d’hôte et absence du témoin ; essayer clavier, tactile et manette sur les plateformes visées.

Ces essais restants sont suivis dans le classeur. La présence d’une fonctionnalité dans le catalogue n’est pas une validation complète sur appareil.
