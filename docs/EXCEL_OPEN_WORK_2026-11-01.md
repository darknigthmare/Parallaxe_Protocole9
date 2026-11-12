> **Document historique.** Pour l’état courant (112/120), utiliser `PARALLAXE_Suivi_Courant_2026-11-11_Temporal.xlsx` et `parallaxe-open-work-20261101.json`. Les chiffres ci-dessous décrivent la livraison du 1er novembre.

# Reprise Excel ouverte — PARALLAXE · Protocole 9 (01/11/2026)

## Périmètre et conservation

Cette livraison reprend les entrées encore **ouvertes en production, en validation ou en contrôle** dans la base GitHub `569bdedfab3a46f7753ac08c70651a2b399ff60d` (version de jeu 0.4.1). Trois classeurs historiques restent **inchangés** :

- `PARALLAXE_Design_Complet.xlsx` : maître de conception historique (sources `workbook-v02.json` / `anomalies-design.json`) ;
- `PARALLAXE_Suivi_Reprise_2026-10-28.xlsx` : reprise et correctifs ;
- `PARALLAXE_Suivi_Sessions_2026-10-29.xlsx` : intégrité des sessions et suivis.

Le premier `PARALLAXE_Registre_Ouverts_2026-11-01.xlsx` est conservé comme **instantané 96/24**. Le classeur **actuel** est `PARALLAXE_Registre_Ouverts_2026-11-01_v2.xlsx`, qui reflète la progression réelle des quatre anomalies intégrées (100/20). Les deux classeurs restent complémentaires aux trois archives du projet. La source auditable de la v2 est `parallaxe-open-work-20261101.json` et son générateur est `scripts/build-open-workbook.mjs`.

## Couverture

| Source | Relevé |
| --- | ---: |
| Entrées de conception à suivre, toutes catégories hors Références | 446 |
| Anomalies décrites, état runtime distingué | 120 (100 dans le runtime ; 20 non intégrées, QA GPU restante) |
| Sessions historiques encore ouvertes | 9 |
| Radio historique encore ouverte | 8 |
| Correctifs de CI à réceptionner physiquement | 8 |
| Jouabilité validée localement mais limitée en conditions réelles | 9 |
| **Total dans le nouveau registre** | **600** |
| Lots concrets priorisés avec critères / preuve / dépendances | **28** |

« Présent » indique un élément du produit, **pas** une recette complète ; « Implémenté — QA partielle » n'est pas « Validé ». Aucune ligne n'a été déclarée résolue en inventant un test. Les anomalies pensées mais absentes du runtime sont toujours distinguées.

## Ordre de traitement proposé

1. **P0 / réception réelle** : audio PTT et TURN, reflets sur GPU, 2–4 clients et votes, campagne complète, Chalet, 100 anomalies et équité des preuves.
2. **P1 / qualité et cohérence** : 20 anomalies restantes, avatars et animations, commandes tactiles, accessibilité silencieuse, performances et sauvegardes.
3. **P2 / extension** : nouveaux niveaux documentés, finitions artistiques, équilibrage et distribution PC.

## Critères pour clôturer une ligne

Un état ne peut passer à « Validé » qu'avec une révision de code identifiée, un test conforme au domaine, une preuve datée (vidéo/capture/log avec données privées expurgées) et, si le problème concerne micro, GPU ou appareils, un **essai sur matériel réel**. Les résultats automatiques préexistants conservent leur portée et leur commit exact.

Le classeur de conception a une édition documentaire 0.4.0, alors que le runtime fusionné est 0.4.1 ; ce décalage historique ne doit pas être masqué par un changement de libellé. Cette PR apporte également **quatre nouveaux effets de scène** au catalogue et leurs tests : `clock_stop_gaze` (regard direct continu 2 s), `carpet_wrong_weave`, `coat_without_body` et `fire_extinguisher_full`. Ils restent « Implémenté — QA partielle » avant une recette GPU. Le registre ne change pas les résultats des anciennes QA ni les anciens statuts de la version 0.4.0.

## Régénérer

Le référentiel `anomalies-gap-20261101.json` et le CSV Excel-compatible `ANOMALIES_RESTANTES_20261101.csv` documentent, pour **chacun des 20** cas encore absents : A/B, référence normale, déclenchement, emplacement requis, éléments à produire et test d'acceptation. Ils ne rendent aucun cas jouable.

Dans un environnement disposant de l'outil `@oai/artifact-tool`, exécuter `node scripts/build-open-workbook.mjs` depuis la racine. Vérifier les formules, les filtres, les feuilles, la mise en page et les totaux avant intégration.

L'intégration éventuelle des nouveaux états dans les **trois classeurs sources** demande un passage d'édition contrôlé qui préserve leurs styles, formules, onglets et historiques. En attendant, ce registre offre une vision transversale sans perte d'information.

## Recettes CI documentées

- `npm test` vérifie le lien entre catalogue jouable, 120 fiches, 600 lignes de suivi et statuts.
- `npm run test:scene` vérifie au niveau CPU la visibilité, l'effet et la réinitialisation des quatre cas, ainsi que les collisions et repères inspectables.
- `python3 scripts/validate-open-workbook.py` vérifie l'intégrité ZIP/XML, les six feuilles, le suivi des IDs et les chiffres 100/20 de la v2.

Les conditions **non réalisées** restent : rendu réel GPU, lisibilité par profils de qualité, audio physique, TURN sur réseaux restrictifs, accessibilité effective et parcours coopératif sur 2–4 appareils réels. Un feu vert GitHub Actions ne certifie pas ces domaines.
