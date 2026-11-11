# Reprise acoustique — 11 novembre 2026

Base de travail : `0a3ba7f8cb5d6182aa5a838471ebf2b9204f79dc` (code du lot observations `0ba8796`).

Quatre cas originaux sont raccordés à Saint-Clair : coups privés 3/4 avec silence de référence, combiné volontaire et respiration lente, boîte à musique physique et note retenue, pluie dont la source locale passe au plafond après approche du salon.

## Commandes et preuve
E sur la porte 903 rejoue le cycle ; E sur le combiné le décroche ; E sur la boîte remonte la mélodie ; E sur la fenêtre revient à l’écoute de la pluie. R repose le combiné et arrête la boîte. La légende privée décrit la même séquence que les échantillons sonores. Elle reste disponible sans Web Audio, sans casque et en mode muet. Elle ne dit jamais « anomalie détectée » et n’est pas jointe aux signalements réseau.

La porte de référence reste silencieuse : les trois/quatre coups sont tous deux inhabituels, comme dans la fiche originale. La note tenue ne devient pas une nouvelle voix d’un joueur. Aucun microphone, enregistrement ou analyse vocale n’est utilisé.

## Cycle de vie
Le bus ambiance règle ces sons sans modifier les talkies. Les menus, pertes de focus, onglets masqués, silence et destruction du moteur arrêtent les sources. Les horloges locales sont suspendues ; la reprise reprend le cycle sans rejouer une rafale d’événements. Les comparaisons solo A/B conservent le moment de l’action tout en changeant uniquement la perception. Le changement de passage nettoie les gestes et les effets.

## Vérification
`npm run test:acoustic` : tests déterministes de la séquence, du PCM, des captions et du routage AudioContext simulé.
`npm test` : règles, projections et compatibilité du registre.
`npm run test:scene` : objets physiques, rayons d’inspection, animations et pause.
`python3 scripts/validate-open-workbook.py` : compteurs 108/12, textes A/B et 600 lignes.

Les résultats exacts de CI sont rattachés au commit de la PR. L’écoute humaine au casque/haut-parleurs, le rendu GPU, TURN et les tests coopératifs sur appareils physiques ne sont pas réputés effectués. Les 12 concepts restants ne sont pas jouables. Pas de fusion de main ni de déploiement du site dans ce lot.
