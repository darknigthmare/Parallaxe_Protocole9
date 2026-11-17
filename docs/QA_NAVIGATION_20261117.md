# Navigation, focus et manette — 17 novembre 2026

Base exacte : `112e4969e3d6ab71947ad5391bb87e7d43126476` (collecte et transfert v2 déjà fusionnés). Catalogue, règles, textes A/B, modèles et dépendances inchangés.

## Comportements

Un contrôleur de focus unique sert aux menus clavier et manette. Priorité : alerte graphique, clavier virtuel, panneau courant. Tab et Maj+Tab parcourent seulement les contrôles visibles/actifs et bouclent dans le panneau ; les résumés de sections fermées restent accessibles. Les contrôles du décor ou du menu sous-jacent sont inert le temps du panneau. Les valeurs antérieures de ces attributs sont restaurées, y compris si elles existaient avant. Un bouton supprimé ou désactivé ne laisse pas le focus sur body. Les fenêtres sans contrôle ont un repli sur le panneau.

Échap est consommé par une seule couche, ne remonte pas à la pause du jeu et ignore les répétitions, la composition de texte et les combinaisons système. La fermeture rend le focus à son contrôle d’origine s’il existe encore. Le clavier virtuel conserve le champ original comme destination ; valider le texte ne soumet pas le formulaire. L’alerte porte un nom et le rôle alertdialog. Son rappel est placé dans le DOM du menu actif, au lieu d’un bouton hors de la portée modale.

Les deux portes manette rejettent des axes non finis ou hors [-1,1], même après armement. Elles exigent ensuite un retour au neutre avant un nouvel appui. Deux régressions sur le contrôleur d’origine échouaient (commande de jeu acceptée, confirmation de menu déclenchée) et passent après correction. Le slot matériel et le mapping standard restent inchangés.

## Preuves et périmètre

- `tests/dialog-focus.test.mjs` : 11 contrôles du module réel sur un DOM simulé, y compris restauration des inert, focus perdu, sections fermées, Échap et priorité graphique.
- `tests/gamepad-menu.test.mjs` : les 14 cas précédents et deux régressions réelles, avant/après.
- `tests/browser-menus.mjs` : jeu compilé et événements clavier/clics CDP. Le contrôleur est explicitement simulé via l’API Gamepad ; focus, inert et comportements React sont réels. Contrôle imbriqué, retour au champ, confirmation sans salon, journal en partie, répétition Échap, alertdialog/détails/rappel et restauration WebGL. Captures et rapport portent le build-info exact.
- Les autres suites et les trois compilations restent exigées. La suite d’interruptions conserve son test de priorité, en injectant le nouveau vrai résolveur de panneau plutôt qu’une fonction manquante dans son harnais.

La tentative locale de navigateur a été bloquée par `ERR_BLOCKED_BY_ADMINISTRATOR` avant le premier contrôle. Ce refus n’est pas présenté comme un test réussi et n’a pas été contourné. La recette complète doit être lue sur la CI de la révision exacte.

## Suivi

Classeur Navigation cumulatif : treize onglets, 28 lots, cinq avancés (W01, W14, W17, W23, W28), aucune clôture. Les 600 clés et 124 recettes historiques restent conservées. Le skill p9-reprise local, dans ses deux copies, cite maintenant le pointeur courant au lieu d’une ancienne édition. Son manifeste SHA256 est mis à jour ; aucune installation globale de plugin.

Ni clavier/manette/téléphone physique, ni lecteur d’écran, ni certification WCAG, ni mesure GPU ne sont revendiqués. Les fins N07–N09, autres objets narratifs et `hall_stretch` restent ouverts selon leurs critères. Le statut de production Vercel se contrôle séparément du résultat de CI.

## Références primaires consultées
https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert
https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation
