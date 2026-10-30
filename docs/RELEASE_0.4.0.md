# PARALLAXE — Protocole 9 · 0.4.0

**28 octobre 2026.** Cette reprise réunit la version 0.3.0 retrouvée dans les sources du site et les correctifs réseau déjà fusionnés sur GitHub, puis ajoute quinze anomalies et un quatrième lieu optionnel. Le catalogue compte **96 anomalies intégrées sur 120 conçues**, dont **84 effets visuels et 12 profils radio**.

## Le Chalet de service

Le mode **Lieu au choix** propose maintenant Saint-Clair, Terminus 09, Aile blanche et le Chalet de service. Le chalet est un module de bois assemblé sous un hangar, avec entrée, vestiaire, table de contrôle, tasse, carnet, foyer froid, miroir, fenêtre, relais et terminal.

Deux anomalies propres au lieu sont jouables : une table qui s’étend jusqu’au mur gauche et un visage immobile au fond du conduit. Le garde-corps et le détour à droite sont identiques pour tous ; la perception ne modifie jamais les collisions. Les effets communs compatibles du corps, des reflets, de l’éclairage et de la radio complètent son pool.

La campagne conserve **Saint-Clair → Terminus 09 → Aile blanche**, ses trois validations par secteur et ses sauvegardes existantes. Une inspection autonome du chalet demande neuf bons diagnostics consécutifs.

## Quinze anomalies ajoutées

| Ensemble | Identifiants | Preuve jouable |
| --- | --- | --- |
| Comparaisons plausibles | `paired_guestbook`, `paired_hand`, `paired_photo_weather` | Registre d’arrivée, gant gauche/droit et météo d’une photographie. Les valeurs ordinaires peuvent varier entre passages ; elles doivent concorder dans le même passage. |
| Documents et présence | `wrong_team_photo`, `map_missing_room`, `rules_swap`, `guest_tally` | Ancienne équipe remplacée par les inspecteurs présents, chambre manquante sur le plan, règlement inversé, compteur trop élevé. |
| Miroirs | `mirror_extra_door`, `reflection_no_team` | Porte 909 seulement dans le miroir de l’hôtel ; disparition des autres corps réfléchis dans les quatre lieux, avec corps propre conservé. |
| Lieu et matière | `root_under_door`, `water_up_wall`, `extra_door`, `exit_breath` | Racines sous la porte 901, eau qui remonte le mur, porte 905 supplémentaire et joint de sortie qui s’écarte lentement. |
| Chalet | `cabine_table_size`, `cabine_chimney_face` | Taille réelle du plateau et présence visible dans le foyer. |

Les supports R9, C9 et G9 possèdent une géométrie, une lecture privée agrandie avec **E** et une référence dans le carnet **J**. Les pings partagent uniquement la cible. En solo, les deux perceptions conservent le même inspecteur dans le registre et le compteur.

Sans coéquipier présent, deux mannequins numérotés T1 et T2 servent de témoins pour le miroir. Ils ne sont pas des joueurs et ne changent pas le compteur. Pendant l’anomalie, leurs corps disparaissent uniquement de la capture réfléchie ; leurs socles et la circulation restent fixes.

## Corrections et continuité

- Le serveur portable accepte désormais le chalet lors de la création d’un salon.
- Les arceaux du métro restent sous le plafond au lieu de le traverser.
- Une capture de miroir interrompue restaure les corps et la porte temporaire.
- Les métadonnées du registre, du gant, de la photographie, de la table et du talkie correspondent à leur comportement physique.
- Les corrections de la PR nº 1 restent présentes : votes invalidés après absence, perceptions privées, anciennes négociations radio ignorées et validation STUN/TURN.
- Les menus présentent quatre lieux avec des boutons adaptés aux écrans étroits. La sélection de campagne n’affiche que ses trois secteurs.

Le modèle GLB de l’inspecteur est inchangé par rapport à la version 0.3.0. Son manifeste conserve cette provenance, et les empreintes du source et du modèle ont été vérifiées.

## Classeur, sources et jeu PC

Les quinze onglets du classeur sont conservés. Les nouveaux statuts sont reliés au catalogue exécuté, le chalet possède sa ligne et sa colonne de disponibilité, et les corrections réseau sont rapprochées du suivi principal. Les 24 concepts restants gardent leur statut non implémenté.

Les archives `PARALLAXE_Jeu_PC_LAN_v0.4.0.zip` et `PARALLAXE_Sources_v0.4.0.zip` sont construites depuis les sources courantes. Le portable requiert Node.js 22.13 ou ultérieur et un navigateur compatible WebGL 2 ; aucune installation des dépendances du projet n’est nécessaire pour jouer. Le ZIP des sources est aussi embarqué dans le portable pour le téléchargement hors ligne.

## Vérification et limites

**189 contrôles automatisés réussissent** : règles 19, résilience 28, scène 25, chalet 9, inspection 13, radio 32, contrôleur radio 4 et configuration radio 59. Le typage strict et les compilations locale et hébergée réussissent. Le serveur compilé a été lancé sans dépendances installées, avec deux clients HTTP puis quatre clients dans le chalet jusqu’à neuf diagnostics corrects et la victoire. Les chemins privés restent protégés.

Ces résultats ne valident pas les pixels, les shaders, les FPS, l’écoute humaine ou les microphones physiques. La route d’aperçu a refusé la connexion du navigateur ; la recette GPU, les appareils cibles et la voix entre réseaux avec TURN restent à exécuter. Les 24 anomalies prévues, les autres architectures, les cinématiques et les lots de production avancée restent suivis dans le classeur.

Voir [QA.md](QA.md), [qa-final-v0.4.0.json](qa-final-v0.4.0.json) et le [document de conception](DESIGN.md) pour les preuves et leur périmètre.
