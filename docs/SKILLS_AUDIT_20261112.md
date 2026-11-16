# Audit des skills — Parallaxe / 12 novembre 2026

## Résultat et périmètre

Comparaison des fichiers de dépôt, et non d’installations sur le PC de l’utilisateur. Parallaxe a été examiné à `4db8e6ec7b66c91463024127cbde93f09d30c442`, branche `continuation/observations-20261110`. Les trois autres jeux ont été lus sur leur branche par défaut via le connecteur GitHub le 12 novembre 2026 ; leurs branches de travail ne sont pas toutes auditées.

| Dépôt | Références communes `.ai-tools/sources.json` | Fichiers de skills observés |
|---|---|---|
| Parallaxe, base 118 | Spec Kit 1.3.0, Superpowers 7.0.2, Game Studios 1.2.0 ; préparateur, tests et doctor présents | Aucun SKILL.md local dans l’archive de cette base ; les dix guides gamedev sont des références épinglées |
| Yautja — La Longue Chasse, main | Même manifeste et mêmes trois commits | `.claude/skills` contient notamment adopt, architecture-review, art-bible, asset-audit, code-review, etc. Il y a bien des fichiers locaux en plus des références |
| Moustique — The Video Game, branche par défaut | Même manifeste et mêmes trois commits | `.claude/skills` non trouvé (404 dans le périmètre autorisé) ; cela ne prouve pas l’absence d’une installation externe |
| Multiverse Breach, master | Même manifeste et mêmes trois commits | `.agents/skills` et `.claude/skills` non trouvés (404 dans ce périmètre) |

Les pins inchangés : Spec Kit `34a0d388eac671d656eb05b125ad3ed6056168ed`, Superpowers `22f0b463e7a5e579904dd6211a520321035526f7`, Game Studios `05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418`. Le guide gamedev reste épinglé à `19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9`. L’audit ne remplace pas ces pins par des versions supposées plus récentes.

## Ajout appliqué à Parallaxe

Cinq skills **originaux adaptés au dépôt**, chacun avec un fichier complet et identique sous `.agents/skills/<nom>/SKILL.md` et `.claude/skills/<nom>/SKILL.md` :

| Nom | Travail guidé |
|---|---|
| p9-reprise | Révision exacte, source Excel courante, archives, choix du prochain lot |
| p9-anomalies | Référence normale, A/B d’origine, lieu compatible et preuve réellement observable |
| p9-scene | Géométrie/éclairage, collisions, reflets, ressources, niveau bas et limites GPU |
| p9-coop-radio | Vérité serveur, commandes périmées, voix privées, consentement, focus et arrêt immédiat |
| p9-livraison | QA, génération de l’Excel, cohérence SHA du code/paquet et vérification des archives |

Les doublons sont intentionnels pour les deux clients ; ils ne représentent pas dix compétences différentes. Le manifeste `.ai-tools/project-skills.json` verrouille chaque contenu en SHA256. Le validateur refuse une copie divergente, un nom dupliqué, un fichier absent, une mauvaise destination et un lien symbolique. Les tests du préparateur sont conservés.

Correction : la règle `/.agents/` aurait exclu ces skills du dépôt. Une exception ne laisse passer que `.agents/skills/p9-*`. Le reste des fichiers agents générés demeure ignoré. Ni hook, ni permission supplémentaire, ni dépendance de jeu n’a été ajouté.

`AGENTS.md` et `CLAUDE.md` pointent maintenant vers les workflows locaux. `python3 .ai-tools/setup.py doctor` expose séparément les fichiers locaux présents et les intégrations externes.

## Validation et limites d’activation

Commandes : `npm run test:skills`, `python3 .ai-tools/setup.py doctor`, et contrôle du manifeste Git de livraison. 18 tests du préparateur et du validateur sont passés localement. Les fichiers sont réellement présents et versionnés dans cette livraison ; cela ne prouve pas qu’un client Codex ou Claude Code les a chargés.

Dans l’environnement de cet audit, les exécutables Codex et Claude ne sont pas présents. Les plugins Spec Kit/Superpowers/Game Studios **n’ont pas été installés ni activés par ce lot**. Leur préparation sûre déjà fournie reste disponible ; aucune installation globale ni configuration utilisateur n’est écrasée. Les cinq skills P9 ne sont pas une copie ou une prétendue installation intégrale des frameworks externes.

## Sources de comparaison

- https://github.com/darknigthmare/Parallaxe_Protocole9/blob/4db8e6ec7b66c91463024127cbde93f09d30c442/.ai-tools/sources.json
- https://github.com/darknigthmare/Parallaxe_Protocole9/blob/4db8e6ec7b66c91463024127cbde93f09d30c442/docs/gamedev-sources.json
- https://github.com/darknigthmare/yautja-la-longue-chasse/blob/main/.ai-tools/sources.json
- https://github.com/darknigthmare/yautja-la-longue-chasse/tree/main/.claude/skills
- https://github.com/darknigthmare/moustique-the-video-game/blob/main/.ai-tools/sources.json
- https://github.com/darknigthmare/multiverse-breach/blob/master/.ai-tools/sources.json
- https://developers.openai.com/codex/skills/
- https://code.claude.com/docs/en/skills
