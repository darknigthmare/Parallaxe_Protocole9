# Reprise ascenseur et couloir — 11 novembre 2026

Base : `03e59a9f2e4f672e98929f9305f271392f0ccfe9`, branche `continuation/observations-20261110`, PR #5. Le lot ajoute trois cas au catalogue (112 → 115), sans modifier les 120 fiches originales ni supprimer un ancien cas.

## Réalisation et fidélité à la conception

**elevator_count** : cabine de service complète dans une découpe permanente du mur de fond, à gauche du terminal. Plancher, côtés, fond, plafond, rails, lumière, deux portes et afficheur 09 sont des objets Three.js. E commande le même appel partagé pour l’équipe. Une sonnerie normalement, neuf sonneries espacées de 0,8 s chez le témoin affecté ; aucun mouvement du seuil, de la cabine ou de l’étage affiché. Un relevé local donne le compte entendu, pas le verdict. Le carillon est synthétisé, sans sample externe.

**visitor_one_frame** : la cabine ouverte normale est vide. Chez le témoin affecté, un passager original apparaît pendant l’ouverture puis avance jusqu’à l’encadrement. Il demeure jusqu’au prochain appel ou passage ; le délai minimal de 14 s entre appels laisse plus de dix secondes d’observation après ouverture complète. Aucun flash d’une image. Les portes se referment progressivement lors d’un second appel puis s’ouvrent à nouveau. Le joueur observe depuis le couloir : aucune entrée requise, aucune porte susceptible de le piéger.

**footsteps_unowned** : les déplacements observés des inspecteurs déclenchent des pas normaux ; le son propre garde le timbre existant de chaque lieu, désormais lié au déplacement après collision et non à la touche tenue. Après trois secondes d’immobilité de tous les inspecteurs observés, seuls les témoins affectés reçoivent une source de pas résiduels au fond du couloir. Le compteur écrit ne compte pas les pas des joueurs. Tout déplacement reprend la fenêtre d’observation. En coopération, une absence de nouvelles positions pendant 1,75 s ou un joueur déconnecté suspend la preuve et affiche un état de synchronisation, sans transformer une panne réseau en anomalie. Ce seuil porte sur les poses reçues, pas une mesure parfaite de simultanéité entre appareils.

## Architecture et sûreté

Le cinquième support `lift` réutilise l’intention `prop` authentifiée et ses gardes de passage, présence, proximité, séquence et répétition. Les bornes de normalisation sont adaptées aux cinq supports, pour ne pas perdre le premier événement lors d’un rechargement. Les seuls champs diffusés restent l’identité de l’action, sa cible, son auteur, sa séquence, son horaire et sa position publique. Ni les neuf carillons ni le passager n’apparaissent dans le paquet public.

La géométrie du sas est identique entre perceptions. Les limites de locomotion restent inchangées ; le fond de cabine se situe derrière le mur découpé. Les battants coulissent derrière les jambages, et non par-dessus le terminal voisin. Les tests existants gardent tous leurs repères et leurs parcours.

## Contrôles ajoutés

`npm run test:lift` : temporisation des pas à 10/30/60/144 images/s, mouvements lents, reprise du mouvement, arrêt audio en pause, positions absentes ou périmées, changement de contexte, A/B, une/neuf sonneries, passager visible au-delà de dix secondes, clients arrivant tard, répétitions et persistance des cinq supports, PCM déterministe borné.

`npm run test:temporal` : vraie géométrie de cabine, battants, numéro 09 constant, visibilité privée et remise à zéro ; libération idempotente des ressources.

`npm run test:scene` : accès au support dans le décor complet, recul possible devant l’ascenseur, pas liés aux poses réelles, suspension après données réseau périmées. Les tests de scène restent CPU : aucun rendu de pixels n’est simulé en preuve de qualité visuelle.

`npm test`, radio, interfaces radio, acoustique, inspection, Chalet : non-régression. TypeScript, builds et archive à vérifier dans la CI de la révision livrée. Les preuves finales de CI et les empreintes doivent pointer le commit exact ; ce document ne prétend pas qu’un test encore non exécuté est passé.

## Excel et reste à produire

Classeur courant : `docs/PARALLAXE_Suivi_Courant_2026-11-11_Ascenseur.xlsx`.
115 cas en code / 120 conçus, 5 concepts absents, 600 entrées de suivi et 28 lots. Sources actuelles : `parallaxe-open-work-20261101.json`, `anomalies-gap-lift-20261111.json`, `ANOMALIES_RESTANTES_ASCENSEUR_20261111.csv`, `lift-delivery-20261111.json`. Les archives, y compris le classeur 112/8, sont conservées sans modification.

Restants : `radio_future`, `vent_whisper`, `hall_stretch`, `shadow_points`, `observatory_earth`. Les voix articulées, la projection d’ombre liée au corps, le confort de dilatation et le lieu d’observatoire exigent leurs propres implémentations. Aucun de ces cinq cas n’est annoncé jouable par ce lot.

## Limites

Pas de validation GPU physique, mesure FPS, écoute humaine, microphones, TURN entre réseaux, test coopératif humain ou lancement sous Windows. Les accessoires procéduraux ne sont pas des assets AAA certifiés. Ce lot n’est ni une fusion dans main ni un déploiement du site. Le ratio 115/120 indique la présence au catalogue, pas l’achèvement du jeu.
