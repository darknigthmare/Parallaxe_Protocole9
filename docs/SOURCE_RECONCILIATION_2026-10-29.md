# Réconciliation des sources — 29 octobre 2026

## Résultat actuel : sources récupérées et fusion appliquée

Le dépôt source du Site a été ouvert avec le helper Sites officiel. Son HEAD est exactement **`6c8784e0cf5d64f6386f3448434b0bc659d3fc15`**, associé à la version sauvegardée 7. `package.json` déclare 0.4.0 ; `SELECTABLE_LEVELS` contient quatre lieux et le catalogue 96 anomalies. Le Chalet est donc confirmé par les fichiers, pas seulement par une capture textuelle.

La consolidation 0.4.1 part de la PR #2 à **`2ec5d3a343f3cdd0e86f729d7b0cb1c6c622bd65`**. Les historiques Git n'ont pas d'ancêtre commun ; `ccf629a22b5409f9ea9ad4eb5a221253a7030893` sert de base de comparaison par contenu, sans prétendre être un parent du dépôt Sites.

| Élément | Constat et décision |
| --- | --- |
| Dépendances | Versions et intégrités identiques ; seul le numéro du paquet racine différait |
| Hébergement | Identité `.openai/hosting.json`, schéma D1 et migrations inchangés |
| Catalogue et lieux | Contenu 0.4 conservé : 96 anomalies, quatre lieux, campagne toujours à trois secteurs |
| Sessions | Version PR conservée ; ajout des 17 cibles d'objet de la 0.4 |
| Interface | Lectures, mono et calibration 0.4 réunis avec `SessionScope`, décisions contextualisées et gestes PR |
| Scène et avatar | Scène 0.4 et échantillonnage du reflet à 120 Hz ; avatar 0.4 déjà doté de la remise à zéro de l'épaule |
| Radio | Synthèses et preuves 0.4 réunies avec l'invalidation RTC PR ; calibration liée à la session |
| Portable | Protections des chemins 0.4, Chalet à quatre clients, contexte de décision et provenance PR |
| Tests | Union des scénarios existants et régressions ciblées de la fusion |
| Conception | Classeur 120 fiches / 96 intégrées récupéré avec sa copie de téléchargement ; classeur de reprise GitHub conservé |

L'inventaire initial comptait 135 fichiers communs identiques, 44 modifiés, 25 propres au Site et 20 propres à GitHub. Les fichiers ont été rapprochés par domaine ; aucune des deux arborescences n'a remplacé aveuglément l'autre.

Les rapports 0.3/0.4 importés sont des **preuves historiques**. Les résultats de la version consolidée sont dans [qa-final-v0.4.1.json](qa-final-v0.4.1.json). La récupération et la fusion ne valent pas, à elles seules, validation GPU, microphones, TURN ou publication.

## Relevés précédents conservés

Les sections suivantes décrivent les tentatives antérieures, lorsque les sources étaient encore inaccessibles. Leur statut bloqué est historique.

# Sources de la reprise du 29 octobre 2026

## Base des correctifs

Les correctifs de sessions, de radio et d'entrées de cette passe partent du commit GitHub **`1a7196f0151b3e755edc5670d8d571a9ec9e065c`**, sur `continuation/session-integrity-20261029`, dans la [PR #2](https://github.com/darknigthmare/Parallaxe_Protocole9/pull/2). Le paquet déclare **0.2.1** et `src/game/levels.ts` contient trois lieux : Saint-Clair, Terminus 09 et Aile blanche.

Le commit précédent `f1cadcca96dd94a84eaf68bdf821f235fb50b2cf` était la base de l'examen des guides. Le commit `1a7196f` ajoute les consignes et références de cet examen. Les résultats des correctifs sont consignés séparément dans [QA.md](QA.md) et [suivi-correctifs-20261029.json](suivi-correctifs-20261029.json).

Pendant cette passe, la branche a reçu les commits `b2722ee2e5dca1eaae4007b03a20b9eede661d49` et `f738ab9a54df2b6b651c179c5e9b035ca626719c`. La base d'intégration devient donc **`f738ab9a54df2b6b651c179c5e9b035ca626719c`**. Les protections `SessionScope`, la priorité de succession aux inspecteurs restés présents, leurs tests, leur documentation et leur classeur de suivi sont conservés. Les gardes de décision et de PTT sont raccordées à ces changements, puis les suites sont rejouées ensemble.

## Ce qui a été retrouvé du Site

Les métadonnées du projet ont été lues avec l'accès propriétaire autorisé. Elles identifient la dernière **version sauvegardée** suivante ; elles ne prouvent pas à elles seules quelle version est actuellement déployée.

| Champ | Valeur constatée |
| --- | --- |
| Projet | `appgprj_6adf87d7eaf48191a7dd65687cb07c5b` |
| Site | [PARALLAXE — Protocole 9](https://parallaxe-protocole-neuf.darknigthmare.chatgpt.site) |
| Version sauvegardée | 7 |
| Identifiant de version | `appgver_84f492da13308191bd1a9fca82253c3d` |
| Commit source déclaré | `6c8784e0cf5d64f6386f3448434b0bc659d3fc15` |
| Archive déclarée | TAR, 71 fichiers, 12 840 960 octets |
| Empreinte d'archive déclarée | `sha256:9c500cbc4f1e4ab166fff8dfca02b13f6f149acd2a157b38a631159a218033c1` |

Une capture textuelle de la publication, enregistrée le **28 octobre 2026 à 21:51 UTC**, affiche **« ÉDITION JOUABLE 0.4.0 »** et **quatre lieux**, dont **Chalet de service**. C'est une preuve du texte capturé, sans vérification du gameplay de ce quatrième lieu, du contenu de son code ou de l'état actuel du Site.

## Récupération tentée et limite actuelle

L'ouverture des sources a été tentée avec le mécanisme prévu par Sites et un identifiant temporaire transmis au processus par son entrée standard. La connexion au proxy de cet environnement a échoué avant le clonage du dépôt source (`Failed to connect to browser-proxy port 8889`). Le clonage GitHub par le shell rencontre le même défaut de connexion ; les lectures et écritures GitHub de cette passe passent par le connecteur autorisé.

La recherche dans les fichiers disponibles n'a pas fourni d'archive source correspondante. **Aucune source de la version sauvegardée 7 n'a donc été récupérée ni comparée.** Aucun identifiant d'accès, jeton ou lien de téléchargement signé ne figure dans ce rapport.

## Conséquence pour cette livraison

Les corrections continuent sur la base GitHub nommée ci-dessus, avec tests propres à cette base. Elles ne constituent pas une version 0.4.0, une récupération du quatrième lieu, une fusion avec les sources du Site ou un déploiement de ce Site. Les archives historiques v0.2.1 ne sont pas régénérées par cette passe.

Avant une livraison destinée à remplacer le Site : récupérer le commit source déclaré ou son archive, vérifier l'empreinte de l'archive si elle est utilisée, comparer le manifeste et les différences avec GitHub, puis reporter les correctifs sur la source retenue. Les essais doivent porter sur cette source finale. La ligne **SRC01** du suivi reste bloquée jusqu'à cette comparaison.

## Vérification complémentaire — jouabilité et paquet PC

La reprise suivante part de `5c4488ae9d36f44875352cf62997c8800f32db76`. La lecture des sept versions Sites et de la projection publiée confirme la version sauvegardée 7, le même commit source et les quatre lieux annoncés. Le commit `6c8784e0cf5d64f6386f3448434b0bc659d3fc15` n'est pas accessible comme objet Git dans le dépôt GitHub du jeu. Aucun nouvel export source 0.4.0 n'a été retrouvé parmi les fichiers disponibles.

Dans cette reprise, aucun exécuteur local n'est disponible. La voie de reprise Git prévue par Sites exige cet exécuteur ; les lectures de métadonnées ne donnent pas le contenu des fichiers. Aucun accès éphémère inutile n'a été créé. La comparaison reste donc ouverte, avec la même limite qu'au relevé précédent.

Les corrections de gestes tactiles, de poses de l'inspecteur et de durée du reflet retardé sont appliquées à la base GitHub nommée. La CI reconstruit désormais un paquet PC pour cette révision et le lance depuis son ZIP extrait. Le nom de l'artefact, `COMMIT.txt` et les empreintes identifient exactement cette livraison ; elle ne constitue pas la récupération de l'édition 0.4.0. Voir [le suivi de jouabilité](suivi-jouabilite-20261029.json).
