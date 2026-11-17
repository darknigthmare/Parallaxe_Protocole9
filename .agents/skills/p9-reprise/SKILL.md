---
name: p9-reprise
description: "Reprendre Parallaxe depuis une branche, un Excel ou une PR sans perdre les modifications ni confondre archives et état courant."
---

# Reprise de Parallaxe
Lire AGENTS.md, README.md et package.json depuis la racine. Vérifier le SHA de la branche et les changements non enregistrés avant de travailler. Lire docs/current-delivery.json : ses chemins workbook, workstream_csv, qa et workstream_updates désignent l’édition courante. Le registre docs/parallaxe-open-work-20261101.json conserve les 600 clés historiques ; ses anciens chemins de livraison ne remplacent pas le pointeur courant.

Comparer la demande aux tâches ouvertes et choisir un lot borné, observable. Ne pas reposer les questions auxquelles la conversation répond. Si une installation externe est demandée, exécuter python3 .ai-tools/setup.py doctor et distinguer référence, fichiers présents, client disponible et compétence effectivement chargée.

Choisir p9-anomalies pour du contenu, p9-scene pour le rendu, p9-coop-radio pour les états partagés, p9-livraison pour les preuves et archives. Lire seulement la fiche utile du manifeste docs/gamedev-sources.json à sa révision figée ; ses exemples ne changent pas le moteur.

Avant livraison : conserver la conception A/B d'origine, les 600 clés et les archives. Indiquer le SHA exact, les tests exécutés et les contrôles impossibles. Ne pas fusionner main ou déployer à la faveur d'une simple lecture de skill.
