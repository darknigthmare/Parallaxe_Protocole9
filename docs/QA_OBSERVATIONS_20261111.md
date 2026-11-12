# Observations prolongées — reprise du 11 novembre 2026

Base de travail : `main` au commit `a1774830149d485af800133f688e94b208940883`. L’archive source contrôlée `edbeab61834ff9c7f8a4934b7e02621787e83c36` contient les mêmes sources de jeu ; la comparaison GitHub montre uniquement les ajouts d’outillage IA intervenus ensuite. Ces ajouts sont conservés dans la branche de livraison.

## Contenu réellement intégré

Le catalogue passe de **100 à 104 anomalies sur les 120 fiches originales**. Les 16 autres concepts restent explicitement non implémentés. Les quatre ajouts sont exclus des trois lieux qui ne possèdent pas leurs repères physiques.

| Cas | Preuve et comportement | Fidélité au déclencheur |
| --- | --- | --- |
| `paired_stars` | Six étoiles fixes en référence ; quatre à gauche et quatre à droite dans les perceptions opposées. Deux points communs, union exacte des six positions. Relevé privé E. | Station ICI, face à la même fenêtre G9. |
| `photo_age` | Portrait original en tons sépia. Cheveux, yeux, rides et posture changent progressivement. Le résultat reste acquis en quittant la zone et en basculant A/B. | Dix secondes cumulées près du cadre, puis vieillissement progressif sur douze secondes. Pause et autres lieux n’avancent pas le compteur. |
| `stair_wrong_shadow` | Palier et rampe horizontale à six montants réellement modélisés. Seule la projection devient un escalier ; géométrie et collisions restent identiques. | Sous l’applique du palier de service. Preuve visible même sans shadow map. |
| `ceiling_walker` | Silhouette originale articulée, inversée, marche lente au plafond. Aucun collider ni poursuite. | Apparition après le milieu du parcours, puis persistance jusqu’à la fin de la manche. |

`docs/anomalies-design.json` reste inchangé : les textes de référence/A/B, déclenchements et règles d’équité d’origine ne sont pas réécrits pour prétendre que l’implémentation est fidèle.

## Récupération vérifiée

Le lot interrompu était stocké en quatre fragments compressés sur la branche. Les 25 fichiers ont été reconstitués uniquement après vérification SHA-256 de leur source et de leur résultat. Le transfert, à lui seul, ne constituait pas une implémentation appliquée. La reprise conserve tous les ajouts d’outillage du 4 novembre.

## Correctifs

Les cibles `coat` et `extinguisher` existaient dans la scène mais pas dans la liste `TARGETS` du serveur : leurs signalements pouvaient renvoyer « Repère inconnu ». Les deux cibles et les nouveaux repères sont maintenant acceptés ; le message public ne contient jamais le résultat de la perception.

La brume de l’extincteur tournait autour de l’origine de la fixation et pouvait quitter le cylindre. Son pivot est recentré et ses particules passent en coordonnées locales. Le retour au tour normal réinitialise sa rotation.

La nouvelle constellation est un cas relationnel particulier : **les deux côtés voient quatre points**, contrairement aux cas ordinaires avec un témoin normal. Seul le masque du destinataire traverse la projection réseau. Les tests HTTP ne déduisent plus le diagnostic des seuls anciens champs de relation.

Le vrai appel de mise à jour de scène suspend désormais les compteurs d’observation lorsque le jeu est masqué, sans focus ou derrière un menu/une lecture. Une régression de scène vérifie 25 secondes interrompues puis la reprise normale du vieillissement.

## Suivi Excel

Le fichier courant est `PARALLAXE_Suivi_Courant_2026-11-11.xlsx`, avec huit onglets. Ses compteurs proviennent de formules : 120 concepts, 104 en code, 16 non intégrés, 600 entrées de suivi, 28 lots et 124 scénarios QA encore ouverts dans le suivi historique.

Les 446 entrées importées des feuilles de conception ont retrouvé les bonnes colonnes Action / Critère / Limite. Les tests proposés correspondent au domaine au lieu d’un choix fondé sur des mots qui pouvaient correspondre au mauvais système. Les identifiants et états historiques restent conservés.

Les cinq précédents classeurs sont conservés comme archives ; aucun compteur ancien 96/24 ou 100/20 n’est présenté comme l’état courant. Le générateur actuel utilise `artifact_tool` dans `scripts/build-current-workbook.py`. Le validateur relit le ZIP/XML, les valeurs de formules exportées, chaque clé/critère/statut des 600 entrées et les textes A/B des 120 cas. Il compare également les 16 fiches restantes au CSV et au JSON.

## Vérification locale réalisée

- `npm test` : **168 tests réussis** sous Node 22.16.0 (22 règles, 33 résilience, 16 décisions, 5 adaptateurs, 64 client, 28 commandes).
- `node tests/observation-state.test.mjs` : **10 tests réussis**, incluant seuil temporel et persistance à 10, 30, 60 et 144 images/s.
- `python3 scripts/validate-open-workbook.py` : contrôle des données et du classeur courant.
- Le classeur est recalculé par l’outil d’édition, sans erreur de formule ni variable `{{...}}` restante ; aperçu de synthèse relu.

La géométrie Three.js, le typage et les compilations doivent être confirmés par la CI de cette branche avec les dépendances verrouillées. Les résultats GitHub s’appliquent à leur SHA exact, pas à une version future.

## Limites maintenues ouvertes

Le contrôle CPU de géométrie n’est pas un contrôle visuel GPU. Aucun FPS, mixage matériel, microphone réel, TURN entre réseaux restrictifs ou parcours sur 2–4 appareils physiques n’est déclaré réussi. Les nouvelles observations restent « Implémenté — QA partielle ». Le portrait est un asset procédural original, pas une photographie réaliste ni un asset AAA.

La campagne garde ses trois secteurs et neuf validations ; le Chalet reste optionnel en mode lieu unique. Ce lot ne change pas les versions de dépendances, le stockage D1, les permissions micro ni l’identité d’hébergement. Il ne publie pas de nouveau site.
