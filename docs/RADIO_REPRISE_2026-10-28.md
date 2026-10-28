# Reprise du 28 octobre 2026 — configuration des talkies

Base : `b3dbbb3ebfd3ad2ffa8c931712523520d7a96916`, branche `continuation/coop-resilience-20261028`, PR nº 1. Cette passe conserve les correctifs de reconnexion précédents. Elle ne fusionne pas `main`, ne redéploie pas le site et ne régénère pas les archives 0.2.1.

## Correctifs exécutés dans le jeu

Le serveur appelle déjà `makeRadioConfig`. Cette fonction filtre maintenant les adresses avant de les communiquer au client : familles STUN/TURN distinctes, noms DNS ASCII/punycode, IPv4, IPv6 entre crochets, ports 1–65535, paramètres de transport connus. Les URI avec identifiants, chemin, fragment, syntaxe hiérarchique `turn://` ou paramètres supplémentaires sont refusées. Les autres entrées valides restent utilisables. Les doublons sont supprimés avant la limite de quatre adresses par famille.

Le profil est volontairement conservateur pour le navigateur : `stun:`/`stuns:` sans paramètre ; `turn:` accepte `udp` et `tcp` ; `turns:` accepte le transport implicite ou `tcp`. DTLS-over-UDP, IPvFuture et les identifiants de zone IPv6 ne sont pas pris en charge. Ce contrôle ne fait pas de résolution DNS et n’atteste pas qu’un navigateur donné supporte chaque schéma.

Un secret vide ou constitué d’espaces ne déclare plus TURN configuré. Les secrets non vides sont conservés exactement : retirer leurs espaces modifierait la signature. Une longueur inférieure à 32 octets déclenche un avertissement, mais la longueur ne prouve pas l’entropie d’une clé. Les clés de test du dépôt sont fictives et ne doivent pas servir en production.

`expiresAt` correspond exactement à la seconde d’expiration du nom temporaire TURN. Le format de signature reste HMAC-SHA1/base64, sans modification du protocole existant. L’identité interne et l’horloge sont contrôlées avant signature. Aucun secret partagé ni contenu d’URI rejetée ne figure dans les diagnostics.

## Précontrôle de l’hébergement

```sh
npm run test:radio-config
npm run check:radio-config
npm run check:radio-config -- --require-turn --json
```

Ces commandes utilisent Node.js 22.13 ou ultérieur, déjà requis par le projet. Elles n’ajoutent aucune dépendance. La suppression des types par le module Node peut produire un avertissement expérimental sur certaines versions 22.x ; ce n’est pas un échec du test.

Le précontrôle lit uniquement `PARALLAXE_STUN_URLS`, `PARALLAXE_TURN_URLS` et `PARALLAXE_TURN_SECRET` dans l’environnement du processus. Fournir les valeurs réelles dans l’environnement serveur ; ne jamais les versionner. Pour les variables Cloudflare, exécuter le contrôle dans un contexte où elles ont été injectées : la commande ne lit pas les secrets du déploiement distant.

Sorties : `0` = configuration sans erreur bloquante ; `1` = paramètres à corriger ou TURN exigé mais absent ; `2` = option inconnue. Les doublons, entrées surnuméraires et secrets courts sont des avertissements. Un STUN explicitement vide reste autorisé pour une configuration locale ; `no-ice-servers` avertit de cette limitation. Sans `--require-turn`, l’absence volontaire de relais n’est pas une erreur.

Le JSON ne contient ni URL, ni secret, ni identifiant temporaire. `turnConfigured` signifie seulement « paramètres de relais présents et valides » : ce n’est pas une preuve de connexion. Aucune ouverture de port, création de service payant, allocation TURN, capture de microphone ou requête DNS n’est effectuée.

## Vérifications et limites

59 tests sont passés localement sous Node.js 22.16.0. Ils couvrent URI acceptées/refusées, limites/doublons, secrets vides, HMAC, expiration, identités, diagnostics expurgés et commande de précontrôle. Le module a également passé un contrôle TypeScript strict isolé. Les tests CLI utilisent `fileURLToPath` pour ne pas dépendre du format des chemins Unix.

La CI existante était réussie sur `b3dbbb3`. Une étape pour les 59 nouveaux tests est ajoutée au workflow ; le résultat du **nouveau commit** doit être consulté séparément. La compilation complète n’a pas été exécutée localement : cette passe ne disposait pas d’un clone complet avec les dépendances.

Restent à vérifier : jeu à deux/quatre appareils physiques, écoute de la distorsion, connexions effectivement relayées entre réseaux différents, permissions navigateur et rendu GPU/reflets. Aucun nouveau lieu, modèle 3D ou cas d’anomalie n’est ajouté par cette passe.

## Suivi Excel

[Classeur complémentaire de reprise](PARALLAXE_Suivi_Reprise_2026-10-28.xlsx) : deux feuilles, Synthèse et Suivi, avec 24 entrées, priorités, critères, preuves et limites. [Données de suivi](suivi-radio-20261028.json).

Le [classeur maître de conception](PARALLAXE_Design_Complet.xlsx) est conservé sans modification : ce complément ne remplace ni ses 120 fiches d’anomalies ni son suivi général. Les extensions et lieux supplémentaires restent à réaliser ; ils ne sont pas marqués comme jouables ici.

## Références techniques

- RFC 7064, URI STUN : https://www.rfc-editor.org/rfc/rfc7064.html
- RFC 7065, URI TURN : https://www.rfc-editor.org/rfc/rfc7065.html
- Coturn, identifiants temporaires TURN REST : https://github.com/coturn/coturn/blob/master/README.turnserver
