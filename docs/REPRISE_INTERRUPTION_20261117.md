# Reprise ciblée des interruptions — 17 novembre 2026

Point repris : `de30f8cd53f370c0474586318e5333b544132e6b`, sur `continuation/interruptions-20261116`, base main `712e886`. Les lots précédents ne sont pas recréés.

## Travail conservé et finalisé

Le lot réinitialise les commandes, le talkie et les lectures privées à la perte de WebGL. Il restaure l’environnement et les surfaces de rendu, garde la partie solo en pause jusqu’à une reprise volontaire et rejette les gestes tactiles invalides. La coopération n’est pas mise en pause globalement ; aucune autorisation de microphone n’est réactivée automatiquement.

La récupération a abouti au commit lisible `777076eed529b18ac4edf871b7da37a02f4e5f6a` après les corrections du harnais CDP : booléens au lieu de sérialisation DOM, délais bornés pour l’initialisation du rendu logiciel, appels de dessin observés sans synchroniser le pilote à chaque appel. Le run 44010561486 a exécuté les 648 contrôles nommés (630 jeu, 18 outillage), les trois compilations, les six étapes navigateur, les trois captures et le paquet extrait. Ce résultat ne constitue pas la réception finale de l’affichage : une erreur a été trouvée ensuite dans les captures.

## Défaut visuel effectivement trouvé

L’alerte technique et le fond de Pause avaient le même z-index 30. Le menu apparaissant plus tard dans le DOM recouvrait l’alerte. Les tests de présence et de focus passaient alors que le message et ses boutons étaient invisibles. La capture `02-context-lost.png` du run 44010561486 prouve ce défaut.

La feuille dédiée `app/graphics-recovery.css`, chargée après le thème par les deux points d’entrée, place l’alerte et son rappel au-dessus des panneaux. Une hauteur bornée et un défilement conservent les actions dans les petites fenêtres. Aucun changement de modèle, collision, texture ou réglage de résolution.

La recette navigateur vérifie désormais les cibles réellement atteintes par `elementFromPoint`, les clics CDP sur « Accéder aux menus » et le rappel, ainsi que la fenêtre émulée 390×400. Une simple présence DOM ne peut plus valider cet affichage. Les trois captures 1280×800 sont conservées. Les tests exécutent le jeu compilé, pas une maquette ni une page de démonstration.

## Sources, suivi et vérifications permanentes

Les workflows temporaires et les fragments de transport sont supprimés. La CI permanente exécute les interruptions, Chromium/SwiftShader et le validateur du nouveau classeur ; elle conserve aussi les rapports et captures en cas d’échec. Vérifier son résultat sur le commit final exact, pas sur le seul run de récupération.

Classeur documentaire conservé : `docs/PARALLAXE_Suivi_Interruptions_2026-11-16.xlsx`, dix onglets, et CSV `docs/CHANTIERS_INTERRUPTION_20261116.csv`. Le 16 novembre est sa date d’édition, le 17 celle de cette reprise. Les 600 clés, les huit onglets historiques hors Synthèse, les 28 lots et les 124 recettes QA restent conservés. W03, W11, W13, W14 et W23 avancent ; aucune clôture matérielle automatique. Les quinze classeurs précédents, les textes A/B, les skills et le verrouillage des dépendances sont inchangés.

## Limites de la recette

WebGL est exécuté avec SwiftShader dans Chromium sous Linux, pas sur GPU physique. La petite fenêtre est une émulation, pas un téléphone. Aucun essai de manette physique, lecteur d’écran, écoute humaine, microphone, TURN inter-réseaux ou lanceur Windows n’est certifié. Le scénario navigateur utilise une référence solo ; les règles coopératives restent couvertes séparément par les clients HTTP automatisés.

119/120 concepts restent intégrés. `hall_stretch` demeure hors tirage dans l’attente de sa condition de confort humain. Le succès de la CI ne prouve pas la publication Vercel : comparer le SHA de la production à celui livré.
