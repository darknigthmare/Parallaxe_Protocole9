# O9 — observatoire et skills locaux / 12 novembre 2026

Base du lot : `4db8e6ec7b66c91463024127cbde93f09d30c442` (118 concepts au catalogue). Cible : 119/120, sans changer les textes originaux ni les dépendances. Le résultat CI est à rattacher au SHA effectivement testé dans la PR, pas à cette note rédigée avant publication.

## Fonctionnalité et fidélité

Cinquième lieu optionnel **Observatoire 09**, accessible via « Lieu au choix » en entraînement et en coopération. Neuf validations dans ce lieu ; campagne toujours Saint-Clair → Terminus 09 → Aile blanche, sans changement de checkpoint. La sauvegarde de lieu unique conserve `observatory`.

Galerie terrestre traversable avec sol, toiture, murs, poutres/lampes, télescope fixe, deux miroirs de contrôle, relais et terminal. La baie O9 occupe une ouverture physique du mur ouest, derrière deux volets coulissants. De véritables montagnes et étoiles procédurales constituent la référence. La sphère planétaire originale est située derrière cette baie dans le monde 3D, jamais dans le HUD. Les collisions ne changent pas selon la perception. Le joueur observe depuis la galerie ; il ne sort pas dans un paysage ouvert.

E sur la commande ouvre ou ferme les volets. L’animation dure 1,5 s, avec délai entre gestes de 3 s et chronologie publique existante. E sur la baie donne la lecture privée ; elle ne décrit pas le ciel avant ouverture complète. Le cas `observatory_earth` montre une immense planète seulement au témoin affecté. Le même relief nocturne reste normal chez l’autre. Changer A/B garde l’ouverture, une nouvelle référence la réinitialise. La sélection O9 contient huit cas compatibles : ce nouveau ciel et sept cas communs de radio/reflets ; tous les indices des lieux existants restent à leur place.

Le support `observatory-shutters` est le septième support public. Le serveur impose lieu, proximité, présence, séquence, requestId, délai et decisionEpoch. Un geste de Saint-Clair ne fonctionne pas à O9, et inversement. `propEvents` ne contient aucune valeur de ciel/planète/verdict privé. Un doublon ne rejoue pas l’action ; une commande d’un ancien passage est rejetée. Un pair arrivé après ouverture voit l’état courant. Le solo se fige en pause, la coopération conserve la chronologie commune.

## Défauts corrigés en recette

- Les volets bord à bord laissaient passer le rayon central à cause de leur joint. Leur recouvrement est maintenant de quatre centimètres ; le test exige un volet matériel fermé et aucun mur occultant l’ouverture lorsque les panneaux sont écartés.
- Le témoin de QA réseau comparait une liste incomplète de champs, ignorant `knockCount`. Certains parcours tirant les coups 3/4 échouaient aléatoirement malgré une règle du jeu correcte. Les deux harnais concernés comparent maintenant l’intégralité de PersonalView ; une régression vérifie références identiques et 3/4 coups.
- La règle Git qui ignorait `.agents` empêchait la livraison des skills. Elle comporte maintenant une exception étroite pour les cinq workflows P9.

## Contrôles

- `test:observatory` : 13 tests, progression optionnelle, sauvegarde, 10/30/60/144 Hz, fermeture, pause, A/B/reset, pair tardif, isolation du lieu, commandes serveur, géométrie finie, baie non occultée, textures et destruction idempotente.
- `test:scene` : deux tests supplémentaires de la scène entière (commande puis baie à portée, lecture, qualité basse, A/B, reset, marche au terminal et masquage dans les autres lieux).
- `test:session-adapters` : vrai handler D1 avec stockage CAS simulé, action commune, doublons, ancien passage, aucun résultat privé dans l’événement ; ajout d’un test du témoin automatisé 3/4.
- `tests/portable.test.mjs` : nouvelle partie optionnelle via vrai serveur HTTP lancé depuis l’archive ; commande authentifiée, état public commun, doublon, mauvais lieu, reset et rejection d’un ancien contexte.
- `test:skills` : 18 contrôles, cinq workflows, dix copies, SHA256/métadonnées/chemins/symlinks, anciens tests du préparateur conservés.
- Toutes les suites de la CI, typage, builds hébergé/local, packaging et validation Excel sont à rejouer sur la révision finale. Pas de résultat extrapolé d’une ancienne révision.

## Reste explicite

`hall_stretch` reste non intégré : la condition de locomotion/confort humain de sa fiche originale n’est pas levée. Le cadre O9 et ses modèles sont des créations procédurales originales, pas une réception artistique AAA. Rendu WebGL/pixels, contraste, ciel réellement lisible, FPS/coût des cinq lieux préchargés, écoute humaine, microphones, TURN réel, coopération humaine et lanceur Windows restent à réceptionner. Les tests CPU n’en donnent pas la preuve. Pas de fusion main ou déploiement par ce lot.
