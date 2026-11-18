# Concordance (N07) · 18 novembre 2026

Depuis le bilan d’une **campagne gagnée sans erreur**, sélectionner **Voir l’épilogue · Concordance**. Les trois plans durent environ 18 secondes en lecture continue. Dans la salle de relève éclairée par le jour, trois relevés portent chacun un tronçon du même tracé rouge. C’est en joignant les feuilles que le trajet devient lisible.

Le compteur public des erreurs détermine l’accès au bouton. La séquence est facultative et chaque inspecteur la consulte localement. Le bilan, le diagnostic de l’équipe et les règles de victoire restent ceux de la campagne. N08 *Dossier 09* et N09 *Dernier témoin* restent à produire. La base de cette édition est le commit `e3b2436cb457e8d71eaf2264d95e65e400af44be`.

## Recette depuis le jeu

| Parcours | Résultat attendu |
| --- | --- |
| Viser le feuillet du hall par un glissement à la souris, relâcher puis appuyer sur la touche d’interaction. | La visée reste sur le feuillet après le relâchement. Un clic bref ou le bouton de capture permet toujours de verrouiller le pointeur. |
| Reprendre une campagne à huit validations dans une fenêtre paysage de 640 × 420. | Les commandes de l’accueil défilent entre l’en-tête et le pied de page. « Reprendre l’inspection » reste activable. |
| Gagner la campagne avec zéro erreur et ouvrir l’épilogue. | Le premier plan montre la salle du matin. Le dernier réunit les trois relevés. Chaque plan a une description en français. |
| Activer la réduction des mouvements avant la victoire. | La lecture démarre sur une image fixe. Les boutons permettent de parcourir les trois plans au rythme du joueur. |
| Choisir Pause, changer de plan ou revenir au bilan pendant la lecture. | Le plan choisi reste affiché en pause. Le retour au bilan conserve les compteurs de la victoire. |
| Épuiser la tolérance, gagner après une erreur ou gagner dans le mode lieu unique. | Le joueur reçoit le bilan correspondant et peut revenir à l’accueil. L’option Concordance est réservée à la campagne gagnée sans erreur. |
| Rendre indisponible le contexte graphique de l’épilogue. | Les trois descriptions restent consultables et le retour au bilan reste accessible. |
| Faire terminer la campagne à plusieurs et ouvrir l’épilogue sur un seul appareil. | Chacun choisit le moment de la lecture. Vérifier le retour au bilan, le confort et la compréhension du tracé auprès de chaque joueur. |

Les essais de confort sur GPU physique et de compréhension par plusieurs personnes restent ouverts. Pour rapprocher un rapport automatisé du jeu essayé, relever le SHA de sa compilation. Les captures du parcours et le résultat de la CI concernent uniquement cette révision.

## Classeur et registre cumulatif

L’onglet **Concordance** reprend les 28 chantiers et distingue les trois fiches narratives. W20 avance avec la salle, W26 avec la lecture des témoignages, W28 avec la nouvelle édition. Les anciennes éditions restent consultables. Le registre historique conserve ses 600 clés et la synthèse ses 124 recettes QA ouvertes.

Pour vérifier le classeur et le CSV de cette édition depuis la racine du dépôt, exécuter `python3 scripts/validate-concordance-workbook.py`. Le validateur compare chaque clé, les anciens onglets, les états cumulatifs et les résultats des formules. Le pointeur `docs/current-delivery.json` donne les chemins du dernier classeur et de son CSV.
