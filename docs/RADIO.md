# Talkies — PARALLAXE v0.2.1

## Utilisation

Dans un salon coopératif, **Écouter sans microphone** débloque la lecture audio sans demander le microphone. **Activer mon microphone** est une action distincte : le navigateur demande la permission, puis la piste reste muette jusqu’à l’appui sur le bouton PTT. Garder le bouton **MAINTENIR POUR PARLER** ou la touche **T** enfoncés transmet la voix ; relâcher coupe la piste. Un appui est limité à 30 secondes afin qu’une touche perdue ne laisse pas une transmission ouverte.

La perte de focus, une page masquée, l’extinction du talkie, une liaison vocale déconnectée ou la sortie du salon coupent la transmission. L’ouverture d’une modale relâche également le PTT ; il reste possible de parler depuis le panneau radio. **Couper le microphone** arrête ses pistes et conserve la réception. **Reconnecter la radio** relâche le PTT puis renouvelle les liaisons entre partenaires. **Éteindre le talkie** coupe le microphone et ferme les liaisons vocales. Revenir au menu détruit les connexions et le contexte audio associé.

Depuis la v0.2.1, couper le microphone ou éteindre le talkie invalide aussi une demande de permission encore en attente. Si le navigateur fournit ensuite un flux pour cette ancienne demande, ses pistes sont immédiatement rendues muettes et arrêtées. Son accord, son refus ou sa finalisation ne peuvent pas remplacer, interrompre ou modifier l’état d’une activation plus récente. Quitter le salon conserve la même protection contre un flux reçu après la fermeture du talkie.

Le bouton **Test de calibration** fonctionne sans microphone et sans partenaire parlant. Il joue un contrôle local et fournit une transcription accessible. Une panne réseau ou un refus de microphone apparaît comme une erreur technique séparée : ce n’est jamais une anomalie de gameplay. Le volet **Diagnostic de liaison** permet de consulter les états de négociation et ICE ainsi que les nombres de candidats de chaque partenaire.

## Voix réelle et traitement

Chaque paire d’inspecteurs utilise une connexion WebRTC. Une équipe de quatre produit donc au maximum six liaisons entre pairs. La voix est transmise par les pistes WebRTC ; les messages PTT passent aussi par un DataChannel afin de réagir sans attendre le prochain sondage HTTP.

La réception traverse un filtre passe-haut à 330 Hz et passe-bas à 3 300 Hz, une compression dynamique, une saturation légère et une enveloppe de réception. Un bref souffle de porteuse accompagne le début et la fin d’une transmission, localement et chez les destinataires. Les profils d’anomalies peuvent ajouter un écho, une modulation, des coupures, du bruit ou un retour de porteuse. Ces effets concernent la perception du destinataire ; la source vocale d’un joueur n’est pas modifiée pour tous ses partenaires.

Le serveur de jeu ne reçoit pas de fichiers audio et n’enregistre pas la voix. Il transporte les descriptions SDP, les candidats ICE et les états nécessaires à la connexion. Le code n’utilise ni `MediaRecorder`, ni capture permanente avant permission, ni clonage de voix.

## Contrôles locaux des six anomalies radio

| Profil | Observation reproductible | Transcription accessible |
| --- | --- | --- |
| Normal | Trois tonalités distinctes puis silence | `1 · 2 · 3` |
| Écho | Chaque tonalité revient en écho | `1 · 1 · 2 · 2 · 3 · 3` |
| Coupure | La deuxième tonalité manque | `1 · [coupure] · 3` |
| Parasites | Bruit ajouté au contrôle | `[grésillement] 1 · 2 · 3 [grésillement]` |
| Modulation | Les trois tonalités deviennent métalliques | `1 · 2 · 3, avec modulation métallique` |
| Mauvais canal | Séquence distincte de la référence | `9 · 9 · 0` |
| Après la fin | Une porteuse basse revient après le silence | `1 · 2 · 3 · silence · [porteuse basse]` |

Les tonalités et les transcriptions dépendent uniquement du profil de perception assigné au joueur. La permission microphone, le débit réseau et l’état de WebRTC ne changent pas le résultat du contrôle. Si WebAudio est indisponible, la transcription reste une preuve utilisable ; l’impossibilité de jouer le son est indiquée séparément.

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

Les **19 tests automatisés** de `tests/radio.test.mjs` réussissent pour la v0.2.1. Ils vérifient le consentement explicite, le démarrage muet, les coupures PTT, la fermeture des pistes, les transcriptions déterministes, l’isolation et les limites de signalisation, les rôles de négociation, l’offre initiale sans microphone et les identifiants TURN temporaires. Sept nouveaux cas couvrent les permissions tardives, les annulations et les activations concurrentes. Les faux périphériques utilisés dans ces tests ne remplacent pas une écoute humaine sur du matériel réel.

La régression a d’abord été reproduite sur le code v0.2 : après extinction pendant une permission en attente, l’état pouvait devenir `enabled=false`, `microphone=true`, avec une piste muette mais non arrêtée. Six des sept nouveaux contrôles échouaient avant le correctif ; le cas de fermeture complète du client était déjà protégé. Après correction, les sept réussissent, ainsi que les douze tests existants et le contrôle TypeScript. Le [rapport d’annulation v0.2.1](qa-radio-cancellation-v0.2.1.json) conserve les scénarios, résultats et limites ; aucun microphone physique n’a été sollicité.

La réussite de tests de signalisation ou de connexions sans microphone ne prouve pas la qualité sonore d’un casque donné, l’interopérabilité de tous les navigateurs ou le fonctionnement d’un relais TURN non configuré. Ces limites doivent rester distinctes des fonctionnalités présentes dans le code.

### Résultat observé dans deux onglets le 26 octobre 2026

Deux inspecteurs ont activé l’écoute, sans autoriser de microphone et sans relais TURN configuré. Dans les deux onglets, les descriptions locale et distante étaient présentes, l’état de signalisation était `stable` et la collecte ICE était `complete`. L’état ICE est toutefois resté `new`, avec **zéro candidat local et zéro candidat distant**.

Ce test confirme l’échange réel des offres et réponses à travers la signalisation authentifiée. Il ne confirme ni une liaison WebRTC `connected`, ni le transport d’un son, ni la qualité d’une conversation. L’environnement de test n’a fourni aucun chemin ICE exploitable. Aucune permission microphone supplémentaire n’a été demandée et aucune politique du navigateur n’a été contournée. Les tentatives ont été arrêtées après ce diagnostic. La cause précise de l’absence de candidats n’est pas établie par ce seul résultat.

Les tests de consentement et de pistes muettes utilisent des périphériques simulés clairement identifiés. Un essai ultérieur sur les appareils des joueurs et, si nécessaire, un relais TURN correctement configuré reste requis pour valider la voix de bout en bout.

## Références techniques

- [MDN — Perfect negotiation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation)
- [MDN — getUserMedia et contexte sécurisé](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [WebRTC — TURN server](https://webrtc.org/getting-started/turn-server)
- [coturn — mécanisme TURN REST](https://github.com/coturn/coturn/blob/master/README.turnserver)
