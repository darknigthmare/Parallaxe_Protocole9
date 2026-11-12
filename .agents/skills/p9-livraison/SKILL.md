---
name: p9-livraison
description: "Synchroniser le suivi Excel, les preuves QA et les paquets Parallaxe sur une révision exacte sans faux terminé ni archives périmées."
---

# QA, Excel et livraison
Lire .github/workflows/ci.yml, scripts/validate-open-workbook.py, scripts/package-release.mjs et le registre courant. Inventorier les contrôles existants avant d'en ajouter. Un test doit protéger un comportement et pouvoir échouer, pas simplement relire une phrase de documentation.

Mettre à jour les statuts et actions concernés ; conserver les clés, textes A/B et fichiers historiques. Générer l'Excel par scripts/build-current-workbook.py dans un environnement artifact_tool puis vérifier les formules et une plage rendue. Si cet outil manque, ne pas prétendre avoir régénéré le classeur. Exécuter le validateur qui rapproche chaque clé, action, critère, statut et chiffre du code.

Pour la livraison jouable : typage, suites pertinentes puis régressions de CI, builds hosted/local, package:release et tests/package-archive.test.py. Produire code source, paquet et manifeste du même SHA explicite, depuis un arbre propre. Vérifier les empreintes après téléchargement.

Séparer présence au catalogue, test automatique, réception graphique/audio et publication. Une PR verte n'est ni main fusionné ni site déployé. Un succès antérieur n'est pas celui d'un nouveau SHA.

Les skills eux-mêmes se vérifient par python3 .ai-tools/validate_project_skills.py et les tests sous .ai-tools/tests. Les miroirs Codex/Claude doivent être identiques, sans hooks ou dépendances implicites. Ne pas certifier leur chargement effectif sans client disponible.
