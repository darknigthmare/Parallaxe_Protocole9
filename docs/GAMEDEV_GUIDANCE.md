# Guider le développement de PARALLAXE

**Relevé : 29 octobre 2026.** Cette intégration adapte le catalogue [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) au jeu d'observation et d'horreur coopératif PARALLAXE — Protocole 9.

## 1. Base examinée et portée

| Élément | Preuve consultée |
| --- | --- |
| Dépôt du jeu | `darknigthmare/Parallaxe_Protocole9` |
| Branche de reprise | `continuation/session-integrity-20261029`, [PR #2](https://github.com/darknigthmare/Parallaxe_Protocole9/pull/2) |
| Commit examiné | `f1cadcca96dd94a84eaf68bdf821f235fb50b2cf` |
| Paquet de cette base | `package.json` : 0.2.1 |
| Dépendances résolues | `package-lock.json` : Three.js 0.186.1, types Three.js 0.186.0, React 19.2.6, TypeScript 5.9.3 |
| Catalogue de guides | Commit `19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9` ; guides Three.js ciblant r186 |
| Version du site | Capture du 28 octobre : 0.4.0 / quatre lieux. Métadonnées : version sauvegardée 7, commit source identifié. Sources non récupérées ; [comparaison en attente](SOURCE_RECONCILIATION_2026-10-29.md) |

Les versions ci-dessus décrivent le relevé, pas une instruction de rétrograder une version plus récente. Vérifier les métadonnées du code lors de la reprise.

L'intégration initiale ajoute des consignes, une sélection traçable et des critères de validation. L'application qui suit corrige les décisions coopératives retardées, le cycle de vie radio et les entrées PTT ; ses preuves sont dans [QA.md](QA.md) et le [suivi daté](suivi-correctifs-20261029.json). Le classeur de reprise reçoit un onglet daté en conservant son historique. Cette passe ne crée pas de nouvelle anomalie ni de nouvelle édition jouable, ne régénère pas les archives distribuées et ne déploie pas le Site.

Le catalogue aide à choisir une méthode et à éviter des erreurs courantes. Le rendu des miroirs, les perceptions privées, le consensus et les talkies restent des systèmes propres à PARALLAXE. Leur bon fonctionnement doit être prouvé dans ce projet.

## 2. Guides retenus et utilisation

Les onze références, leur chemin exact, leur commit et leur empreinte Git sont dans [gamedev-sources.json](gamedev-sources.json). Lire seulement celles qui servent à la tâche en cours.

| Guide | Quand le lire | Adaptation au jeu |
| --- | --- | --- |
| `router` | Début d'une tâche ou changement de domaine | Identifier la vraie cible, les versions et les fichiers ; sélectionner le minimum de guides |
| `threejs-scene-setup` | Caméra, boucle, redimensionnement, cycle de vie | Examiner `src/game/scene.ts`, le rendu WebGL, le delta borné et la reprise après masquage ; conserver les contrôles FPS du jeu |
| `threejs-materials-lighting` | Matériaux, éclairages et ombres | Vérifier PBR, couleurs et lisibilité des indices à chaque qualité ; les réflexions d'environnement ne remplacent pas les miroirs planaires |
| `threejs-gltf-loading` | Import ou animation d'un nouveau GLB | Contrôler hiérarchie, échelle, clips, matériaux et erreurs de chargement ; le personnage actuel reste procédural tant qu'un remplacement n'est pas demandé |
| `input-systems` | Interruption des gestes, pause, focus et capture du pointeur | Remettre à zéro les actions de déplacement et de regard ; protéger chaque geste avec son identifiant, sans modifier les règles PTT |
| `audio-design` | Mixage, ambiance, parasites et retour radio | Régler les groupes de sons et l'intelligibilité ; appliquer les effets selon le destinataire avec la calibration écrite conservée |
| `level-design` | Nouveau lieu ou modification de parcours | Valider d'abord dimensions, passages, points d'observation, référence normale et terminal ; ajouter ensuite les détails |
| `performance-optimization` | Saccade, coût des reflets, budget GPU/CPU | Mesurer une scène reproductible avec quatre corps, reflets et radio ; corriger le coût dominant puis remesurer |
| `physics-tuning` | Collision, traversée d'objet, déplacement instable | Vérifier le contrôleur et les collisions existants à plusieurs cadences ; justifier tout changement de pas de simulation par un problème reproduit |
| `procedural-gen` | Tirage ou rejouabilité des anomalies | Préserver graine et génération côté autorité ; reproduire les cas par données de test, filtrer les lieux compatibles, conserver les références normales |
| `create-game-assets` | Corps, accessoires, décors ou textures | Fixer la direction artistique, tracer la provenance et vérifier échelle, pivots, animations, collisions et lecture dans le jeu |

Les fiches transversales contiennent parfois des exemples Godot, Unity ou Python. Adapter le concept aux modules TypeScript existants. Ne pas recopier leurs API, changer de moteur, imposer un système physique ou installer des dépendances sans besoin concret.

Le catalogue à la révision retenue ne possède pas de guide générique pour notre multijoueur Web/WebRTC ni pour l'horreur d'observation. `godot-multiplayer` et les tests headless GDScript ne sont pas les outils de ce projet. Pour ces sujets, utiliser les contrats du code, [RADIO.md](RADIO.md), [QA.md](QA.md) et les documentations primaires WebRTC / Web Audio citées ci-dessous.

## 3. Priorités de développement

Les points suivants sont une feuille de travail proposée, pas une liste de nouveaux défauts démontrés. Certains invariants sont déjà implémentés et doivent être conservés.

| Ordre | Travail | Critère de sortie |
| --- | --- | --- |
| 1 | Réconcilier la base GitHub et la source de l'édition 0.4.0 signalée | Identifier le commit/source, comparer les différences et rattacher les preuves à la bonne édition avant remplacement du site |
| 2 | Préserver une session complète à 2 puis 4 inspecteurs | Salon → référence → observations → vote → résultat → passage suivant ; retours après absence et départ sans ancien consensus |
| 3 | Valider la radio en conditions réelles | Activation, refus, annulation tardive, écoute seule, appui continu, perte de focus, reconnexion et arrêt effectif ; réseau TURN testé séparément |
| 4 | Vérifier corps, reflets et anomalies associées | Corps local/coéquipier cohérents, indices lisibles à chaque qualité, aucun résidu d'effet après passage conforme |
| 5 | Étendre les lieux et anomalies | Chaque ajout fournit référence, preuve solo/coop, parcours praticable et test ciblé avant promotion dans le catalogue |
| 6 | Optimiser la scène mesurée | Même appareil, résolution, qualité et scénario avant/après ; amélioration chiffrée sans disparition d'indice |

### Session et perceptions

`src/game/session.ts` décide des actions coopératives ; `src/game/rules.ts` porte les règles communes au solo et au serveur. `projectRoom()` est la projection destinée au joueur. Tester ce qu'elle révèle autant que ce qu'elle masque.

Préserver l'ordre « invalider le vote interrompu, puis rafraîchir la présence » après 45 secondes d'absence. Un client revenu ne réactive ni ses anciens votes ni ses anciennes offres radio. Tester également le départ explicite du témoin et l'interdiction d'un nouveau vote pendant qu'un membre manque.

Les décisions `start`, `next` et `vote` transmettent le `decisionEpoch` de la vue que le joueur a utilisée. Le serveur le modifie lors d'une transition ou d'une interruption de décision, sans l'incrémenter pour chaque mouvement ou message. Un contexte manquant ou ancien produit un 409 avec la projection privée actuelle, après sauvegarde du nettoyage. Le client se resynchronise et attend une nouvelle action ; les réessais CAS D1 conservent l'intention d'origine.

La logique métier reste commune à la cible portable et au backend D1. Une réussite avec deux clients Node ne valide pas à elle seule la concurrence des écritures D1.

### Talkies et anomalies sonores

Séparer le transport vocal, l'état du microphone et l'effet de perception. Pour une nouvelle anomalie, définir ce que l'inspecteur doit entendre et la preuve écrite équivalente. Une panne de liaison garde son diagnostic réseau propre.

Mesurer le mixage à l'écoute : les effets peuvent altérer le message pour le gameplay, mais leur intensité doit respecter la preuve prévue. Vérifier que les réglages radio/ambiance et le silence restent opérants. Aucun résultat de mock ne remplace un essai avec casque, microphones et appareils cibles.

### Personnages, miroirs et scènes

Les personnages de `src/game/avatar.ts` sont des assemblages articulés procéduraux. L'export `public/models/inspecteur-parallaxe.glb` n'est pas la preuve d'un remplacement du modèle utilisé par la scène. Vérifier la chaîne effectivement appelée avant toute intervention sur l'import.

En état normal, les reflets capturent le corps complet. Les anomalies peuvent modifier délibérément sa présence ou son comportement. Conserver ces deux possibilités, la protection contre la récursion et la restauration des visibilités temporaires lors d'un changement de rendu. Une réduction de résolution ou de fréquence de capture est acceptable seulement si les indices restent observables.

Pour les performances, consigner appareil, navigateur, résolution, qualité, nombre de joueurs et scénario. `scene.getStats()` fournit des compteurs utiles ; ces compteurs ne mesurent pas à eux seuls les temps GPU ou les FPS. Définir ensuite les budgets de la cible mesurée.

## 4. Fiche minimale pour un ajout de contenu

Avant de rendre un cas sélectionnable, renseigner :

- Identifiant stable, lieu compatible et condition de déclenchement.
- Référence normale et preuve anormale précise.
- Perception de chaque rôle et comparaison attendue entre inspecteurs.
- Preuve en entraînement solo et solution accessible si le son ou un effet visuel est désactivé.
- Retour à la normale, changement de lieu et comportement après reconnexion.
- Ressources et provenance, coût estimé puis mesuré si pertinent.
- Test automatisé adapté, contrôle visuel/sonore requis et statut réel.

Suivre les statuts **conçu**, **implémenté**, **vérifié automatiquement**, **validé sur cible** séparément. Une ligne du classeur ou un modèle exporté ne suffit pas à passer à « validé sur cible ».

Synchroniser les données concernées : `src/game/catalog.ts`, `docs/anomalies-design.json`, `docs/PARALLAXE_Design_Complet.xlsx` et sa copie de téléchargement quand le contenu change. Ne pas modifier le classeur pour prétendre qu'un guide a produit du gameplay. Si son générateur n'est pas disponible, noter précisément la mise à jour encore à faire.

## 5. Vérifications et preuves

Les commandes sont celles de `package.json` et du workflow existant ; aucun nouveau framework de test n'est nécessaire pour intégrer ces guides.

| Commande | Portée | Limite |
| --- | --- | --- |
| `npm run typecheck` | Contrats TypeScript | Pas d'exécution du jeu |
| `npm test` | Règles et résilience des sessions | Pas de rendu GPU ni d'écoute |
| `npm run test:resilience` | Régressions ciblées de reprise/présence/projection | Pas un remplacement de tous les tests |
| `npm run test:movement` | Callbacks réels de déplacement, regard et interruptions avec frontières navigateur simulées | Pas de montage React ni de périphérique tactile physique |
| `npm run test:scene` | Géométries et états de scène avec dépendances de rendu simulées | Ne valide pas les pixels, les shaders ou les FPS |
| `npm run test:radio` | États radio, permissions et traitement avec API simulées | Ne valide pas la capture physique ni l'intelligibilité |
| `npm run test:radio-ui` | Annulation et transitions des actions d'interface | Pas de parcours complet sur appareils |
| `npm run test:radio-config` | Configuration radio et normalisation des adresses | Pas de connectivité TURN réelle |
| `npm run build:local` puis `npm run test:portable` | Compilation et échanges avec serveur portable | Pas de validation de la cible D1 |
| `npm run test:network` | Parcours du backend visé par `PARALLAXE_TEST_URL` | Nécessite un serveur de test préparé et joignable |

La CI garde ses contrôles existants. Pour une modification documentaire, vérifier les chemins, les sources et le JSON. Pour un changement de comportement, reproduire le problème et exécuter les contrôles du domaine, puis consulter la CI du commit livré.

Chaque preuve mentionne la révision, la commande/scénario, l'environnement, le résultat et les limites. Les rapports historiques de QA ne deviennent pas des résultats du nouveau commit. Un contrôle impossible reste explicitement « non exécuté » ; poursuivre les travaux indépendants qui peuvent être vérifiés.

## 6. Provenance et entretien

Sources amont consultées au commit [19d93f9](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9). Le catalogue est sous [Apache-2.0](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/LICENSE) avec un [NOTICE](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/NOTICE). Cette intégration rédige des consignes propres au projet et référence les fiches ; elle ne redistribue pas leurs fichiers ou scripts. Une redistribution ultérieure devra conserver les mentions applicables.

Pour mettre les références à jour, examiner les différences amont, confirmer les versions et la compatibilité, actualiser le commit et les empreintes du manifeste, puis adapter les consignes qui changent. La mise à jour du catalogue ne justifie pas une migration automatique du moteur.

Documentation primaire complémentaire :

- [Three.js](https://threejs.org/docs/) : vérifier les API avec la version verrouillée.
- [WebRTC — connexions](https://webrtc.org/getting-started/peer-connections) et [relais TURN](https://webrtc.org/getting-started/turn-server).
- [MediaDevices.getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) et [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).

## Application suivante : gestes, poses et paquet extrait

Le [suivi de jouabilité du 29 octobre](suivi-jouabilite-20261029.json) part du commit `5c4488ae9d36f44875352cf62997c8800f32db76`. Il applique les références ci-dessus à trois défauts reproduits : gestes tactiles conservés après interruption, rotation d'épaule conservée après le talkie et retard de reflet raccourci à haute fréquence.

Les contrôles des deux jobs CI utilisent maintenant le même SHA explicite. Après compilation, `npm run package:release` produit le manifeste, le commit et les empreintes des archives. `python3 tests/package-archive.test.py` vérifie leur contenu puis lance les clients du test portable depuis une extraction neuve. Les artefacts de CI portent la révision et l'identifiant d'exécution ; les ZIP historiques suivis dans `public/downloads` restent des éditions antérieures.

Cette validation ne remplace pas les essais GPU, l'écoute, les microphones, les périphériques réels ou la récupération des sources 0.4.0.
