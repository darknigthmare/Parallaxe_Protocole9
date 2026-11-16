# Gestes partagés et perceptions temporelles — 11 novembre 2026

Base exacte : `e8ae289681dd37d9b7893b4cf8cb1370a58656bf`, PR #5, branche `continuation/observations-20261110`. Aucun changement de dépendance ou de moteur. Les 120 fiches d’origine restent inchangées.

## Nouveau contenu

Le catalogue contient 112 cas. Les quatre nouveaux sont limités à Saint-Clair et ont chacun une référence physique : cloche de réception, vase à fleur, porte témoin et mannequin en vitrine. E effectue un geste ; pour le mannequin, un message écrit du salon déclenche également l’écoute. Aucun microphone n’est consulté.

- **Cloche en retard** : bouton pressé simultanément, sonnerie immédiate normale ou cinq secondes plus tard dans la perception affectée. Son original synthétisé, provenance du comptoir, légende privée identique à la preuve.
- **Fleur de retard** : rotation volontaire de 90°, vase commun, fleur décalée de deux secondes. Les pivots sont indépendants pour ne pas masquer le décalage par un héritage de rotation.
- **Ombre avant la porte** : après demande volontaire, ouverture physique temporisée de deux secondes ; l’ombre affectée l’anticipe. La silhouette contrôlée reste visible sans shadow maps. La porte n’est pas une sortie et ne change aucune collision.
- **Mannequin à l’écoute** : corps orienté vers la fenêtre, tête seule tournée vers la position du dernier appel/message dans la perception affectée. Les messages ne contiennent ni angle privé ni statut d’anomalie.

## Autorité et résilience

L’action `prop` est authentifiée par le transport déjà existant. Elle porte le `decisionEpoch`, un identifiant de requête stable et la séquence du support observée. Le serveur vérifie le lieu, la phase, la présence, la distance au support et son cooldown. Une séquence ancienne ne rejoue pas un geste. Une répétition exacte est sans effet.

L’événement autorisé est annoncé 650 ms avant son contact pour laisser passer le polling ordinaire. Il ne contient que l’identité du geste, le support, son rang, l’heure serveur et la position de l’émetteur. Aucun retard privé ni résultat de lecture. Chaque destinataire applique sa propre perception. Ce délai n’est pas une garantie sur un réseau très lent : les clients reçus tard affichent la position courante et ne rejouent pas les sons déjà terminés.

Les gestes solo gèlent en pause ; les gestes coopératifs restent attachés à l’horloge partagée et ne ralentissent pas parce qu’un joueur ouvre un menu. L’audio du joueur interrompu est coupé immédiatement. La réception d’un nouvel état et la perte de focus ne doivent pas provoquer une rafale de rattrapage. Le passage suivant et une nouvelle session réinitialisent la totalité des supports.

## Vérifications

`npm test` conserve les tests du domaine, des callbacks et du serveur. `npm run test:temporal` ajoute les états réels, seuils 10/30/60/144 images/s, actions rejouées/périmées, signaux texte, séparation des perceptions, transformations et ressources Three.js. `npm run test:scene` vérifie les quatre repères dans le décor complet et les anciennes lignes de vue. Le classeur est régénéré avec artifact_tool et vérifié par `scripts/validate-open-workbook.py`.

Les résultats exacts de CI sont rattachés au SHA et au workflow final, pas à la simple existence de ce rapport. Le jeu hébergé n’est pas publié et main n’est pas modifiée par cette livraison.

## Correction pendant la recette

La porte témoin initialement prévue près de la plante du fond était masquée par son feuillage. Elle est placée sur le mur droit, à l’entrée (z = 11,10), avec ses ancres serveur/client et son volume fixe de collision mis à jour ensemble. Les rayons d’inspection de la scène complète et les anciens parcours passent après ce déplacement ; les anciens indices ne sont pas déplacés pour masquer le défaut.

Le handler D1 est aussi testé avec le stockage CAS simulé pour une intention commune, la répétition identique et un geste d’un ancien passage. Le test du ZIP extrait exerce l’action `prop` avec deux clients HTTP : authentification, projection publique identique, pas de retard/lecture privée transmis, répétition sans effet et rejet après changement de passage.

## Réception restant nécessaire

Contraste et lisibilité des props, ombre au sol et matériaux sur GPU ; écoute physique de la cloche ; latence sur deux réseaux et 2–4 appareils humains ; confort de la manipulation ; interaction tactile/manette physique. Aucun FPS, fidélité graphique AAA ou validation matérielle n’est certifié ici. Les huit concepts restants et les 600 lignes de réception ne sont pas déclarés clôturés.

Références techniques consultées : https://threejs.org/docs/pages/Object3D.html ; https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start ; guide Three.js épinglé dans docs/gamedev-sources.json.
