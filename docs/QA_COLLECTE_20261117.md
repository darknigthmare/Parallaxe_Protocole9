# Consignes physiques et transfert — 17 novembre 2026

Base exacte : `c0c55acdea6246d4c5d118775b300e64c487434a`. Les travaux antérieurs restent en place. Suivi courant : `docs/current-delivery.json`.

## W26 / W25 — support matériel

Un porte-feuillet fixé au mur de l’entrée accompagne chacun des cinq lieux. L’objet est placé à gauche de la porte quand on se retourne vers l’entrée. Les feuilles SC-01, T9-01, AB-01, CH-01 et O9-01 réutilisent exactement les consignes originales. Le support est ciblé avec les commandes d’interaction existantes (clavier remappé, manette, tactile), puis le lecteur existant propose une conservation explicite. Le carnet conserve sa copie accessible, sans imposer cette recherche à tous les joueurs.

Conserver signifie garder une **copie personnelle**. Le feuillet reste au mur pour les autres inspecteurs et entre les passages. Aucune animation de main ou arrachement du papier n’est revendiquée. L’objet, son identifiant et son texte sont communs aux perceptions et ne donnent aucun diagnostic. L’interaction ne diffuse pas un nouveau ping inconnu au serveur. Un changement de contexte invalide le lecteur ouvert avant toute conservation.

Le support réutilise un seul ensemble de cinq meshes et cinquante triangles, hors de la limite de marche. Son dos rejoint les murs des cinq lieux, sa face est devant eux. Les textures d’identifiant sont créées à la première visite et réutilisées. Aucun nouveau miroir, obstacle, éclairage ou changement de dépendance. Les matériaux restent soumis à l’éclairage existant. Les tests de ressources protègent la destruction unique des géométries, matériaux et textures.

La suite de scène comporte sept nouveaux contrôles : vraie sélection dans chaque lieu avec raycast de la scène entière (pas seulement une liste d’interactions), conservation sous effets A/B et trois qualités, invalidation des phases et contextes. Le contrôle physique GPU reste séparé.

## W16 — format de sauvegarde v2

Le nouveau format `parallaxe-training-backup-v2` ajoute `fieldNotes` : uniquement les cinq identifiants autorisés, jamais les textes, noms, codes de salon, graines, consentements ou résultats cachés. Les exports de progression et d’anomalies restent présents. L’import du format v1 normalise ses champs vers v2 sans effacer les notes locales. Les découvertes et consignes sont fusionnées ; la progression est remplacée uniquement après l’aperçu et la confirmation déjà existants.

L’import lit les trois valeurs précédentes avant toute écriture, écrit son snapshot local puis tente de remplacer les trois clés. Un échec déclenche une tentative de restauration exacte. L’échec de cette restauration est explicitement annoncé. localStorage ne devient pas transactionnel et les onglets simultanés restent une recette ouverte. Les anciennes copies avant import, sans fieldNotes, restent récupérables. L’interface des Archives est rafraîchie après confirmation sans imposer un rechargement.

Huit régressions nouvelles échouent sur la source c0c55ac (20 anciens tests réussis, 8 nouveaux échoués) et passent après modification (28/28). Un contrôle supplémentaire exécute le vrai composant d’aperçu/confirmation. Les suites locales déjà exécutées restent sans erreur ; le typage complet et les trois builds sont exigés dans la CI du SHA livré.

## Recette navigateur permanente

`test:browser-records` conserve les cinq références et les fins, et ajoute un glissement souris réel vers le feuillet puis la vraie touche d’interaction. Aucun accès à l’objet interne du moteur ni oracle d’anomalie n’est utilisé pour sélectionner le support. Les captures supplémentaires montrent le support et son lecteur. La recette déclenche toujours une erreur d’écriture réelle sur le stockage du navigateur.

Le test lit les octets du Blob créé par le bouton d’export, importe ce fichier via le champ réel avec aperçu en lecture seule, confirme puis ouvre les Archives sans rechargement. Un ancien fichier v1 est également éprouvé. Les fixtures restent dans un profil de navigateur jetable ; elles ne deviennent ni données joueur ni points d’entrée de production.

## Suivi et limites

W16/W23/W25/W26/W28 avancent. Classeur cumulatif à douze onglets ; les dix onglets historiques hors Synthèse restent identiques. Les anciens fichiers XLSX, les 600 clés, les textes A/B, les règles et les skills sont conservés. Le validateur historique Dossiers contrôle désormais sa propre édition au lieu de supposer qu’elle restera la dernière.

Le succès d’un test logiciel ne certifie ni GPU physique, ni manette, téléphone, microphone, TURN ou Windows. Les salles et cinématiques N07–N09 restent à produire. La collecte d’autres objets narratifs reste distincte des copies de consignes. `hall_stretch` reste exclu ; 119/120 décrit le catalogue, pas l’achèvement global. Le résultat de la CI et la publication doivent être vérifiés sur la révision finale exacte.
