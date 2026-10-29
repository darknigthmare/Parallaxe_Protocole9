# Talkies — PARALLAXE v0.3.0

## Utilisation

Dans un salon coopératif, **Écouter sans microphone** débloque la lecture audio sans demander le microphone. **Activer mon microphone** est une action distincte : le navigateur demande la permission, puis la piste reste muette jusqu’à l’appui sur le bouton PTT. Garder le bouton **MAINTENIR POUR PARLER** ou la touche **T** enfoncés transmet la voix ; relâcher coupe la piste. Un appui est limité à 30 secondes afin qu’une touche perdue ne laisse pas une transmission ouverte.

La perte de focus, une page masquée, l’extinction du talkie, une liaison vocale déconnectée ou la sortie du salon coupent la transmission. L’ouverture d’une modale relâche également le PTT ; il reste possible de parler depuis le panneau radio. **Couper le microphone** arrête ses pistes et conserve la réception. **Reconnecter la radio** relâche le PTT puis renouvelle les liaisons entre partenaires. **Éteindre le talkie** coupe le microphone et ferme les liaisons vocales. Revenir au menu détruit les connexions et le contexte audio associé.

Depuis la v0.2.1, couper le microphone ou éteindre le talkie invalide aussi une demande de permission encore en attente. Si le navigateur fournit ensuite un flux pour cette ancienne demande, ses pistes sont immédiatement rendues muettes et arrêtées. Son accord, son refus ou sa finalisation ne peuvent pas remplacer, interrompre ou modifier l’état d’une activation plus récente. Quitter le salon conserve la même protection contre un flux reçu après la fermeture du talkie.

Le bouton **Test de calibration** fonctionne sans microphone et sans partenaire parlant. Il joue un contrôle local et fournit un relevé accessible. **Arrêter le test**, disponible aussi en solo, coupe immédiatement le signal en cours. Relancer remplace le test précédent. Une panne réseau ou un refus de microphone apparaît comme une erreur technique séparée : ce n’est jamais une anomalie de gameplay. Le volet **Diagnostic de liaison** permet de consulter les états de négociation et ICE ainsi que les nombres de candidats de chaque partenaire.

Le réglage persistant **Radio mono** envoie la même réception aux deux oreilles. Le relevé gauche/droite continue de décrire le signal généré avant ce mixage. Il fournit ainsi l’indice d’une anomalie de canal avec un appareil mono ou en mode silencieux. Il ne mesure ni l’état d’un écouteur, ni l’audition du joueur.

## Voix réelle et traitement

Chaque paire d’inspecteurs utilise une connexion WebRTC. Une équipe de quatre produit donc au maximum six liaisons entre pairs. La voix est transmise par les pistes WebRTC ; les messages PTT passent aussi par un DataChannel afin de réagir sans attendre le prochain sondage HTTP.

La réception traverse un filtre passe-haut à 330 Hz et passe-bas à 3 300 Hz, une compression dynamique, une saturation légère et une enveloppe de réception. Un bref souffle de porteuse accompagne normalement le début et la fin d’une transmission. Les profils peuvent modifier les retours de porteuse, ajouter écho, modulation, coupures, bruit, longue réverbération, routage à gauche ou souffle synthétique après la fin. Ces effets concernent la perception du destinataire ; la source vocale d’un joueur n’est pas modifiée pour tous ses partenaires.

La longue réverbération utilise une réponse impulsionnelle originale, produite dans le code et envoyée à un `ConvolverNode`. Le déplacement à gauche utilise un `StereoPannerNode`. Le contre-code et l’ordre inversé concernent la calibration synthétique : ils ne réécrivent pas les paroles humaines.

Le serveur de jeu ne reçoit pas de fichiers audio et n’enregistre pas la voix. Il transporte les descriptions SDP, les candidats ICE et les états nécessaires à la connexion. Le code n’utilise ni `MediaRecorder`, ni capture permanente avant permission, ni clonage de voix.

## Référence commune et douze anomalies radio

La calibration normale suit cet ordre : **clic d’ouverture → quatre chiffres du panneau RELAIS → séquence 1, 2, 3 → clic de fermeture → silence**. Les chiffres sont encodés en doubles tonalités téléphoniques DTMF et transcrits à l’écran. Ils ne sont pas prononcés par une voix. La référence du code vient du même panneau que les inspecteurs peuvent lire ; elle peut changer au passage suivant.

Le signal normal est centré, avec 50 % de la puissance générée à gauche et 50 % à droite. Sa réponse de réverbération dure 0,12 seconde. Les quatre chiffres d’identification forment une section distincte des trois tonalités de la séquence principale : le compte de trois ou quatre impulsions désigne cette dernière séquence.

| Identifiant | Observation reproductible | Indice du relevé accessible |
| --- | --- | --- |
| Normal | Code identique au panneau, trois tonalités, deux clics | Code de référence et code reçu identiques ; `1 · 2 · 3` ; G 50 % / D 50 % ; 0,12 s |
| `radio_echo` | Chaque tonalité principale revient en écho | `1 · 1 · 2 · 2 · 3 · 3` |
| `radio_chop` | La deuxième tonalité principale manque | `1 · [coupure] · 3` |
| `radio_static` | Grésillement ajouté au code et à la séquence | Bruit synthétique explicitement indiqué |
| `radio_detune` | Les tonalités principales deviennent métalliques | Modulation sur les trois tonalités |
| `radio_wrong_channel` | Une séquence distincte remplace la référence | `9 · 9 · 0` |
| `radio_aftertone` | Une porteuse basse revient après le clic final | Silence, puis porteuse basse |
| `radio_no_squelch` | Seul le clic de fermeture manque | Clic d’ouverture présent, clic final absent ; fin de séquence confirmée |
| `radio_countercode` | Le dernier chiffre reçu diffère du panneau, y compris après un 9 | Par exemple : référence `3142`, code reçu `3143` |
| `radio_left_only` | La calibration se trouve entièrement à gauche | Routage généré G 100 % / D 0 %, avant le mixage mono éventuel |
| `radio_wrong_room` | Une longue queue de réverbération persiste après la clôture | Réponse synthétique de 2,40 s, au lieu de 0,12 s |
| `radio_order_swap` | Les deuxième et troisième tonalités sont échangées | `1 · 3 · 2`, avec toujours trois tonalités claires |
| `radio_pulse_inside` | Une quatrième impulsion lente et soufflée apparaît après la clôture | `1 · 2 · 3`, puis quatrième impulsion avec souffle synthétique |

Les douze profils sont utilisables dans les trois lieux. Leurs preuves dépendent du profil personnel et du code RELAIS fourni au client. La permission microphone, le débit réseau et l’état de WebRTC ne changent pas le résultat du contrôle. Sans WebAudio, le relevé reste utilisable et l’impossibilité de jouer le son est indiquée séparément. Aucune prise de son de la pièce ou mesure du matériel n’intervient dans le diagnostic.

### Repères temporels de la calibration

| Partie du test | Temps après le lancement |
| --- | --- |
| Clic d’ouverture | 0,015 à 0,050 s |
| Quatre chiffres DTMF | Débuts à 0,18 / 0,55 / 0,92 / 1,29 s ; durée de 0,18 s chacun |
| Trois tonalités principales | Débuts à 2,00 / 2,55 / 3,10 s ; durée de 0,18 s chacune |
| Clic de fermeture normal | 3,64 à 3,685 s |
| Quatrième souffle de `radio_pulse_inside` | 4,05 à 4,90 s |
| Fin du buffer normal / salle longue / quatrième souffle | 3,95 / 5,85 / 5,15 s |

Le test joue un unique buffer stéréo calculé de façon déterministe. Son arrêt ou son remplacement stoppe et déconnecte cette source ; aucun retardateur ne peut déclencher ensuite un morceau de l’ancien test. L’annulation fonctionne aussi pendant une reprise du contexte audio. La fin du test n’ouvre jamais le microphone et ne falsifie pas l’indicateur PTT.

### Adaptations des fiches de conception

La fiche « Les chiffres au mauvais endroit » décrivait un code parlé. La réalisation emploie du DTMF synthétique et sa transcription pour éviter un service vocal externe ou une voix navigateur variable. Les chiffres restent comparables au panneau commun. La référence comporte désormais une section d’identification avant les trois tonalités ; les fiches relatives au compte et à l’ordre des impulsions concernent la séquence principale. Le relevé de canal et la durée de réverbération décrivent le signal produit par le jeu, sans prétendre analyser le casque ou la pièce réelle.

### Contrat d’intégration

Le client reçoit `setEvidence({relayCode})`, `setProfile(profileForEffects(view.effects))` et `setMonoOutput(boolean)`. `getRadioReferenceCaption({relayCode})` produit la référence commune à afficher. `probe()` renvoie `{caption, audible, evidence}` ; `evidence` contient `referenceCode`, `receivedCode`, `sequence`, `channels`, `reverbSeconds`, `closingClick` et `pulseCount`. `RadioStatus.probeActive` suit le buffer en cours, tandis que `stopProbe()` l’annule. L’interface arrête également le test lors d’un changement de phase, de passage, de perception, de client ou à la fermeture du panneau radio.

## HTTPS et réseau local

Les navigateurs réservent l’accès au microphone aux contextes sécurisés. `http://localhost` bénéficie d’une exception de développement, mais une adresse IP du réseau local en HTTP ne l’a généralement pas. Pour un autre ordinateur, utilisez HTTPS et un certificat approuvé sur cet appareil, correspondant au nom ou à l’adresse utilisés. Accepter ponctuellement une page d’avertissement de certificat ne garantit pas que le navigateur considère l’origine comme sécurisée.

Lancer sur cet ordinateur :

```sh
npm run local
```

Ouvrir le jeu aux autres appareils du même réseau, avec certificat et clé déjà préparés :

```sh
npm run local -- --lan --cert=/chemin/certificat.pem --key=/chemin/cle-privee.pem
```

Le port par défaut est `4174`; `--port=PORT` permet de le changer. Les options de certificat et de clé doivent être fournies ensemble. La clé privée reste sur l’ordinateur serveur ; ne la joignez pas à une archive distribuée. Sans HTTPS, le jeu, le texte et les contrôles locaux restent disponibles, mais le microphone distant est signalé indisponible.

## STUN et TURN

Le serveur fournit la configuration à un inspecteur authentifié via :

```text
GET /api/session?code=CODE_DU_SALON&radioConfig=1
Authorization: Bearer JETON_DE_L_INSPECTEUR
```

Réponse : `iceServers`, `expiresAt` et `turnConfigured`. Le client n’embarque aucun secret de signature TURN.

| Variable serveur | Valeur attendue |
| --- | --- |
| `PARALLAXE_STUN_URLS` | Liste de serveurs STUN séparés par des virgules. Par défaut : `stun:stun.l.google.com:19302`. Une chaîne vide désactive ce défaut. |
| `PARALLAXE_TURN_URLS` | Liste de serveurs `turn:` ou `turns:` séparés par des virgules. |
| `PARALLAXE_TURN_SECRET` | Secret REST du serveur TURN, compatible avec le mécanisme `use-auth-secret` de coturn. À fournir exclusivement côté serveur. |

Quand les deux variables TURN sont présentes, le serveur calcule des identifiants temporaires valables une heure : nom d’utilisateur avec échéance, mot de passe HMAC-SHA1 encodé en Base64. Le secret de signature ne figure jamais dans la réponse, les sources du navigateur ou les sauvegardes du salon. Le client reçoit les identifiants temporaires nécessaires à sa propre connexion.

Dans un salon, l’interface demande la configuration à l’initialisation puis **toutes les 50 minutes**. Les actions **Écouter sans microphone**, **Activer mon microphone** et **Reconnecter la radio** déclenchent aussi une actualisation. Cette requête s’exécute en parallèle de l’action pour conserver l’activation audio issue du clic utilisateur ; sa réussite dépend du réseau. La configuration reçue est appliquée aux connexions avec `setIceServers`, sans nouvelle demande de permission microphone. Ouvrir ou refermer le panneau radio ne déclenche pas à lui seul ce renouvellement.

STUN seul ne garantit pas la connexion à travers tous les routeurs, réseaux mobiles ou pare-feux. Un service TURN exploité et configuré séparément peut être nécessaire. Aucun service TURN payant n’est créé ni facturé par le jeu. Le texte et les preuves locales restent utilisables quand la voix ne peut pas se connecter.

## Signalisation et reconnexion

Les actions radio réutilisent l’authentification des salons. Chaque message a un expéditeur imposé par le serveur, un destinataire du même salon et deux identités de session radio. Un message d’une ancienne session ne peut pas modifier une session renouvelée.

Les descriptions SDP sont limitées à 16 000 caractères, les candidats ICE à 2 048 caractères. La file contient au maximum 192 messages et environ 128 000 caractères. Les messages expirent après 60 secondes ; ils sont exclus des réponses dès l’expiration puis purgés lors de la prochaine mutation. Le destinataire accuse réception de ses propres messages. Les autres joueurs n’en reçoivent pas une copie.

Les rôles de négociation sont déterminés par les identifiants des joueurs. En cas d’offres simultanées, le pair poli accepte le repli et l’autre conserve sa proposition. Les candidats reçus avant la description distante sont mis en attente. Le départ d’un inspecteur supprime ses négociations. L’indicateur de transmission expire si un paquet de relâchement se perd.

## Validation et limites

Les **32 tests automatisés** de `tests/radio.test.mjs` réussissent pour la v0.3.0. Les 19 contrôles précédents préservent consentement, démarrage muet, PTT, fermeture des pistes, transcriptions, signalisation privée, limites, négociation et identifiants TURN temporaires ; ils comprennent les sept cas d’annulation corrigés en v0.2.1.

Les 13 nouveaux contrôles analysent les véritables échantillons PCM fournis à l’`AudioBuffer` de production : déterminisme et amplitudes, suppression du clic final, fréquences des chiffres DTMF, silence exact du canal droit, queue de réverbération, ordre des tonalités et souffle supplémentaire. Ils vérifient également la construction et la remise à zéro du graphe de réception, le mono, la transcription sans WebAudio et le nettoyage des sources, y compris pendant une reprise audio en attente. Les tests du graphe utilisent des doublures des API navigateur ; ils ne constituent pas un essai matériel d’un navigateur ou d’un casque. Le [rapport radio v0.3](qa-radio-v0.3.json) conserve les mesures et leurs limites.

La régression a d’abord été reproduite sur le code v0.2 : après extinction pendant une permission en attente, l’état pouvait devenir `enabled=false`, `microphone=true`, avec une piste muette mais non arrêtée. Six des sept nouveaux contrôles échouaient avant le correctif ; le cas de fermeture complète du client était déjà protégé. Après correction, les sept réussissent, ainsi que les douze tests existants et le contrôle TypeScript. Le [rapport d’annulation v0.2.1](qa-radio-cancellation-v0.2.1.json) conserve les scénarios, résultats et limites ; aucun microphone physique n’a été sollicité.

La réussite de tests de signalisation ou de connexions sans microphone ne prouve pas la qualité sonore d’un casque donné, l’interopérabilité de tous les navigateurs ou le fonctionnement d’un relais TURN non configuré. Ces limites doivent rester distinctes des fonctionnalités présentes dans le code.

### Résultat observé dans deux onglets le 26 octobre 2026

Deux inspecteurs ont activé l’écoute, sans autoriser de microphone et sans relais TURN configuré. Dans les deux onglets, les descriptions locale et distante étaient présentes, l’état de signalisation était `stable` et la collecte ICE était `complete`. L’état ICE est toutefois resté `new`, avec **zéro candidat local et zéro candidat distant**.

Ce test confirme l’échange réel des offres et réponses à travers la signalisation authentifiée. Il ne confirme ni une liaison WebRTC `connected`, ni le transport d’un son, ni la qualité d’une conversation. L’environnement de test n’a fourni aucun chemin ICE exploitable. Aucune permission microphone supplémentaire n’a été demandée et aucune politique du navigateur n’a été contournée. Les tentatives ont été arrêtées après ce diagnostic. La cause précise de l’absence de candidats n’est pas établie par ce seul résultat.

Les tests de consentement et de pistes muettes utilisent des périphériques simulés clairement identifiés. Un essai ultérieur sur les appareils des joueurs et, si nécessaire, un relais TURN correctement configuré reste requis pour valider la voix de bout en bout.

## Références techniques

- [MDN — Perfect negotiation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation)
- [MDN — getUserMedia et contexte sécurisé](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN — ConvolverNode](https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode)
- [MDN — StereoPannerNode](https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode)
- [WebRTC — TURN server](https://webrtc.org/getting-started/turn-server)
- [coturn — mécanisme TURN REST](https://github.com/coturn/coturn/blob/master/README.turnserver)
