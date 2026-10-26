# PARALLAXE — Protocole 9 · correctif 0.2.1

26 octobre 2026. Correctif du cycle d’activation du microphone et de l’identification des archives distribuées.

## Microphone et extinction du talkie

Une demande de permission microphone pouvait rester en attente lorsque le joueur choisissait « Éteindre le talkie ». Si cette permission était ensuite accordée, la capture pouvait démarrer malgré l’extinction du talkie ; la piste restait muette.

L’extinction invalide désormais la demande en cours. Tout flux reçu après son annulation est immédiatement arrêté. Le succès, le refus ou la finalisation de cette ancienne demande ne peut pas modifier une activation plus récente.

## Distribution

Les archives portent la version complète de `package.json`, y compris le numéro de correctif :

- `PARALLAXE_Jeu_PC_LAN_v0.2.1.zip` pour l’édition autonome précompilée.
- `PARALLAXE_Sources_v0.2.1.zip` pour les sources.

Le paquet portable déclare également la version `0.2.1`. Les liens du jeu et du README pointent vers ces archives. Les commandes d’installation et de lancement restent décrites dans le [README](../README.md).

## Contenu et vérification

Cette mise à jour conserve les trois lieux, les 54 anomalies intégrées, le modèle d’inspecteur et le classeur de conception de l’édition 0.2. Son historique reste disponible dans [RELEASE_0.2.md](RELEASE_0.2.md).

Les contrôles automatisés et leurs limites sont documentés dans [QA.md](QA.md). La correction du cycle de permission ne constitue pas une validation de microphones physiques, de l’écoute humaine de la voix ou du rendu sur GPU.

## Attente de l’interface

L’extinction du talkie libère immédiatement le bouton d’activation, même si une ancienne demande de permission n’a pas encore reçu de réponse. Une garde d’opération empêche son succès, son erreur ou sa finalisation de modifier une demande plus récente. La sortie du salon ferme la radio avant l’attente réseau. Quatre tests du contrôleur vérifient ces états ; ils ne constituent pas une validation visuelle dans un navigateur.
