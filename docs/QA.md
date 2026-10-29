# Vérification actuelle — 0.4.1

Les sources 0.4 du Site sont récupérées et réunies avec la PR #2. Les preuves de cette consolidation sont dans [qa-final-v0.4.1.json](qa-final-v0.4.1.json), avec les commandes, le contexte et les limites. Sous Node 24.22.1 : 165 tests de règles/sessions/commandes, 31 contrôles de scène, 9 du Chalet, 13 de lecture, 42 radio, 15 interface radio et 59 configuration radio réussissent. TypeScript réussit. Les deux compilations finales et la vérification du ZIP réussissent sur le commit propre `fa9cf6306705c750106467d0d6caddf96767b0e7`. Le serveur est lancé depuis son extraction : 17 contrôles nommés, 12 requêtes de protection des chemins et une partie Chalet à 4 clients / 9 diagnostics jusqu’à la victoire. Les archives sont disponibles avec leur [manifeste](../public/downloads/PARALLAXE_v0.4.1_manifest.json). La CI 40907389674 reste en file d’attente au relevé ; ses deux jobs sont encore `queued`.

**Publication effectuée le 29 octobre 2026 à 16:07 UTC (17:07 à Paris).** Le [Site privé 0.4.1](https://parallaxe-protocole-neuf.darknigthmare.chatgpt.site) a été enregistré et déployé avec le statut natif `succeeded`. Source Site : `064a2157b64787228966ea108b683f735f2e3dc6` ; déploiement : `appgdep_6ae36f3e3f848191b1ec1afb032c56e4`. Les sources exécutables correspondent au code GitHub testé `fa9cf63`. Le navigateur de contrôle atteint la page de connexion attendue du Site privé ; cette observation ne constitue pas un essai de jeu. L’accès reste privé. Les identifiants complets de version et de déploiement sont conservés dans le rapport JSON.

Les rapports [0.3](QA_0.3.0.md) et [0.4](QA_0.4.0.md) restent historiques. La prévisualisation navigateur de cette passe n'a pas démarré : son montage ne voit pas l'installation partagée des dépendances. Aucun résultat GPU, microphone, tactile physique, Windows, TURN ou D1 de production n'est revendiqué.

## Historique des passes précédentes

# Bilan de vérification — PARALLAXE v0.2.1

Date : **26 octobre 2026**. La mise à jour v0.2.1 a fait l’objet de **19 tests radio réussis, de 4 tests du contrôleur d’interface réussis et d’un contrôle TypeScript réussi**. Les autres preuves v0.2 sont conservées et identifiées comme telles ; elles n’ont pas été relancées pour ce correctif ciblé. Ce bilan distingue les contrôles exécutés, leurs limites et les contrôles de livraison. Une fonctionnalité présente dans le code n’est pas automatiquement validée sur le matériel des joueurs.

## Périmètre vérifié

La v0.2.1 conserve **trois lieux** — Saint-Clair, Terminus 09 et Aile blanche — et **54 anomalies implémentées** : 48 effets visuels et six effets radio. La campagne demande trois diagnostics corrects par lieu, avec une nouvelle référence normale à chaque changement de lieu ; les points de reprise sont 0, 3 et 6. Le mode « lieu au choix » conserve l’objectif de neuf diagnostics consécutifs. Ces règles et la migration des sauvegardes v0.1 sont couvertes par les tests du domaine.

Le classeur comporte **120 fiches de conception : 54 implémentées avec QA partielle et 66 prévues**. Les pools par lieu se recoupent ; leurs tailles ne doivent pas être additionnées pour obtenir le nombre d’anomalies uniques. Sources : [catalogue](../src/game/catalog.ts), [règles](../src/game/rules.ts), [validation du classeur](workbook-validation.json).

## Résultats exécutés

| Domaine | Résultat et preuve | Ce que ce résultat ne démontre pas |
| --- | --- | --- |
| Règles et perceptions | **17 tests réussis** dans `tests/rules.test.mjs` : déterminisme, référence normale, couverture des 54 anomalies dans leurs lieux, témoin et observateur de référence pour deux à quatre joueurs, indices relationnels, campagne, points de reprise, victoire, erreurs, mode libre et migration v0.1. | Difficulté ressentie, plaisir de jeu ou compréhension par une équipe novice. |
| Votes, accès et départs | Les mêmes 17 tests couvrent les projections privées, le désaccord puis l’unanimité, l’absence de double score, les droits de l’hôte, le plafond de quatre joueurs, les poses finies, la suspension quand le seul témoin se déconnecte et la réaffectation après départ explicite. | Audit de sécurité indépendant ou mesure de latence sur un réseau externe. |
| Radio automatisée v0.2.1 | **19 tests réussis** dans `tests/radio.test.mjs` : les douze contrôles précédents et sept cas d’annulation, de permission tardive et d’activation concurrente. Ils couvrent aussi destinataires privés, expéditeur imposé, acquittements, limites, expiration, consentement, piste initialement muette, PTT, contexte HTTP non sécurisé, six preuves locales déterministes, négociation, offre initiale sans microphone et identifiants TURN temporaires. | Capture d’un microphone physique, intelligibilité, qualité sonore ou liaison TURN réellement exploitée. Les périphériques et API navigateur de ces tests sont simulés. |
| Contrôleur d’interface radio v0.2.1 | **4 tests réussis** dans `tests/radio-actions.test.mjs` : attente libérée à l’arrêt, protection de la nouvelle demande, erreurs anciennes ignorées, invalidation à la sortie et démarrage dans le geste utilisateur. | Rendu DOM, clics dans un navigateur réel ou contrôle d’un microphone physique. |
| Coopération avec D1 réel | **Réussite avec quatre clients HTTP** sur l’API du jeu et Cloudflare D1 local : trois arrivées concurrentes, places uniques, plafond, autorisations, projections privées, neuf votes unanimes concurrents comptés une seule fois, victoire et références synchronisées dans les trois lieux. Le départ révoque le jeton et préserve les autres participants. | Quatre vues 3D rendues ou quatre appareils physiques en Wi-Fi. |
| Signalisation avec D1 réel | Le même essai valide les messages radio ciblés, les identités de session, les acquittements protégés et l’obtention authentifiée de la configuration ICE. | Le passage d’un flux vocal ou d’un DataChannel entre navigateurs. |
| Scène sur CPU | **11 contrôles réussis** dans `tests/scene.geometry.test.mjs` : données finies, normales, luminaires, application et réinitialisation des 48 effets, cibles atteintes par les rayons Three.js, corps et reflets sans récursion, retard du reflet proche d’une seconde, trois lieux traversables, relais, collisions, qualité et libération des ressources. | Le renderer, le dessin Canvas et la capture PMREM sont remplacés dans ce test. Aucun pixel, shader, éclairage perçu ou FPS n’est certifié. |
| Modèle GLB | **Aller-retour `GLTFExporter → GLTFLoader` réussi** : 52 444 triangles, 51 maillages, 12 nœuds articulés, trois clips d’animation et positions finies. Les pièces sont articulées par transformations rigides, sans déformation de peau. | Apparence du modèle sous un vrai éclairage GPU, fidélité d’une animation jouée à l’écran ou validation dans un moteur externe. |
| Typage v0.2.1 | **`tsc --noEmit --incremental false` réussi** après le correctif d’annulation. | Exécution sur tous les navigateurs ou appareils. |
| Build local v0.2.1 | **`npm run build:local` réussi** après le correctif du microphone et du contrôleur d’interface. | Validation des images rendues ou du fonctionnement sur un réseau physique. |
| Serveur portable compilé v0.2.1 | **`npm run test:portable` réussi** : démarrage sans `node_modules`, HTML servi avec un statut 200, modules du serveur non publiés (404), deux clients, référence, inspection, unanimité correcte et sortie. Le test compare les perceptions personnelles complètes. La vérification porte sur la compilation v0.2.1 ; l’intégrité des archives est décrite séparément. | Voix réelle, GPU, certificat HTTPS accepté sur un autre appareil ou contrôle final de l’archive distribuée. |
| Interface et radio dans le navigateur | **Validation partielle dans deux onglets réels** : accès au salon et à la radio, activation explicite de l’écoute, descriptions WebRTC échangées et diagnostics exposés. Le navigateur n’a fourni aucun candidat ICE ; voir le diagnostic ci-dessous. | Liaison vocale `connected`, transport de voix ou capture microphone. |
| Classeur Excel | Contrôles de structure, recalcul et formules réussis ; modification puis restauration d’un statut et d’un lieu vérifiées. La v0.2 avait fait l’objet de **30 plages rendues sur 15 onglets**. Pour la v0.2.1, **9 rendus des 6 feuilles modifiées** ont été examinés, sans problème relevé dans le rapport visuel. | Validation des fonctionnalités du jeu décrites dans les fiches. Leur statut reste « Implémenté — QA partielle » quand les essais matériels manquent. |

Le test D1 a été exécuté le 26 octobre 2026, de **20:41:43 à 20:41:45 UTC**, contre la prévisualisation locale du projet. Le [rapport réseau v0.2](qa-network-v0.2.json) contient les sept résultats et leurs limites, sans codes de salon ni jetons. Les contrôles de déconnexion des tests unitaires ne doivent pas être présentés comme un nouvel essai de coupure physique prolongée : le test réel d’absence de 45 secondes conservé dans `qa-network.json` appartient à la v0.1.

## Annulation des permissions microphone — correctif v0.2.1

Une course a été reproduite avec le véritable `RadioClient` et des périphériques simulés : éteindre le talkie pendant une demande de permission, puis accorder cette permission tardivement, laissait `enabled=false` mais `microphone=true`, avec une piste muette non arrêtée. Cette reproduction établit que le client conservait cette piste malgré l’extinction ; elle ne mesure pas l’état d’un périphérique physique et ne prouve aucune transmission vocale.

Le correctif invalide les opérations anciennes, arrête les flux qu’elles reçoivent et réserve la finalisation à la demande qui possède encore l’activation. Il protège aussi l’écoute contre l’échec tardif d’une activation remplacée.

| Nouveau contrôle | Avant correction v0.2 | Après correction v0.2.1 |
| --- | --- | --- |
| Extinction du talkie pendant une permission, puis accord tardif | Échec : microphone réactivé, piste non arrêtée | Réussi : piste arrêtée, microphone et talkie éteints |
| Coupure du microphone seul pendant une permission | Échec : microphone réactivé | Réussi : piste arrêtée, écoute conservée |
| Accord ancien après une nouvelle activation | Échec : nouvelle demande bloquée par l’ancienne promesse | Réussi : ancien flux arrêté, nouveau microphone préservé |
| Refus ancien après une nouvelle activation | Échec : nouvelle demande bloquée par l’ancienne promesse | Réussi : nouveau microphone et état d’erreur préservés |
| Fin d’une ancienne demande pendant une nouvelle demande encore en attente | Échec : nouvelle demande bloquée par l’ancienne promesse | Réussi : la demande récente reste partagée, sans demande supplémentaire |
| Échec de l’ancienne activation de lecture après réactivation | Échec : la nouvelle écoute était désactivée | Réussi : nouvelle écoute conservée |
| Flux reçu après fermeture complète du client, comme lors d’une sortie de salon | Réussi : protection déjà présente | Réussi : protection conservée |

La sélection ciblée passe de **1 succès et 6 échecs** à **7 succès**. La suite radio complète passe à **19/19**, sans échec, et TypeScript réussit. Le [rapport machine v0.2.1](qa-radio-cancellation-v0.2.1.json) précise le code testé et les commandes. Les 17 tests règles et 11 contrôles CPU restent des résultats v0.2 conservés ; leurs sources n’ont pas été modifiées pour cette correction. Aucun microphone physique, nouveau test WebRTC entre navigateurs ou rendu GPU n’a été utilisé.

## Annulation dans l’interface v0.2.1

Le bouton d’activation restait auparavant en attente jusqu’à la réponse d’une ancienne permission, même après extinction. Le contrôleur `RadioActionGate` libère cet état immédiatement et invalide les callbacks anciens lors d’une extinction, d’un changement de client ou d’un démontage. Les demandes courantes restent actives et seules leurs erreurs sont affichées. Le [rapport du contrôleur](qa-radio-ui-v0.2.1.json) décrit les quatre tests et distingue cette vérification de la validation visuelle.

## Diagnostic radio observé dans deux onglets

Les deux participants ont cliqué sur **Écouter sans microphone**. Aucun microphone n’a été demandé et aucun relais TURN n’était configuré. Les deux onglets ont présenté les mêmes valeurs :

| Indicateur | Valeur observée |
| --- | --- |
| État de signalisation | `stable` |
| Collecte ICE | `complete` |
| État de connexion ICE | `new` |
| Description locale | Présente |
| Description distante | Présente |
| Candidats locaux | **0** |
| Candidats distants | **0** |

L’offre et la réponse WebRTC ont donc traversé la signalisation authentifiée. **La liaison n’a pas atteint l’état `connected` et aucun transport de voix ou de DataChannel n’est validé.** L’absence de chemin ICE est constatée ; sa cause précise n’est pas établie par cet essai. Aucune politique du navigateur n’a été contournée et les tentatives ont été arrêtées après ce diagnostic. Le [rapport navigateur](qa-radio-browser-v0.2.json) conserve ces observations.

La calibration locale demeure indépendante du microphone et du réseau : les six profils d’anomalie et leur référence produisent des preuves et transcriptions déterministes. Cette propriété est couverte par les tests automatisés ; elle ne constitue pas une écoute humaine des effets sur un casque réel. La [capture du panneau radio](qa/radio-v0.2.jpg) montre le relevé de calibration normal et le message de liaison indisponible ; elle ne représente pas un rendu de la scène 3D. Le [guide radio](RADIO.md) décrit les commandes, HTTPS et la configuration STUN/TURN.

## Limitation graphique constatée

Le navigateur de contrôle renvoie **`GL_RENDERER = Disabled`** et refuse la création du contexte WebGL. L’application affiche cet état et laisse les menus, le salon, la radio et la calibration accessibles. La partie 3D exige un contexte graphique fonctionnel. Aucune modification de navigateur, d’isolation ou de sécurité n’a été effectuée pour contourner cette limitation.

Les contrôles CPU portent sur les véritables géométries, transformations et rayons Three.js. Ils ne valident pas le rendu des miroirs, des avatars, des matériaux, des lumières ou des anomalies à l’écran. Les six surfaces planaires, dont deux actives par lieu, sont contrôlées structurellement. Aucune mesure de photoréalisme, de confort visuel, de FPS ou de compatibilité GPU n’est revendiquée.

| Géométrie structurelle | Triangles comptés |
| --- | ---: |
| Saint-Clair | 196 580 |
| Terminus 09 | 84 278 |
| Aile blanche | 107 032 |
| Un inspecteur articulé | 52 444 |

Les totaux des lieux incluent les effets masqués. Ce sont des volumes de géométrie, pas des nombres de triangles effectivement affichés par image, d’appels de dessin ou des résultats de performance. Sources : [état du contenu](build-status.json) et [manifeste GLB](../public/models/inspecteur-parallaxe.manifest.json).

## Contrôles de livraison — référence v0.2

Le typage, les compilations locale et hébergée, et le serveur portable ont été exécutés avec succès sur les sources v0.2. Le jeu extrait du ZIP a aussi été démarré sans dépendances installées, puis contrôlé par deux clients jusqu’au verdict unanime et à leur départ.

| Contrôle | Commande ou méthode | Résultat final v0.2 |
| --- | --- | --- |
| Build hébergé | `npm run build` | **Réussi.** Avertissement non bloquant sur la taille du module de scène. |
| Archives | `npm run package:release` puis `zipfile.testzip()` | **CRC réussi pour les deux ZIP et l’Excel embarqué.** Chemins et présence du code, modèle, serveur et lanceurs contrôlés. |
| Contenu de distribution | Inspection de l’inventaire et des exclusions | **Réussi.** Pas de dépendances installées, de sessions locales ou de clés privées ; le ZIP PC contient les sources et ne s’embarque pas lui-même. |
| Jeu réellement extrait | `tests/portable.test.mjs` depuis le dossier extrait | **Réussi.** Deux clients, référence, inspection, diagnostic et sortie. |

Les [preuves finales](qa-final-v0.2.json) reprennent ces résultats. Le workflow `.github/workflows/ci.yml` est fourni pour ces contrôles ; aucune exécution distante sur GitHub n’est revendiquée dans cette livraison.

### Distribution v0.2.1

Le typage, les 19 tests radio, les 4 tests du contrôleur d’interface, les builds local et hébergé ainsi que le test du serveur portable avec deux clients ont réussi sur la v0.2.1. Les [preuves finales v0.2.1](qa-final-v0.2.1.json) recensent ces résultats. Les deux ZIP et l’Excel embarqué passent les contrôles CRC. Le ZIP des sources contient 172 fichiers, tous identiques au projet ; le paquet PC contient 45 fichiers, dont les assets compilés identiques au build portable testé et le ZIP des sources. Les versions, lanceurs, modèle GLB, classeur et nouveaux tests radio sont présents. Les dépendances installées, sessions locales, clés privées et auto-embarquements du ZIP PC sont exclus. Le test du serveur porte sur le build compilé avant assemblage ; le lancement depuis une extraction de ces nouveaux ZIP n’a pas été répété. La CI distante n’avait pas encore été exécutée au moment de cet export ; consulter GitHub Actions pour son état sur le commit publié.

## Essais à effectuer sur les appareils cibles

1. Ouvrir les trois lieux sur un GPU fonctionnel. Vérifier matériaux, ombres, portraits, textes, relais, panneau de convergence, avatars et vrais reflets. Le quai normal doit être vide, son afficheur « QUAI 09 / SERVICE TERMINÉ » ; la clinique normale doit présenter un seul lit et le moniteur « FC 072 / RYTHME SINUSAL ».
2. Déclencher les 48 effets visuels dans leurs lieux autorisés, comparer les perceptions de deux puis quatre joueurs, puis revenir à un passage normal sans résidu visuel. Vérifier séparément les trois indices relationnels : relais, flèche et heure SYNCHRO.
3. Écouter les six effets radio et leur référence avec un casque réel ; comparer les relevés écrits, y compris sans microphone et avec la voix indisponible. Une panne technique doit rester distincte d’un indice du jeu.
4. Vérifier une conversation réelle à deux puis quatre appareils : permission, piste initialement muette, maintien et relâchement du PTT, perte de focus, passage en arrière-plan, coupure du microphone, reconnexion et départ. Mesurer intelligibilité, écho, niveau sonore et latence.
5. Tester le réseau local en HTTPS avec un certificat approuvé, puis des réseaux distincts avec un relais TURN opérationnel. Contrôler son expiration et le renouvellement de configuration. Aucun service TURN externe n’a été validé par les essais actuels.
6. Finir une campagne complète et une partie dans un lieu choisi avec de vraies vues 3D. Essayer désaccords, votes modifiés, absence du seul témoin, reprise, départ et changement d’hôte.
7. Vérifier clavier/souris, tactile et manette sur les appareils visés ; mesurer les performances dans les trois qualités, y compris avec quatre avatars et les reflets actifs. Les seuils acceptables doivent être fixés à partir de ces mesures.

## Pièces de vérification

- [Règles : 17 tests, résultat conservé v0.2](../tests/rules.test.mjs) et [radio : 19 tests v0.2.1](../tests/radio.test.mjs).
- [Reproduction et correction des annulations radio v0.2.1](qa-radio-cancellation-v0.2.1.json).
- [Scène : 11 contrôles CPU](../tests/scene.geometry.test.mjs) et [manifeste du modèle GLB](../public/models/inspecteur-parallaxe.manifest.json).
- [API D1 réelle, quatre clients](qa-network-v0.2.json), [radio dans deux onglets, résultat partiel](qa-radio-browser-v0.2.json) et [test du portable](../tests/portable.test.mjs).
- [Validation des données du classeur](workbook-validation.json), [structure du classeur](workbook-structure-validation.json) et [revue visuelle du classeur et de sa mise à jour](workbook-visual-review.json).

Les fichiers `qa-network.json` et `qa-results.json` sont des traces historiques v0.1. Ils ne doivent pas être utilisés pour annoncer les comptes, le contenu ou les résultats de la v0.2.

## Correctifs coopératifs et radio — 29 octobre 2026

Ce lot applique les consignes gamedev à des défauts reproduits dans le code. Il part de `1a7196f0151b3e755edc5670d8d571a9ec9e065c`, puis intègre les changements concurrents jusqu'à `f738ab9a54df2b6b651c179c5e9b035ca626719c`. Le contenu reste celui de la base GitHub 0.2.1. Le [relevé des sources](SOURCE_RECONCILIATION_2026-10-29.md) distingue cette base du Site plus récent dont les sources ne sont pas récupérées.

### Défauts protégés

| Situation | Comportement corrigé et preuve attendue |
| --- | --- |
| Vote retardé après changement de passage | Le vote porte le `decisionEpoch` affiché lors de l'action. Un ancien contexte reçoit 409 et ne vote pas dans le nouveau passage. |
| Double passage suivant au changement de lieu | La seconde requête garde son intention d'origine et ne saute pas la référence normale du métro ou de la clinique. |
| Absence détectée avant réception des votes | L'interruption invalide le contexte même si aucun vote n'était encore enregistré. Le nettoyage précède le battement de retour. |
| Réessai après conflit d'écriture D1 | Le handler réapplique le payload d'origine ; il ne remplace pas son contexte par celui du nouvel état. Le nettoyage est persisté avant le 409. |
| Ancien salon ou tentative abandonnée | `SessionScope` conserve les barrières de session et d'ordre ajoutées par le lot concurrent ; les décisions sont en plus rattachées à la visite et à l'identité observées. |
| Négociation radio suspendue lors de l'extinction | Les continuations, réessais, erreurs et callbacks périmés ne recréent pas de pair. Une nouvelle négociation avance sans attendre l'ancienne. |
| Bouton de talkie maintenu après interruption | La manette doit être relâchée puis pressée à nouveau après perte de focus, masquage, pause, perte réseau ou changement de session. Un maintien continu ne contourne pas la limite de 30 secondes. |

### Contrats et compatibilité

`start`, `next` et `vote` exigent désormais un entier sûr `decisionEpoch`. Une valeur absente ou invalide renvoie `INVALID_DECISION_CONTEXT` ; une valeur périmée renvoie `STALE_DECISION_CONTEXT`. Les deux réponses ont le statut HTTP 409 et contiennent la projection privée actuelle. Les clients doivent transmettre la valeur de leur vue affichée, accepter cette nouvelle vue et attendre une confirmation volontaire. Ils ne doivent pas réessayer automatiquement une décision avec un contexte actualisé.

Le compteur de décision reste stable pendant les mouvements, messages, battements et votes non conclusifs. Les salons sauvegardés sans ce champ sont migrés de façon déterministe. Les anciennes interfaces déjà chargées doivent être rechargées avec le client corrigé après une mise à jour du serveur. Aucun changement de schéma SQL, de dépendance ou de règle de score n'est introduit.

### Portée des vérifications

Les commandes et les résultats à jour figurent dans [suivi-correctifs-20261029.json](suivi-correctifs-20261029.json), avec le commit de code et le lien de CI lorsqu'ils sont connus.

**CI du code vérifiée :** commit `f258c5b6bd99e24d6ef9650941fa6a86b162a1f0`, [exécution 40884677504](https://github.com/darknigthmare/Parallaxe_Protocole9/actions/runs/40884677504), **réussie**. Les deux jobs, sources/traçabilité et jeu, ont terminé avec succès. Les journaux du job jeu confirment Node **22.23.4**.

| Contrôle sur cette révision | Résultat |
| --- | --- |
| Règles, résilience et intentions de décision | 66 tests réussis : 17 + 33 + 16 |
| Adaptateurs de sessions | 5 tests réussis, dont le parcours HTTP Node à quatre clients |
| Callbacks client et durée de vie de session | 60 tests réussis |
| Client radio | 29 tests réussis |
| Actions de l'interface radio et maintien PTT | 15 tests réussis : 4 + 11 |
| Configuration radio | 59 tests réussis |
| Géométries et transitions de scène | 11 contrôles CPU réussis ; aucun rendu GPU validé |
| TypeScript et compilation portable | Réussis |
| Serveur portable réellement compilé | Réussi : deux clients et 11 vérifications, dont les rejets 409 et le départ propre |

Les suites Node totalisent **234 tests réussis et zéro échec**. Les contrôles CPU et les vérifications du scénario portable sont comptés séparément. Le complément documentaire et le classeur référencent ce commit de code effectivement testé ; leurs mises à jour ne doivent pas être présentées comme une nouvelle version jouable.

- `npm test` couvre les règles, la résilience, les intentions de décision, les adaptateurs et les callbacks du client. Les callbacks de `app/game.tsx` sont exécutés depuis leur code réel avec requêtes différées ; React n'est pas monté dans un navigateur.
- `npm run test:session-adapters` exécute quatre scénarios des vrais handlers Cloudflare avec un **stockage CAS simulé**, puis un scénario contre le **vrai serveur HTTP Node**. Ce dernier utilise les modules du domaine effacés de leurs annotations TypeScript et une page de test explicitement factice : quatre clients, neuf consensus, trois références normales et rejeux 409. Il ne valide pas le frontend compilé ni le service D1 hébergé.
- `npm run test:radio` exerce le vrai client radio avec API Web Audio/WebRTC simulées. Six régressions reproduisent les opérations périmées après extinction ou reconnexion locale. Quatre autres reproduisent les rejets RTC tardifs après départ ou remplacement du pair distant, sans changement de génération locale. Chaque défaut a été observé avant sa correction ; la suite complète atteint 29 tests réussis. La négociation du pair remplaçant est également vérifiée.
- `npm run test:radio-ui` inclut la logique de maintien PTT. Les transitions entre deux images sont testées sans prétendre qu'une manette physique a été utilisée.
- La CI vérifie en plus TypeScript, les géométries CPU, la configuration radio, le build portable et les échanges de deux clients avec le **portable réellement compilé**. Ce dernier test reste distinct de la fixture HTTP de la suite adaptateurs.

Les exécutions locales de ce lot utilisent Node 24.22.1 ; la CI utilise Node 22. Les tests HTTP locaux ont nécessité l'autorisation d'écoute sur `127.0.0.1` de l'environnement. Les processus et données temporaires sont nettoyés, y compris lors des échecs d'arrivée ou de réservation de port.

Aucun nouvel essai GPU, navigateur avec scène 3D, microphone physique ou TURN entre réseaux n'est revendiqué. Les preuves historiques ci-dessus conservent leur date et leur édition ; elles ne remplacent pas ces essais. Le classeur de reprise conserve ses deux feuilles historiques et ajoute une feuille datée pour ce lot. Le classeur concurrent de suivi des sessions et le classeur maître d'anomalies sont conservés.


## Gestes tactiles, poses et livraison extraite — suite du 29 octobre 2026

**Code appliqué :** [`b70350c59e97487d0c7224d6c57c17eabb0f8e1b`](https://github.com/darknigthmare/Parallaxe_Protocole9/commit/b70350c59e97487d0c7224d6c57c17eabb0f8e1b), depuis `5c4488ae9d36f44875352cf62997c8800f32db76`. Le [suivi structuré de ce lot](suivi-jouabilite-20261029.json) recense sept points et conserve les limites de chaque preuve.

### État de validation de ce lot

La [CI de cette révision](https://github.com/darknigthmare/Parallaxe_Protocole9/actions/runs/40901665020) est **en file d'attente** au moment du relevé : les jobs `game` et `source-snapshot` n'ont pas démarré. L'exécuteur local est également indisponible. **Aucun nouveau succès TypeScript, Node, géométrie Three.js complète, compilation ou ZIP extrait n'est revendiqué sur ce commit.** Les succès du lot précédent, présentés plus haut, gardent leurs révisions et ne deviennent pas des résultats de cette passe.

Les vérifications exécutables disponibles sont des reproductions V8 des vrais corps de fonctions, avec annotations TypeScript retirées et frontières navigateur ou transformations simulées :

| Vérification isolée | Résultat observé |
| --- | --- |
| Gestes tactiles du code intégré | **27 scénarios réussis**, zéro échec : pause, carnet, vote, radio, retour, verdicts, remplacement de session, focus, masquage, capture et gestes simultanés |
| Pose de l'inspecteur après talkie/radio | Quatre défauts reproduits avant correction ; les quatre retours corrigés et le contrôle du geste indépendant réussissent |
| Historique du reflet sur une marche de deux secondes | Six cadences vérifiées : 20, 60, 120, 240, 360 Hz et cadence variable ; les deux échecs à haute fréquence sont corrigés |
| Ensemble pose + historique isolés | **11 scénarios**, six échecs avant correction et zéro après ; ce compte est distinct des 27 scénarios d'entrées |
| Classeur de reprise | Nouvelle feuille « Jouabilité 29-10 » ; intégrité ZIP/CRC vérifiée et contenu décompressé des trois feuilles historiques, styles et tables conservé à l'identique |

Le défaut tactile initial laisse une commande avant de `0,9210526` après ouverture d'une pause ; après perte de focus, un ancien déplacement peut la réactiver. Le correctif efface les origines, les actions, les touches et l'indicateur visuel. Chaque geste garde son propre identifiant de pointeur ; la fin du joystick conserve le doigt utilisé pour regarder. Les handlers traitent aussi `lostpointercapture`.

L'épaule droite gardait sa rotation Y de `0,90 radian` après une pose talkie. La pose normale restaure maintenant ses trois axes avant les animations particulières.

À 240 Hz, la reproduction isolée du reflet passe d'environ **0,746 s à 1,004 s** de retard ; à 360 Hz, d'environ **0,497 s à 1,006 s**. L'historique reste borné à 180 poses. Ces valeurs sont des calculs simulés, pas des FPS mesurés sur une carte graphique.

### Régressions et livraison préparées

- `tests/movement-input.test.mjs` exécute les callbacks réels avec `stripTypeScriptTypes` sous Node et est intégré à `npm test`. Le harnais de sessions utilise également les vraies fonctions de remise à zéro.
- `tests/scene.geometry.test.mjs` ajoute cinq transitions de pose et un contrôle à six cadences avec les objets Three.js de sa suite CPU. Ses onze contrôles antérieurs sont conservés ; l'exécution de l'ensemble reste à confirmer par la CI.
- Les deux jobs de CI extraient maintenant explicitement le même SHA de branche. Cela évite de rattacher une archive du commit de branche à un test du commit de fusion GitHub.
- Le packaging ajoute `COMMIT.txt`, des empreintes SHA-256 et le commit au manifeste. `tests/package-archive.test.py` contrôle les ZIP et leur contenu, puis lance le serveur réellement extrait avec les deux clients du scénario portable.
- Le test refuse un dossier fourni contenant déjà `.parallaxe-data`. Le paquet de CI est publié uniquement après succès et son nom inclut la révision, l'exécution et la tentative.

**Aucun paquet PC de ce nouveau commit n'est encore déclaré validé ou disponible dans ce relevé.** Les archives historiques suivies dans `public/downloads` restent inchangées. Le lancement du serveur extrait sous Linux, quand il sera exécuté, ne validera pas à lui seul le double-clic du lanceur Windows, le rendu WebGL ou les périphériques physiques.

Le [relevé des sources](SOURCE_RECONCILIATION_2026-10-29.md) confirme que la comparaison avec la source Site 0.4.0 reste bloquée. Aucun nouveau lieu, déploiement ou récupération du Chalet de service n'est revendiqué par ce lot.
