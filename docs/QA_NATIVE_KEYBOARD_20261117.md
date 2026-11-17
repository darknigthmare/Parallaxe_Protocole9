# Diagnostic de la recette clavier — 17 novembre 2026

Le run 44060273859 (`506a78e`) démarre Chromium et affiche les paramètres, mais échoue au retour Tab/Maj+Tab. Le test transmettait `modifiers: 1`, soit **Alt** dans CDP, au lieu de **Shift: 8**. La première pression était donc ignorée à juste titre par le jeu qui protège les raccourcis système. Ce n’est pas une preuve de défaut du focus.

Ce comportement a été reproduit avec de vrais événements Chromium sur une page locale sans réseau : 1 produit altKey, 8 produit shiftKey, et les événements sont trusted. Les trois gestes inverses emploient désormais une option nommée `shift: true`. Chaque geste du scénario vérifie la touche, ses modificateurs, sa répétition et son origine native dans la page.

Aucun contrôle de focus, d’ordre, de retour ou d’inertie n’est retiré. Aucun comportement de production ne change pour ce correctif. Le test local du protocole ne remplace pas la recette complète du jeu compilé : son résultat doit être consulté sur le commit exact.

Source primaire du protocole : https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Input.pdl (`dispatchKeyEvent`, Alt=1, Ctrl=2, Meta=4, Shift=8).
