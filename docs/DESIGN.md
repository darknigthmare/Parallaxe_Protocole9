# PARALLAXE — Protocole 9

## Document de conception · édition 0.4.0

28 octobre 2026. Jeu original d’inspection coopérative à perceptions divergentes, pour un à quatre joueurs. La coopération en ligne concerne deux à quatre inspecteurs ; l’entraînement solo permet de comparer deux perceptions successivement.

**La règle centrale : les joueurs occupent le même lieu, mais ne reçoivent pas toujours la même réalité. Ils doivent décrire, comparer puis décider ensemble si le passage est conforme.** Une anomalie vue par une seule personne suffit à rendre le passage anormal. Le nombre de témoins d’accord ne remplace pas une preuve.

Le classeur [PARALLAXE_Design_Complet.xlsx](PARALLAXE_Design_Complet.xlsx) contient 120 fiches originales détaillées. Le catalogue runtime 0.4.0 en intègre 96 ; les 24 autres restent des spécifications de production. Les statuts du classeur séparent présence dans le code, vérification ciblée, essais matériels encore ouverts et conception future. Les sources de vérité sont [catalog.ts](../src/game/catalog.ts), [rules.ts](../src/game/rules.ts), [levels.ts](../src/game/levels.ts) et le bilan [QA.md](QA.md).

## 1. Expérience recherchée

La tension vient d’un désaccord sincère : « Je vois quelqu’un derrière le paravent », « De mon côté il est vide ». La bonne réponse consiste à fixer un repère, décrire le fait puis vérifier. Le jeu récompense une méthode collective, sans désigner un saboteur secret et sans demander de croire automatiquement la majorité.

Trois formes de preuves se complètent :

- **Altération personnelle visible.** Un lit se soulève, un plafond paraît trop proche, une ombre de rame traverse un quai vide. Un témoin constate un changement ; un autre conserve la référence.
- **Contradiction relationnelle.** Deux codes, flèches ou heures sont plausibles seuls. Leur incompatibilité n’apparaît qu’après comparaison entre inspecteurs. Ces cas rendent la communication nécessaire même si chacun a bonne mémoire.
- **Transformation de réception.** Les talkies transportent une vraie voix, mais la réception de certains inspecteurs peut être altérée. Un étalonnage déterministe et son relevé écrit permettent de vérifier l’effet sans dépendre de la qualité du réseau ou du microphone.

Le ton est une horreur d’observation : temps suspendu, espaces familiers devenus incohérents, présence supplémentaire, corps qui ne correspond plus à son reflet. Les traces sombres, yeux et silhouettes servent de faits observables. Aucune violence graphique ni attaque inévitable n’est nécessaire pour résoudre la boucle actuelle.

Les inspirations de genre sont l’observation de passages répétitifs de [The Exit 8, page officielle PLAYISM](https://playism.com/en/game/the-exit-8/) et l’inspection de cabines de [The Cabin Factory, studio International Cat](https://www.internationalcatstudios.com/). « Cabin examinator » est interprété comme cette seconde référence dans le brief. Les noms, textes, modèles procéduraux, règles coopératives et anomalies de PARALLAXE sont créés pour ce projet ; les ressources de ces jeux ne sont pas réutilisées.

## 2. Boucle jouable

### Préparer une inspection

Le responsable crée une salle avec mode, difficulté et pseudonyme. Les autres rejoignent par son code. Le serveur confirme les identités, autorise les actions et conserve la vérité du passage. L’entraînement solo reprend les mêmes règles de diagnostic avec un basculement Alpha/Bêta.

Chaque lieu commence par une **référence non notée**. Le groupe peut mémoriser disposition, textes, lumière, reflets et appareils avant le premier tirage. La référence enseigne également les invariants variables : les valeurs de RELAIS, de SYNCHRO et de la flèche peuvent changer entre deux passages, mais elles doivent correspondre entre joueurs pendant un même passage. Les nouveaux repères BUREAU D2, CONSIGNE C9, dossier 09 et journal suivent la même règle de concordance, avec leurs domaines de valeurs propres.

### Observer, parler, comparer

Le groupe inspecte librement. Un message utile précise le repère, le fait et la vérification attendue : « Au miroir, mon corps est immobile mais le reflet lève la main. Est-ce que le tien fait pareil ? » Le talkie, la radio texte, le ping d’objet et le carnet soutiennent cet échange. Aucun décodage vocal automatique n’est requis.

Chaque membre choisit **Anomalie** ou **Conforme**. Les votes restent modifiables tant qu’ils divergent. La résolution exige l’accord des membres présents ; une majorité ne suffit pas. Un diagnostic coopératif ne se résout pas avec une seule personne présente. Le résultat et sa justification sont révélés après l’accord, puis le groupe passe à l’inspection suivante.

### Campagne de trois lieux

La campagne traverse **Saint-Clair → Terminus 09 → Aile blanche**. Chaque secteur demande trois diagnostics corrects consécutifs. La troisième réussite valide le palier, puis le lieu suivant s’ouvre sur une nouvelle référence sans anomalie.

| Situation | Progression conservée | Suite |
| --- | --- | --- |
| Trois réussites à Saint-Clair | 3 validations | Référence de Terminus 09 |
| Erreur au métro après une réussite | Palier 3 | Reprendre les trois validations du métro |
| Trois réussites au métro | 6 validations | Référence d’Aile blanche |
| Erreur en clinique après deux réussites | Palier 6 | Reprendre les trois validations de la clinique |
| Troisième réussite en clinique | 9 validations | Victoire et bilan |

La campagne ne demande donc pas neuf bonnes réponses sans interruption sur l’ensemble des lieux. Les paliers terminés restent acquis. Chaque erreur ajoute néanmoins une faute au total : **la troisième erreur termine une partie standard**. Le mode détendu supprime cette limite, en conservant la remise à zéro du secteur courant.

### Lieu au choix

Le mode de lieu unique conserve la règle initiale : choisir un des quatre décors, obtenir neuf diagnostics corrects consécutifs, revenir à zéro après une erreur. Standard et détendu appliquent la même différence de limite d’erreurs que la campagne.

Les sauvegardes solo de la v0.1 sont reprises comme inspections autonomes de l’hôtel, afin de préserver le sens de leur série de neuf. Les données de reprise invalides doivent être rejetées sans bloquer l’application.

### Tirage et distribution

La configuration initiale tire 68 % de passages anormaux et 32 % conformes, dans le catalogue compatible avec le lieu. Elle évite les cinq dernières anomalies tirées. Ces valeurs sont des réglages de conception à équilibrer par de vrais playtests.

À deux joueurs, un tour à anomalie affecte un seul témoin et conserve une vue normale. À trois ou quatre, le tirage peut affecter un ou deux témoins, en gardant au moins une référence personnelle normale. Les contradictions relationnelles distribuent des valeurs plausibles mais incompatibles. La comparaison doit porter sur le même repère et le même passage ; une variation d’édition ou d’assignation entre deux passages peut être normale. La structure et les positions sont communes ; les effets personnels ne sont pas exposés aux autres avant le résultat.

## 3. Les quatre architectures

### Saint-Clair — L’hôtel sans neuvième étage

Le lieu d’apprentissage possède réception, galerie, chambres, service, coin salon et façade vitrée. Les portes 901 à 904, l’horloge 03:09, les plantes vertes, le tableau rempli, le chariot et le mobilier au sol offrent une baseline concrète. La pluie ne contient aucune silhouette au normal.

Les anomalies propres à l’hôtel jouent sur la disparition, la substitution et l’état d’un objet : plaque 909, tableau vide, feuillage mort, téléphone suspendu, valise respirante. Le joueur peut décrire la différence sans connaître un terme technique de rendu.

La v0.3.0 ajoute un **bureau de contrôle D2**, une **consigne C9** et un **poste d’objets témoins**. Ces repères préservent la référence du chariot à une seule valise et les vraies portes 901–904.

| Repère | Référence normale | Comparaison attendue |
| --- | --- | --- |
| BUREAU D2 | Chambre assignée 204 ou 205 | Même numéro entre joueurs au même passage |
| DOSSIER 09 | Tampon VALIDÉ ou REFUSÉ | Même décision, sans incidence sur les règles de vote |
| Le Courrier de Saint-Clair | Édition du 26 ou du 27 octobre 2026 | Même date d’édition, indépendamment de la date de l’ordinateur |
| CONSIGNE C9 | Valises A rectangulaire et B arrondie, étiquettes 09 et 18 | Même correspondance entre côté, forme et étiquette |
| Sablier du poste 09 | Sable descendant | Observer réellement la direction des grains |
| Tasse du poste 09 | Vapeur montante | Suivre les volutes depuis le bord de la tasse |
| Râtelier du poste 09 | Une clé 09 | Compter les clés et lire leurs étiquettes |

Les quatre premières preuves sont relationnelles : une lecture isolée peut être parfaitement plausible. Les trois dernières portent sur un mouvement physique ou un nombre d’objets. La lecture agrandie d’un repère reste facultative ; elle doit montrer la valeur locale de l’objet, sans décider du vote pour le joueur.

La version 0.4.0 complète les supports par le **registre, le règlement et le compteur R9**, le **gant C9**, puis la **météo, l’ancienne équipe et le plan G9**. Une même lecture plausible du registre, du gant ou de la météo peut changer normalement entre passages ; un désaccord entre inspecteurs dans un même passage est la preuve relationnelle. La photo normale porte trois signatures fixes, le plan décrit les quatre vraies chambres et le compteur suit les membres présents. La bascule solo Alpha/Bêta ne change jamais cette population.

L’hôtel reçoit aussi une cinquième porte physique, des racines sous la chambre 901, des gouttes remontant le mur, un joint de sortie animé et une porte visible exclusivement dans le miroir principal. Chaque effet revient à la référence sans changer les collisions communes.

### Terminus 09 — Le dernier quai

Le métro possède un quai vide, une voie, un signal ferroviaire, un afficheur et sa propre architecture de carrelage et métal. La référence exacte est **QUAI 09 / SERVICE TERMINÉ**, signal vert et rails droits. Une rame présente constitue une anomalie ; elle ne fait pas partie du décor normal.

La distance et les lignes de perspective élargissent l’inspection. Les preuves propres au lieu sont rame impossible, destination incohérente, signal altéré, rails réorientés et ombre de train sans véhicule correspondant. Les zones dangereuses ne sont pas une étape de confirmation obligatoire. La nouvelle série ajoute un tableau d’archives statique : 01:09 T09 → OBSERVATOIRE, puis 01:12 T12 ← BELVÉDÈRE. Le plan suit BELVÉDÈRE → OBSERVATOIRE → TERMINUS 09 ; l’ajout de NULLE PART constitue la variante. Le compteur du portique SCELLÉ reste à 0000 au normal, et augmente toutes les 2,4 secondes dans sa variante, sans aucun franchissement demandé. Le tunnel sombre peut devenir un horizon diurne impossible. Ces supports ne rendent pas la voie praticable.

### Aile blanche — La clinique de nuit

La référence comporte **un seul lit vide au sol dans le couloir**, un moniteur **FC 072 / RYTHME SINUSAL**, un paravent sans présence et un fauteuil roulant immobile. Ces indications sont des objets de fiction à mémoriser ; aucune connaissance médicale n’est nécessaire.

Le lieu exploite proximité et nombre : lit qui se soulève, lit supplémentaire, silhouette derrière le tissu, paravent qui respire, fauteuil qui tourne et moniteur incohérent. La tension vient d’objets attendant quelqu’un dans une aile vide, sans patient souffrant représenté.

Le lit du couloir porte la plaque **09** ; un autre lit, dans la **salle vitrée distincte**, porte **10**. L’anomalie de plaque duplique 09 sur ce second lit. Elle se distingue du lit supplémentaire, qui change le nombre de lits dans le couloir. Une ombre d’occupant sans corps sur le matelas et des gouttes remontant dans une perfusion de démonstration complètent la série. Aucun patient ni geste de soin réel n’est demandé.

### Chalet de service — Le module témoin

La version 0.4.0 ouvre ce quatrième lieu en **Lieu au choix**, sans changer la campagne de trois secteurs ni ses sauvegardes. Le chalet assemblé dans un hangar possède une entrée, un vestiaire, une table à quatre pieds avec tasse et carnet, un foyer froid, des poutres de bois, une fenêtre, un miroir, un relais et le terminal de sortie.

La table normale mesure 2,10 × 1,40 m. Sa variante atteint 4,70 m de large vers le mur gauche ; le bord droit et les accessoires restent fixes. Une autre anomalie révèle un visage immobile au fond du conduit. Un garde-corps identique pour tous délimite la baie de la table et le chemin longeant le mur droit reste ouvert. La géométrie de collision ne dépend jamais de la perception privée.

Le chalet accueille les anomalies communes compatibles de lumière, sortie, RELAIS, SYNCHRO, corps, reflets et radio. Son pool se recoupe avec les autres lieux : il ne constitue pas autant de nouveaux identifiants.

### Ce qui reste à produire

L’observatoire côtier, le dépôt d’archives et la salle finale restent des extensions conçues. Chacune devra posséder architecture, référence, parcours et preuves propres. Le fait de figurer dans le classeur ne rend pas ces cartes accessibles dans la version livrée.

## 4. Talkies : vraie voix et anomalies vérifiables

### Utilisation actuelle

**Écouter la radio** active la réception sans demander le microphone. **Autoriser le microphone** ouvre séparément la permission du navigateur. La piste commence muette ; maintenir T, LB à la manette ou le bouton tactile émet, puis relâcher coupe la transmission. Un appui est limité à 30 secondes pour éviter une émission bloquée.

Perte de focus, page masquée, fermeture de la radio, modale, liaison déconnectée ou sortie du salon coupent l’émission. Désactiver le microphone arrête ses pistes ; l’écoute peut rester active. Le retour au menu ferme les connexions et le contexte vocal.

Le correctif 0.2.1 protège les autorisations de microphone qui se terminent après une extinction ou une sortie. La demande applicative est invalidée ; si le navigateur retourne tout de même un flux plus tard, ses pistes sont immédiatement arrêtées avant toute installation. Une ancienne réponse, positive ou négative, ne peut pas remplacer l’état d’une activation plus récente. Le contrôleur de l’interface invalide aussi son opération : l’extinction libère la commande sans attendre l’ancienne permission et une ancienne finalisation ne peut pas modifier l’attente d’une opération récente. Les tests utilisent des promesses différées et des pistes simulées ; ils ne constituent pas un essai de microphone physique.

Chaque paire d’inspecteurs utilise WebRTC ; quatre membres forment au maximum six liaisons entre pairs. La voix réelle est transmise par ces pistes. Le serveur autorise et distribue la signalisation, pas des fichiers vocaux. Le code n’utilise pas de mécanisme d’enregistrement applicatif ni de clonage de voix. Détails et paramètres : [RADIO.md](RADIO.md), [radio.ts](../src/game/radio.ts), [radio-config.ts](../src/game/radio-config.ts).

La réception normale passe par un filtre 330–3 300 Hz, une compression, une saturation légère et une enveloppe. Un souffle court de porteuse accompagne l’émission. Ces choix donnent une couleur de talkie ; leur présence dans le code ne certifie pas encore le confort du mix sur tous les casques.

### Douze preuves de contrôle et de réception

Le bouton **Étalonner** fonctionne sans micro et sans partenaire parlant. Il produit des sons synthétiques et une transcription privée des faits. Le protocole normal commence par un clic, encode les **quatre chiffres RELAIS en doubles tonalités synthétiques DTMF**, joue la **séquence principale 1 / 2 / 3**, puis se ferme par un clic. Les deux sections sont nommées dans le relevé : les quatre chiffres d’identification ne sont pas les trois étapes principales. Aucune voix parlée n’est synthétisée pour ce code.

| ID runtime | Fait anormal reproductible |
| --- | --- |
| `radio_echo` | Tonalités répétées en écho |
| `radio_chop` | Deuxième tonalité retirée |
| `radio_static` | Grésillement superposé |
| `radio_detune` | Modulation métallique |
| `radio_wrong_channel` | Séquence 9 / 9 / 0 |
| `radio_aftertone` | Porteuse basse après la fin |
| `radio_no_squelch` | Clic de fermeture absent |
| `radio_countercode` | Code DTMF différent du panneau RELAIS du même passage |
| `radio_left_only` | Signal généré entièrement à gauche, relevé G 100 / D 0 |
| `radio_wrong_room` | Queue de réverbération prolongée |
| `radio_order_swap` | Séquence principale 1 / 3 / 2 |
| `radio_pulse_inside` | Quatrième impulsion soufflée après le clic final |

Les profils appropriés transforment aussi la réception vocale locale. Le contre-code et l’ordre inversé portent sur la calibration ; ils ne réécrivent pas les paroles humaines. Aucun effet ne fabrique une phrase attribuée à un partenaire. Le relevé écrit décrit le signal généré sans choisir le vote à la place du joueur et sans prétendre mesurer son casque ou sa pièce.

La séquence principale commence à 2,00 secondes, puis continue à 2,55 et 3,10 secondes. Le clic final survient à 3,64 secondes. La queue normale dure 0,12 seconde ; la grande salle synthétique atteint 2,4 secondes. La quatrième impulsion soufflée survient après la clôture, de 4,05 à 4,90 secondes. Ces valeurs de production rendent les essais reproductibles ; leur intelligibilité et leur confort doivent aussi être éprouvés à l’écoute.

### Une panne n’est pas une anomalie

Permission refusée, microphone absent, réception bloquée et réseau défaillant ont un état technique séparé. Ils ne changent ni la vérité du passage ni la séquence fictionnelle d’étalonnage. Ainsi, un écho matériel ou des paquets perdus ne deviennent pas une fausse preuve de design. Le groupe peut toujours utiliser texte, repères et relevé de calibration.

Le microphone dépend d’un [contexte sécurisé et d’une permission utilisateur](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). Pour les cas du projet, utiliser HTTPS ou localhost ; une IP LAN en HTTP n’offre généralement pas cette permission. Un certificat doit être reconnu par les appareils clients. Le lanceur accepte certificat et clé fournis par l’hébergeur.

Une liaison directe peut échouer entre réseaux ; [TURN est le mécanisme de relais prévu par WebRTC](https://webrtc.org/getting-started/turn-server). Le serveur de PARALLAXE peut fournir aux membres authentifiés des identifiants temporaires calculés à partir d’un secret resté côté serveur. Cela ne déploie pas un service TURN automatiquement. Une recette avec relais réel, microphones physiques et navigateurs différents reste une vérification distincte.

## 5. Inspecteurs et reflets

La version actuelle comprend des corps procéduraux originaux, articulés et équipés, visibles localement, sur les coéquipiers et dans les surfaces réfléchies. Les états de locomotion et de talkie donnent une lecture de ce que fait un partenaire. Ce sont des modèles temps réel construits par code ; les humains sculptés et texturés photoréalistes restent un lot artistique futur.

Les miroirs et vitres utilisent des réflexions planaires de la scène. Ce dispositif fournit un vrai reflet de géométrie ; il ne constitue pas une affirmation de ray tracing. Le coût des passes, les pixels, l’éclairage et les angles extrêmes doivent être examinés sur GPU.

Les anomalies de corps et de reflet ont des preuves différentes :

- **Retard du reflet** : position et orientation reproduites environ une seconde après le corps. Tester son propre corps évite de confondre le phénomène avec une latence d’avatar distant.
- **Reflet absent** : le décor reste réfléchi, mais le corps local manque. Une surface entière noire n’est pas la même anomalie.
- **Salut autonome** : le reflet salue de la main droite et bouge légèrement la tête alors que le corps demeure immobile. Cette réalisation reprend la fiche historique « Le salut tardif » et conserve son ID PX.
- **Mannequin** : le premier vrai coéquipier prend une apparence rigide ; en solo, le corps local et son reflet portent la variante. Le membre conserve sa vraie identité dans l’interface.
- **Double** : un inspecteur supplémentaire apparaît sans devenir un membre réseau et sans recevoir vote ou liaison vocale.
- **Ombre autonome** : une forme humaine noire aplatie se détache au sol et tourne indépendamment, tandis que le corps réel reste normal.

La série 0.3.0 ajoute cinq altérations du corps désigné : badge vierge, taille excessive, talkie dans l’autre main, regard indépendant sous la visière et pieds sans contact au sol. Le premier pair présent selon son slot sert de cible ; après son départ, le suivant est choisi. Le corps local et son reflet servent de repli uniquement si aucun pair n’est présent. Le talkie est abaissé et visible sans PTT : **droite au normal, gauche dans la variante**. Un refus de microphone ne supprime donc jamais cette preuve.

Deux nouvelles preuves portent uniquement sur le reflet : posture assise tandis que le corps reste debout, et badge du slot suivant alors que le badge réel garde son identité. Aucun événement préalable consistant à s’asseoir n’est requis. Les coordonnées partagées, collisions et informations du roster restent stables ; seules les apparences locales sont modifiées.

La disparition collective de la v0.4.0 masque uniquement les autres inspecteurs dans la capture réfléchie ; le corps propre reste présent. Sans coéquipier présent, les deux mannequins témoins T1 et T2 restent visibles directement et normalement dans le miroir. Ils sont des repères hors équipe et ne changent ni le registre des joueurs ni le compteur. Les corps et les socles sont restaurés proprement après la capture.

L’export v0.3.0 [inspecteur-parallaxe.glb](../public/models/inspecteur-parallaxe.glb) accompagne les sources : 53 990 triangles, 58 maillages, 12 nœuds articulés et trois clips (Marche, Radio, Salut). La relecture GLTFLoader vérifie les sommets et animations ; le [manifeste](../public/models/inspecteur-parallaxe.manifest.json) précise les dimensions et limites. Il s’agit de pièces rigides articulées, sans skinning ; les matériaux sont PBR de base et le lettrage du badge runtime n’est pas embarqué. Le fichier mesure 4 825 784 octets et son emprise est de 0,6853 × 1,7522 × 0,508 m. Le rendu GPU reste à contrôler. Les animations d’anomalies et états de jeu sont fournis dans les sources du runtime ; ils ne font pas partie des trois clips de base du GLB. Son manifeste identifie la version et l’empreinte du modèle source.

Le roster, la connexion et les états d’autorisation demeurent fiables. Un faux corps appartient au décor fictionnel. Il ne doit pas ressembler à une perte de membre ou à une panne technique impossible à distinguer.

## 6. Règles de contenu et d’équité

Chaque fiche du classeur contient baseline, perceptions A/B, comparaison exacte, déclenchement, critère de preuve, garde-fous, besoins d’assets, intensité et statut. Les titres intégrés et les métadonnées runtime sont synchronisés depuis le code ; les colonnes de mise en scène et d’assets restent des intentions de conception lorsqu’elles dépassent le comportement actuel.

Une bonne anomalie doit être persistante assez longtemps pour être décrite, située par un repère commun et reconnaissable sans imposer un comportement punitif. Une collision partagée ne change pas parce qu’un seul inspecteur voit un meuble supplémentaire. La sortie et le vote restent accessibles sous brouillard ou obscurité.

Les réglages graphiques ne doivent pas supprimer une preuve. Une couleur seule demande une alternative de forme, état ou rythme. Une preuve audio doit avoir une équivalence jouable sans audition ; les contrôles radio fournissent leur relevé factuel, y compris la répartition gauche / droite et les durées synthétisées. La peur réduite, le remappage complet et les options avancées de caméra restent des lots de production lorsqu’ils ne sont pas explicitement présents dans le suivi.

Les intensités 1 à 5 sont des intentions de design : détail discret, étrangeté, malaise, présence inquiétante, confrontation visuelle forte. Elles ne représentent pas une classification officielle par âge. Difficulté et peur sont séparées : un code parfaitement calme peut nécessiter une comparaison plus exigeante qu’une silhouette évidente.

Les objets peuvent porter une instruction fictionnelle comme « Ne les crois pas ». L’interface conserve la règle réelle. Aucun écran de connexion, aucune permission de microphone ni aucun message d’erreur système n’est falsifié pour créer de la peur.

## 7. Production visuelle haute définition

La livraison actuelle est une base web 3D procédurale avec boucle et réseau réels. Une direction high poly aboutie demande un pipeline artistique et matériel supplémentaire. Le nombre de triangles ne remplace pas la qualité des volumes, du matériau, de l’animation et de la lumière.

Les lots prioritaires proposés sont radio, corps/mains, miroir, lit et afficheur de métro, parce qu’ils portent des preuves proches et répétées. Pour chaque asset :

1. Fixer échelle, silhouette, repère de jeu et variations normales/anormales.
2. Produire un sculpt haute définition original avec références et provenance conservées.
3. Créer une retopologie adaptée au temps réel et à la déformation attendue.
4. Déplier les UV et cuire normal, AO et détails avec cages et marges contrôlées.
5. Construire les textures PBR et vérifier leur réponse sous les éclairages des quatre lieux.
6. Pour les corps, produire squelette, poids, sockets de radio, animations et transitions.
7. Générer LOD, compression et profils, puis mesurer sur le parcours d’inspection réel.
8. Rejouer tous les effets et vérifier que la preuve n’a pas changé ou disparu.

Des sources 4K sont proposées pour les héros observés de près, 2K mutualisé pour certains accessoires et atlas pour les modules. Ce sont des budgets à ajuster après mesures, pas une promesse de chargement 4K partout. Les sources 8K n’ont d’intérêt que si un usage prouvé le justifie.

Pour chaque cible matérielle, publier configuration, résolution, profil, temps CPU/GPU, mémoire et passes de réflexion. Un objectif de 60 images/s à 1080p doit rester un objectif jusqu’à mesure. Aucune certification mobile ne découle d’une simulation de viewport desktop.

Les sources modifiables, exports, auteurs et licences doivent accompagner les futurs assets. La géométrie procédurale actuelle est conservée dans le dépôt. Un projet natif Unreal Engine, un installateur signé, une intégration Steam et les cinématiques finales constituent des lots distincts ; ils ne sont pas déduits de la présence de sources web ou d’une archive portable.

## 8. Réseau et robustesse

Le serveur conserve la vérité, le score, les phases et la distribution des témoins. Les actions de salle utilisent un jeton de membre, une autorisation et des mutations concurrentes protégées. Les clients reçoivent leur seule perception avant le débrief. Le code de salle ne confère pas l’identité d’un autre inspecteur.

La perte de présence suspend le quorum au lieu de résoudre silencieusement un diagnostic sans le témoin. La reprise conserve l’identité et la perception ; le départ explicite retire le membre. Les transitions de campagne sont autoritaires pour que tout le groupe change de lieu ensemble.

La signalisation radio dispose de destinataires, d’identités de session, de limites de taille, d’accusés de réception et d’expiration. Les messages d’une ancienne session ne peuvent pas modifier une nouvelle négociation. Ces protections réduisent les erreurs et l’exposition entre membres ; les essais de transport voix sur les réseaux visés restent nécessaires.

Les résultats propres à la version 0.4.0 sont détaillés dans [QA.md](QA.md), [build-status.json](build-status.json) et [qa-final-v0.4.0.json](qa-final-v0.4.0.json). La reprise conserve les correctifs de la PR nº 1 : invalidation des votes après absence, projections privées, sessions radio périmées et configuration STUN/TURN. Les contrôles séparent les règles, la résilience, les objets, la géométrie, les profils radio, l’interface radio, la configuration et le serveur compilé avec de vrais clients HTTP. Les succès CPU et WebAudio ne constituent pas une capture GPU, un essai de microphone physique ou une session vocale connectée. La route d’aperçu navigateur refuse toujours la connexion ; cette limite est inscrite dans les preuves de la version.

L’historique de la révision 0.2.1 comprend 19 tests radio, dont sept nouveaux scénarios d’autorisation tardive et de réactivation, ainsi que 4 tests distincts du contrôleur d’interface. Six des sept nouveaux tests radio échouaient avant la correction ; les sept passent après. Le [rapport de régression](qa-radio-cancellation-v0.2.1.json) précise le périmètre simulé. Les preuves de la v0.2 sont conservées : 17 tests de règles, 11 suites CPU de géométrie et une campagne HTTP réelle à quatre clients sur trois lieux. Ces résultats décrivent leur exécution historique ; seuls les rapports datés de la nouvelle version attestent une réexécution. Deux onglets réels ont aussi ouvert un salon, activé l’écoute sans microphone et échangé offre/réponse avec négociation stable. L’environnement n’a fourni aucun candidat ICE : aucune liaison audio connectée ni aucun flux vocal reçu ne sont revendiqués par cet essai.

La passe 0.2.1 a aussi réussi le contrôle TypeScript, les compilations locale et hébergée, ainsi que le test de l’édition portable sans `node_modules`. Deux clients HTTP authentifiés ont rejoint le serveur compilé, traversé la référence puis l’inspection, résolu un consensus et quitté la salle. Le [rapport de livraison](qa-final-v0.2.1.json) sépare ces résultats des contrôles d’archives et de CI GitHub encore à exécuter après assemblage et publication.

Les contrôles HTTP à quatre clients, tests de règles, tests radio et contrôles de géométrie ont des couvertures différentes. Ils ne doivent pas être résumés par « tout le jeu testé ». Le détail des preuves et limites figure dans [QA.md](QA.md), les rapports JSON et la feuille QA.

## 9. Narration et suite de production

Le protocole considère les témoignages comme des fragments à rapprocher. Il demande des diagnostics de conformité, puis révèle progressivement que la séparation des perceptions est son véritable objet d’étude. Les inspecteurs restent ordinaires et désarmés ; leur compétence est de vérifier ensemble.

La victoire actuelle produit un bilan. Trois dénouements étendus sont conçus : une salle de concordance au matin, un dossier d’équipe précédente et une cabine réunissant les objets décrits par chacun. Ils demandent scènes, assets, mise en scène et recette distinctes. Ils ne sont pas présentés comme cinématiques déjà livrées.

Après les quinze ajouts de la version 0.4.0, les **24 concepts restants** se répartissent en sept ensembles de production. Le filtre de statut dans le classeur reste la référence pour savoir lesquels sont effectivement jouables.

| Lot restant | Fiches PX | Travail préalable |
| --- | --- | --- |
| Comparaisons, mémoire et textes | 035 | Supports lisibles, valeurs privées, comparaison équitable et interface toujours fiable |
| Sons du lieu | 033, 037–043 | Sources originales, spatialisation, équivalence écrite et séparation des sons techniques |
| Événements temporels | 044–048 | Déclencheurs reproductibles, fenêtres d’observation et preuve répétable sans réflexe |
| Espace et miroir | 057, 058 | Collisions communes, trajet sûr, surfaces réfléchies et reset complet |
| Matière et traces | 074, 075 | Géométrie / animation, lisibilité à qualité réduite et contrôle des faux positifs |
| Présences originales | 062–065, 067 | Silhouettes et animations propres, distance de comparaison, aucun blocage forcé |
| Nouvelles architectures | 080 | Observatoire avec référence, circulation, lumière et assets distincts |

Les prochains lots doivent être choisis selon leur valeur de coopération et les résultats des playtests. Les menaces actives et doubles anomalies attendent leurs règles de combinaison, indices précurseurs et issues sûres. Une collection cosmétique future ne doit pas donner un équipement révélant automatiquement la vérité.

## 10. Lire et maintenir le classeur

Les quinze feuilles sont Synthèse, Boucle, Anomalies, Coopération, Radio, Personnages, Niveaux, Lieux, Direction artistique, Audio, Commandes, Narration, Production, QA et Références. Elles portent des tableaux filtrables, en-têtes figés, statuts et repères stables.

Les compteurs de Synthèse et les pools par lieu sont des formules liées au catalogue. Les pools incluent des effets communs : leurs tailles ne s’additionnent pas en nombre d’anomalies uniques. Modifier un statut ou le champ de présence actualise les compteurs associés. Ajouter manuellement des lignes exige d’étendre les tables et plages, ou de régénérer depuis les sources JSON.

Les fichiers de suivi sont :

- `anomalies-design.json` : les 120 concepts ; ordre des 80 fiches initiales conservé.
- `runtime-catalog.json` : copie des 96 entrées runtime confirmées, avec leurs lieux autorisés.
- `workbook-v02.json` : règles, feuilles spécialisées, lots et parcours QA.
- `build-status.json` : périmètre réellement vérifié et limites de la version.
- `scripts/build-design-workbook.mjs` : génération du XLSX, contrôles des compteurs et rendus.

Un statut **Implémenté — QA partielle** signifie que le comportement existe en code avec des vérifications ciblées, pas que les images, le mix, les appareils, le relais TURN ou la commercialisation sont entièrement validés. **Conçu — non implémenté** désigne une spécification prête à prioriser, sans effet jouable correspondant.
