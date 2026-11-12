# Accessibilité des commandes et de la caméra — 12 novembre 2026

Base : `a78c6511112ad55b4dc5bc31c35b7e89c304cc3a`, branche `continuation/observations-20261110`, PR #5. Ce lot ne modifie ni le catalogue (119/120), ni les textes A/B originaux, ni la progression, ni les dépendances du jeu. `hall_stretch` reste exclu avant la recette humaine prévue dans sa fiche.

## Changements réellement raccordés

Douze actions clavier sont affectables depuis Paramètres. Les doublons sont refusés avec une explication, Échap et les flèches restent réservés ; annulation et réinitialisation sont disponibles. Les indications de jeu, d’aide et de talkie utilisent l’affectation courante. Les accessoires affichent une instruction neutre plutôt qu’une touche E gravée. Les contrôles tactiles et les boutons manette existants sont conservés ; ce lot ne remappe pas la manette.

Le code clavier désigne une position physique. L’affichage propose AZERTY français classique et QWERTY ; sélectionner l’affichage ne change pas les positions. La saisie, les raccourcis Ctrl/Alt/Commande et la composition de texte ne déclenchent aucune commande de jeu. Échap ferme les menus pendant une partie, sauf capture d’une nouvelle touche ou composition. La libération de la touche de talkie reste traitée même après un changement de focus vers un champ de saisie.

FOV vertical réglable de 50 à 95 degrés, valeur initiale 65 ; matrice de caméra actualisée sans changer pose, vitesse ou collision. Inversion verticale unique au niveau de `look`, donc appliquée à la souris, au tactile et au stick droit sans double inversion. Le mode confort immobilise la caméra d’accueil et conserve le sprint désactivé. La caméra de déplacement n’avait déjà pas de balancement forcé ; aucune option de bobbing artificielle n’est ajoutée. Les mouvements qui constituent des preuves d’anomalie restent observables.

Les relevés acoustiques, de calibration et d’inspection sont agrandissables de 100 à 150 %, avec retour à la ligne et défilement si nécessaire. Les textes restent privés ; aucun réglage n’est envoyé au serveur.

Les réglages existants sont migrés dans le même stockage local, validés par type et bornés. Les valeurs non finies, doublons, touches inconnues et champs non attendus sont rejetés. Les consentements vocaux, identités et jetons ne sont pas des préférences et ne sont pas conservés dans ce nouvel objet. Le premier rendu n’écrase plus les réglages récupérés avec les valeurs par défaut.

## Corrections de fiabilité

Un changement de réglage remet les entrées à zéro et ferme la transmission. Une répétition clavier qui arrive après une pause, perte de focus ou remise à zéro ne redémarre ni la marche ni la voix : un nouveau relâchement/appui est nécessaire. La vérification du ticket de salon demeure dans le vrai callback Game.

L’ancien effet React appelait `setQuality` pour chaque changement de préférence, ce qui détruisait/redimensionnait les cibles des reflets, même lors d’un simple changement de volume. Les effets qualité, caméra et audio sont maintenant séparés selon leurs dépendances. Un test exécute ces vrais effets et vérifie l’absence de nouvel appel de qualité pour le son, le FOV ou une touche. Ceci ne constitue pas une mesure de FPS.

## Régressions et contrôles

- `npm run test:accessibility` : migration, corruption, bornes, conflits, positions AZERTY/QWERTY, saisie, composition, répétition, PTT et callback Game réellement extrait ; dépendances des effets de préférence.
- `npm run test:scene` : trois nouveaux contrôles Three.js réels sur le FOV, l’inversion et la caméra d’accueil, avec les anciens contrôles de scène conservés. Le rendu WebGL est simulé dans cette suite.
- `npm test`, `test:radio-ui` et suites observation/acoustique/temporel/ascenseur/voix/ombre/inspection/Chalet/radio/configuration : régressions existantes.
- `python3 scripts/validate-open-workbook.py` : archive XML, formules calculées, 600 clés/critères/statuts et 120 références normales/A/B.
- CI du commit de livraison : typecheck complet, éditions hébergée et locale, création et lancement du ZIP extrait.

La borne de capture du harnais `session-scope.test.mjs` a été adaptée au nouveau chargement normalisé des préférences ; la logique de test du transport est inchangée.

## Suivi rapproché du code

Le classeur courant est `docs/PARALLAXE_Suivi_Courant_2026-11-12_Accessibilite.xlsx`. P04 n’annonce plus 104 cas ; P09 ne limite plus la recette aux quatre anciens lieux ; P15 décrit les réglages réellement implémentés ; P17 ne présente plus la constellation intégrée comme absente ; P35 distingue compilation/archives de la recette Windows. Les cinq anciennes formulations restent dans le modèle source historique et les anciens classeurs. Les 600 clés, 28 lots et 124 recettes historiques restent en suivi ; aucune réception humaine n’est déclarée terminée.

## Limites de validation

Aucune nouvelle validation de confort humain, GPU physique/FPS, microphone, TURN inter-réseaux ou lanceur Windows. Les dispositions autres que les deux affichages proposés peuvent remapper leurs positions, mais le libellé de disposition ne prétend pas détecter toutes les variantes internationales. Les tests de clavier simulent les événements : ils ne certifient pas tous les claviers physiques. Une éventuelle capture de l’interface sans WebGL ne certifie pas les scènes 3D.

Références de comportement navigateur :
- https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
- https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat
- https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event
