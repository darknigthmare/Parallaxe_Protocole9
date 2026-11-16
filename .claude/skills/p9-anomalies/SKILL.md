---
name: p9-anomalies
description: "Ajouter ou corriger une anomalie Parallaxe en fidélité aux références normales et A/B, avec un vrai support, un lieu compatible et un reset testable."
---

# Contenu et fidélité
Lire docs/anomalies-design.json puis src/game/catalog.ts et src/game/rules.ts. Le premier contient aussi des concepts non jouables ; le catalogue contient les cas sélectionnables. Ne jamais réécrire le concept original pour faire passer une adaptation approximative pour une réalisation 1:1.

Décrire : support physique, référence normale, différence privée, déclencheur, durée observable, comparaison solo/coop, alternative sans son, remise à zéro et preuve exigée. Les dépendances de lieu doivent exister avant de proposer le cas au tirage. Un nouveau lieu optionnel ne rallonge pas LEVEL_ORDER ni les sauvegardes de campagne.

Implémenter d'abord l'état déterministe et son test, ensuite objets, interactions et inspection dans la scène complète. Pour une action partagée, utiliser le contrat prop du serveur ; ne pas transmettre sa conséquence privée. Tester le passage référence → A → B → passage suivant, focus/perte de session et absence de coéquipier.

La locomotion et le confort humain sont des critères réels : hall_stretch reste hors tirage tant que la condition de sa fiche n'est pas satisfaite. Pour un cas visuel, une suite CPU n'est pas une preuve de pixels.

Actualiser runtime-catalog.json, le registre courant et la liste restante sans fermer les réceptions humaines. Lire p9-livraison pour le classeur et les preuves. Sources transversales : level-design, game-feel et create-game-assets selon docs/gamedev-sources.json.
