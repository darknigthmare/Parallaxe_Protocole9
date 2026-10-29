# PARALLAXE — Protocole 9

**Édition jouable 0.2.1 · 26 octobre 2026**
Jeu original d’observation et d’horreur psychologique en 3D, pour **2 à 4 inspecteurs**, avec entraînement solo à deux perceptions.

Vous êtes au même endroit. Vous ne voyez pas la même chose. Décrivez vos observations au talkie, comparez vos reflets et rendez un diagnostic commun avant que le lieu ne vous retienne.

Le correctif **0.2.1** empêche une autorisation microphone tardive de réactiver la capture après l’extinction du talkie. Une demande annulée ne peut plus perturber une activation suivante. L’interface libère immédiatement son attente lors de l’extinction et ignore les réponses des anciennes demandes. Voir les [notes de version 0.2.1](docs/RELEASE_0.2.1.md).

## Jouer ou télécharger

- [Version hébergée](https://parallaxe-protocole-neuf.darknigthmare.chatgpt.site/) : cette édition conserve son accès privé ; les invités doivent y avoir accès.
- [Jeu PC / réseau local précompilé](public/downloads/PARALLAXE_Jeu_PC_LAN_v0.2.1.zip) : sur GitHub, utiliser « Download raw file » pour télécharger le ZIP.
- [Conception et suivi Excel](docs/PARALLAXE_Design_Complet.xlsx).
- [Inspecteur 3D animé au format GLB](public/models/inspecteur-parallaxe.glb), avec [fiche technique](public/models/inspecteur-parallaxe.manifest.json).
- [Sources complètes](public/downloads/PARALLAXE_Sources_v0.2.1.zip), ou **Code → Download ZIP** dans le dépôt.

Le paquet précompilé requiert **Node.js 22.13 ou ultérieur**, un navigateur compatible **WebGL 2** et une accélération graphique fonctionnelle. Il ne nécessite pas `npm install`. Extraire entièrement l’archive avant de lancer le jeu.

**Windows :** ouvrir `LANCER_JEU_WINDOWS.cmd`.
**macOS / Linux :** exécuter `sh lancer_jeu.sh`.
Puis ouvrir `http://localhost:4174`.

## Trois lieux, deux parcours

| Lieu | Référence à apprendre | Atmosphère |
| --- | --- | --- |
| **Saint-Clair** | Chambres 901–904, horloge, réception, plantes, chariot et miroir | Hôtel boisé, service absent, pluie derrière les vitres |
| **Terminus 09** | Quai vide, rails parallèles, signal vert, panneau QUAI 09 / SERVICE TERMINÉ | Station désaffectée, éclairage froid, tunnel sans départ |
| **Aile blanche** | Un lit au sol, moniteur FC 072, paravent vide, fauteuil roulant immobile | Clinique de nuit et unité de soins désertée |

**La traversée** enchaîne les trois lieux. Il faut trois diagnostics corrects dans chaque secteur, soit neuf au total. Le premier passage de chaque lieu est une référence normale et n’est pas noté. Une erreur remet à zéro les validations du secteur en cours ; les secteurs terminés restent acquis. Trois erreurs terminent une session standard. L’observation libre supprime la limite d’erreurs.

**Lieu au choix** permet de rester dans l’un des trois décors. Il reprend la règle de neuf bons diagnostics consécutifs ; une erreur remet cette série à zéro. Les sauvegardes solo de l’édition 0.1 sont reprises avec cette règle dans l’hôtel.

Il peut y avoir une anomalie ou un passage conforme. Un détail anormal vu par une seule personne suffit pour toute l’équipe. Tous les votes doivent être identiques avant de résoudre le passage ; chacun peut modifier son avis tant qu’il n’y a pas d’unanimité. Le serveur conserve la réponse et attribue à chacun sa perception.

Certains indices restent plausibles lorsqu’on les observe seul. Les codes RELAIS, les indications SYNCHRO ou les flèches peuvent changer normalement d’un passage à l’autre, mais doivent concorder entre joueurs dans un même passage. La discussion devient nécessaire pour découvrir la contradiction.

## Les talkies

Ouvrir le panneau radio depuis le salon ou pendant l’inspection. **Activer mon microphone** déclenche la demande de permission du navigateur. Le microphone est ensuite muet tant que la touche **T** ou le bouton de transmission n’est pas maintenu. **Écouter sans microphone** permet de recevoir les autres joueurs sans autoriser de capture.

La voix circule réellement en WebRTC. La réception applique une bande passante réduite, une compression, une légère saturation et des bruits de porteuse. Certaines anomalies ajoutent un écho, des parasites, une coupure, une modulation, un changement de canal ou un retour après la fin. Chaque destinataire possède son propre traitement : deux inspecteurs peuvent entendre différemment la même personne.

Le **test de calibration** joue normalement trois tonalités, `1 · 2 · 3`, puis du silence. Son relevé écrit rend les anomalies radio résolubles sans microphone, sans partenaire parlant ou en mode silencieux. Une erreur de connexion est affichée séparément ; elle ne modifie pas le résultat du contrôle.

Le serveur du jeu n’enregistre pas la voix. Il échange seulement la signalisation nécessaire aux connexions et les états des talkies. La sortie du salon ferme les connexions et arrête les pistes. Une transmission est aussi coupée au relâchement, à la perte de focus, quand la page est masquée et après 30 secondes d’appui continu.

**Pour le microphone, HTTPS ou localhost est nécessaire.** Une adresse réseau locale en HTTP permet le jeu et le texte, mais bloque l’accès au micro. Certains réseaux Internet nécessitent aussi un relais TURN configuré par l’hébergeur. Voir [la configuration radio complète](docs/RADIO.md).

## Inspecteurs, corps et reflets

Les personnages sont des modèles procéduraux originaux, articulés : tête, casque, visière, bras, mains, doigts, jambes, chaussures, tenue, harnais, sac et talkie. Le joueur voit son corps en baissant le regard. Les coéquipiers ont une couleur et un indicatif distincts ; leurs positions sont interpolées et leurs bras réagissent à la transmission.

L’inspecteur exporté contient **52 444 triangles, 51 maillages et 12 articulations rigides**, avec trois clips : Marche, Radio et Salut. Le fichier GLB conserve les matériaux PBR et s’importe indépendamment dans un outil 3D. Son animation utilise des nœuds articulés ; il ne s’agit pas d’un personnage à déformation souple de la peau. Les lettrages des badges et les étiquettes de nom générés dans le jeu ne sont pas embarqués dans cet export.

Les miroirs et les vitres utilisent des réflexions planaires. Le corps complet apparaît dans ces captures, tandis que les éléments qui obstrueraient la caméra à la première personne sont masqués dans la vue directe. Des anomalies peuvent retarder le reflet, le rendre indépendant, retirer le corps réfléchi, ajouter un double ou transformer un inspecteur en mannequin. Les variantes solo possèdent une preuve sur le corps local ou dans son reflet.

La scène utilise des matériaux PBR, des ombres, une lampe, des surfaces réfléchissantes et des géométries détaillées. Les qualités graphiques ajustent notamment la résolution et les captures de réflexion. Les modèles sont définis dans le code ; cette livraison ne prétend pas fournir des personnages sculptés et capturés pour une production AAA.

## Commandes

| Action | Clavier / souris |
| --- | --- |
| Se déplacer | ZQSD, WASD ou flèches |
| Regarder | Souris ; clic dans la scène pour capturer le pointeur, ou cliquer-glisser |
| Accélérer | Maj gauche, hors mode de confort |
| Signaler l’objet visé | E |
| Diagnostic | V ou terminal de sortie |
| Lampe | F |
| Carnet de référence du lieu | J |
| Talkie | Maintenir T, après activation du microphone |
| Changer de perception solo | Tab ou bouton Alpha/Bêta |
| Pause / fermer une modale | Échap |

**Manette pendant l’exploration :** sticks pour marcher et regarder ; A pour signaler, X pour le diagnostic, Y pour la lampe, LB pour le talkie, View pour le carnet et Menu pour la pause. Les menus restent utilisables avec leurs boutons à l’écran.

**Tactile :** joystick gauche, glissement à droite pour regarder, boutons d’action et de talkie. Réglages : volumes d’ambiance et de radio séparés, silence, sensibilité, qualité et confort visuel.

## Coopération sur le réseau local

Depuis l’archive précompilée :

```sh
node scripts/start-local.mjs --lan
```

Le terminal donne les adresses à ouvrir sur les autres appareils. Tous utilisent la même adresse de serveur et le même code de salon. L’ordinateur hôte doit rester allumé. Le pare-feu peut demander d’autoriser Node.js sur le réseau privé. `--lan` n’ouvre pas automatiquement de port Internet.

Pour la voix depuis les autres appareils, fournir un certificat HTTPS déjà approuvé par ces appareils et correspondant au nom utilisé :

```sh
node scripts/start-local.mjs --lan --cert=/chemin/certificat.pem --key=/chemin/cle-privee.pem
```

Sans `--lan`, le serveur écoute uniquement sur `127.0.0.1`. Choisir un autre port avec `--port=4180`. Les salons temporaires de `.parallaxe-data/`, les clés privées et les variables locales sont exclus du dépôt et des archives.

## Développer à partir des sources

```sh
npm ci
npm run build:local
npm run local
```

Après modification, recompiler avec `npm run build:local` ou utiliser `npm run local -- --build`. Le frontend autonome réutilise le même jeu et les mêmes règles que l’édition hébergée ; le serveur Node réutilise les mêmes sessions autoritaires.

Pour recréer les archives, travailler depuis un clone Git du dépôt : `git clone https://github.com/darknigthmare/Parallaxe_Protocole9.git`. La commande de packaging utilise l’inventaire Git ; le ZIP des sources suffit pour développer et jouer avec les commandes ci-dessus, mais ne contient pas de dépôt Git.

Après compilation, `npm run package:release` prépare les archives dans `outputs/release-v0.2.1/` et leurs copies téléchargeables dans `public/downloads/`. Le nom des archives et la version du paquet portable reprennent la version complète de `package.json`, y compris le numéro de correctif. La commande exclut sessions, clés, variables privées et dépendances installées. Le paquet PC contient le ZIP des sources pour rendre ce téléchargement disponible hors ligne ; il n’embarque jamais sa propre archive.

### Édition hébergée

Le projet comprend le frontend Vinext et un backend Cloudflare D1. `npm run dev` démarre le développement hébergé ; `npm run build` compile le Worker. `.openai/hosting.json` conserve l’identité de l’édition Sites existante, sans jeton de connexion.

Après génération de la configuration locale du Worker, appliquer la migration D1 locale avec :

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lowly_taskmaster.sql
```

La publication Sites gère sa base de production séparément. Les variables STUN/TURN sont décrites dans [RADIO.md](docs/RADIO.md). Aucun service payant ni relais TURN externe n’est créé automatiquement.

## Excel et conception

Le classeur [PARALLAXE_Design_Complet.xlsx](docs/PARALLAXE_Design_Complet.xlsx) contient **120 fiches d’anomalies**, dont **54 intégrées dans cette édition** et **66 conçues pour la suite**. La présence dans le code est distinguée d’une validation complète sur matériel réel.

Les fiches précisent référence normale, perceptions, comparaison attendue, déclencheurs, preuves, ressources, intensité et équité. Le classeur développe également campagne, lieux, personnages, radio, audio, accessibilité, narration, production et scénarios QA. Les huit anciens dossiers de plafond, mur, bagage, paravent, lit, train d’ombre, flèche et horloge sont désormais promus dans le contenu jouable.

`docs/anomalies-design.json` conserve la conception structurée. `src/game/catalog.ts` est la référence des cas **effectivement sélectionnés par le moteur**, avec leurs lieux compatibles.

Le classeur livré se modifie directement dans Excel. Son générateur `scripts/build-design-workbook.mjs` utilise `@oai/artifact-tool`, fourni par l’environnement d’édition des documents et absent des dépendances du jeu. La compilation et l’exécution du jeu ne nécessitent pas cet outil.

## Guides de développement

Les [consignes du dépôt](AGENTS.md) et le [guide adapté à PARALLAXE](docs/GAMEDEV_GUIDANCE.md) relient dix références de `awesome-gamedev-agent-skills` aux scènes Three.js, aux anomalies, aux personnages, à la radio et aux vérifications existantes. Les sources sont [fixées à une révision précise](docs/gamedev-sources.json).

Le relevé distingue cette base GitHub 0.2.1 de l'édition 0.4.0 signalée dans la [PR de reprise #2](https://github.com/darknigthmare/Parallaxe_Protocole9/pull/2). Consulter le guide pour la réconciliation des sources et les limites de validation avant une nouvelle livraison.

## Vérification

```sh
npm run typecheck
npm test
npm run test:scene
npm run test:radio
npm run test:radio-ui
npm run build:local
npm run test:portable
```

Le workflow GitHub Actions reprend ces contrôles. Le test D1 s’exécute séparément avec `PARALLAXE_TEST_URL=http://adresse-du-serveur npm run test:network` et crée uniquement des salons de contrôle. Les preuves et limites sont dans [QA.md](docs/QA.md) et [le rapport réseau v0.2](docs/qa-network-v0.2.json). Les [notes du correctif 0.2.1](docs/RELEASE_0.2.1.md) complètent [l’historique de l’édition 0.2](docs/RELEASE_0.2.md).

**Le navigateur de contrôle désactive WebGL.** Les tests CPU de géométrie, de logique et de réseau ne remplacent pas l’évaluation des pixels, des shaders, du confort et des FPS sur un vrai GPU. La capture avec microphones physiques, l’écoute humaine de la distorsion et les connexions entre réseaux Internet avec TURN restent à vérifier sur les appareils cibles. Ces essais et les contenus non réalisés sont suivis dans le classeur.

## Structure

| Chemin | Rôle |
| --- | --- |
| `app/game.tsx` | Interface, commandes, solo et client coopératif |
| `app/mission-selector.tsx`, `app/radio-panel.tsx` | Parcours et talkie |
| `src/game/scene.ts`, `locations.ts` | Lieux, collisions, réflexions et effets |
| `src/game/avatar.ts` | Inspecteurs articulés et équipement |
| `src/game/radio.ts`, `radio-config.ts` | Voix, traitement, négociation et TURN |
| `src/game/audio.ts` | Ambiances et pas des trois lieux |
| `src/game/catalog.ts`, `levels.ts`, `rules.ts` | Anomalies, références et progression |
| `src/game/session.ts` | Salons, perceptions privées, votes et signalisation |
| `app/api/session/route.ts` | Backend D1 et concurrence |
| `scripts/start-local.mjs`, `standalone/` | Édition Node indépendante |
| `docs/`, `tests/` | Excel, conception et preuves de vérification |

## Références

L’observation cyclique s’inscrit dans le genre de [The Exit 8](https://playism.com/en/game/the-exit-8/) et [The Cabin Factory](https://www.internationalcatstudios.com/). PARALLAXE possède ses lieux, textes, géométries, sons synthétisés, règles coopératives et anomalies originaux. Aucun modèle ou son de ces jeux n’a été extrait.

Références techniques : [connexions WebRTC](https://webrtc.org/getting-started/peer-connections), [relais TURN](https://webrtc.org/getting-started/turn-server), [permissions du microphone](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [Three.js](https://threejs.org/docs/). Les bibliothèques conservent leurs licences : [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).
