# Reprise des sessions — 29 octobre 2026

Base GitHub : `f1cadcca96dd94a84eaf68bdf821f235fb50b2cf`, PR #2.
La version de contenu reste **0.2.1 sur cette branche**. Le site privé publié en
0.4.0 n'est ni remplacé ni redéployé par cette correction. Ses sources doivent
encore être rapprochées du dépôt avant une nouvelle livraison de contenu.

## Correctifs appliqués

- Chaque visite d'un salon possède une génération locale indépendante de son
  code. Retour au menu, passage au solo, nouvelle connexion, reprise et démontage
  rendent les anciennes réponses et erreurs inopérantes.
- Les états reçus sont vérifiés contre le code du salon et l'identité locale.
  Les compteurs de révision et d'horodatage doivent être des entiers sûrs positifs
  ou nuls. Une réponse étrangère ne peut pas bloquer les mises à jour suivantes.
- Une ancienne fin de requête ne peut pas libérer le verrou d'une action plus
  récente. Les requêtes de présence possèdent leur propre verrou, sont annulées
  au nettoyage et ne bloquent pas le sondage d'une nouvelle session.
- Quitter ne maintient plus l'interface en attente de la réponse réseau. Le
  paquet de départ conserve les anciens identifiants, mais ne peut plus effacer
  une session ouverte entretemps. En cas de panne, le délai de présence serveur
  reste nécessaire : cela ne constitue pas une garantie de réception du départ.
- Créer/rejoindre n'envoie pas le jeton de l'ancien salon. Le mode solo efface
  l'alerte de réseau périmée. Un échec de passage suivant ne ferme plus sa modale.
- Après expiration du chef d'équipe, la succession est calculée **avant** son
  battement de retour ; un inspecteur resté présent garde la priorité.
- La projection HTTP utilise une heure relevée après l'écriture de présence,
  au lieu de l'horodatage antérieur à l'attente de la base.

## Preuves reproductibles

```sh
node tests/session-scope.test.mjs
node tests/session-resilience.test.mjs
npm test
```

Les deux commandes ciblées passent localement sous Node 22.16.0 : **34 tests de
client + 33 tests de résilience = 67 tests**. La PR ajoute **39 tests** au total
(34 nouveaux + 5 supplémentaires dans la suite de résilience).

La suite client extrait et exécute les véritables callbacks de `app/game.tsx`
avec requêtes différées, stockage et horloges simulés. Elle ne duplique pas leur
implémentation. Elle ne monte pas React dans un navigateur et ne valide pas de
pixels GPU. Le typage, les autres suites et le build portable sont contrôlés
par le workflow GitHub sur la révision publiée ; ne pas réutiliser le résultat
d'une ancienne révision comme preuve de celle-ci.

## Limites et suites

Le micro physique, les connexions relayées TURN et les essais sur plusieurs
appareils restent à valider. Un diagnostic retardé **dans le même salon** après
un changement de passage demande encore une protection de protocole dédiée ;
la barrière de cette passe protège les changements de visite/session côté client.
Aucune anomalie ni aucun niveau supplémentaire n'est revendiqué.

Le complément `PARALLAXE_Suivi_Sessions_2026-10-29.xlsx` accompagne le classeur
maître de 120 fiches, conservé intact. Son suivi distingue code testé, contenu
non récupéré et validation matérielle manquante.
