---
name: p9-coop-radio
description: "Modifier la coopération, les gestes partagés, WebRTC, les voix privées ou les permissions de Parallaxe sans fuite de vérité ni reprise de commande périmée."
---

# Coopération et audio
Lire src/game/session.ts, rules.ts et les modules audio/radio concernés. Toute réponse passe par projectRoom ; jamais Room, graine, réponse cachée, jeton ni perception d'un autre inspecteur.

Les décisions et gestes conservent le decisionEpoch visible au clic, y compris pendant les réessais CAS. Vérifier contexte, présence, proximité, support compatible, séquence et identifiant idempotent. Un ancien passage ou une réponse d'une session abandonnée ne réactive aucune action. Tester via handlers D1 simulés ET serveur HTTP extrait quand ce contrat change.

La radio réelle exige une activation explicite ; arrêt au relâchement, focus perdu, masquage, sortie et limite de durée. Une permission tardive doit fermer ses pistes. Garder indépendants défaut technique, permission, son diégétique et preuve privée. Toute nouvelle preuve sonore a un relevé écrit privé.

Les voix nommées n'utilisent que l'identité propre et l'accord révocable de la partie. Pas de capture, imitation ou TTS réseau implicite. Un retrait serveur ne doit pas révéler le cas caché. Ne pas rejouer de son expiré à la reconnexion.

Choisir npm test, test:session-adapters, test:radio, test:radio-ui, test:radio-config, test:spoken et la suite du support selon le changement. Les mocks ne valident pas micro, écoute humaine, TURN réel ou quatre joueurs humains.
