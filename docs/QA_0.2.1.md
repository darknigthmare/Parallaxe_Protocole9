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
