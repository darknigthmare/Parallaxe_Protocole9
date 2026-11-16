---
name: p9-scene
description: "Modifier les lieux Three.js, les modèles, les miroirs, les collisions ou la performance de Parallaxe en préservant les repères observables."
---

# Scènes Three.js
Lire src/game/scene.ts, le module du lieu et package-lock.json. Ne pas migrer Three.js ni changer la direction artistique pour copier un exemple de guide. Lire les références threejs-scene-setup et threejs-materials-lighting de docs/gamedev-sources.json.

Un objet observable doit être orienté vers une zone accessible, ne pas masquer les anciens repères, avoir une collision cohérente et être sélectionnable par le vrai Raycaster. Ajouter des tests dans la scène entière, pas seulement un test de construction du module.

Garder la géométrie de collision et les positions réseau communes à toutes les perceptions. Les volets, cadres et extérieurs doivent former une vraie ouverture, pas une image dans le HUD. Les modèles procéduraux ne constituent pas une certification AAA.

Les buffers partagés ont un propriétaire unique. Tester remplacement, départ, dispose idempotent et absence de double destruction. Les reflets doivent restaurer la visibilité dans finally et éviter la récursion. La qualité basse conserve les preuves.

Exécuter test:scene et la suite du module, puis les tests anciens des lieux. Pour un contrôle visuel, noter appareil, navigateur, contexte WebGL, captures et erreurs. Les matrices, triangle counts et stubs ne valident ni contraste, ni shaders, ni FPS. Mesurer avant toute promesse de performance.
