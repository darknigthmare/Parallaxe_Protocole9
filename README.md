# PARALLAXE — Protocole 9

**Édition jouable 0.4.1 · 29 octobre 2026**
Jeu original d’observation et d’horreur psychologique en 3D, pour **2 à 4 inspecteurs**, avec entraînement solo à deux perceptions.

Vous êtes au même endroit. Vous ne voyez pas la même chose. Décrivez vos observations au talkie, comparez vos reflets et rendez un diagnostic commun avant que le lieu ne vous retienne.

La version **0.4.1** réunit les sources 0.4.0 récupérées du Site et les correctifs de la PR #2 : décisions coopératives liées au bon passage, anciennes réponses réseau ignorées, radio arrêtée lors des interruptions, gestes tactiles réinitialisés et retard du reflet stable à haute fréquence. Le **Chalet de service**, les **96 anomalies**, les lectures privées et les douze anomalies radio de la 0.4 sont conservés. Voir les [notes 0.4.1](docs/RELEASE_0.4.1.md) et la [réconciliation des sources](docs/SOURCE_RECONCILIATION_2026-10-29.md).

## Jouer ou télécharger

- [Version hébergée](https://parallaxe-protocole-neuf.darknigthmare.chatgpt.site/) : cette édition conserve son accès privé ; les invités doivent y avoir accès.
- [Jeu PC / réseau local précompilé](public/downloads/PARALLAXE_Jeu_PC_LAN_v0.4.1.zip) : sur GitHub, utiliser « Download raw file » pour télécharger le ZIP.
- [Conception et suivi Excel](docs/PARALLAXE_Design_Complet.xlsx).
- [Inspecteur 3D animé au format GLB](public/models/inspecteur-parallaxe.glb), avec [fiche technique](public/models/inspecteur-parallaxe.manifest.json).
- [Sources complètes](public/downloads/PARALLAXE_Sources_v0.4.1.zip), ou **Code → Download ZIP** dans le dépôt.
- [Manifeste du paquet 0.4.1](public/downloads/PARALLAXE_v0.4.1_manifest.json) et [empreintes SHA-256](public/downloads/PARALLAXE_v0.4.1_SHA256SUMS.txt) : construction propre `fa9cf63`, archive extraite et testée.

**Correctifs de la PR #2 :** le workflow [GitHub Actions](https://github.com/darknigthmare/Parallaxe_Protocole9/actions/workflows/ci.yml) prépare désormais un artefact `parallaxe-pc-lan-<commit>-<exécution>-<tentative>`. Il est publié seulement après une validation réussie et contient les ZIP PC et sources reconstruits, `COMMIT.txt`, `SHA256SUMS.txt` et le manifeste. La CI vérifie le contenu et lance le serveur depuis une extraction du ZIP avec deux clients. Les archives 0.4.1 et les artefacts de CI identifient leur révision exacte ; les anciennes archives restent historiques. Consulter [le suivi de jouabilité](docs/suivi-jouabilite-20261029.json) pour les preuves.

Le paquet précompilé requiert **Node.js 22.13 ou ultérieur**, un navigateur compatible **WebGL 2** et une accélération graphique fonctionnelle. Il ne nécessite pas `npm install`. Extraire entièrement l’archive avant de lancer le jeu.

**Windows :** ouvrir `LANCER_JEU_WINDOWS.cmd`.
**macOS / Linux :** exécuter `sh lancer_jeu.sh`.
Puis ouvrir `http://localhost:4174`.

## Quatre lieux, deux parcours

| Lieu | Référence à apprendre | Atmosphère |
| --- | --- | --- |
| **Saint-Clair** | Chambres 901–904, horloge, réception, plantes, chariot et miroir | Hôtel boisé, service absent, pluie derrière les vitres |
| **Terminus 09** | Quai vide, rails parallèles, signal vert, panneau QUAI 09 / SERVICE TERMINÉ | Station désaffectée, éclairage froid, tunnel sans départ |
| **Aile blanche** | Un lit au sol, moniteur FC 072, paravent vide, fauteuil roulant immobile | Clinique de nuit et unité de soins désertée |
| **Chalet de service** | Table à quatre pieds, tasse et carnet, foyer vide, garde-corps et fenêtre sur le hangar | Module de bois hors de la campagne |

**La traversée** enchaîne les trois lieux. Il faut trois diagnostics corrects dans chaque secteur, soit neuf au total. Le premier passage de chaque lieu est une référence normale et n’est pas noté. Une erreur remet à zéro les validations du secteur en cours ; les secteurs terminés restent acquis. Trois erreurs terminent une session standard. L’observation libre supprime la limite d’erreurs.

**Lieu au choix** permet de rester dans l’un des quatre décors, y compris le chalet. Il reprend la règle de neuf bons diagnostics consécutifs ; une erreur remet cette série à zéro. Les sauvegardes solo de l’édition 0.1 sont reprises avec cette règle dans l’hôtel.

Il peut y avoir une anomalie ou un passage conforme. Un détail anormal vu par une seule personne suffit pour toute l’équipe. Tous les votes doivent être identiques avant de résoudre le passage ; chacun peut modifier son avis tant qu’il n’y a pas d’unanimité. Le serveur conserve la réponse et attribue à chacun sa perception.

Certains indices restent plausibles lorsqu’on les observe seul. Les codes RELAIS, les indications SYNCHRO ou les flèches peuvent changer normalement d’un passage à l’autre, mais doivent concorder entre joueurs dans un même passage. La discussion devient nécessaire pour découvrir la contradiction.

## Lire et comparer les nouveaux repères

À Saint-Clair, le **bureau D2** présente une chambre assignée, un dossier tamponné et un journal. La **consigne C9** expose deux valises de formes distinctes, étiquetées 09 et 18. Les valeurs de ces supports peuvent changer normalement entre passages ; elles doivent concorder entre les inspecteurs d’un même passage. Une valeur plausible isolée peut donc cacher une contradiction collective.

Le **poste 09** ajoute un sablier, une tasse et un râtelier. Le sable descend, la vapeur monte et une seule clé 09 est suspendue. Les anomalies inversent réellement les trajectoires ou ajoutent une seconde clé.

La **réception R9** ajoute un registre d’arrivée, le règlement et le compteur des inspecteurs présents. La **galerie G9** présente une photographie météo, la photographie de l’ancienne équipe et le plan des chambres. Un gant de contrôle complète la consigne C9. Les noms du registre, la météo et la main du gant peuvent varier normalement entre passages ; ils doivent concorder entre les perceptions d’un même passage. Le carnet **J** décrit chaque référence. En solo, Alpha et Bêta restent les deux perceptions d’un même inspecteur : leur bascule ne modifie pas le registre ni le compteur.

Dans le **Chalet de service**, comparez la taille de la table et inspectez le fond du foyer. Le garde-corps délimite la même zone pour tous et laisse toujours le passage de droite ouvert. Le chalet reprend aussi les effets compatibles du corps, du reflet, des signaux et de la radio.

Visez un support et appuyez sur **E** pour agrandir son relevé lorsqu’il est disponible. Cette lecture reprend votre perception locale. Elle ne rend pas le verdict à votre place. Le talkie reste utilisable pendant la lecture.

Terminus 09 possède un tableau d’archives fixe, un plan de ligne et un compteur de portique scellé. Aile blanche possède deux plaques de lit distinctes — couloir et salle vitrée — et un dispositif de démonstration de perfusion. Ces repères complètent la référence de chaque lieu.

## Les talkies

Ouvrir le panneau radio depuis le salon ou pendant l’inspection. **Activer mon microphone** déclenche la demande de permission du navigateur. Le microphone est ensuite muet tant que la touche **T** ou le bouton de transmission n’est pas maintenu. **Écouter sans microphone** permet de recevoir les autres joueurs sans autoriser de capture.

La voix circule réellement en WebRTC. La réception applique une bande passante réduite, une compression, une légère saturation et des bruits de porteuse. Certaines anomalies ajoutent un écho, des parasites, une coupure, une modulation, un changement de canal ou un retour après la fin. Chaque destinataire possède son propre traitement : deux inspecteurs peuvent entendre différemment la même personne.

Le **test de calibration** joue un clic d’ouverture, le code du panneau RELAIS en tonalités téléphoniques DTMF, trois tonalités `1 · 2 · 3`, puis un clic final et du silence. Son relevé écrit rend les douze anomalies radio résolubles sans microphone, sans partenaire parlant ou en mode silencieux. Les nouveaux cas incluent clic final absent, contre-code, canal gauche seul, longue réverbération, séquence `1 · 3 · 2` et quatrième impulsion après clôture. Le code chiffré et l’ordre des tonalités sont des preuves de calibration synthétique. Une erreur de connexion est affichée séparément ; elle ne modifie pas le résultat du contrôle.

Le bouton **Arrêter le test** coupe aussi une préparation audio encore en attente. Le réglage **Radio mono** répartit la réception sur les deux oreilles ; le relevé conserve l’indice du canal généré par le jeu, sans prétendre mesurer votre casque.

Le serveur du jeu n’enregistre pas la voix. Il échange seulement la signalisation nécessaire aux connexions et les états des talkies. La sortie du salon ferme les connexions et arrête les pistes. Une transmission est aussi coupée au relâchement, à la perte de focus, quand la page est masquée et après 30 secondes d’appui continu.

**Pour le microphone, HTTPS ou localhost est nécessaire.** Une adresse réseau locale en HTTP permet le jeu et le texte, mais bloque l’accès au micro. Certains réseaux Internet nécessitent aussi un relais TURN configuré par l’hébergeur. Voir [la configuration radio complète](docs/RADIO.md).

## Inspecteurs, corps et reflets

Les personnages sont des modèles procéduraux originaux, articulés : tête, casque, visière, bras, mains, doigts, jambes, chaussures, tenue, harnais, sac et talkie. Le joueur voit son corps en baissant le regard. Les coéquipiers ont une couleur et un indicatif distincts ; leurs positions sont interpolées et leurs bras réagissent à la transmission.

L’inspecteur exporté contient **53 990 triangles, 58 maillages et 12 articulations rigides**, avec trois clips : Marche, Radio et Salut. Le fichier GLB conserve les matériaux PBR et s’importe indépendamment dans un outil 3D. Son animation utilise des nœuds articulés ; il ne s’agit pas d’un personnage à déformation souple de la peau. Les lettrages des badges et les étiquettes de nom générés dans le jeu ne sont pas embarqués dans cet export.

Les nouvelles anomalies peuvent rendre un badge vierge, agrandir le corps, changer la main du talkie, déplacer les yeux sous la visière ou soulever les pieds de 20 cm. Le reflet peut rester assis sur un tabouret vide ou porter un autre numéro de badge. En solo, le corps local ou son reflet fournit la preuve.

Les miroirs et les vitres utilisent des réflexions planaires. Le corps complet apparaît dans ces captures, tandis que les éléments qui obstrueraient la caméra à la première personne sont masqués dans la vue directe. Des anomalies peuvent retarder le reflet, le rendre indépendant, retirer le corps réfléchi, ajouter un double ou transformer un inspecteur en mannequin. Les variantes solo possèdent une preuve sur le corps local ou dans son reflet.

La version 0.4.0 ajoute une porte présente uniquement dans le miroir et la disparition des coéquipiers dans le reflet, avec conservation du corps propre. Sans coéquipier présent, deux mannequins numérotés T1 et T2 servent de témoins physiques et réfléchis ; ils ne comptent pas comme membres de l’équipe. L’hôtel peut aussi présenter une cinquième porte, des racines sous un seuil, de l’eau qui remonte le mur et un joint de sortie qui respire. Ces effets préservent les collisions communes.

La scène utilise des matériaux PBR, des ombres, une lampe, des surfaces réfléchissantes et des géométries détaillées. Les qualités graphiques ajustent notamment la résolution et les captures de réflexion. Les modèles sont définis dans le code ; cette livraison ne prétend pas fournir des personnages sculptés et capturés pour une production AAA.

## Commandes

| Action | Clavier / souris |
| --- | --- |
| Se déplacer | ZQSD, WASD ou flèches |
| Regarder | Souris ; clic dans la scène pour capturer le pointeur, ou cliquer-glisser |
| Accélérer | Maj gauche, hors mode de confort |
| Signaler ou examiner le support visé | E |
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

Après compilation, `npm run package:release` prépare les archives dans `outputs/release-v0.4.1/` et leurs copies téléchargeables dans `public/downloads/`. Le nom des archives et la version du paquet portable reprennent la version complète de `package.json`, y compris le numéro de correctif. La commande exclut sessions, clés, variables privées et dépendances installées. Le paquet PC contient le ZIP des sources pour rendre ce téléchargement disponible hors ligne ; il n’embarque jamais sa propre archive.

### Édition hébergée

Le projet comprend le frontend Vinext et un backend Cloudflare D1. `npm run dev` démarre le développement hébergé ; `npm run build` compile le Worker. `.openai/hosting.json` conserve l’identité de l’édition Sites existante, sans jeton de connexion.

Après génération de la configuration locale du Worker, appliquer la migration D1 locale avec :

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lowly_taskmaster.sql
```

La publication Sites gère sa base de production séparément. Les variables STUN/TURN sont décrites dans [RADIO.md](docs/RADIO.md). Aucun service payant ni relais TURN externe n’est créé automatiquement.

## Excel et conception

Le classeur [PARALLAXE_Design_Complet.xlsx](docs/PARALLAXE_Design_Complet.xlsx) contient **120 fiches d’anomalies**, dont **96 intégrées dans cette édition** et **24 conçues pour la suite**. La présence dans le code est distinguée d’une validation complète sur matériel réel.

Les fiches précisent référence normale, perceptions, comparaison attendue, déclencheurs, preuves, ressources, intensité et équité. Le classeur développe également campagne, lieux, personnages, radio, audio, accessibilité, narration, production et scénarios QA. La version 0.3.0 avait promu 27 fiches ; la version 0.4.0 en promeut quinze autres. Les 24 restantes gardent explicitement leur statut prévu. Les quinze onglets incluent le quatrième lieu et les correctifs réseau repris depuis GitHub.

`docs/anomalies-design.json` conserve la conception structurée. `src/game/catalog.ts` est la référence des cas **effectivement sélectionnés par le moteur**, avec leurs lieux compatibles.

Le classeur livré se modifie directement dans Excel. Son générateur `scripts/build-design-workbook.mjs` utilise `@oai/artifact-tool`, fourni par l’environnement d’édition des documents et absent des dépendances du jeu. La compilation et l’exécution du jeu ne nécessitent pas cet outil.

## Guides de développement

Les [consignes du dépôt](AGENTS.md) et le [guide du projet](docs/GAMEDEV_GUIDANCE.md) relient onze références gamedev fixées à une révision aux systèmes réels de PARALLAXE. Les sources du Site ont été récupérées puis comparées aux correctifs de la PR #2 ; le [rapport de réconciliation](docs/SOURCE_RECONCILIATION_2026-10-29.md) décrit les choix de fusion.

Le [classeur de reprise](docs/PARALLAXE_Suivi_Reprise_2026-10-28.xlsx), les [résultats 0.4.1](docs/qa-final-v0.4.1.json) et le [suivi de jouabilité](docs/suivi-jouabilite-20261029.json) distinguent les contrôles automatisés des essais encore nécessaires sur appareils.

## Vérification

```sh
npm run typecheck
npm test
npm run test:scene
npm run test:movement
npm run test:cabin
npm run test:inspection
npm run test:radio
npm run test:radio-ui
npm run test:radio-config
npm run build
npm run build:local
npm run test:portable
npm run package:release
python3 tests/package-archive.test.py
```

Le workflow GitHub Actions reprend ces contrôles. Le test D1 s’exécute séparément avec `PARALLAXE_TEST_URL=http://adresse-du-serveur npm run test:network` et crée uniquement des salons de contrôle. Les preuves et limites sont dans [QA.md](docs/QA.md) et [le rapport réseau v0.2](docs/qa-network-v0.2.json). Les [notes de version 0.4.0](docs/RELEASE_0.4.0.md), les [notes de version 0.3.0](docs/RELEASE_0.3.0.md), le [correctif 0.2.1](docs/RELEASE_0.2.1.md) et [l’édition 0.2](docs/RELEASE_0.2.md) conservent l’historique.

**La recette navigateur v0.4.0 n’a pas pu commencer : la route d’aperçu a refusé la connexion.** Le GPU désactivé et la liaison ICE incomplète observés en v0.2 restent des résultats historiques ; ils n’ont pas été remesurés ici. Les tests CPU de géométrie, de logique et de réseau ne remplacent pas l’évaluation des pixels, des shaders, du confort et des FPS sur un vrai GPU. La capture avec microphones physiques, l’écoute humaine de la distorsion et les connexions entre réseaux Internet avec TURN restent à vérifier sur les appareils cibles. Ces essais et les contenus non réalisés sont suivis dans le classeur.

## Structure

| Chemin | Rôle |
| --- | --- |
| `app/game.tsx` | Interface, commandes, solo et client coopératif |
| `app/mission-selector.tsx`, `app/radio-panel.tsx` | Parcours et talkie |
| `src/game/scene.ts`, `locations.ts`, `cabin.ts` | Lieux, collisions, réflexions et effets |
| `src/game/avatar.ts` | Inspecteurs articulés et équipement |
| `src/game/radio.ts`, `radio-config.ts` | Voix, traitement, négociation et TURN |
| `src/game/audio.ts` | Ambiances et pas des quatre lieux |
| `src/game/catalog.ts`, `levels.ts`, `rules.ts` | Anomalies, références et progression |
| `src/game/session.ts` | Salons, perceptions privées, votes et signalisation |
| `app/api/session/route.ts` | Backend D1 et concurrence |
| `scripts/start-local.mjs`, `standalone/` | Édition Node indépendante |
| `docs/`, `tests/` | Excel, conception et preuves de vérification |

## Références

L’observation cyclique s’inscrit dans le genre de [The Exit 8](https://playism.com/en/game/the-exit-8/) et [The Cabin Factory](https://www.internationalcatstudios.com/). PARALLAXE possède ses lieux, textes, géométries, sons synthétisés, règles coopératives et anomalies originaux. Aucun modèle ou son de ces jeux n’a été extrait.

Références techniques : [connexions WebRTC](https://webrtc.org/getting-started/peer-connections), [relais TURN](https://webrtc.org/getting-started/turn-server), [permissions du microphone](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [Three.js](https://threejs.org/docs/). Les bibliothèques conservent leurs licences : [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).
