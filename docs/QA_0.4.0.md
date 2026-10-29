# Bilan de vérification — PARALLAXE v0.4.0

**28 octobre 2026. 189 contrôles automatisés réussis**, auxquels s’ajoutent le typage strict, les compilations locale et hébergée et l’exécution du serveur précompilé avec deux puis quatre clients HTTP. Ce rapport distingue les comportements vérifiés des essais qui nécessitent encore les appareils des joueurs.

## Périmètre

Le catalogue exécuté comprend **96 anomalies : 84 visuelles et 12 profils radio**, réparties dans quatre lieux. Les pools se recoupent : hôtel 76, métro 48, clinique 48, chalet 35. Leur somme ne représente pas des anomalies uniques. La conception conserve 120 fiches, dont **24 non implémentées**.

La version retrouve les 27 ajouts de la v0.3.0, préserve les correctifs de résilience et de configuration radio déjà fusionnés sur GitHub, puis ajoute sept supports de comparaison, six effets de scène ou de reflet et deux anomalies propres au chalet. Le quatrième lieu reste optionnel ; la campagne et ses sauvegardes gardent les trois secteurs d’origine.

Sources : [catalogue exécuté](runtime-catalog.json), [rapport final](qa-final-v0.4.0.json), [notes de version](RELEASE_0.4.0.md), [règles](../src/game/rules.ts) et [niveaux](../src/game/levels.ts).

## Contrôles exécutés

| Contrôle | Résultat | Périmètre de la preuve |
| --- | --- | --- |
| Règles et sessions | **19/19** | 96 identifiants dans leurs lieux compatibles, témoins et vues normales, campagne, consensus, erreurs, victoire, migration, actions authentifiées, pings privés et neuf diagnostics du chalet. |
| Résilience | **28/28** | Présence et départs, quorum suspendu, votes périmés invalidés, reprise, projections privées et anciens échanges radio. |
| Scène complète | **25/25** | Géométries finies, matériaux, directions, collisions, vrais rayons d’inspection, captures réfléchies, remise à zéro et parcours des quatre lieux. |
| Chalet et métro | **9/9** | Table réellement agrandie, accessoires fixes, visage visible dans le foyer, deux réflecteurs, garde-corps et trajet commun, libération des ressources ; arceaux du métro sous le plafond. |
| Supports d’inspection | **13/13** | Documents et objets physiques, variantes privées et normales, sept nouveaux supports, membres présents, noms ambigus ou invalides, remise à zéro. |
| Radio | **32/32** | Autorisation tardive, annulation, reprise, PTT, fermeture, profils synthétiques et six preuves supplémentaires héritées de la v0.3.0. |
| Contrôleur d’interface radio | **4/4** | Actions en attente, arrêt, changement de mode et annulation. |
| Configuration radio | **59/59** | Validation des listes STUN/TURN, schémas, secrets, avertissements, précontrôle et processus CLI. L’exécution autorisée résout les deux refus de sous-processus du sandbox initial. |
| TypeScript | **Réussi** | Vérification complète du projet. |
| Compilation autonome | **Réussie** | Frontend et modules du serveur Node. |
| Compilation hébergée | **Réussie** | Frontend Vinext et Worker Cloudflare. |
| Serveur portable réel | **Réussi** | Sans `node_modules`, deux clients traversent référence, inspection et consensus ; quatre clients terminent neuf diagnostics du chalet jusqu’à la victoire. |
| Chemins HTTP privés | **12 cas réussis** | Modules serveur bloqués après normalisation, encodages et casse ; traversée hors du répertoire public refusée ; ressources publiques servies intactes. |
| Modèle GLB inchangé | **Réussi** | Empreinte du source égale au manifeste, en-tête GLB 2 et taille valides, 58 maillages, trois clips. Aucun nouveau rendu GPU ni import externe revendiqué. |

Les 189 correspondent uniquement aux huit premières suites ; les compilations et scénarios HTTP sont présentés séparément. Les scripts figurent dans [tests](../tests/) et le workflow dans [ci.yml](../.github/workflows/ci.yml).

Rapports détaillés : [scène](qa-scene-v0.4.0.json), [chalet](qa-cabin-v0.4.0.json), [inspection](qa-inspection-v0.4.0.json), [portable](qa-portable-v0.4.0.json), [bilan final](qa-final-v0.4.0.json).

## Corrections vérifiées par la revue croisée

Le serveur local limitait encore la création de salon aux trois anciens lieux. Il utilise maintenant la validation commune `isLevelId`, et le scénario HTTP crée réellement un salon à quatre personnes dans le chalet.

Les noms Alpha et Bêta servent à distinguer les perceptions solo, mais ne doivent pas changer le registre ordinaire. Une composition de référence stable est maintenant fournie aux objets d’inspection. Les contrôles vérifient le passage Alpha → Bêta, puis le retour à la composition coopérative réelle lorsque cette référence est retirée.

La porte supplémentaire du miroir n’existe que pendant la capture du miroir principal de l’hôtel. Une interruption de capture restaure l’état. La disparition collective retire les autres corps réfléchis et conserve le corps propre ; en solo, deux mannequins témoins persistants fournissent la comparaison. Les collisions de leurs socles sont identiques dans toutes les perceptions.

Pour les sept nouveaux supports de l’hôtel, la revue a vérifié un point de vue accessible et le **premier objet physique rencontré par le rayon de la scène complète**. Il ne s’agit pas seulement de viser une liste de cibles en ignorant les murs. Les deux cibles du chalet et le trajet continu à droite ont aussi été contrôlés. La lecture agrandie reprend la perception concernée ; les pings ne transportent pas cette lecture.

Les arceaux du métro culminent maintenant vers 3,339 m, sous le plafond à 3,43 m. Le carnet décrit les nouveaux états normaux, les valeurs qui peuvent varier entre passages et les mannequins hors équipe.

## Géométrie et modèle

La scène contient **582 153 triangles stockés, 1 244 maillages et huit surfaces de réflexion plane**, en incluant les lieux et anomalies inactifs. Le total stocké n’est pas une mesure des triangles affichés à chaque image ni des performances GPU.

| Lieu | Triangles incluant les effets inactifs |
| --- | ---: |
| Hôtel | 252 932 |
| Métro | 102 766 |
| Clinique | 126 607 |
| Chalet | 75 956 |

Ces sous-totaux n’incluent pas tous les objets partagés de la scène. Le module architectural propre au chalet compte 29 930 triangles et 69 maillages ; ses témoins et effets communs augmentent le sous-total de la scène complète. Chaque inspecteur de base compte 53 990 triangles.

Le [manifeste du GLB](../public/models/inspecteur-parallaxe.manifest.json) conserve `sourceVersion: 0.3.0`, car le modèle et son source n’ont pas changé. Le fichier mesure 4 825 784 octets. Son SHA-256 est `dfbf18ed3ddfcf7e60112ad416c1abb5784214235d7532c868b4eee93159c506`. L’empreinte du source `avatar.ts` correspond exactement au manifeste. Les clips sont Marche, Radio et Salut ; les articulations sont des pièces rigides. Les textes de badges et effets runtime ne sont pas intégrés à cet export.

## Navigateur, voix et matériel

La route officielle de l’aperçu local a refusé la connexion avec `ERR_CONNECTION_REFUSED`, alors que le service se déclarait actif. L’aperçu a ensuite été arrêté. **Aucune nouvelle validation de pixels, WebGL, microphone physique ou voix connectée n’a pu être obtenue.** Voir [le rapport navigateur](qa-browser-v0.4.0.json).

Les tests radio exercent les traitements, les autorisations et les échanges simulés. Leurs transcriptions déterministes rendent les anomalies résolubles sans micro, mais ne certifient pas le rendu sur un casque ou la qualité d’un appel réel. Une erreur technique de connexion reste distincte d’une preuve d’anomalie.

Les essais D1 à quatre clients, l’interface dans deux onglets, le GPU désactivé et l’absence de candidats ICE documentés en v0.2 sont historiques. Ils n’ont pas été remesurés pour cette livraison. Les bilans [v0.3.0](QA_0.3.0.md) et [v0.2.1](QA_0.2.1.md), ainsi que les rapports [D1](qa-network-v0.2.json) et [radio navigateur](qa-radio-browser-v0.2.json), restent conservés.

## Assemblage et publication

Le générateur du classeur conserve quinze onglets, 120 fiches et des formules de comptage. La quatrième disponibilité et le niveau chalet sont ajoutés sans déplacer les colonnes des trois anciens lieux. Le suivi distingue code intégré, vérification ciblée et recette matérielle ouverte. Les validations de structure et les rendus du classeur sont conservés dans les rapports de classeur.

Les archives sont assemblées après la dernière copie du classeur dans `docs`, `public/downloads` et `standalone-dist/downloads`. Le contrôle final d’assemblage compare leurs contenus au projet et au build exécuté, vérifie les CRC, les versions, les exclusions et le ZIP des sources embarqué. Les empreintes finales des archives sont calculées après l’assemblage, sans les inscrire dans les archives elles-mêmes.

Ce rapport documente la vérification locale. L’état de publication et la CI du commit final sont consultables dans la pull request de cette version ; ils ne sont pas déduits du succès des tests locaux.

## Recette encore nécessaire

1. Parcourir les quatre lieux sur un GPU fonctionnel, à plusieurs qualités : pixels, lumières, reflets, textes, collisions ressenties, confort et FPS.
2. Comparer deux puis quatre vues réelles pour les 84 effets visuels, puis revenir à une référence propre.
3. Utiliser de vrais microphones : autoriser, refuser, activer tardivement, relâcher le PTT, masquer la page, quitter et rejoindre.
4. Vérifier l’écoute humaine, le mono, les profils radio et une liaison entre réseaux avec un relais TURN configuré.
5. Exécuter les lanceurs sur Windows et macOS et essayer les commandes tactiles et manette sur les appareils cibles.
6. Produire les 24 anomalies encore conçues et les autres lots du classeur : nouvelles architectures, assets avancés, narration finale et distribution.
