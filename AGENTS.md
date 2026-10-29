# Consignes de développement — PARALLAXE

## Commencer par la bonne révision

Lire `README.md`, `package.json`, `package-lock.json` et [le guide du projet](docs/GAMEDEV_GUIDANCE.md). Vérifier la branche, le commit de départ et les changements déjà en cours avant toute modification.

L'examen des guides du 29 octobre 2026 porte sur la PR #2, commit `f1cadcca96dd94a84eaf68bdf821f235fb50b2cf`, dont le paquet déclare **0.2.1**. Les correctifs qui suivent partent du commit documentaire `1a7196f0151b3e755edc5670d8d571a9ec9e065c`. Les métadonnées du Site identifient sa version sauvegardée 7 et son commit source ; une capture du 28 octobre affiche **0.4.0 / quatre lieux**. Le téléchargement des sources reste bloqué et leur comparaison n'est pas faite : consulter le [relevé des sources](docs/SOURCE_RECONCILIATION_2026-10-29.md). Retrouver et comparer ces sources avant une livraison destinée à remplacer le site ; poursuivre les corrections isolées sur une base explicitement nommée.

## Moteur et sélection des guides

Le jeu utilise **Three.js / TypeScript**, une interface React, Web Audio / WebRTC, les règles partagées de `src/game/`, un serveur Node portable et un backend Cloudflare D1. Les versions verrouillées relevées sont Three.js 0.186.1, React 19.2.6 et TypeScript 5.9.3 ; relire le verrouillage lors d'une reprise.

Les références de `awesome-gamedev-agent-skills` sont recensées avec commit et empreintes dans [gamedev-sources.json](docs/gamedev-sources.json). Pour chaque tâche, sélectionner seulement les fiches utiles dans la table du guide, les lire à cette révision, puis adapter leurs principes aux API du projet. Les documents locaux restent utilisables quand l'amont est indisponible ; signaler alors la référence non consultée.

Conserver le moteur, les versions, la direction artistique et les deux cibles existantes. Les exemples Godot/Unity des fiches transversales ne sont pas des API TypeScript. Le catalogue consulté ne fournit pas notre coopération ni le transport vocal WebRTC. Ne pas installer tout le catalogue, ajouter un moteur, migrer une bibliothèque ou remplacer les personnages procéduraux pour satisfaire un exemple de guide.

## Invariants du jeu

- **Vérité serveur :** utiliser `projectRoom()` pour les réponses réseau. Ne pas diffuser l'objet `Room`, la graine, la réponse cachée, les perceptions des autres inspecteurs ou les empreintes de leurs jetons.
- **Consensus :** respecter l'unanimité, la présence de toute l'équipe et les transitions existantes. Après une absence d'au moins 45 secondes, invalider les anciens votes et calculer la succession du chef parmi les inspecteurs restés présents avant de rafraîchir la présence ; aucune reconnexion ne doit rétablir un diagnostic ou une priorité périmés.
- **Intention du joueur :** `start`, `next` et `vote` portent le `decisionEpoch` observé dans le rendu, avec l'identité du salon concerné. Ne jamais remplacer ce contexte par la dernière valeur serveur pendant un réessai. Une décision ancienne renvoie 409 avec `projectRoom()` après persistance du nettoyage de session ; demander une nouvelle décision explicite. Les réponses d'une session abandonnée ne doivent pas restaurer ses identifiants.
- **Anomalies :** chaque cas possède une référence normale, un lieu compatible, une preuve observable et une comparaison explicite. Les codes, heures ou flèches variables se comparent entre joueurs du même passage. Réinitialiser intégralement les effets entre deux passages.
- **Voix :** capture uniquement après activation explicite, microphone initialement muet, écoute sans capture conservée. Une autorisation tardive annulée doit fermer ses pistes. Couper la transmission au relâchement, à la perte de focus, au masquage, à la sortie et à la limite de 30 secondes ; une manette maintenue ne la réactive pas sans relâchement. Invalider aussi les négociations, réessais et callbacks RTC après extinction ou remplacement de la connexion.
- **Commandes :** une pause, une modale, un verdict, un changement de session ou une perte de focus invalide les gestes de déplacement et de regard. Réinitialiser les actions et leurs origines avant le retrait des contrôles ; rejeter les anciens événements et traiter la perte de capture sans annuler le geste d'un autre pointeur.
- **Accessibilité :** conserver la calibration écrite, les preuves solo et les modes silencieux/confort. Une erreur WebRTC n'est jamais la preuve d'une anomalie.
- **Corps et reflets :** conserver le corps complet dans les captures de l'état normal, ainsi que les variations intentionnelles des anomalies prévues. Éviter la récursion des miroirs et restaurer les états temporaires même en cas d'erreur. Une qualité graphique réduite doit laisser chaque indice reconnaissable.
- **Progression :** préserver les migrations de sauvegardes, les secteurs validés de la traversée et les règles propres au lieu unique. Un ajout de décor ne doit pas modifier implicitement ces règles.
- **Contenu réel :** `src/game/catalog.ts` décrit les cas sélectionnables ; `docs/anomalies-design.json` et le classeur décrivent aussi des idées. Une idée documentée n'est pas une fonctionnalité jouable.

## Modifier et vérifier

Faire une modification ciblée, vérifier son effet observable, puis mettre à jour les preuves et le suivi concernés. Pour une correction de comportement, ajouter une régression seulement si elle protège le risque corrigé. Ne pas écrire de tests qui se bornent à relire la documentation.

| Domaine modifié | Contrôles existants à sélectionner |
| --- | --- |
| Règles, perceptions, sessions, sauvegardes | `npm test` ; ciblage avec `npm run test:resilience`, `npm run test:session-actions` ou `npm run test:session-adapters` |
| Commandes, gestes tactiles, pause et focus | `npm run test:movement` ; essai sur périphérique pour le comportement physique |
| Lieux, avatars, collisions, reflets | `npm run test:scene` + contrôle visuel sur GPU pour les pixels et indices |
| Radio et permissions | `npm run test:radio`, `npm run test:radio-ui`, `npm run test:radio-config` + écoute réelle si l'audio change |
| Contrats TypeScript | `npm run typecheck` |
| Cible portable | `npm run build:local`, puis `npm run test:portable` |
| Paquet PC archivé | `npm run package:release`, puis `python3 tests/package-archive.test.py` depuis un checkout propre ; serveur lancé depuis une extraction neuve |
| Backend D1 | `npm run test:session-adapters` vérifie les handlers avec stockage CAS simulé ; `npm run test:network` vers une instance D1 de test pour valider le service réel |
| Documentation seule | Vérifier sources, chemins, JSON et cohérence des versions |

Les jobs CI, l'archive source et le paquet PC doivent utiliser le même SHA explicite. Le manifeste, `COMMIT.txt` et les empreintes rattachent les fichiers à cette révision.

La CI de `.github/workflows/ci.yml` est la référence des contrôles automatisés requis. Un test CPU de scène ou une simulation des API radio ne prouve ni qualité d'image, ni FPS, ni intelligibilité sur microphone réel, ni fonctionnement TURN entre réseaux. Pour chaque résultat, préciser commit, commande, environnement et limite. Garder « non exécuté » distinct de « réussi ».

Pour les performances, mesurer une scène reproductible sur le même appareil avant et après ; utiliser notamment `scene.getStats()`. Définir les budgets par cible à partir des mesures. Aucune promesse de FPS sans mesure.

## Livrer et reprendre

Employer [le modèle de PR](.github/pull_request_template.md) pour rendre les changements et leurs preuves vérifiables. Mettre à jour la conception, le catalogue, le suivi Excel et la documentation quand leur contenu change ; ne pas marquer une ligne terminée sur la seule existence d'un guide. Le générateur Excel utilise un outil d'édition absent des dépendances du jeu : signaler honnêtement un classeur non régénéré.

Conserver le SHA de la base, les sources exactes et les limites de validation. Une modification documentaire n'est pas une nouvelle version jouable. Le déploiement, les migrations de données et les services externes suivent la demande en cours ; la lecture d'un guide ne les déclenche pas.
