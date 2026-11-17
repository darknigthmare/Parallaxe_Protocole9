# Diagnostic et corrections de navigation — 17 novembre 2026

## Modificateur du test

Le run 44060273859 (`506a78e`) démarre Chromium et affiche les paramètres, mais échoue au retour Tab/Maj+Tab. Le test transmettait `modifiers: 1`, soit **Alt** dans CDP, au lieu de **Shift: 8**. La première pression était donc ignorée à juste titre par le jeu qui protège les raccourcis système. Ce n’est pas une preuve de défaut du focus.

Ce comportement a été reproduit avec de vrais événements Chromium sur une page locale sans réseau. Les trois gestes inverses emploient une option nommée `shift: true`. Chaque événement reçu est vérifié : touche, modificateurs, répétition et origine native. Aucune assertion de navigation n’a été affaiblie.

## Vrai défaut du retour après un clavier imbriqué

Une reproduction native indépendante montre qu’après suspension du confinement parent, ouverture/fermeture du clavier virtuel, puis fermeture du parent, le focus revenait à BODY et non à son bouton d’origine. La mémoire de cet ouvreur était perdue lors du remontage du confinement parent.

`DialogOpener` conserve maintenant la destination pendant la même visite de panneau. Un changement de panneau/contexte, la fermeture complète ou la désactivation remettent cette mémoire à zéro. L’ancien scénario natif produit `returnsToOpener:false`, le corrigé `true`. Deux tests supplémentaires portent la suite de focus à **13 cas**. Le scénario React complet exige aussi le retour au bouton principal après l’édition imbriquée : neuf étapes navigateur sont attendues, pas encore déclarées réussies par ce document.

## Démarrage du navigateur

Le run 44061462240 (`5a68799`) a échoué avant le scénario lors de la requête HTTP supplémentaire `/json/list` (délai 5 secondes). Le lanceur se connecte désormais directement au socket de navigateur indiqué par `DevToolsActivePort`, puis utilise `Target.getTargets` et `Target.attachToTarget` en mode aplati. Les commandes de page portent leur session dédiée ; les commandes Browser/Target restent sur la connexion navigateur.

Le lancement reste unique et borné. Aucun scénario échoué n’est relancé automatiquement, aucune protection de site n’est désactivée, aucune résolution ou géométrie n’est réduite. Les erreurs de lancement précisent l’étape et le temps écoulé ; le diagnostic stderr reste limité au processus jetable et à 8 Kio. Les essais natifs locaux passent avec ce chemin. La CI du jeu compilé reste requise avant fusion.

Sources primaires :
https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Input.pdl
https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Target.pdl

Ces essais ne certifient ni lecteur d’écran, ni clavier/manette/GPU physique. Ils ne remplacent pas les autres suites, les builds, les classeurs et le paquet extrait de la révision exacte.
